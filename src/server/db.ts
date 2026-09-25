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
  company_id: string;
  phone_number: string;
  last_message_preview: string;
  last_message_at: number;
  unread_user: number;
  unread_company: number;
};

export type MessageRow = {
  id: number;
  channel_id: string;
  author: 'user' | 'employee';
  sent_by: string | null;
  content: string;
  created_at: number;
};

/** Which side of a conversation reads (or wrote): the customer or the business. */
export type ChannelSide = 'user' | 'company';

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
 * A conversation is one row shared by both sides, keyed by the
 * (company, phone) pair. Which "half" a viewer sees is derived from who they
 * are (customer via phone match, employee via company membership), not from
 * the data — so both sides always read the same message thread.
 */

/** The conversation row id is the compound key of the pair it represents. */
export const buildChannelId = (companyId: string, phoneNumber: string): string => `${companyId}:${phoneNumber}`;

/** Ids carry the pair, so the parts can be recovered without a lookup. */
export const parseChannelId = (id: string): { companyId: string; phoneNumber: string } | null => {
  const index = id.indexOf(':');
  if (index <= 0 || index === id.length - 1) return null;

  const companyId = id.slice(0, index);
  const phoneNumber = id.slice(index + 1);
  // The phone half must be all digits; otherwise this is not a channel id.
  if (!/^\d+$/.test(phoneNumber)) return null;

  return { companyId, phoneNumber };
};

export const getChannel = (id: string): Promise<ChannelRow | null> =>
  oxmysql.single<ChannelRow>(
    'SELECT `id`, `company_id`, `phone_number`, `last_message_preview`, `last_message_at`, `unread_user`, `unread_company` FROM `beacon_channels` WHERE `id` = ?',
    [id],
  );

export const getChannelsByPhone = (phoneNumber: string): Promise<ChannelRow[]> =>
  oxmysql.query<ChannelRow[]>(
    'SELECT `id`, `company_id`, `phone_number`, `last_message_preview`, `last_message_at`, `unread_user`, `unread_company` FROM `beacon_channels` WHERE `phone_number` = ? ORDER BY `last_message_at` DESC',
    [phoneNumber],
  );

export const getChannelsByCompany = (companyId: string): Promise<ChannelRow[]> =>
  oxmysql.query<ChannelRow[]>(
    'SELECT `id`, `company_id`, `phone_number`, `last_message_preview`, `last_message_at`, `unread_user`, `unread_company` FROM `beacon_channels` WHERE `company_id` = ? ORDER BY `last_message_at` DESC',
    [companyId],
  );

/**
 * Creates the conversation row for a (company, phone) pair. No-op when it
 * already exists: the id is the compound key, so the INSERT IGNORE dedupes.
 */
export const createChannel = async (companyId: string, phoneNumber: string): Promise<boolean> => {
  try {
    await oxmysql.insert('INSERT IGNORE INTO `beacon_channels` (`id`, `company_id`, `phone_number`) VALUES (?, ?, ?)', [
      buildChannelId(companyId, phoneNumber),
      companyId,
      phoneNumber,
    ]);
    return true;
  } catch (err) {
    console.error('[beaconapp] failed to create channel', err);
    return false;
  }
};

/** Touches the preview/time and increments the *other* side's unread counter. */
export const touchChannel = (
  companyId: string,
  phoneNumber: string,
  preview: string,
  timestamp: number,
  writerSide: ChannelSide,
): Promise<number | null> =>
  oxmysql.update(
    'UPDATE `beacon_channels` SET `last_message_preview` = ?, `last_message_at` = ?, `unread_user` = `unread_user` + ?, `unread_company` = `unread_company` + ? WHERE `company_id` = ? AND `phone_number` = ?',
    [preview, timestamp, writerSide === 'company' ? 1 : 0, writerSide === 'user' ? 1 : 0, companyId, phoneNumber],
  );

/** Marks a conversation as read for one side, leaving the other side alone. */
export const markChannelRead = (id: string, readerSide: ChannelSide): Promise<number | null> =>
  oxmysql.update(
    readerSide === 'user'
      ? 'UPDATE `beacon_channels` SET `unread_user` = 0 WHERE `id` = ?'
      : 'UPDATE `beacon_channels` SET `unread_company` = 0 WHERE `id` = ?',
    [id],
  );

// Messages

export const insertMessage = (row: Omit<MessageRow, 'id'>): Promise<number | null> =>
  oxmysql.insert(
    'INSERT INTO `beacon_messages` (`channel_id`, `author`, `sent_by`, `content`, `created_at`) VALUES (?, ?, ?, ?, ?)',
    [row.channel_id, row.author, row.sent_by, row.content, row.created_at],
  );

export const getMessages = (channelId: string, limit: number, offset: number): Promise<MessageRow[]> =>
  oxmysql.query<MessageRow[]>(
    'SELECT `id`, `channel_id`, `author`, `sent_by`, `content`, `created_at` FROM `beacon_messages` WHERE `channel_id` = ? ORDER BY `created_at` DESC LIMIT ? OFFSET ?',
    [channelId, limit, offset],
  );

// Bootstrap

export const waitForDatabase = (): Promise<true> => oxmysql.awaitConnection();
