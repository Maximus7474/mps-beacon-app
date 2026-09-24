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
// Freshness model:
//  * pushes (`beaconapp:client:update*`) patch the cache in place. They are
//    applied whether or not the UI is open, which is what makes state pushed
//    while the app was closed show up on the next mount.
//  * reads revalidate on a TTL and are single-flight, so N mounts, N tab
//    switches and N timer ticks collapse into a single server round-trip.
// ---------------------------------------------------------------------------

/** Revalidation windows (ms). Pushes keep these slices correct in between. */
const TTL = {
  companies: 120_000,
  announcements: 120_000,
  channels: 30_000,
} as const;

export type CacheKey = 'companies' | 'announcements' | ChannelSliceKey;

type Slice<T> = {
  data: T;
  /** Epoch ms of the last successful fetch; 0 means "never fetched". */
  fetchedAt: number;
  /**
   * True when the slice only ever accumulated pushes and was never fetched in
   * full and it is always revalidated before being served as fresh.
   */
  partial: boolean;
};

/** What changed, so the NUI bridge can pick between a patch and a full hydrate. */
export type CacheChange =
  | { kind: 'company'; company: Company }
  | { kind: 'announcement'; announcement: Announcement }
  | { kind: 'announcementRemoved'; id: string }
  | { kind: 'employee'; employee: EmployeeState }
  | { kind: 'slice'; key: CacheKey };

// State

const companies: Slice<Company[]> = { data: [], fetchedAt: 0, partial: false };
const announcements: Slice<Announcement[]> = { data: [], fetchedAt: 0, partial: false };
const channels = new Map<ChannelSliceKey, Slice<Channel[]>>();
let employee: EmployeeState = { enabled: false, companyId: null };

/**
 * Bumped on every mutation and owned by the client, so a patch can never be
 * older than the snapshot the UI hydrated from.
 */
let revision = 0;

/** Single-flight guard: at most one in-flight fetch per slice. */
const inflight = new Map<CacheKey, Promise<void>>();
/** Slices known to be out of date (a mutation we could not apply fully). */
const dirtyKeys = new Set<CacheKey>();
const listeners = new Set<(change: CacheChange, revision: number) => void>();

const isChannelKey = (key: CacheKey): key is ChannelSliceKey => key === 'personal' || key.startsWith('company:');

const ttlFor = (key: CacheKey): number =>
  isChannelKey(key) ? TTL.channels : key === 'companies' ? TTL.companies : TTL.announcements;

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

/** A patch arriving before the first fetch means we only hold part of the set. */
const markPartialIfUnfetched = (slice: Slice<unknown>) => {
  if (slice.fetchedAt === 0) slice.partial = true;
};

export const applyCompany = (company: Company): number => {
  companies.data = upsert(companies.data, company);
  markPartialIfUnfetched(companies);
  return bump({ kind: 'company', company });
};

export const applyAnnouncement = (announcement: Announcement): number => {
  announcements.data = [...announcements.data.filter((a) => a.id !== announcement.id), announcement].sort(
    (a, b) => b.createdAt - a.createdAt,
  );
  markPartialIfUnfetched(announcements);
  return bump({ kind: 'announcement', announcement });
};

export const removeAnnouncement = (id: string): number => {
  announcements.data = announcements.data.filter((a) => a.id !== id);
  markPartialIfUnfetched(announcements);
  return bump({ kind: 'announcementRemoved', id });
};

/** No-op when nothing changed, so a repeated group update causes no traffic. */
export const setEmployee = (next: EmployeeState): number => {
  if (next.enabled === employee.enabled && next.companyId === employee.companyId) return revision;
  employee = next;
  return bump({ kind: 'employee', employee });
};

