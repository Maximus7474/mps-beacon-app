import config from '../common/config';
import { debuglog } from '../common/debug';
import { isDebugEnabled } from '../common/debug';
import type {
  AddAnnouncementPayload,
  AddPostRequest,
  Announcement,
  AnnouncementType,
  BasicResponse,
  Channel,
  ChannelScope,
  Company,
  CompanyStatus,
  DeleteAnnouncementPayload,
  DeletePostRequest,
  EmployeeCompanyResponse,
  GetChannelsRequest,
  GetMessagesRequest,
  GetOrCreateChannelRequest,
  GetOrCreateChannelResponse,
  Message,
  Post,
  SendMessageRequest,
  SendMessageResponse,
  StaticCompany,
  UpdateCompanyStatusRequest,
} from '../common/types';
import { LoadJsonFile } from '../common/utils';
import * as db from './db';
import { getPlayerName, getPlayerPhoneNumber, hasJob } from './players';
import { RegisterServerCallback } from './utils/callbacks';

// Static data & runtime state

const staticCompanies = LoadJsonFile<StaticCompany[]>('static/companies.json');

/** Current open/busy/closed per company; only holds statuses that deviate. */
const statusOverrides = new Map<string, CompanyStatus>();

const companies: Company[] = staticCompanies.map((company) => ({
  ...company,
  status: 'closed' as CompanyStatus,
  // Untouched companies read as "just now", matching the old minutes: 0.
  lastActiveAt: Date.now(),
  posts: [] as Post[],
}));

const getCompany = (id: string): Company | undefined => companies.find((c) => c.id === id);

const ANNOUNCEMENT_TYPES: AnnouncementType[] = ['status', 'offer', 'general'];
const COMPANY_STATUSES: CompanyStatus[] = ['open', 'busy', 'closed'];
const CLOSED_STATUSES: CompanyStatus[] = ['closed'];

const fail = (message: string): BasicResponse => ({ success: false, message });

/**
 * Broadcast a state change to every client. Centralised so the debug log shows
 * exactly what was emitted and when — a missing notification usually means this
 * line never fired (the write failed upstream) rather than a client problem.
 */
