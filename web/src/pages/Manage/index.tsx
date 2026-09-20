import { useState, useCallback } from 'react';
import type {
  AddAnnouncementPayload,
  AddPostPayload,
  Announcement,
  AnnouncementType,
  Company,
  CompanyStatus,
  PostType,
} from '@common/types';
import { BrandMark } from '~/components/BrandMark';
import { TrashIcon } from '@phosphor-icons/react/dist/ssr';
import styles from './index.module.scss';

interface ManagePageProps {
  company: Company | null;
  announcements: Announcement[];
  onAddAnnouncement: (a: AddAnnouncementPayload) => Promise<boolean>;
  onDeleteAnnouncement: (id: string) => Promise<boolean>;
  onAddPost: (companyId: string, post: AddPostPayload) => Promise<boolean>;
  onDeletePost: (companyId: string, postId: string) => Promise<boolean>;
  onUpdateStatus: (companyId: string, status: CompanyStatus) => Promise<boolean>;
}

const announcementTypes: { value: AnnouncementType; label: string }[] = [
  { value: 'status', label: 'Open / Close Update' },
  { value: 'offer', label: 'Discount / Offer' },
  { value: 'general', label: 'General Announcement' },
];

const postTypes: { value: PostType; label: string }[] = [
  { value: 'post', label: 'Post / Update' },
  { value: 'menu', label: 'Menu Item' },
];

const statusOptions: { value: Company['status']; label: string; colour: string }[] = [
  { value: 'open', label: 'Open', colour: 'green' },
  { value: 'busy', label: 'Busy', colour: 'orange' },
  { value: 'closed', label: 'Closed', colour: 'red' },
];

