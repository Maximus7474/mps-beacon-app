export type CompanyStatus = 'open' | 'busy' | 'closed';
export type AnnouncementType = 'status' | 'offer' | 'general';
export type PostType = 'menu' | 'post';

export type Post = {
  id: string;
  type: PostType;
  title: string;
  content: string;
  price?: string;
  badge?: string;
  /** Unix timestamp in milliseconds */
  timestamp: number;
};

export type Company = {
  id: string;
  name: string;
  job: string;
  category: string;
  icon: string;
  iconBg: string;
  image?: string;
  tags: string[];
  status: CompanyStatus;
  /**
   * Unix timestamp (ms) of the last status change. Absolute rather than a
   * pre-computed "minutes ago" so a cached payload cannot go stale.
   */
  lastActiveAt: number;
  description: string;
  address?: string;
  coords?: { x: number; y: number };
  phone: `${number}` | null;
  posts: Post[];
};

export type Announcement = {
  id: string;
  companyId: string;
  companyName: string;
  companyIcon: string;
  companyIconBg: string;
  companyImage?: string;
  type: AnnouncementType;
  title: string;
  content: string;
  /** Unix timestamp (ms) the announcement was posted. See `Company.lastActiveAt`. */
  createdAt: number;
};

/**
 * Static profile of a company, loaded from `static/companies.json` on the
 * server (no runtime-mutable fields — status lives in server memory).
 */
export type StaticCompany = Pick<
  Company,
  'id' | 'name' | 'job' | 'category' | 'icon' | 'iconBg' | 'tags' | 'description' | 'address' | 'phone'
>;

export type AddAnnouncementPayload = {
  companyId: string;
  type: AnnouncementType;
  title: string;
  content: string;
};

export type DeleteAnnouncementPayload = {
  id: string;
};

export type AddPostPayload = {
  type: PostType;
  title: string;
  content: string;
  price?: string;
};

export type AddPostRequest = {
  companyId: string;
  post: AddPostPayload;
};

export type DeletePostRequest = {
  companyId: string;
  postId: string;
};

export type UpdateCompanyStatusRequest = {
  companyId: string;
  status: CompanyStatus;
};

export type JobData = {
  group: string;
  grade: number;
};

export type EmployeeCompanyResponse = {
  companyId: string | null;
};

export type ChannelScope = 'personal' | 'company';

export type Channel = {
  /**
   * Compound conversation key `<companyId>:<phone>`. One row serves both
   * sides; which "half" a viewer sees is a property of the viewer, not the id.
   */
  id: string;
  /**
   * The viewer's perspective on this conversation: `personal` for the
   * customer (they see the company's branding), `company` for an employee
   * (they see the customer's phone number). The stored row has no scope.
   */
  scope: ChannelScope;
  /** Personal scope: the company the conversation is with. */
  companyId?: string;
  /** Branding snapshot (personal scope) so lists render without company joins. */
  companyName?: string;
  companyIcon?: string;
  companyIconBg?: string;
  companyImage?: string;
  /** Company scope: the customer's phone number. */
  phoneNumber: `${number}` | null;
  lastMessagePreview: string;
  /** Unix timestamp (ms) of the latest message. */
  lastMessageAt: number;
  unreadCount: number;
};

export type GetChannelsRequest = {
  scope: ChannelScope;
  /** Required for company scope; the employee's company. */
  companyId?: string;
  /** Paging hooks for the backend; channels are returned in full (ToDo: honour limit/offset). */
  offset?: number;
  limit?: number;
};

/**
 * Author of an outgoing message.
 */
export type MessageAuthor = 'user' | 'employee';

/** Which side of the conversation the viewer sees a message on. */
export type MessageDirection = 'incoming' | 'outgoing';

export type Message = {
  /**
   * Auto-increment id from the database. Optimistic client entries use a
   * negative placeholder until the server's response replaces them.
   */
  id: number;
  channelId: string;
  direction: MessageDirection;
  /** Present only for outgoing messages. */
  author?: MessageAuthor;
  /**
   * Employee display name for outgoing messages sent by colleagues.
   */
  sentByEmployeeName?: string;
  content: string;
  /** Unix timestamp (ms). */
  timestamp: number;
};

export type GetMessagesRequest = {
  channelId: string;
  /** Server honours `limit` (default 50, max 100) and `offset`. */
  offset?: number;
  limit?: number;
};

export type SendMessageRequest = {
  channelId: string;
  content: string;
};

/**
 * `message` echoes the stored row so the UI can append it without refetching.
 */
export type SendMessageResponse = { success: true; message: Message } | { success: false; message: string };

/**
 * Ask the server for the viewer's personal channel with a company, creating
 * it on first contact.
 */
export type GetOrCreateChannelRequest = {
  companyId: string;
};

/**
 * `created` tells the UI whether this is a brand-new conversation; failure
 * carries a human-readable `message` (e.g. the business is unreachable).
 */
export type GetOrCreateChannelResponse =
  | { success: true; channel: Channel; created: boolean }
  | { success: false; message: string };

/**
 * Server push when a message is written. Broadcast to every client; each one
 * decides relevance for itself (receiving side, open channel lists).
 */
export type NewMessagePush = {
  channelId: string;
  companyId: string;
  /** Which side wrote the message; the other side is the recipient. */
  senderSide: 'user' | 'company';
  /** The conversation's customer phone number (both sides of the pair). */
  phoneNumber: string;
  message: {
    id: number;
    author: 'user' | 'employee';
    sentByEmployeeName?: string;
    content: string;
    timestamp: number;
  };
};

// Client cache & NUI sync

/** Employee (on-duty) state, resolved from the player's framework active group. */
export type EmployeeState = {
  enabled: boolean;
  companyId: string | null;
};

/** Cache slice key for a channel list: `personal` or `company:<companyId>`. */
export type ChannelSliceKey = 'personal' | `company:${string}`;

export const channelSliceKey = (scope: ChannelScope, companyId?: string): ChannelSliceKey =>
  scope === 'company' ? `company:${companyId ?? ''}` : 'personal';

/**
 * Everything the NUI needs for its first frame. Built by the client-runtime
 * cache and handed over by the `beaconapp:client:sync` callback, so an iframe
 * that was just (re)created hydrates instantly instead of re-querying the
 * database — including state that was pushed while the app was closed.
 */
export type BeaconSnapshot = {
  /**
   * Monotonic counter owned by the client cache. The UI records the revision it
   * hydrated from and ignores any patch that predates it.
   */
  revision: number;
  companies: Company[];
  announcements: Announcement[];
  employee: EmployeeState;
  /** Channel lists keyed by `ChannelSliceKey`; absent until first fetched. */
  channels: Record<string, Channel[]>;
};

export type BeaconSyncResponse = BeaconSnapshot;
