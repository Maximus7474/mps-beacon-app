import { RegisterServerCallback } from './utils/callbacks';
import { SEED_ANNOUNCEMENTS, SEED_COMPANIES } from '../common/data/seed';
import type {
  AddAnnouncementPayload,
  AddPostRequest,
  Announcement,
  AnnouncementType,
  BasicResponse,
  Company,
  CompanyStatus,
  DeleteAnnouncementPayload,
  DeletePostRequest,
  EmployeeCompanyResponse,
  Post,
  UpdateCompanyStatusRequest,
} from '../common/types';

const companies: Company[] = structuredClone(SEED_COMPANIES);
const announcements: Announcement[] = structuredClone(SEED_ANNOUNCEMENTS);

const ANNOUNCEMENT_TYPES: AnnouncementType[] = ['status', 'offer', 'general'];
const COMPANY_STATUSES: CompanyStatus[] = ['open', 'busy', 'closed'];

const fail = (message: string): BasicResponse => ({ success: false, message });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

const hasJob = (src: number, job: string): boolean => {
  try {
    return Boolean(global.exports['mps-beacon-app'].hasJob(src, job));
  } catch (err) {
    console.error('[beaconapp] failed to read hasJob export', err);
  }
  return false;
};

// ---------------------------------------------------------------------------
// Validation & authorization
//
// Every mutating callback funnels through a `validate*` function that returns
// either an allowed, normalized payload (`ok: true`) or a denial response
// (`ok: false`). This is the single place to approve or deny an action — add
// or tighten rules here without touching the mutation/broadcast code below.
// ---------------------------------------------------------------------------

type Validation<T> = { ok: true; value: T } | { ok: false; response: BasicResponse };

const allow = <T>(value: T): Validation<T> => ({ ok: true, value });
const deny = (message: string): Validation<never> => ({ ok: false, response: fail(message) });

/** Company must exist and the caller must hold the matching ox group. */
const authorize = (src: number, company: Company | undefined): Validation<Company> => {
  if (!company) return deny('Company not found');
  if (!hasJob(src, company.job)) return deny('Not authorised');
  return allow(company);
};

const normalizeText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const validateAddAnnouncement = (
  src: number,
  data: AddAnnouncementPayload,
): Validation<{ company: Company; type: AnnouncementType; title: string; content: string }> => {
  if (!isRecord(data) || typeof data.companyId !== 'string') return deny('Invalid request');
  if (!ANNOUNCEMENT_TYPES.includes(data.type)) return deny('Invalid announcement type');

  const auth = authorize(
    src,
    companies.find((c) => c.id === data.companyId),
  );
  if (auth.ok === false) return auth;

  const title = normalizeText(data.title);
  const content = normalizeText(data.content);
  if (title.length < 1 || title.length > 80) return deny('Title must be 1-80 characters');
  if (content.length < 1 || content.length > 400) return deny('Message must be 1-400 characters');

  return allow({ company: auth.value, type: data.type, title, content });
};

const validateDeleteAnnouncement = (src: number, data: DeleteAnnouncementPayload): Validation<Announcement> => {
  if (!isRecord(data) || typeof data.id !== 'string') return deny('Invalid request');

  const announcement = announcements.find((a) => a.id === data.id);
  if (!announcement) return deny('Announcement not found');

  const auth = authorize(
    src,
    companies.find((c) => c.id === announcement.companyId),
  );
  if (auth.ok === false) return auth;

  return allow(announcement);
};

const validateAddPost = (src: number, data: AddPostRequest): Validation<{ company: Company; post: Post }> => {
  if (!isRecord(data) || typeof data.companyId !== 'string' || !isRecord(data.post)) return deny('Invalid request');
  if (data.post.type !== 'post' && data.post.type !== 'menu') return deny('Invalid post type');

  const auth = authorize(
    src,
    companies.find((c) => c.id === data.companyId),
  );
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
    timestamp: Date.now(),
  };

  return allow({ company: auth.value, post });
};

const validateDeletePost = (
  src: number,
  data: DeletePostRequest,
): Validation<{ company: Company; postIndex: number }> => {
  if (!isRecord(data) || typeof data.companyId !== 'string' || typeof data.postId !== 'string')
    return deny('Invalid request');

  const auth = authorize(
    src,
    companies.find((c) => c.id === data.companyId),
  );
  if (auth.ok === false) return auth;

  const postIndex = auth.value.posts.findIndex((p) => p.id === data.postId);
  if (postIndex === -1) return deny('Post not found');

  return allow({ company: auth.value, postIndex });
};

const validateSetCompanyStatus = (
  src: number,
  data: UpdateCompanyStatusRequest,
): Validation<{ company: Company; status: CompanyStatus }> => {
  if (!isRecord(data) || typeof data.companyId !== 'string') return deny('Invalid request');
  if (!COMPANY_STATUSES.includes(data.status)) return deny('Invalid status');

  const auth = authorize(
    src,
    companies.find((c) => c.id === data.companyId),
  );
  if (auth.ok === false) return auth;

  return allow({ company: auth.value, status: data.status });
};

// ---------------------------------------------------------------------------
// Callbacks
// ---------------------------------------------------------------------------

RegisterServerCallback<Company[]>('beaconapp:getcompanies', async () => companies);
RegisterServerCallback<Announcement[]>('beaconapp:getannouncements', async () => announcements);

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
  const announcement: Announcement = {
    id: makeId('a'),
    companyId: company.id,
    companyName: company.name,
    companyIcon: company.icon,
    companyIconBg: company.iconBg,
    companyImage: company.image,
    type,
    title,
    content,
    minutesAgo: 0,
  };

  announcements.unshift(announcement);
  emitNet('beaconapp:client:updateannouncement', src, announcement);
  return { success: true };
});

RegisterServerCallback<BasicResponse>('beaconapp:deleteannouncement', async (src, data: DeleteAnnouncementPayload) => {
  const validation = validateDeleteAnnouncement(src, data);
  if (validation.ok === false) return validation.response;

  const announcement = validation.value;
  const index = announcements.indexOf(announcement);
  if (index !== -1) announcements.splice(index, 1);
  emitNet('beaconapp:client:removeannouncement', src, { id: announcement.id });
  return { success: true };
});

RegisterServerCallback<BasicResponse>('beaconapp:addpost', async (src, data: AddPostRequest) => {
  const validation = validateAddPost(src, data);
  if (validation.ok === false) return validation.response;

  const { company, post } = validation.value;
  company.posts.push(post);
  emitNet('beaconapp:client:updatecompany', src, company);
  return { success: true };
});

RegisterServerCallback<BasicResponse>('beaconapp:deletepost', async (src, data: DeletePostRequest) => {
  const validation = validateDeletePost(src, data);
  if (validation.ok === false) return validation.response;

  const { company, postIndex } = validation.value;
  company.posts.splice(postIndex, 1);
  emitNet('beaconapp:client:updatecompany', src, company);
  return { success: true };
});

RegisterServerCallback<BasicResponse>('beaconapp:setcompanystatus', async (src, data: UpdateCompanyStatusRequest) => {
  const validation = validateSetCompanyStatus(src, data);
  if (validation.ok === false) return validation.response;

  const { company, status } = validation.value;
  company.status = status;
  company.lastActiveMinutes = 0;

  emitNet('beaconapp:client:updatecompany', src, company);
  return { success: true };
});
