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
import { ensureFresh, getAnnouncements, getChannels, getCompanies, invalidateChannels } from './cache';
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
 * Channel ids are deterministic (`<scope>:<companyId>:<phone>`), so the scope
 * of a conversation can be read straight off the id.
 */
const invalidateChannelsFor = (channelId?: string): void => {
  const [scope, companyId] = typeof channelId === 'string' ? channelId.split(':') : [];

  if (scope === 'company' && companyId) invalidateChannels('company', companyId);
  else invalidateChannels('personal');
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

    // There is no message push event yet, so the preview/time of the affected
    // list has to be re-read rather than patched.
    if (response.success) invalidateChannelsFor(data?.channelId);

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

// Flips the `beaconapp:debug` convar from the dev panel. The convar is owned
// by the server and replicated down, so both sides' AddConvarChangeListener
// fire and the web app receives `debugupdate` — one toggle drives every log.
RegisterNuiCallback('beaconapp:client:debugtoggle', (_data: unknown, cb: (result: string) => void) => {
  debuglog(`[beaconapp:nui] debugtoggle (currently ${isDebugEnabled() ? 'on' : 'off'}) -> asking server to flip`);
  emitNet('beaconapp:server:debugtoggle');
  cb('ok');
});
