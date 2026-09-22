import { oxmysql } from '@overextended/oxmysql';

export type AnnouncementRow = {
  id: string;
  company_id: string;
  type: 'status' | 'offer' | 'general';
  title: string;
  content: string;
  created_at: number;
};

export type PostRow = {
  id: string;
  company_id: string;
  type: 'post' | 'menu';
  title: string;
  content: string;
  price: string | null;
  badge: string | null;
  created_at: number;
};

export type ChannelRow = {
  id: string;
  scope: 'personal' | 'company';
  company_id: string;
  phone_number: string;
  last_message_preview: string;
  last_message_at: number;
  unread_count: number;
};

export type MessageRow = {
  id: string;
  channel_id: string;
  author: 'user' | 'employee' | null;
  sent_by: string | null;
  content: string;
  created_at: number;
};

// Announcements

export const insertAnnouncement = (row: AnnouncementRow): Promise<number | null> =>
  oxmysql.insert(
    'INSERT INTO `beacon_announcements` (`id`, `company_id`, `type`, `title`, `content`, `created_at`) VALUES (?, ?, ?, ?, ?, ?)',
    [row.id, row.company_id, row.type, row.title, row.content, row.created_at],
  );

export const deleteAnnouncement = (id: string): Promise<number | null> =>
  oxmysql.update('DELETE FROM `beacon_announcements` WHERE `id` = ?', [id]);

export const getAnnouncements = (): Promise<AnnouncementRow[]> =>
  oxmysql.query<AnnouncementRow[]>(
    'SELECT `id`, `company_id`, `type`, `title`, `content`, `created_at` FROM `beacon_announcements` ORDER BY `created_at` DESC',
  );

// Posts

export const insertPost = (row: PostRow): Promise<number | null> =>
  oxmysql.insert(
    'INSERT INTO `beacon_posts` (`id`, `company_id`, `type`, `title`, `content`, `price`, `badge`, `created_at`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [row.id, row.company_id, row.type, row.title, row.content, row.price, row.badge, row.created_at],
  );

export const deletePost = (companyId: string, id: string): Promise<number | null> =>
  oxmysql.update('DELETE FROM `beacon_posts` WHERE `company_id` = ? AND `id` = ?', [companyId, id]);

export const getAllPosts = (): Promise<PostRow[]> =>
  oxmysql.query<PostRow[]>(
    'SELECT `id`, `company_id`, `type`, `title`, `content`, `price`, `badge`, `created_at` FROM `beacon_posts` ORDER BY `created_at` DESC',
  );

// Channels

/**
 * A conversation is stored as a mirror pair of rows sharing one phone number:
 * - `personal` scope row: what the customer sees (keyed to their phone).
 * - `company` scope row:  what the employees see (keyed to the company).
 *
 * Both carry the same last-message/unread state, updated together.
*/

/** Deterministic ids keep the get-or-create race-free: the unique key does the dedupe. */
export const buildChannelId = (scope: 'personal' | 'company', companyId: string, phoneNumber: string): string =>
  `${scope}:${companyId}:${phoneNumber}`;

export const getChannel = (id: string): Promise<ChannelRow | null> =>
  oxmysql.single<ChannelRow>(
    'SELECT `id`, `scope`, `company_id`, `phone_number`, `last_message_preview`, `last_message_at`, `unread_count` FROM `beacon_channels` WHERE `id` = ?',
    [id],
  );

export const getChannelsByPhone = (phoneNumber: string): Promise<ChannelRow[]> =>
  oxmysql.query<ChannelRow[]>(
    'SELECT `id`, `scope`, `company_id`, `phone_number`, `last_message_preview`, `last_message_at`, `unread_count` FROM `beacon_channels` WHERE `scope` = ? AND `phone_number` = ? ORDER BY `last_message_at` DESC',
    ['personal', phoneNumber],
  );

export const getChannelsByCompany = (companyId: string): Promise<ChannelRow[]> =>
  oxmysql.query<ChannelRow[]>(
    'SELECT `id`, `scope`, `company_id`, `phone_number`, `last_message_preview`, `last_message_at`, `unread_count` FROM `beacon_channels` WHERE `scope` = ? AND `company_id` = ? ORDER BY `last_message_at` DESC',
    ['company', companyId],
  );

/**
 * Creates the personal/company mirror rows for a fresh conversation.
 * No-op when the pair already exists (rows use deterministic ids, so this is
 * safe to call on every request).
 */
export const createChannelPair = (companyId: string, phoneNumber: string): Promise<boolean> =>
  oxmysql.transaction([
    {
      query: 'INSERT IGNORE INTO `beacon_channels` (`id`, `scope`, `company_id`, `phone_number`) VALUES (?, ?, ?, ?)',
      values: [buildChannelId('personal', companyId, phoneNumber), 'personal', companyId, phoneNumber],
    },
    {
      query: 'INSERT IGNORE INTO `beacon_channels` (`id`, `scope`, `company_id`, `phone_number`) VALUES (?, ?, ?, ?)',
      values: [buildChannelId('company', companyId, phoneNumber), 'company', companyId, phoneNumber],
    },
  ]);

/** Touches the preview/unread state on both halves of a conversation pair. */
export const touchChannelPair = (
  companyId: string,
  phoneNumber: string,
  preview: string,
  timestamp: number,
): Promise<number | null> =>
  oxmysql.update(
    'UPDATE `beacon_channels` SET `last_message_preview` = ?, `last_message_at` = ? WHERE `company_id` = ? AND `phone_number` = ?',
    [preview, timestamp, companyId, phoneNumber],
  );

// Messages

export const insertMessage = (row: MessageRow): Promise<number | null> =>
  oxmysql.insert(
    'INSERT INTO `beacon_messages` (`id`, `channel_id`, `author`, `sent_by`, `content`, `created_at`) VALUES (?, ?, ?, ?, ?, ?)',
    [row.id, row.channel_id, row.author, row.sent_by, row.content, row.created_at],
  );

export const getMessages = (channelId: string, limit: number, offset: number): Promise<MessageRow[]> =>
  oxmysql.query<MessageRow[]>(
    'SELECT `id`, `channel_id`, `author`, `sent_by`, `content`, `created_at` FROM `beacon_messages` WHERE `channel_id` = ? ORDER BY `created_at` DESC LIMIT ? OFFSET ?',
    [channelId, limit, offset],
  );

// Bootstrap

export const waitForDatabase = (): Promise<true> => oxmysql.awaitConnection();
