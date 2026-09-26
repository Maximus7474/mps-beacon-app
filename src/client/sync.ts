import config from '@common/config';
import { debuglog, isDebugEnabled, setDebugPushListener } from '@common/debug';
import type {
  Announcement,
  BeaconSnapshot,
  Channel,
  Company,
  EmployeeCompanyResponse,
  JobData,
  NewMessagePush,
} from '@common/types';
import * as cache from './cache';
import { triggerServerCallback } from './utils/callbacks';
import { getViewerPhone } from './viewer';

// ---------------------------------------------------------------------------
// Cache ⇄ NUI bridge
//
// The client cache (see cache.ts) is the source of truth for what the UI can
// display. It is passive: one pull per slice per session, then kept correct
// purely by the server pushes handled here. This module mirrors every change
// into the iframe and serves the snapshot the UI hydrates from on mount.
//
// The iframe is created on open and destroyed on close, so the UI can never be
// relied on to observe its own lifetime: the app opening is signalled by the
// `beaconapp:client:sync` callback, and `onOpen`/`onClose` in init.ts cover the
// phone closing the app.
// ---------------------------------------------------------------------------

/** NUI actions; the patch names mirror the server events that carry them. */
const ACTION = {
  company: 'beaconapp:updatecompany',
  announcement: 'beaconapp:updateannouncement',
  announcementRemoved: 'beaconapp:removeannouncement',
  employee: 'beaconapp:setemployeemode',
  newMessage: 'beaconapp:newmessage',
  hydrate: 'beaconapp:hydrate',
} as const;

let uiOpen = false;

/**
 * lb-phone custom-app iframes never receive `SendNUIMessage`: the phone only
 * forwards messages sent through its SendCustomAppMessage export, addressed to
 * the app identifier (lb-phone docs, "Sending a message to the UI"). Every
 * message to the web app therefore goes through here, in the exported
 * `{action, data}` shape the UI's useNuiEvent parses.
 */
const pushToNui = (message: Record<string, unknown>): void => {
  try {
    const resp = global.exports['lb-phone'].SendCustomAppMessage(config.Identifier, message) as
      | true
      | [false, string | undefined];

    const [ok, err] = Array.isArray(resp) ? resp : [true, undefined];

    if (!ok) debuglog(`[beaconapp:sync] SendCustomAppMessage failed: ${err ?? 'unknown error'}`);
  } catch (err) {
    console.error('[beaconapp] SendCustomAppMessage threw', err);
    console.error('[beaconapp] SendCustomAppMessage param', message);
  }
};

/**
 * Patches are sent unconditionally: a message with no page behind it is dropped
 * harmlessly, and the phone may keep the iframe alive while the app is closed —
 * where the update is wanted. The cache makes a missed patch recoverable either
 * way, because the next mount hydrates from it.
 */
const push = (action: string, data: unknown, revision: number): void => {
  debuglog(`[beaconapp:sync] push ${action} (rev ${revision})`);
  pushToNui({ action, data, revision });
};

/** Resolves the player's on-duty company from the framework's active group. */
const resolveEmployee = async (jobData: JobData | null): Promise<void> => {
  const group = jobData?.group;

  if (!group) {
    debuglog('[beaconapp:sync] groupupdate: no active group, disabling employee mode');
    cache.setEmployee({ enabled: false, companyId: null });
    return;
  }

  debuglog(`[beaconapp:sync] groupupdate: resolving company for group "${group}"`);

  try {
    const { companyId } = await triggerServerCallback<EmployeeCompanyResponse>('beaconapp:getemployeecompany', {
      group,
    });
    cache.setEmployee({ enabled: Boolean(companyId), companyId: companyId ?? null });
    debuglog(`[beaconapp:sync] employee mode -> ${companyId ?? 'none'}`);
  } catch (err) {
    console.error('[beaconapp] failed to resolve employee company', err);
    cache.setEmployee({ enabled: false, companyId: null });
  }
};

