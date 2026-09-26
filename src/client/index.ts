import { debuglog, isDebugEnabled } from '../common/debug';
import type {
  AddAnnouncementPayload,
  AddPostRequest,
  Announcement,
  BasicResponse,
  BeaconSyncResponse,
  Channel,
  ChannelScope,
  Company,
  DeleteAnnouncementPayload,
  DeletePostRequest,
  GetChannelsRequest,
  GetMessagesRequest,
  GetOrCreateChannelRequest,
  GetOrCreateChannelResponse,
  Message,
  SendMessageRequest,
  SendMessageResponse,
  UpdateCompanyStatusRequest,
} from '../common/types';
import { channelSliceKey } from '../common/types';
import {
  applyChannel,
  applyChannelRead,
  fetchSliceIfMissing,
  getAnnouncements,
  getChannelById,
  getChannels,
  getCompanies,
  getEmployee,
} from './cache';
import { handleUiClosed, handleUiSync, initBeaconSync } from './sync';
import { triggerServerCallback } from './utils/callbacks';
import { waitForClientReady } from './utils/ready';
import './init';

// Server pushes are absorbed by the client cache and mirrored to the NUI from
// there (see sync.ts) — the iframe is rebuilt on every app open, so it can not
// be the place where state lives.
initBeaconSync();

const register = <T>(name: string, handler: (data: any) => Promise<T>, onError: T) => {
  RegisterNuiCallback(name, async (data: any, cb: (result: T) => void) => {
    debuglog(`[beaconapp:nui] callback '${name}'`);
    try {
      await waitForClientReady();
      const result = await handler(data);
      debuglog(`[beaconapp:nui] callback '${name}' ok`);
      cb(result);
    } catch (err) {
      console.error(`[beaconapp] NUI callback '${name}' failed`, err);
      cb(onError);
    }
  });
};

// Reads
//
// Every read is answered from the cache; a slice is only pulled from the
// server the first time it is needed this session. Server pushes (or local
// writes below) keep the slices correct afterwards — the UI never has to ask
// twice, and nothing polls.

register<Company[]>(
  'beaconapp:getcompanies',
  async () => {
    await fetchSliceIfMissing('companies');
    return getCompanies();
  },
  [],
);

register<Announcement[]>(
  'beaconapp:getannouncements',
  async () => {
    await fetchSliceIfMissing('announcements');
    return getAnnouncements();
  },
  [],
);

register<Channel[]>(
  'beaconapp:getchannels',
  async (data: GetChannelsRequest) => {
    const scope: ChannelScope = data?.scope === 'company' ? 'company' : 'personal';
    const companyId = scope === 'company' && typeof data?.companyId === 'string' ? data.companyId : undefined;
    if (scope === 'company' && !companyId) return [];

    const key = channelSliceKey(scope, companyId);
    await fetchSliceIfMissing(key);
    return getChannels(scope, companyId);
  },
  [],
);

/**
 * Resolves one conversation by its compound id (`<companyId>:<phone>`).
 * The stored row serves both sides, so both cached slices are pulled (only if
 * missing) and searched; the returned `scope` reflects the viewer's
 * perspective. Used by the conversation route, which only receives an id in
 * the URL.
 */
register<Channel | null>(
  'beaconapp:getchannel',
  async (data: { id?: string }) => {
    if (typeof data?.id !== 'string' || !data.id) return null;

    const companyId = data.id.split(':')[0];
    if (!companyId) return null;

    await fetchSliceIfMissing('personal', channelSliceKey('company', companyId));
    const channel = getChannelById(data.id);
    if (!channel) return null;

    // Perspective: an on-duty employee of the company views it as the business.
    const employee = getEmployee();
    return employee.enabled && employee.companyId === channel.companyId
      ? { ...channel, scope: 'company' as const }
      : { ...channel, scope: 'personal' as const };
  },
  null,
);

