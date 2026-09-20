import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { fetchNui } from '~/utils/fetchNui';
import { useNuiEvent } from '~/hooks/useNuiEvent';
import { BeaconContext } from '~/hooks/useBeacon';
import { devMode } from '~/utils/utils';
import { SEED_ANNOUNCEMENTS, SEED_COMPANIES } from '@common/data/seed';
import type {
  AddAnnouncementPayload,
  AddPostPayload,
  Announcement,
  BasicResponse,
  Company,
  CompanyStatus,
  Post,
} from '@common/types';

function notify(message: string) {
  if (typeof sendNotification === 'function') {
    sendNotification({ title: 'Beacon', content: message });
  } else {
    console.warn('[beaconapp]', message);
  }
}

const tmpId = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

// Server-authoritative reducers. Shared by the live NUI events and the browser
// dev-mode simulation so both follow the exact same path.
function upsertCompany(list: Company[], company: Company): Company[] {
  const index = list.findIndex((c) => c.id === company.id);
  if (index === -1) return [...list, company];
  const next = [...list];
  next[index] = company;
  return next;
}

function upsertAnnouncement(list: Announcement[], announcement: Announcement): Announcement[] {
  const rest = list.filter((a) => a.id !== announcement.id);
  return [announcement, ...rest].sort((a, b) => a.minutesAgo - b.minutesAgo);
}

