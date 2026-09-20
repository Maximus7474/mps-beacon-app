import type { AddAnnouncementPayload, AddPostPayload, Announcement, Company, CompanyStatus } from '@common/types';

export interface BeaconContextType {
  companies: Company[];
  announcements: Announcement[];
  employeeMode: boolean;
  employeeCompanyId: string | null;
  loading: boolean;
  setEmployeeMode: (value: boolean) => void;
  addAnnouncement: (payload: AddAnnouncementPayload) => Promise<boolean>;
  deleteAnnouncement: (id: string) => Promise<boolean>;
  addPost: (companyId: string, post: AddPostPayload) => Promise<boolean>;
  deletePost: (companyId: string, postId: string) => Promise<boolean>;
  updateStatus: (companyId: string, status: CompanyStatus) => Promise<boolean>;
}
