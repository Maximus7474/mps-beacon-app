import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { fetchNui } from '~/utils/fetchNui';
import { useNuiEvent } from '~/hooks/useNuiEvent';
import { BeaconContext } from '~/hooks/useBeacon';
import { devMode } from '~/utils/utils';
import { debuglog, isDebugEnabled, setDebugEnabled } from '~/utils/debug';
import { SEED_ANNOUNCEMENTS, SEED_COMPANIES } from '@common/data/seed';
import type {
  AddAnnouncementPayload,
  AddPostPayload,
  Announcement,
  BasicResponse,
  BeaconSnapshot,
  Company,
  CompanyStatus,
  Post,
} from '@common/types';

function notify(message: string) {
  if (typeof sendNotification === 'function') {
    debuglog('[beaconapp:web] sendNotification ->', message);
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
  return [announcement, ...rest].sort((a, b) => b.createdAt - a.createdAt);
}

/** Dev stand-in for the client-runtime cache's snapshot (see src/client/cache.ts). */
const DEV_SNAPSHOT: BeaconSnapshot = {
  revision: 0,
  companies: SEED_COMPANIES,
  announcements: SEED_ANNOUNCEMENTS,
  employee: { enabled: false, companyId: null },
  channels: {},
};

export const BeaconProvider = ({ children }: { children: ReactNode }) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [employeeMode, setEmployeeModeState] = useState(false);
  const [employeeCompanyId, setEmployeeCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Highest cache revision applied. The revision counter is owned by the client
   * runtime cache and the iframe is rebuilt on every app open, so a patch that
   * predates the snapshot we hydrated from must be dropped rather than allowed
   * to clobber it.
   */
  const revisionRef = useRef(0);

  // Keep the debug gate in step with the client's convar.
  useNuiEvent<boolean>('debugupdate', (value) => setDebugEnabled(value));

  useEffect(() => {
    if (!isDebugEnabled()) return;
    debuglog('[beaconapp:web] provider state', {
      companies: companies.length,
      announcements: announcements.length,
      employeeMode,
      employeeCompanyId,
    });
  }, [companies, announcements, employeeMode, employeeCompanyId]);

  const isStale = useCallback((revision?: number) => {
    if (typeof revision !== 'number') return false;
    if (revision < revisionRef.current) return true;

    revisionRef.current = revision;
    return false;
  }, []);

  /**
   * A snapshot is the cache's complete state at the moment it was produced, so
   * it is always applied (it supersedes anything held locally). Only the
   * granular patches race with it, hence the `isStale` guard above.
   */
  const applySnapshot = useCallback((snapshot: BeaconSnapshot) => {
    revisionRef.current = Math.max(revisionRef.current, snapshot?.revision ?? 0);

    setCompanies(snapshot?.companies ?? []);
    setAnnouncements(snapshot?.announcements ?? []);
    setEmployeeModeState(Boolean(snapshot?.employee?.enabled));
    setEmployeeCompanyId(snapshot?.employee?.companyId ?? null);
    setLoading(false);
  }, []);

  // One round-trip per mount: the client runtime answers from its own cache, so
  // a reopened app paints immediately and state pushed while the app was closed
  // is still there. Data that is stale is refreshed in the background and
  // arrives as a `beaconapp:hydrate` push.
  useEffect(() => {
    let cancelled = false;

    debuglog('[beaconapp:web] mounting: requesting sync from client cache');

    fetchNui<BeaconSnapshot>('beaconapp:client:sync', undefined, DEV_SNAPSHOT)
      .then((snapshot) => {
        debuglog(
          `[beaconapp:web] sync received (rev ${snapshot?.revision}, ${snapshot?.companies?.length ?? 0} companies, ${snapshot?.announcements?.length ?? 0} announcements)`,
        );
        if (!cancelled) applySnapshot(snapshot);
      })
      .catch((err) => {
        console.error('[beaconapp] failed to sync with the client cache', err);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applySnapshot]);

  // In the browser there is no game server to push back an authoritative
  // update, so successful actions re-emit the same NUI event the server would
  // have sent. In-game this is a hard no-op — the server alone drives state.
  const confirmInDev = useCallback((action: string, data: unknown) => {
    if (!devMode) return;
    window.dispatchEvent(new MessageEvent('message', { data: { action, data } }));
  }, []);

  // Server → NUI: single-entity patches, plus whole-snapshot hydrates when the
  // client cache revalidated after this iframe mounted.
  useNuiEvent<BeaconSnapshot>('beaconapp:hydrate', (snapshot) => {
    debuglog(`[beaconapp:web] hydrate push (rev ${snapshot?.revision})`);
    applySnapshot(snapshot);
  });

  useNuiEvent<Company>('beaconapp:updatecompany', (company, message) => {
    debuglog(`[beaconapp:web] recv updatecompany "${company?.id}" (rev ${message.revision})`);
    if (isStale(message.revision)) {
      debuglog(`[beaconapp:web] dropped stale updatecompany (rev ${message.revision} <= ${revisionRef.current})`);
      return;
    }
    setCompanies((prev) => upsertCompany(prev, company));
  });

  useNuiEvent<Announcement>('beaconapp:updateannouncement', (announcement, message) => {
    debuglog(
      `[beaconapp:web] recv updateannouncement "${announcement?.id}" from "${announcement?.companyName}" (rev ${message.revision})`,
    );
    if (isStale(message.revision)) {
      debuglog(`[beaconapp:web] dropped stale updateannouncement (rev ${message.revision} <= ${revisionRef.current})`);
      return;
    }
    setAnnouncements((prev) => upsertAnnouncement(prev, announcement));
  });

  useNuiEvent<{ id?: string }>('beaconapp:removeannouncement', (data, message) => {
    debuglog(`[beaconapp:web] recv removeannouncement "${data?.id}" (rev ${message.revision})`);
    if (isStale(message.revision)) {
      debuglog(`[beaconapp:web] dropped stale removeannouncement (rev ${message.revision} <= ${revisionRef.current})`);
      return;
    }
    if (typeof data?.id === 'string') {
      setAnnouncements((prev) => prev.filter((a) => a.id !== data.id));
    }
  });

  useNuiEvent<{ enabled?: boolean; companyId?: string }>('beaconapp:setemployeemode', (data, message) => {
    debuglog(`[beaconapp:web] recv setemployeemode (rev ${message.revision}, enabled: ${data?.enabled})`);
    if (isStale(message.revision)) {
      debuglog(`[beaconapp:web] dropped stale setemployeemode (rev ${message.revision} <= ${revisionRef.current})`);
      return;
    }
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

  // Mutations

  const addAnnouncement = useCallback(
    async (payload: AddAnnouncementPayload) => {
      debuglog('[beaconapp:web] addAnnouncement ->', payload);
      try {
        const res = await fetchNui<BasicResponse>('beaconapp:addannouncement', payload, { success: true });
        debuglog('[beaconapp:web] addAnnouncement <-', res);
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
              createdAt: Date.now(),
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
      debuglog(`[beaconapp:web] deleteAnnouncement -> ${id}`);
      try {
        const res = await fetchNui<BasicResponse>('beaconapp:deleteannouncement', { id }, { success: true });
        debuglog('[beaconapp:web] deleteAnnouncement <-', res);
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
      debuglog('[beaconapp:web] addPost ->', { companyId, post });
      try {
        const res = await fetchNui<BasicResponse>('beaconapp:addpost', { companyId, post }, { success: true });
        debuglog('[beaconapp:web] addPost <-', res);
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
      debuglog(`[beaconapp:web] deletePost -> ${companyId}/${postId}`);
      try {
        const res = await fetchNui<BasicResponse>('beaconapp:deletepost', { companyId, postId }, { success: true });
        debuglog('[beaconapp:web] deletePost <-', res);
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
      debuglog(`[beaconapp:web] updateStatus -> ${companyId} = ${status}`);
      try {
        const res = await fetchNui<BasicResponse>(
          'beaconapp:setcompanystatus',
          { companyId, status },
          { success: true },
        );
        debuglog('[beaconapp:web] updateStatus <-', res);
        if (!res.success) {
          notify(res.message);
          return false;
        }

        if (devMode) {
          const company = companies.find((c) => c.id === companyId);
          if (company) {
            confirmInDev('beaconapp:updatecompany', { ...company, status, lastActiveAt: Date.now() });
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