export function ManagePage({
  company,
  announcements,
  onAddAnnouncement,
  onDeleteAnnouncement,
  onAddPost,
  onDeletePost,
  onUpdateStatus,
}: ManagePageProps) {
  const [toast, setToast] = useState<string | null>(null);
  const [toastKey, setToastKey] = useState(0);

  // Announcement form
  const [annType, setAnnType] = useState<AnnouncementType>('general');
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');

  // Post form
  const [postType, setPostType] = useState<PostType>('post');
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postPrice, setPostPrice] = useState('');

  const companyAnnouncements = announcements.filter((a) => a.companyId === company?.id);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setToastKey((k) => k + 1);
    setTimeout(() => setToast(null), 2100);
  }, []);

  async function submitAnnouncement() {
    if (!company || !annTitle.trim() || !annContent.trim()) return;
    const ok = await onAddAnnouncement({
      companyId: company.id,
      type: annType,
      title: annTitle.trim(),
      content: annContent.trim(),
    });
    if (!ok) {
      showToast('Failed to post announcement');
      return;
    }
    setAnnTitle('');
    setAnnContent('');
    showToast('Announcement posted');
  }

  async function submitPost() {
    if (!company || !postTitle.trim() || !postContent.trim()) return;
    const ok = await onAddPost(company.id, {
      type: postType,
      title: postTitle.trim(),
      content: postContent.trim(),
      price: postPrice.trim() || undefined,
    });
    if (!ok) {
      showToast('Failed to add post');
      return;
    }
    setPostTitle('');
    setPostContent('');
    setPostPrice('');
    showToast('Post added');
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Manage</h1>
          <span className={styles.employeeBadge}>EMPLOYEE</span>
        </div>

        {company ? (
          <div className={styles.companyBanner}>
            <BrandMark
              image={company.image}
              icon={company.icon}
              iconBg={company.iconBg}
              className={styles.companyLogo}
            />
            <div className={styles.companyInfo}>
              <div className={styles.companyName}>{company.name}</div>
              <div className={styles.companyCategory}>{company.category}</div>
            </div>
          </div>
        ) : (
          <div className={styles.noCompany}>No business assigned to your account</div>
        )}
      </div>

      <div className={styles.scroll}>
        {company && (
          <>
            {/* Status */}
            <div className={styles.sectionTitle}>Business Status</div>
            <div className={styles.formCard}>
              {statusOptions.map((opt) => (
                <div key={opt.value} className={styles.formRow}>
                  <span className={styles.formLabel}>
                    <span className={styles.statusBadge} style={{ backgroundColor: opt.colour }} aria-hidden='true' />
                    {opt.label}
                  </span>
                  <input
                    type='radio'
                    className={styles.radio}
                    name='status'
                    checked={company.status === opt.value}
                    onChange={async () => {
                      const ok = await onUpdateStatus(company.id, opt.value);
                      showToast(ok ? `Status set to ${opt.label}` : 'Failed to update status');
                    }}
                  />
                </div>
              ))}
            </div>

            {/* New announcement */}
            <div className={styles.sectionTitle}>New Announcement</div>
            <div className={styles.formCard}>
              <div className={styles.formRow}>
                <span className={styles.formLabel}>Type</span>
                <select
                  className={styles.formSelect}
                  value={annType}
                  onChange={(e) => setAnnType(e.target.value as AnnouncementType)}
                >
                  {announcementTypes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formRow}>
                <span className={styles.formLabel}>Title</span>
                <input
                  className={styles.formInput}
                  placeholder='e.g. Now Open'
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  maxLength={80}
                />
              </div>
              <div className={styles.formRow}>
                <span className={styles.formLabel}>Message</span>
                <textarea
                  className={styles.formTextarea}
                  placeholder='Write your announcement...'
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                  maxLength={400}
                />
              </div>
            </div>
            <button
              className={styles.submitBtn}
              onClick={submitAnnouncement}
              disabled={!annTitle.trim() || !annContent.trim()}
            >
              Post Announcement
            </button>

            {/* Existing announcements */}
            <div className={styles.sectionTitle}>Posted Announcements</div>
            {companyAnnouncements.length === 0 ? (
              <div className={styles.emptyItems}>No announcements yet</div>
            ) : (
              <div className={styles.itemsList}>
                {companyAnnouncements.map((a) => (
                  <div key={a.id} className={styles.itemRow}>
                    <div className={styles.itemMeta}>
                      <div className={styles.itemTop}>
                        <span className={styles.itemTitle}>{a.title}</span>
                        <span className={`${styles.itemTypePill} ${styles[a.type]}`}>{a.type.toUpperCase()}</span>
                      </div>
                      <div className={styles.itemContent}>{a.content}</div>
                    </div>
                    <button
                      className={styles.deleteBtn}
                      onClick={async () => {
                        const ok = await onDeleteAnnouncement(a.id);
                        showToast(ok ? 'Announcement removed' : 'Failed to remove announcement');
                      }}
                      aria-label='Delete'
                    >
                      <TrashIcon size={16} weight='regular' />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* New post */}
            <div className={styles.sectionTitle}>New Post / Menu Item</div>
            <div className={styles.formCard}>
              <div className={styles.formRow}>
                <span className={styles.formLabel}>Type</span>
                <select
                  className={styles.formSelect}
                  value={postType}
                  onChange={(e) => setPostType(e.target.value as PostType)}
                >
                  {postTypes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formRow}>
                <span className={styles.formLabel}>Title</span>
                <input
                  className={styles.formInput}
                  placeholder='e.g. Seasonal Latte'
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  maxLength={80}
                />
              </div>
              <div className={styles.formRow}>
                <span className={styles.formLabel}>Details</span>
                <textarea
                  className={styles.formTextarea}
                  placeholder='Describe this item or post...'
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  maxLength={400}
                />
              </div>
              {postType === 'menu' && (
                <div className={styles.formRow}>
                  <span className={styles.formLabel}>Price</span>
                  <input
                    className={styles.formInput}
                    placeholder='e.g. $12.00'
                    value={postPrice}
                    onChange={(e) => setPostPrice(e.target.value)}
                    maxLength={12}
                  />
                </div>
              )}
            </div>
            <button
              className={styles.submitBtn}
              onClick={submitPost}
              disabled={!postTitle.trim() || !postContent.trim()}
            >
              Add {postType === 'menu' ? 'Menu Item' : 'Post'}
            </button>

            {/* Existing posts */}
            <div className={styles.sectionTitle}>Posts & Menu</div>
            {company.posts.length === 0 ? (
              <div className={styles.emptyItems}>No posts yet</div>
            ) : (
              <div className={styles.itemsList}>
                {company.posts.map((p) => (
                  <div key={p.id} className={styles.itemRow}>
                    <div className={styles.itemMeta}>
                      <div className={styles.itemTop}>
                        <span className={styles.itemTitle}>{p.title}</span>
                        <span className={`${styles.itemTypePill} ${styles[p.type]}`}>{p.type.toUpperCase()}</span>
                      </div>
                      <div className={styles.itemContent}>{p.content}</div>
                    </div>
                    <button
                      className={styles.deleteBtn}
                      onClick={async () => {
                        const ok = await onDeletePost(company.id, p.id);
                        showToast(ok ? 'Post removed' : 'Failed to remove post');
                      }}
                      aria-label='Delete'
                    >
                      <TrashIcon size={16} weight='regular' />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ height: 32 }} />
          </>
        )}
      </div>

      {toast && (
        <div key={toastKey} className={styles.successToast}>
          ✓ {toast}
        </div>
      )}
    </div>
  );
}