export const subscribe = (listener: (change: CacheChange, revision: number) => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// Reads

export const getRevision = (): number => revision;

export const getCompanies = (): Company[] => companies.data;

export const getAnnouncements = (): Announcement[] => announcements.data;

export const getChannels = (scope: ChannelScope, companyId?: string): Channel[] =>
  getChannelSlice(scope, companyId)?.data ?? [];

/** Scope keys that have already been fetched; used by the revalidation timer. */
export const channelKeys = (): ChannelSliceKey[] => [...channels.keys()];

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

// Revalidation

const isFresh = (key: CacheKey): boolean => {
  const slice = sliceFor(key);
  if (!slice || slice.fetchedAt === 0 || slice.partial) return false;
  if (dirtyKeys.has(key)) return false;
  return Date.now() - slice.fetchedAt < ttlFor(key);
};

const fetchSlice = async (key: CacheKey): Promise<void> => {
  if (key === 'companies') {
    companies.data = await triggerServerCallback<Company[]>('beaconapp:getcompanies');
    companies.fetchedAt = Date.now();
    companies.partial = false;
    debuglog(`[beaconapp:cache] companies fetched (${companies.data.length})`);
    // A revalidated set can differ from what the UI already painted, so the
    // change is announced like any other (the bridge turns it into a hydrate
    // push while the app is open; while closed it is recoverable on mount).
    bump({ kind: 'slice', key });
    return;
  }

  if (key === 'announcements') {
    announcements.data = await triggerServerCallback<Announcement[]>('beaconapp:getannouncements');
    announcements.fetchedAt = Date.now();
    announcements.partial = false;
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

  channels.set(key, { data: rows, fetchedAt: Date.now(), partial: false });
  debuglog(`[beaconapp:cache] channels fetched (${key}, ${rows.length})`);
  bump({ kind: 'slice', key });
};

const refresh = (key: CacheKey, force: boolean): Promise<void> => {
  const running = inflight.get(key);
  if (running) return running; // single-flight: share the round-trip
  if (!force && isFresh(key)) return Promise.resolve();

  const task = fetchSlice(key)
    .catch((err) => {
      // Keep whatever we already hold; the next mount or TTL tick retries.
      dirtyKeys.add(key);
      debuglog(`[beaconapp:cache] refresh failed (${key})`, err);
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, task);
  return task;
};

/** Drops the cached list for a slice without touching the others. */
export const invalidate = (...keys: CacheKey[]): void => {
  for (const key of keys) {
    dirtyKeys.add(key);
    debuglog(`[beaconapp:cache] invalidated (${key})`);
  }
};

export const invalidateChannels = (scope: ChannelScope, companyId?: string): void =>
  invalidate(channelSliceKey(scope, companyId));

/**
 * Revalidate slices that are missing, partial or past their TTL. Safe to call
 * on every mount / navigation / timer tick.
 */
export const ensureFresh = async (...keys: CacheKey[]): Promise<void> => {
  await Promise.all(keys.map((key) => refresh(key, false)));
};

/**
 * Revalidate regardless of TTL — used right after a local mutation that the
 * broadcast cannot fully describe.
 */
export const ensureFreshNow = async (...keys: CacheKey[]): Promise<void> => {
  await Promise.all(keys.map((key) => refresh(key, true)));
};

/** True when the slice is present and still within its TTL. */
export const isCached = (key: CacheKey): boolean => isFresh(key);

/** True once the slice has been fetched from the server at least once. */
export const hasData = (key: CacheKey): boolean => (sliceFor(key)?.fetchedAt ?? 0) > 0;

/** Reset for a new session (resource restart, player unload, dev tooling). */
export const clear = (): void => {
  companies.data = [];
  companies.fetchedAt = 0;
  companies.partial = false;
  announcements.data = [];
  announcements.fetchedAt = 0;
  announcements.partial = false;
  channels.clear();
  dirtyKeys.clear();
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
  companies: { count: companies.data.length, fetchedAt: companies.fetchedAt, partial: companies.partial },
  announcements: {
    count: announcements.data.length,
    fetchedAt: announcements.fetchedAt,
    partial: announcements.partial,
  },
  channels: [...channels].map(([key, slice]) => ({ key, count: slice.data.length, fetchedAt: slice.fetchedAt })),
  inflight: [...inflight.keys()],
  dirty: [...dirtyKeys],
});
