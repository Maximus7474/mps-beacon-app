import { debuglog } from '@common/debug';
import {
  type Announcement,
  type BeaconSnapshot,
  type Channel,
  type ChannelScope,
  type ChannelSliceKey,
  type Company,
  type EmployeeState,
  channelSliceKey,
} from '@common/types';
import { triggerServerCallback } from './utils/callbacks';

// ---------------------------------------------------------------------------
// Freshness model (passive):
//  * The UI pulls once per mount and is then kept correct by server pushes.
//  * Reads are served straight from this cache; nothing here ever polls,
//    revalidates or expires — a slice is fetched at most once per session.
//  * Cache reset (`clear`, or the `beaconapp:clearcache` server event) wipes
//    everything; the next mount pulls fresh data (character/job changes etc).
// ---------------------------------------------------------------------------

export type CacheKey = 'companies' | 'announcements' | ChannelSliceKey;

type Slice<T> = {
  data: T;
  /** True once the slice has been fetched from the server this session. */
  loaded: boolean;
};

/** What changed, so the NUI bridge can pick between a patch and a full hydrate. */
export type CacheChange =
  | { kind: 'company'; company: Company }
  | { kind: 'announcement'; announcement: Announcement }
  | { kind: 'announcementRemoved'; id: string }
  | { kind: 'employee'; employee: EmployeeState }
  | { kind: 'slice'; key: CacheKey };

// State

const companies: Slice<Company[]> = { data: [], loaded: false };
const announcements: Slice<Announcement[]> = { data: [], loaded: false };
const channels = new Map<ChannelSliceKey, Slice<Channel[]>>();
let employee: EmployeeState = { enabled: false, companyId: null };

/**
 * Bumped on every mutation and owned by the client, so a patch can never be
 * older than the snapshot the UI hydrated from.
 */
let revision = 0;

/** Single-flight guard: at most one in-flight fetch per slice. */
const inflight = new Map<CacheKey, Promise<void>>();
const listeners = new Set<(change: CacheChange, revision: number) => void>();

const isChannelKey = (key: CacheKey): key is ChannelSliceKey => key === 'personal' || key.startsWith('company:');

const sliceFor = (key: CacheKey): Slice<unknown> | undefined =>
  key === 'companies' ? companies : key === 'announcements' ? announcements : channels.get(key);

const getChannelSlice = (scope: ChannelScope, companyId?: string): Slice<Channel[]> | undefined =>
  channels.get(channelSliceKey(scope, companyId));

// Reducers

const upsert = <T extends { id: string }>(list: T[], item: T): T[] => {
  const index = list.findIndex((entry) => entry.id === item.id);
  if (index === -1) return [...list, item];
  const next = [...list];
  next[index] = item;
  return next;
};

const bump = (change: CacheChange): number => {
  revision += 1;
  for (const listener of listeners) listener(change, revision);
  return revision;
};

export const applyCompany = (company: Company): number => {
  companies.data = upsert(companies.data, company);
  return bump({ kind: 'company', company });
};

export const applyAnnouncement = (announcement: Announcement): number => {
  announcements.data = [...announcements.data.filter((a) => a.id !== announcement.id), announcement].sort(
    (a, b) => b.createdAt - a.createdAt,
  );
  return bump({ kind: 'announcement', announcement });
};

export const removeAnnouncement = (id: string): number => {
  announcements.data = announcements.data.filter((a) => a.id !== id);
  return bump({ kind: 'announcementRemoved', id });
};

/** No-op when nothing changed, so a repeated group update causes no traffic. */
export const setEmployee = (next: EmployeeState): number => {
  if (next.enabled === employee.enabled && next.companyId === employee.companyId) return revision;
  employee = next;
  return bump({ kind: 'employee', employee });
};

/**
 * Idempotent patch for one conversation. Applied to the cached list (only when
 * it was fetched at least once — a list that was never read stays empty until
 * its first pull) and mirrored by the bridge.
 */
export const applyChannel = (channel: Channel): number => {
  const slice = channels.get(channelSliceKey(channel.scope, channel.companyId));
  if (slice) slice.data = upsert(slice.data, channel);
  return bump({ kind: 'slice', key: channelSliceKey(channel.scope, channel.companyId) });
};

/** Zeroes the unread counter on one side of a conversation, in place. */
export const applyChannelRead = (channelId: string, readerScope: ChannelScope): number => {
  const slice = channels.get(channelSliceKey(readerScope));
  const channel = slice?.data.find((c) => c.id === channelId);
  if (channel && channel.unreadCount > 0) {
    channel.unreadCount = 0;
    return bump({ kind: 'slice', key: channelSliceKey(readerScope) });
  }
  return revision;
};

