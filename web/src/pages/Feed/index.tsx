import { useState, useMemo } from 'react';
import { formatRelativeTime, toRelativeMinutes } from '~/utils/utils';
import type { Announcement, AnnouncementType } from '@common/types';
import { BrandMark } from '~/components/BrandMark';
import styles from './index.module.scss';

type Filter = 'all' | AnnouncementType;

const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'status', label: 'Status' },
  { id: 'offer', label: 'Offers' },
  { id: 'general', label: 'General' },
];

const typeLabel: Record<AnnouncementType, string> = {
  status: 'STATUS',
  offer: 'OFFER',
  general: 'INFO',
};

interface AnnouncementFeedProps {
  announcements: Announcement[];
}

export function AnnouncementFeedPage({ announcements }: AnnouncementFeedProps) {
  const [filter, setFilter] = useState<Filter>('all');

  const sorted = useMemo(() => {
    const base = [...announcements].sort((a, b) => b.createdAt - a.createdAt);
    if (filter === 'all') return base;
    return base.filter((a) => a.type === filter);
  }, [filter, announcements]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Announcements</h1>
        <div className={styles.segmented}>
          {filters.map((f) => (
            <button
              key={f.id}
              className={`${styles.segment} ${filter === f.id ? styles.active : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.scroll}>
        <div className={styles.sectionLabel}>
          {filter === 'all'
            ? 'Latest Updates'
            : filter === 'status'
              ? 'Open & Close Updates'
              : filter === 'offer'
                ? 'Discounts & Offers'
                : 'General News'}
        </div>

        {sorted.length === 0 ? (
          <div className={styles.empty}>No announcements in this category.</div>
        ) : (
          sorted.map((ann) => (
            <div key={ann.id} className={styles.item}>
              <BrandMark
                image={ann.companyImage}
                icon={ann.companyIcon}
                iconBg={ann.companyIconBg}
                className={styles.itemLogo}
              />
              <div className={styles.itemBody}>
                <div className={styles.itemTop}>
                  <span className={styles.companyName}>{ann.companyName}</span>
                  <span className={`${styles.typePill} ${styles[ann.type]}`}>{typeLabel[ann.type]}</span>
                </div>
                <div className={styles.itemTitle}>{ann.title}</div>
                <div className={styles.itemContent}>{ann.content}</div>
                <div className={styles.itemTime}>{formatRelativeTime(toRelativeMinutes(ann.createdAt))}</div>
              </div>
            </div>
          ))
        )}

        <div style={{ height: '1rem' }} />
      </div>
    </div>
  );
}