/**
 * A message arrived for a conversation. The cache is never invalidated (that
 * would force a refetch); the push is applied in place instead, and the full
 * row is only pulled when the cache holds nothing usable for the channel
 * (list never fetched, or a conversation the list predates).
 */
const applyNewMessage = async (push: NewMessagePush): Promise<void> => {
  const known = cache.getChannelById(push.channelId);

  if (known) {
    cache.applyChannel({
      ...known,
      lastMessagePreview: push.message.content,
      lastMessageAt: push.message.timestamp,
      // The recipient's counter goes up; the sender's was already zeroed
      // locally on send. Server truth wins on the next full pull.
      unreadCount: push.senderSide === 'user' ? known.unreadCount + 1 : known.unreadCount,
    });
    return;
  }

  const employee = cache.getEmployee();
  const companyKey = `company:${push.companyId}` as const;
  const viewerIsCustomer = push.senderSide === 'company' && getViewerPhone() === push.phoneNumber;
  const viewerIsEmployee = push.senderSide === 'user' || employee.enabled;

  if (viewerIsCustomer) await cache.fetchSliceIfMissing('personal');
  else if (viewerIsEmployee) await cache.fetchSliceIfMissing(companyKey);

  const channel = cache.getChannelById(push.channelId);
  if (channel) {
    // The pull itself may already carry the message (race with the insert);
    // the patch keeps it correct either way.
    cache.applyChannel({
      ...channel,
      lastMessagePreview: push.message.content,
      lastMessageAt: Math.max(push.message.timestamp, channel.lastMessageAt),
      unreadCount: push.senderSide === 'user' ? channel.unreadCount + 1 : channel.unreadCount,
    });
  } else {
    debuglog(`[beaconapp:sync] newmessage "${push.channelId}" not held by this viewer; cache unchanged`);
  }
};

/**
 * Subscribes to the server's pushes and mirrors every cache change into the NUI.
 * Call once, at client startup.
 */