export const subscribe = (listener: (change: CacheChange, revision: number) => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// Reads

export const getRevision = (): number => revision;

export const getEmployee = (): EmployeeState => employee;

export const getCompanies = (): Company[] => companies.data;

export const getAnnouncements = (): Announcement[] => announcements.data;

export const getChannels = (scope: ChannelScope, companyId?: string): Channel[] =>
  getChannelSlice(scope, companyId)?.data ?? [];

/** Looks a channel up by id across the channel slices that have been fetched. */
export const getChannelById = (id: string): Channel | undefined => {
  for (const slice of channels.values()) {
    const channel = slice.data.find((entry) => entry.id === id);
    if (channel) return channel;
  }
  return undefined;
};

/**
 * Everything the NUI needs. The arrays are handed over by reference because the
 * payload is serialised straight into the lb-phone app-message push (see
 * sync.ts); do not mutate them.
 */
export const getSnapshot = (): BeaconSnapshot => ({
  revision,
  companies: companies.data,
  announcements: announcements.data,
  employee,
  channels: Object.fromEntries([...channels].map(([key, slice]) => [key, slice.data])),
});

// Fetching (one-shot per session slice)

const fetchSlice = async (key: CacheKey): Promise<void> => {
  if (key === 'companies') {
    companies.data = await triggerServerCallback<Company[]>('beaconapp:getcompanies');
    companies.loaded = true;
    debuglog(`[beaconapp:cache] companies fetched (${companies.data.length})`);
    bump({ kind: 'slice', key });
    return;
  }

  if (key === 'announcements') {
    announcements.data = await triggerServerCallback<Announcement[]>('beaconapp:getannouncements');
    announcements.loaded = true;
    debuglog(`[beaconapp:cache] announcements fetched (${announcements.data.length})`);
    bump({ kind: 'slice', key });
    return;
  }

  const companyId = key.startsWith('company:') ? key.slice('company:'.length) : undefined;
  const scope: ChannelScope = companyId ? 'company' : 'personal';
  const rows = await triggerServerCallback<Channel[]>('beaconapp:getchannels', {
    scope,
    companyId: companyId || undefined,
  });

  channels.set(key, { data: rows, loaded: true });
  debuglog(`[beaconapp:cache] channels fetched (${key}, ${rows.length})`);
  bump({ kind: 'slice', key });
};

/** At most one in-flight fetch per slice; repeat callers share the round-trip. */
const fetch = (key: CacheKey): Promise<void> => {
  const running = inflight.get(key);
  if (running) return running;

  const task = fetchSlice(key)
    .catch((err) => {
      // Keep whatever we hold (possibly nothing); the next mount retries.
      debuglog(`[beaconapp:cache] fetch failed (${key})`, err);
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, task);
  return task;
};

export const fetchSliceIfMissing = async (...keys: CacheKey[]): Promise<void> => {
  await Promise.all(
    keys.map(async (key) => {
      if (!sliceFor(key)?.loaded) {
        await fetch(key);
      }
    }),
  );
};

/** True once the slice has been fetched from the server at least once. */
export const hasData = (key: CacheKey): boolean => sliceFor(key)?.loaded ?? false;

/**
 * Cache reset for a new session: character swap, job change, resource
 * maintenance, dev tooling. Everything is dropped and the next mount pulls it
 * again; the running UI (if any) gets a full hydrate from the empty state and
 * refetches on its next navigation or app open.
 */
export const clear = (): void => {
  companies.data = [];
  companies.loaded = false;
  announcements.data = [];
  announcements.loaded = false;
  channels.clear();
  inflight.clear();
  employee = { enabled: false, companyId: null };
  // The counter is only ever compared against a snapshot the UI already holds,
  // and that iframe is gone by the time a session is cleared.
  revision = 0;
  debuglog('[beaconapp:cache] cleared');
};

/** Console inspection helper, exposed in dev builds as `__beaconCache.dump()`. */
export const dump = () => ({
  revision,
  employee,
  companies: { count: companies.data.length, loaded: companies.loaded },
  announcements: { count: announcements.data.length, loaded: announcements.loaded },
  channels: [...channels].map(([key, slice]) => ({ key, count: slice.data.length, loaded: slice.loaded })),
  inflight: [...inflight.keys()],
});