const broadcast = (event: string, target: number | number[] | string, payload: unknown, sender?: number): void => {
  let targets: number[];

  if (typeof target === 'number') {
    targets = [target];
  } else if (Array.isArray(target)) {
    targets = target;
  } else if (typeof target === 'string') {
    targets = global.exports['mps-beacon-app'].getEmployees(target);
  }

  debuglog(`[beaconapp:server] emit ${event} -> ${target}`, payload);

  for (const src of targets) {
    if (sender !== src)
      emitNet(event, src, payload);
  }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

// Validation & authorization

type Validation<T> = { ok: true; value: T } | { ok: false; response: BasicResponse };

const allow = <T>(value: T): Validation<T> => ({ ok: true, value });
const deny = (message: string): Validation<never> => ({ ok: false, response: fail(message) });

/** Company must exist and the caller must hold the matching ox group. */
const authorize = (src: number, company: Company | undefined): Validation<Company> => {
  if (!company) {
    debuglog(`[beaconapp:server] denied src=${src}: company not found`);
    return deny('Company not found');
  }
  if (!hasJob(src, company.job)) {
    debuglog(`[beaconapp:server] denied src=${src}: not authorised for "${company.id}" (job "${company.job}")`);
    return deny('Not authorised');
  }
  return allow(company);
};

const normalizeText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const validateAddAnnouncement = (
  src: number,
  data: AddAnnouncementPayload,
): Validation<{ company: Company; type: AnnouncementType; title: string; content: string }> => {
  if (!isRecord(data) || typeof data.companyId !== 'string') return deny('Invalid request');
  if (!ANNOUNCEMENT_TYPES.includes(data.type)) return deny('Invalid announcement type');

  const auth = authorize(src, getCompany(data.companyId));
  if (auth.ok === false) return auth;

  const title = normalizeText(data.title);
  const content = normalizeText(data.content);
  if (title.length < 1 || title.length > 80) return deny('Title must be 1-80 characters');
  if (content.length < 1 || content.length > 400) return deny('Message must be 1-400 characters');

  return allow({ company: auth.value, type: data.type, title, content });
};

const validateDeleteAnnouncement = (src: number, data: DeleteAnnouncementPayload): Validation<string> => {
  if (!isRecord(data) || typeof data.id !== 'string') return deny('Invalid request');

  // ToDo (auth): fetch the announcement row by id, then authorise against its
  // company (as with posts) so an id for another company's announcement is
  // rejected here and not only by the DELETE statement.
  return allow(data.id);
};

const validateAddPost = (src: number, data: AddPostRequest): Validation<{ company: Company; post: Post }> => {
  if (!isRecord(data) || typeof data.companyId !== 'string' || !isRecord(data.post)) return deny('Invalid request');
  if (data.post.type !== 'post' && data.post.type !== 'menu') return deny('Invalid post type');

  const auth = authorize(src, getCompany(data.companyId));
  if (auth.ok === false) return auth;

  const title = normalizeText(data.post.title);
  const content = normalizeText(data.post.content);
  if (title.length < 1 || title.length > 80) return deny('Title must be 1-80 characters');
  if (content.length < 1 || content.length > 400) return deny('Details must be 1-400 characters');

  const post: Post = {
    id: makeId('p'),
    type: data.post.type,
    title,
    content,
    price: typeof data.post.price === 'string' && data.post.price.trim() ? data.post.price.trim() : undefined,
    badge: undefined,
    timestamp: Date.now(),
  };

  return allow({ company: auth.value, post });
};

const validateDeletePost = (src: number, data: DeletePostRequest): Validation<{ company: Company; postId: string }> => {
  if (!isRecord(data) || typeof data.companyId !== 'string' || typeof data.postId !== 'string')
    return deny('Invalid request');

  const auth = authorize(src, getCompany(data.companyId));
  if (auth.ok === false) return auth;

  return allow({ company: auth.value, postId: data.postId });
};

const validateSetCompanyStatus = (
  src: number,
  data: UpdateCompanyStatusRequest,
): Validation<{ company: Company; status: CompanyStatus }> => {
  if (!isRecord(data) || typeof data.companyId !== 'string') return deny('Invalid request');
  if (!COMPANY_STATUSES.includes(data.status)) return deny('Invalid status');

  const auth = authorize(src, getCompany(data.companyId));
  if (auth.ok === false) return auth;

  return allow({ company: auth.value, status: data.status });
};

// Messaging helpers

/** The viewer's phone number. ToDo: confirm lb-phone's export name/shape. */
const getViewerPhone = (src: number): string | null => {
  try {
    const phone = getPlayerPhoneNumber(src);
    return typeof phone === 'string' && phone.length > 0 ? phone.slice(0, 15) : null;
  } catch (err) {
    console.error('[beaconapp] failed to read player phone number', err);
    return null;
  }
};

const toChannel = (row: db.ChannelRow): Channel => {
  const company = getCompany(row.company_id);
  return {
    id: row.id,
    scope: row.scope as ChannelScope,
    companyId: row.company_id,
    companyName: company?.name,
    companyIcon: company?.icon,
    companyIconBg: company?.iconBg,
    companyImage: undefined,
    phoneNumber: row.phone_number ? (row.phone_number as `${number}`) : null,
    lastMessagePreview: row.last_message_preview,
    lastMessageAt: row.last_message_at,
    unreadCount: row.unread_count,
  };
};

const toMessage = (row: db.MessageRow): Message => {
  const outgoing =
    (row.author === 'user' && row.channel_id.startsWith('personal:')) ||
    (row.author === 'employee' && row.channel_id.startsWith('company:'));
  return {
    id: row.id,
    channelId: row.channel_id,
    direction: outgoing ? 'outgoing' : 'incoming',
    author: outgoing ? (row.author ?? undefined) : undefined,
    sentByEmployeeName: row.sent_by ?? undefined,
    content: row.content,
    timestamp: row.created_at,
  };
};

/** A business is reachable when it has a phone and messaging is permitted. */
const isCompanyReachable = (company: Company | undefined): company is Company => {
  if (!company) return false;
  if (!company.phone) return false;
  // `AllowMessagingWhenClosed` in static/config.json; ToDo: opening-hours schedules.
  if (CLOSED_STATUSES.includes(company.status) && !config.AllowMessagingWhenClosed) return false;
  return true;
};

// Callbacks

RegisterServerCallback<Company[]>('beaconapp:getcompanies', async () => {
  debuglog(`[beaconapp:server] getcompanies -> ${companies.length} companies (memory)`);
  return companies;
});

RegisterServerCallback<Announcement[]>('beaconapp:getannouncements', async () => {
  const rows = await db.getAnnouncements();
  debuglog(`[beaconapp:server] getannouncements -> ${rows.length} rows (db)`);

  // ToDo (perf): hydrate branding with a single JOIN instead of a lookup per row.
  return rows.map<Announcement>((row) => {
    const company = getCompany(row.company_id);
    return {
      id: row.id,
      companyId: row.company_id,
      companyName: company?.name ?? 'Unknown',
      companyIcon: company?.icon ?? '',
      companyIconBg: company?.iconBg ?? '',
      companyImage: undefined,
      type: row.type,
      title: row.title,
      content: row.content,
      // Absolute, so a client holding this in its cache never ages it wrongly.
      createdAt: row.created_at,
    };
  });
});

RegisterServerCallback<EmployeeCompanyResponse>(
  'beaconapp:getemployeecompany',
  async (_src, data: { group?: string }) => {
    const group = typeof data?.group === 'string' ? data.group : '';
    const company = group ? companies.find((c) => c.job === group) : undefined;
    return { companyId: company?.id ?? null };
  },
);

RegisterServerCallback<BasicResponse>('beaconapp:addannouncement', async (src, data: AddAnnouncementPayload) => {
  const validation = validateAddAnnouncement(src, data);
  if (validation.ok === false) return validation.response;

  const { company, type, title, content } = validation.value;
  const row: db.AnnouncementRow = {
    id: makeId('a'),
    company_id: company.id,
    type,
    title,
    content,
    created_at: Date.now(),
  };
  await db.insertAnnouncement(row);

  const announcement: Announcement = {
    id: row.id,
    companyId: company.id,
    companyName: company.name,
    companyIcon: company.icon,
    companyIconBg: company.iconBg,
    companyImage: company.image,
    type,
    title,
    content,
    createdAt: row.created_at,
  };

  broadcast('beaconapp:client:updateannouncement', -1, announcement);
  return { success: true };
});

RegisterServerCallback<BasicResponse>('beaconapp:deleteannouncement', async (src, data: DeleteAnnouncementPayload) => {
  const validation = validateDeleteAnnouncement(src, data);
  if (validation.ok === false) return validation.response;

  await db.deleteAnnouncement(validation.value);
  broadcast('beaconapp:client:removeannouncement', -1, { id: validation.value });
  return { success: true };
});

RegisterServerCallback<BasicResponse>('beaconapp:addpost', async (src, data: AddPostRequest) => {
  const validation = validateAddPost(src, data);
  if (validation.ok === false) return validation.response;

  const { company, post } = validation.value;
  await db.insertPost({
    id: post.id,
    company_id: company.id,
    type: post.type,
    title: post.title,
    content: post.content,
    price: post.price ?? null,
    badge: post.badge ?? null,
    created_at: post.timestamp,
  });

  // Keep server memory consistent with the write so the broadcast actually
  // carries the new post instead of announcing a no-op.
  // ToDo (perf): hydrate posts from the DB on boot (`db.getAllPosts`).
  company.posts = [post, ...company.posts];

  broadcast('beaconapp:client:updatecompany', -1, company);
  return { success: true };
});

RegisterServerCallback<BasicResponse>('beaconapp:deletepost', async (src, data: DeletePostRequest) => {
  const validation = validateDeletePost(src, data);
  if (validation.ok === false) return validation.response;

  const { company, postId } = validation.value;
  await db.deletePost(company.id, postId);
  company.posts = company.posts.filter((post) => post.id !== postId);

  broadcast('beaconapp:client:updatecompany', -1, company);
  return { success: true };
});

RegisterServerCallback<BasicResponse>('beaconapp:setcompanystatus', async (src, data: UpdateCompanyStatusRequest) => {
  const validation = validateSetCompanyStatus(src, data);
  if (validation.ok === false) return validation.response;

  const { company, status } = validation.value;
  statusOverrides.set(company.id, status);
  company.status = status;
  company.lastActiveAt = Date.now();

  debuglog(`[beaconapp:server] setcompanystatus "${company.id}" -> ${status}`);
  broadcast('beaconapp:client:updatecompany', -1, company);
  return { success: true };
});

// Callbacks — messaging

RegisterServerCallback<Channel[]>('beaconapp:getchannels', async (src, data: GetChannelsRequest) => {
  if (!isRecord(data) || (data.scope !== 'personal' && data.scope !== 'company')) return [];
  if (data.scope === 'company' && typeof data.companyId !== 'string') return [];

  const rows =
    data.scope === 'personal'
      ? await db.getChannelsByPhone(getViewerPhone(src) ?? '')
      : await db.getChannelsByCompany(data.companyId);

  debuglog(`[beaconapp:server] getchannels (${data.scope}) -> ${rows.length} rows (db)`);
  return rows.map(toChannel);
});

RegisterServerCallback<Message[]>('beaconapp:getmessages', async (src, data: GetMessagesRequest) => {
  if (!isRecord(data) || typeof data.channelId !== 'string') return [];

  const limit = typeof data.limit === 'number' && data.limit > 0 ? Math.min(data.limit, 100) : 50;
  const offset = typeof data.offset === 'number' && data.offset > 0 ? data.offset : 0;

  const phone = getViewerPhone(src);
  if (!phone) return [];

  const channel = await db.getChannel(data.channelId);
  if (!channel) return [];
  if (channel.scope === 'personal' && channel.phone_number !== phone) return [];
  // ToDo (auth): for `company` scope, verify the viewer actually works at the channel's company.

  const rows = await db.getMessages(data.channelId, limit, offset);
  debuglog(`[beaconapp:server] getmessages "${data.channelId}" -> ${rows.length} rows (db)`);
  return rows.map(toMessage);
});

RegisterServerCallback<GetOrCreateChannelResponse>(
  'beaconapp:getorcreatechannel',
  async (src, data: GetOrCreateChannelRequest) => {
    if (!isRecord(data) || typeof data.companyId !== 'string') return { success: false, message: 'Invalid request' };

    const company = getCompany(data.companyId);
    if (!isCompanyReachable(company)) return { success: false, message: 'This business is unreachable' };

    const phone = getViewerPhone(src);
    if (!phone) return { success: false, message: 'No phone number found' };

    await db.createChannelPair(company.id, phone);
    const row = await db.getChannel(db.buildChannelId('personal', company.id, phone));
    if (!row) return { success: false, message: 'Unable to open the conversation' };

    // A fresh pair carries the zeroed defaults from the schema, so an untouched
    // `last_message_at` means this contact is brand-new.
    const created = row.last_message_at === 0;

    debuglog(`[beaconapp:server] getorcreatechannel "${company.id}" -> ${created ? 'created' : 'existing'}`);
    return { success: true, channel: toChannel(row), created };
  },
);

RegisterServerCallback<SendMessageResponse>('beaconapp:sendmessage', async (src, data: SendMessageRequest) => {
  if (!isRecord(data) || typeof data.channelId !== 'string' || typeof data.content !== 'string')
    return { success: false, message: 'Invalid request' };

  const content = data.content.trim();
  if (content.length < 1 || content.length > 400)
    return { success: false, message: 'Message must be 1-400 characters' };

  const phone = getViewerPhone(src);
  if (!phone) return { success: false, message: 'No phone number found' };

  // The scope is encoded in the deterministic id (`personal:c1:555...`), so
  // the viewer can only send from a channel half they own.
  const [scope, companyId] = data.channelId.split(':');
  if ((scope !== 'personal' && scope !== 'company') || !companyId)
    return { success: false, message: 'Unknown channel' };
  // ToDo (auth): for `company` scope, verify the sender actually works at `companyId`.

  const channel = await db.getChannel(data.channelId);
  if (!channel) return { success: false, message: 'Unknown channel' };
  if (scope === 'personal' && channel.phone_number !== phone) return { success: false, message: 'Unknown channel' };

  const company = getCompany(companyId);
  if (!company) return { success: false, message: 'Unknown channel' };

  const timestamp = Date.now();
  const author: 'user' | 'employee' = scope === 'personal' ? 'user' : 'employee';
  const senderName = author === 'employee' ? getPlayerName(src) : undefined;
  const messageId = makeId('m');

  await db.insertMessage({
    id: messageId,
    channel_id: data.channelId,
    author,
    sent_by: senderName ?? null,
    content,
    created_at: timestamp,
  });
  await db.touchChannelPair(companyId, channel.phone_number, content.slice(0, 120), timestamp);

  // ToDo (unread): increment the other half's unread_count on send and reset
  // it when that viewer fetches the channel, instead of leaving both at 0.
  debuglog(`[beaconapp:server] sendmessage "${data.channelId}" by ${author}`);

  return {
    success: true,
    message: {
      id: messageId,
      channelId: data.channelId,
      direction: 'outgoing',
      author,
      sentByEmployeeName: senderName,
      content,
      timestamp,
    },
  };
});

// Bootstrap

// Debug logging is owned by the replicated `beaconapp:debug` convar. A player
// toggling it in the dev panel flips it for the whole server on purpose — the
// gate is a server-wide switch, not a per-player one.
onNet('beaconapp:server:debugtoggle', () => {
  const next = !isDebugEnabled();
  SetConvarReplicated('beaconapp:debug', next ? '1' : '0');
  debuglog(`[beaconapp:server] debugtoggle -> beaconapp:debug ${next ? 1 : 0}`);
});

setImmediate(async () => {
  try {
    await db.waitForDatabase();
    console.log('[beaconapp] database connection ready');
    debuglog('[beaconapp:server] bootstrap complete');
  } catch (err) {
    console.error('[beaconapp] database connection failed', err);
  }
});