export const initBeaconSync = (): void => {
  onNet('beaconapp:client:updatecompany', (company: Company) => {
    debuglog(`[beaconapp:client] recv updatecompany "${company?.id}"`);
    cache.applyCompany(company);
  });

  onNet('beaconapp:client:updateannouncement', (announcement: Announcement) => {
    debuglog(`[beaconapp:client] recv updateannouncement "${announcement?.id}" from "${announcement?.companyName}"`);
    cache.applyAnnouncement(announcement);

    // lb-phone notification for the new announcement. Wrapped so a bad export
    // shape can never take the cache push down with it.
    try {
      debuglog(`[beaconapp:client] lb-phone SendNotification for "${announcement?.title}"`);
      setTimeout(() => {
        global.exports['lb-phone'].SendNotification({
          app: config.Identifier,
          title: announcement.title,
          content: announcement.content,
        });
        debuglog('[beaconapp:client] lb-phone SendNotification returned without error');
      }, 5_000);
    } catch (err) {
      console.error('[beaconapp] lb-phone SendNotification failed', err);
    }
  });

  onNet('beaconapp:client:newmessage', (push: NewMessagePush) => {
    debuglog(`[beaconapp:client] recv newmessage "${push?.channelId}" from ${push?.senderSide ?? '?'}`);

    const phone = getViewerPhone();
    const recipientIsCustomer = push.senderSide === 'company' && phone === push.phoneNumber;
    const recipientIsCompany = push.senderSide === 'user';

    if (recipientIsCustomer || recipientIsCompany) {
      try {
        const company = cache.getCompanies().find((c) => c.id === push.companyId);
        const title = recipientIsCustomer ? (company?.name ?? 'New message') : 'New message';

        global.exports['lb-phone'].SendNotification({
          app: config.Identifier,
          title,
          content: push.message.content,
        });

        debuglog(`[beaconapp:client] lb-phone SendNotification for new message in "${push.channelId}"`);
      } catch (err) {
        console.error('[beaconapp] lb-phone SendNotification failed', err);
      }
    }

    void applyNewMessage(push);

    // The open thread (if any) appends from this push directly instead of
    // refetching; pages that are not showing it drop it harmlessly. Sent even
    // when the cache had nothing to patch, so the thread never misses a row.
    push(ACTION.newMessage, push, cache.getRevision());
  });

  onNet('beaconapp:client:removeannouncement', (data: { id?: string }) => {
    debuglog(`[beaconapp:client] recv removeannouncement "${data?.id}"`);
    if (typeof data?.id === 'string') cache.removeAnnouncement(data.id);
  });

  /**
   * Session reset: the server drops its runtime state and tells every client
   * to do the same (character changes, job changes, maintenance, …). The next
   * app open / page mount pulls fresh data; no refetch is triggered now.
   */
  onNet('beaconapp:client:clearcache', () => {
    debuglog('[beaconapp:client] recv clearcache');
    cache.clear();
    if (uiOpen) push(ACTION.hydrate, cache.getSnapshot(), cache.getRevision());
  });

  on('beaconapp:groupupdate', (jobData?: JobData | null) => {
    void resolveEmployee(jobData ?? null);
  });

  cache.subscribe((change, revision) => {
    if (change.kind !== 'slice') debuglog(`[beaconapp:sync] cache change ${change.kind} -> rev ${revision}`);

    switch (change.kind) {
      case 'company':
        push(ACTION.company, change.company, revision);
        break;
      case 'announcement':
        push(ACTION.announcement, change.announcement, revision);
        break;
      case 'announcementRemoved':
        push(ACTION.announcementRemoved, { id: change.id }, revision);
        break;
      case 'employee':
        push(ACTION.employee, change.employee, revision);
        break;
      case 'slice':
        // A fetch or patch landed after the iframe hydrated: replace the UI's
        // state wholesale so the open pages always mirror the cache exactly.
        if (uiOpen) push(ACTION.hydrate, cache.getSnapshot(), revision);
        break;
    }
  });

  // The web gate mirrors the convar; the listener is registered on the shared
  // debug module because that module cannot reach the NUI itself (custom-app
  // transport above). Carries no revision: it is not cache state, so it must
  // never be subject to the UI's stale-patch guard.
  setDebugPushListener((enabled: boolean) => {
    debuglog(`[beaconapp:sync] debugupdate push (${enabled ? 'on' : 'off'})`);
    pushToNui({ action: 'debugupdate', data: enabled });
  });

  $DEV: {
    (globalThis as Record<string, unknown>).__beaconCache = {
      dump: cache.dump,
      clear: cache.clear,
      snapshot: cache.getSnapshot,
    };
  }
};

/**
 * Answers `beaconapp:client:sync`, i.e. "give this freshly created iframe its
 * first frame".
 *
 * A warm cache answers immediately, so reopening the app paints in one IPC hop.
 * A cold cache has nothing to show, so the first fetch is awaited — that is the
 * only mount that should ever see a spinner.
 */
export const handleUiSync = async (): Promise<BeaconSnapshot> => {
  uiOpen = true;

  // The convar listener only fires on change, so a player who joined while
  // debug was already on would otherwise never learn the state.
  pushToNui({ action: 'debugupdate', data: isDebugEnabled() });

  const cold = !cache.hasData('companies') || !cache.hasData('announcements');
  debuglog(`[beaconapp:sync] UI sync requested (${cold ? 'cold' : 'warm'} cache)`);

  if (cold) await cache.fetchSliceIfMissing('companies', 'announcements');
  else void cache.fetchSliceIfMissing('companies', 'announcements');

  debuglog(`[beaconapp:sync] snapshot served at revision ${cache.getRevision()}`);

  return cache.getSnapshot();
};

/** The app was closed: no background work was running, so just note it. */
export const handleUiClosed = (): void => {
  debuglog('[beaconapp:sync] UI closed');
  uiOpen = false;
};
