import type { Announcement, Company } from '@common/types';
import { CaretLeftIcon, ChatCircleDotsIcon, InfoIcon, MapPinIcon, PhoneIcon } from '@phosphor-icons/react/dist/ssr';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrandMark } from '~/components/BrandMark';
import { requestChannel } from '~/utils/channel';
import { formatRelativeTime, getCompanyVanityPhoneNumber, toRelativeMinutes } from '~/utils/utils';
import styles from './index.module.scss';

interface CompanyPageProps {
  company: Company;
  announcements: Announcement[];
  onBack: () => void;
}

export function CompanyPage({ company, announcements, onBack }: CompanyPageProps) {
  const navigate = useNavigate();
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const latestAnnouncement = announcements
    .filter((a) => a.companyId === company.id)
    .sort((a, b) => b.createdAt - a.createdAt)[0];

  const statusLabel = company.status === 'open' ? 'Open Now' : company.status === 'busy' ? 'Busy' : 'Closed';

  /**
   * `beaconapp:getorcreatechannel` creates the channel pair on first contact;
   * a failure (closed business, no phone) is surfaced through `res.message`.
   */
  const handleMessageCompany = async () => {
    if (requesting) return;
    setRequesting(true);
    setRequestError(null);

    try {
      const res = await requestChannel(company);
      if (res.success) {
        navigate(`/channels/${res.channel.id}`);
      } else {
        setRequestError(res.message);
      }
    } catch (err) {
      console.error('[beaconapp] failed to request channel', err);
      setRequestError('Could not reach the business.');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type='button' className={styles.back} onClick={onBack} aria-label='Go back'>
          <CaretLeftIcon size='1.125rem' weight='bold' />
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
                  <TimerIcon size='0.8125rem' weight='fill' />
                  <span>Busy</span>
                </div>
              )}*/}
            </div>
          </div>
          <div className={styles.heroMeta}>
            <button type='button' className={styles.messageButton} onClick={handleMessageCompany} disabled={requesting}>
              <ChatCircleDotsIcon size='1rem' weight='fill' />
              {requesting ? 'Opening chat…' : 'Message'}
            </button>
            {requestError && <div className={styles.metaError}>{requestError}</div>}
            {/* ToDo:
                Add button to implement setting way point
                Or if possible open maps application using undoc'd shared components
              */}
            {company.address && (
              <div className={styles.metaLine}>
                <MapPinIcon size='0.875rem' weight='fill' />
                {company.address}
              </div>
            )}
            {/* ToDo: add button to implement calling users */}
            <div className={styles.metaLine}>
              <PhoneIcon size='0.875rem' weight='fill' />
              {company.phone
                ? globalThis.formatPhoneNumber(company.phone)
                : getCompanyVanityPhoneNumber({
                    name: company.name,
                  })}
            </div>
            <div className={styles.metaLine}>
              <InfoIcon size='1.75rem' weight='fill' />
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
                <div className={styles.announcementTime}>
                  {formatRelativeTime(toRelativeMinutes(latestAnnouncement.createdAt))}
                </div>
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

        <div style={{ height: '2rem' }} />
      </div>
    </div>
  );
}