export const BeaconProvider = ({ children }: { children: ReactNode }) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [employeeMode, setEmployeeModeState] = useState(false);
  const [employeeCompanyId, setEmployeeCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [nextCompanies, nextAnnouncements] = await Promise.all([
      fetchNui<Company[]>('beaconapp:getcompanies', undefined, SEED_COMPANIES),
      fetchNui<Announcement[]>('beaconapp:getannouncements', undefined, SEED_ANNOUNCEMENTS),
    ]);

    setCompanies(nextCompanies);
    setAnnouncements(nextAnnouncements);
  }, []);

  useEffect(() => {
    loadData()
      .catch((err) => console.error('[beaconapp] failed to load data', err))
      .finally(() => setLoading(false));
  }, [loadData]);

  // In the browser there is no game server to push back an authoritative
  // update, so successful actions re-emit the same NUI event the server would
  // have sent. In-game this is a hard no-op — the server alone drives state.
  const confirmInDev = useCallback((action: string, data: unknown) => {
    if (!devMode) return;
    window.dispatchEvent(new MessageEvent('message', { data: { action, data } }));
  }, []);

  // Server → NUI live updates (single-entity payloads; no full-array re-sync)
  useNuiEvent<Company>('beaconapp:updatecompany', (company) => {
    setCompanies((prev) => upsertCompany(prev, company));
  });

  useNuiEvent<Announcement>('beaconapp:updateannouncement', (announcement) => {
    setAnnouncements((prev) => upsertAnnouncement(prev, announcement));
  });

  useNuiEvent<{ id?: string }>('beaconapp:removeannouncement', (data) => {
    if (typeof data?.id === 'string') {
      setAnnouncements((prev) => prev.filter((a) => a.id !== data.id));
    }
  });

  useNuiEvent<{ enabled?: boolean; companyId?: string }>('beaconapp:setemployeemode', (data) => {
    const enabled = Boolean(data?.enabled);
    setEmployeeModeState(enabled);
    setEmployeeCompanyId(enabled && typeof data?.companyId === 'string' ? data.companyId : null);
  });

  // Dev tooling: toggling employee mode without a game push defaults to the first company
  const setEmployeeMode = useCallback(
    (value: boolean) => {
      setEmployeeModeState(value);
      setEmployeeCompanyId((prev) => (value ? (prev ?? companies[0]?.id ?? null) : null));
    },
    [companies],
  );

  // ---------------------------------------------------------------------------
  // Mutations
  //
  // No optimistic state: every action waits for server validation, then the UI
  // is updated by the authoritative NUI event the server broadcasts. Denials
  // return `false` and surface the server's message without touching state.
  // ---------------------------------------------------------------------------

  const addAnnouncement = useCallback(
    async (payload: AddAnnouncementPayload) => {
      try {
        const res = await fetchNui<BasicResponse>('beaconapp:addannouncement', payload, { success: true });
        if (!res.success) {
          notify(res.message);
          return false;
        }

        if (devMode) {
          const company = companies.find((c) => c.id === payload.companyId);
          if (company) {
            const announcement: Announcement = {
              id: tmpId('a'),
              companyId: company.id,
              companyName: company.name,
              companyIcon: company.icon,
              companyIconBg: company.iconBg,
              companyImage: company.image,
              type: payload.type,
              title: payload.title,
              content: payload.content,
              minutesAgo: 0,
            };
            confirmInDev('beaconapp:updateannouncement', announcement);
          }
        }
        return true;
      } catch (err) {
        console.error('[beaconapp] addAnnouncement failed', err);
        return false;
      }
    },
    [companies, confirmInDev],
  );

  const deleteAnnouncement = useCallback(
    async (id: string) => {
      try {
        const res = await fetchNui<BasicResponse>('beaconapp:deleteannouncement', { id }, { success: true });
        if (!res.success) {
          notify(res.message);
          return false;
        }

        confirmInDev('beaconapp:removeannouncement', { id });
        return true;
      } catch (err) {
        console.error('[beaconapp] deleteAnnouncement failed', err);
        return false;
      }
    },
    [confirmInDev],
  );

  const addPost = useCallback(
    async (companyId: string, post: AddPostPayload) => {
      try {
        const res = await fetchNui<BasicResponse>('beaconapp:addpost', { companyId, post }, { success: true });
        if (!res.success) {
          notify(res.message);
          return false;
        }

        if (devMode) {
          const company = companies.find((c) => c.id === companyId);
          if (company) {
            const nextPost: Post = {
              id: tmpId('p'),
              type: post.type,
              title: post.title,
              content: post.content,
              price: post.price,
              timestamp: Date.now(),
            };
            confirmInDev('beaconapp:updatecompany', { ...company, posts: [...company.posts, nextPost] });
          }
        }
        return true;
      } catch (err) {
        console.error('[beaconapp] addPost failed', err);
        return false;
      }
    },
    [companies, confirmInDev],
  );

  const deletePost = useCallback(
    async (companyId: string, postId: string) => {
      try {
        const res = await fetchNui<BasicResponse>('beaconapp:deletepost', { companyId, postId }, { success: true });
        if (!res.success) {
          notify(res.message);
          return false;
        }

        if (devMode) {
          const company = companies.find((c) => c.id === companyId);
          if (company) {
            confirmInDev('beaconapp:updatecompany', {
              ...company,
              posts: company.posts.filter((p) => p.id !== postId),
            });
          }
        }
        return true;
      } catch (err) {
        console.error('[beaconapp] deletePost failed', err);
        return false;
      }
    },
    [companies, confirmInDev],
  );

  const updateStatus = useCallback(
    async (companyId: string, status: CompanyStatus) => {
      try {
        const res = await fetchNui<BasicResponse>(
          'beaconapp:setcompanystatus',
          { companyId, status },
          { success: true },
        );
        if (!res.success) {
          notify(res.message);
          return false;
        }

        if (devMode) {
          const company = companies.find((c) => c.id === companyId);
          if (company) {
            confirmInDev('beaconapp:updatecompany', { ...company, status, lastActiveMinutes: 0 });
          }
        }
        return true;
      } catch (err) {
        console.error('[beaconapp] updateStatus failed', err);
        return false;
      }
    },
    [companies, confirmInDev],
  );

  return (
    <BeaconContext.Provider
      value={{
        companies,
        announcements,
        employeeMode,
        employeeCompanyId,
        loading,
        setEmployeeMode,
        addAnnouncement,
        deleteAnnouncement,
        addPost,
        deletePost,
        updateStatus,
      }}
    >
      {children}
    </BeaconContext.Provider>
  );
};