register<GetOrCreateChannelResponse>(
  'beaconapp:getorcreatechannel',
  async (data: GetOrCreateChannelRequest) => {
    const response = await triggerServerCallback<GetOrCreateChannelResponse>('beaconapp:getorcreatechannel', data);

    // First contact creates the pair, so the personal list gained a row; pull
    // it once if this session never fetched the list.
    if (response.success) void fetchSliceIfMissing('personal');

    return response;
  },
  { success: false, message: 'Unable to open the conversation' },
);

register<SendMessageResponse>(
  'beaconapp:sendmessage',
  async (data: SendMessageRequest) => {
    const response = await triggerServerCallback<SendMessageResponse>('beaconapp:sendmessage', data);

    if (response.success) {
      // The sender's own lists update in place: the confirmed row replaces the
      // optimistic one and the viewer's unread counter stays untouched. The
      // server's `newmessage` push to *other* clients carries the same fields
      // (sync.ts), so no refetch is needed on either side.
      const confirmed = response.message;
      const cached = getChannelById(confirmed.channelId);
      if (cached) {
        applyChannel({
          ...cached,
          lastMessagePreview: confirmed.content,
          lastMessageAt: confirmed.timestamp,
        });
      } else {
        // A channel the cache does not know (list not fetched / first contact)
        // appears with the next list pull; nothing to patch now.
        debuglog(`[beaconapp:nui] sendmessage: unknown channel '${confirmed.channelId}'; waiting for list pull`);
      }
    }

    return response;
  },
  { success: false, message: 'Unable to send the message' },
);

// Messages are still read straight through: per-channel history has no push
// event and is paged by the conversation view. Opening a thread also clears
// the local unread badge for the viewer's side — the server does the same
// bookkeeping (markChannelRead), so the next list pull agrees with the cache.
register<Message[]>(
  'beaconapp:getmessages',
  async (data: GetMessagesRequest) => {
    const rows = await triggerServerCallback<Message[]>('beaconapp:getmessages', data);

    if (typeof data?.channelId === 'string' && rows.length >= 0) {
      const channel = getChannelById(data.channelId);
      if (channel) {
        const employee = getEmployee();
        const scope: ChannelScope =
          employee.enabled && employee.companyId === channel.companyId ? 'company' : 'personal';
        applyChannelRead(data.channelId, scope);
      }
    }

    return rows;
  },
  [],
);

// Writes

register<BasicResponse>(
  'beaconapp:addannouncement',
  (data: AddAnnouncementPayload) => triggerServerCallback<BasicResponse>('beaconapp:addannouncement', data),
  { success: false, message: 'Unable to post announcement' },
);

register<BasicResponse>(
  'beaconapp:deleteannouncement',
  (data: DeleteAnnouncementPayload) => triggerServerCallback<BasicResponse>('beaconapp:deleteannouncement', data),
  { success: false, message: 'Unable to delete announcement' },
);

register<BasicResponse>(
  'beaconapp:addpost',
  (data: AddPostRequest) => triggerServerCallback<BasicResponse>('beaconapp:addpost', data),
  { success: false, message: 'Unable to add post' },
);

register<BasicResponse>(
  'beaconapp:deletepost',
  (data: DeletePostRequest) => triggerServerCallback<BasicResponse>('beaconapp:deletepost', data),
  { success: false, message: 'Unable to delete post' },
);

register<BasicResponse>(
  'beaconapp:setcompanystatus',
  (data: UpdateCompanyStatusRequest) => triggerServerCallback<BasicResponse>('beaconapp:setcompanystatus', data),
  { success: false, message: 'Unable to update status' },
);

// UI lifecycle

RegisterNuiCallback('beaconapp:client:sync', async (_data: unknown, cb: (result: BeaconSyncResponse) => void) => {
  debuglog("[beaconapp:nui] callback 'beaconapp:client:sync'");
  cb(await handleUiSync());
});

RegisterNuiCallback('beaconapp:client:uiclosed', (_data: unknown, cb: (result: string) => void) => {
  debuglog("[beaconapp:nui] callback 'beaconapp:client:uiclosed'");
  handleUiClosed();
  cb('ok');
});
