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
  ensureFresh,
  getAnnouncements,
  getChannelById,
  getChannels,
  getCompanies,
  getEmployee,
  invalidateChannels,
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

/**
 * One conversation row serves both sides, so a change to it invalidates both
 * lists the viewer might have rendered it in. Channel ids are the compound
 * conversation key (`<companyId>:<phone>`).
 */
const invalidateChannelsFor = (channelId?: string): void => {
  const companyId = typeof channelId === 'string' ? channelId.split(':')[0] : undefined;

  invalidateChannels('personal');
  if (companyId) invalidateChannels('company', companyId);
};

// Reads

register<Company[]>(
  'beaconapp:getcompanies',
  async () => {
    await ensureFresh('companies');
    return getCompanies();
  },
  [],
);

register<Announcement[]>(
  'beaconapp:getannouncements',
  async () => {
    await ensureFresh('announcements');
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

    await ensureFresh(channelSliceKey(scope, companyId));
    return getChannels(scope, companyId);
  },
  [],
);

/**
 * Resolves one conversation by its compound id (`<companyId>:<phone>`).
 * The stored row serves both sides, so both cached slices are revalidated
 * and searched; the returned `scope` reflects the viewer's perspective.
 * Used by the conversation route, which only receives an id in the URL.
 */
register<Channel | null>(
  'beaconapp:getchannel',
  async (data: { id?: string }) => {
    if (typeof data?.id !== 'string' || !data.id) return null;

    const companyId = data.id.split(':')[0];
    if (!companyId) return null;

    await ensureFresh('personal', channelSliceKey('company', companyId));
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

    // First contact creates the pair, so the personal list gained a row.
    if (response.success && response.created) invalidateChannels('personal');

    return response;
  },
  { success: false, message: 'Unable to open the conversation' },
);

register<SendMessageResponse>(
  'beaconapp:sendmessage',
  async (data: SendMessageRequest) => {
    const response = await triggerServerCallback<SendMessageResponse>('beaconapp:sendmessage', data);

    // The sender's own lists must reflect the new preview/time at once: drop
    // the affected slices and refetch them in the background, which lands as a
    // hydrate push and refreshes any open list or thread.
    if (response.success) {
      invalidateChannelsFor(data?.channelId);
      const companyId = typeof data?.channelId === 'string' ? data.channelId.split(':')[0] : undefined;
      void ensureFresh('personal', ...(companyId ? ([channelSliceKey('company', companyId)] as const) : []));
    }

    return response;
  },
  { success: false, message: 'Unable to send the message' },
);

// Messages are still read straight through: per-channel history has no push
// event and is paged by the conversation view.
register<Message[]>(
  'beaconapp:getmessages',
  (data: GetMessagesRequest) => triggerServerCallback<Message[]>('beaconapp:getmessages', data),
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
