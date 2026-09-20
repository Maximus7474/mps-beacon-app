import { formatRelativeTime, getCompanyVanityPhoneNumber } from '~/utils/utils';
import type { Announcement, Company } from '@common/types';
import { BrandMark } from '~/components/BrandMark';
import styles from './index.module.scss';
import { CaretLeftIcon, MapPinIcon, PhoneIcon, InfoIcon } from '@phosphor-icons/react/dist/ssr';

interface CompanyPageProps {
  company: Company;
  announcements: Announcement[];
  onBack: () => void;
}

export function CompanyPage({ company, announcements, onBack }: CompanyPageProps) {
  const latestAnnouncement = announcements
    .filter((a) => a.companyId === company.id)
    .sort((a, b) => a.minutesAgo - b.minutesAgo)[0];

  const statusLabel =
    company.status === 'open' ? 'Open Now' : company.status === 'busy' ? 'Busy — Wait Expected' : 'Closed';

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.back} onClick={onBack} aria-label='Go back'>
          <CaretLeftIcon size={18} weight='bold' />
        </button>
        <div className={styles.navTitle}>{company.name}</div>
      </header>

      <div className={styles.scroll}>
        <div className={styles.hero}>
          <div className={styles.heroTop}>
            <BrandMark image={company.image} icon={company.icon} iconBg={company.iconBg} className={styles.heroLogo} />
            <div className={styles.heroInfo}>
              <div className={styles.heroName}>{company.name}</div>
              <div className={styles.heroCategory}>{company.category}</div>
              <span className={`${styles.statusPill} ${styles[company.status]}`}>{statusLabel}</span>

              {/* Consider future implementation to add details here
                {company.status === 'busy' && (
                <div className={styles.heroBusy}>
                  <TimerIcon size={13} weight='fill' />
                  <span>Busy</span>
                </div>
              )}*/}
            </div>
          </div>
          <div className={styles.heroMeta}>
            {company.address && (
              <div className={styles.metaLine}>
                <MapPinIcon size={14} weight='fill' />
                {company.address}
              </div>
            )}
            <div className={styles.metaLine}>
              <PhoneIcon size={14} weight='fill' />
              {company.phone
                ? globalThis.formatPhoneNumber(company.phone)
                : getCompanyVanityPhoneNumber({
                    name: company.name,
                  })}
            </div>
            <div className={styles.metaLine}>
              <InfoIcon size={28} weight='fill' />
              {company.description}
            </div>
          </div>
        </div>

        {/* Latest Announcement */}
        {latestAnnouncement && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Latest Announcement</div>
            <div className={`${styles.announcementCard} ${styles[latestAnnouncement.type]}`}>
              <div className={styles.announcementHeader}>
                <div className={styles.announcementTitle}>{latestAnnouncement.title}</div>
                <div className={styles.announcementTime}>{formatRelativeTime(latestAnnouncement.minutesAgo)}</div>
              </div>
              <div className={styles.announcementContent}>{latestAnnouncement.content}</div>
            </div>
          </div>
        )}

        {/* Posts & Menu */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Posts & Menu</div>
          {company.posts.length === 0 ? (
            <div className={styles.emptyPosts}>No posts yet</div>
          ) : (
            <div className={styles.postList}>
              {company.posts.map((post) => (
                <div key={post.id} className={styles.postCard}>
                  <div className={styles.postHeader}>
                    <div className={styles.postTitle}>{post.title}</div>
                    {post.badge && (
                      <span
                        className={[
                          styles.postBadge,
                          post.badge === 'SEASONAL' ? styles.postBadgeSeasonal : '',
                          post.badge === 'LIMITED' ? styles.postBadgeLimited : '',
                        ].join(' ')}
                      >
                        {post.badge}
                      </span>
                    )}
                  </div>
                  <div className={styles.postContent}>{post.content}</div>
                  <div className={styles.postFooter}>
                    <span className={styles.postType}>{post.type}</span>
                    {post.price && <span className={styles.postPrice}>{post.price}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ height: 32 }} />
      </div>
    </div>
  );
}
