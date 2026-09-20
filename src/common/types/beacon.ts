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
  address: string;
  phone: string;
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
