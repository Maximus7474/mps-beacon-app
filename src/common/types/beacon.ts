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
  lastActiveMinutes: number;
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
  minutesAgo: number;
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
  id: string;
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
  id: string;
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
