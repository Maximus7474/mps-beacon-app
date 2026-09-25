import { SEED_CHANNELS } from '@common/data/channels';
import type { Channel, ChannelScope, GetChannelsRequest } from '@common/types';
import { PhoneIcon } from '@phosphor-icons/react/dist/ssr';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BrandMark } from '~/components/BrandMark';
import { useBeacon } from '~/hooks/useBeacon';
import { useNuiEvent } from '~/hooks/useNuiEvent';
import { fetchNui } from '~/utils/fetchNui';
import { devMode, formatRelativeTime, toRelativeMinutes } from '~/utils/utils';
import styles from './index.module.scss';

type Tab = Exclude<ChannelScope, never>;

const TAB_SCOPES: Record<Tab, ChannelScope> = { personal: 'personal', company: 'company' };

// Page size for progressive scrolling — the backend will eventually accept
// offset/limit so oversized channel queries are avoided.
const PAGE_SIZE = 12;

interface ChannelsPageProps {
  /** ToDo: wire to the channel-history page once it exists. */
  onOpenChannel?: (channel: Channel) => void;
}

export function ChannelsPage({ onOpenChannel }: ChannelsPageProps) {
  const { employeeMode, employeeCompanyId } = useBeacon();
  const [tab, setTab] = useState<Tab>('personal');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Outside employee mode the user only ever sees their own channels.
  const scope: ChannelScope = employeeMode ? TAB_SCOPES[tab] : 'personal';
  const companyId = employeeMode && scope === 'company' ? (employeeCompanyId ?? undefined) : undefined;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const request: GetChannelsRequest = { scope, companyId, offset: 0, limit: PAGE_SIZE };
    // Dev fallback mirrors the requested scope; replaced by real DB queries later.
    const mock = devMode
      ? SEED_CHANNELS.filter(
          (channel) =>
            channel.scope === scope && (scope === 'personal' || !companyId || channel.companyId === companyId),
        )
      : undefined;

    fetchNui<Channel[]>('beaconapp:getchannels', request, mock)
      .then((rows) => {
        if (cancelled) return;
        setChannels([...rows].sort((a, b) => b.lastMessageAt - a.lastMessageAt));
        setVisibleCount(PAGE_SIZE);
      })
      .catch((err) => {
        console.error('[beaconapp] failed to load channels', err);
        if (!cancelled) setChannels([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [scope, companyId]);

  useNuiEvent('beaconapp:hydrate', () => {
    void fetchNui<Channel[]>('beaconapp:getchannels', { scope, companyId, offset: 0, limit: PAGE_SIZE }).then(
      (rows) => {
        setChannels([...rows].sort((a, b) => b.lastMessageAt - a.lastMessageAt));
        setVisibleCount((current) => Math.max(current, PAGE_SIZE));
      },
    );
  });

  // Progressive scrolling: render in pages and grow as the sentinel scrolls
  // into view, so a long history never lands in the DOM at once.
  const hasMore = visibleCount < channels.length;

  useEffect(() => {
    if (!hasMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((current) => Math.min(current + PAGE_SIZE, channels.length));
        }
      },
      { rootMargin: '240px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, channels.length]);

  const visible = useMemo(() => channels.slice(0, visibleCount), [channels, visibleCount]);

  const emptyMessage = scope === 'personal' ? 'No conversations yet.' : 'No customer messages yet.';

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Messages</h1>
        {employeeMode && (
          <div className={styles.segmented}>
            <button
              type='button'
              className={`${styles.segment} ${tab === 'personal' ? styles.active : ''}`}
              onClick={() => setTab('personal')}
            >
              Personal
            </button>
            <button
              type='button'
              className={`${styles.segment} ${tab === 'company' ? styles.active : ''}`}
              onClick={() => setTab('company')}
            >
              Company
            </button>
          </div>
        )}
      </div>

      <div className={styles.scroll}>
        <div className={styles.sectionLabel}>Recent</div>

        {loading ? (
          <div className={styles.empty}>Loading…</div>
        ) : visible.length === 0 ? (
          <div className={styles.empty}>{emptyMessage}</div>
        ) : (
          <>
            <div className={styles.list}>
              {visible.map((channel) => {
                const unread = channel.unreadCount > 0;

                return (
                  // ToDo: selecting a channel opens a separate page that loads the message history
                  <button
                    key={channel.id}
                    type='button'
                    className={styles.channel}
                    onClick={() => onOpenChannel?.(channel)}
                  >
                    {channel.scope === 'personal' ? (
                      <BrandMark
                        image={channel.companyImage}
                        icon={channel.companyIcon}
                        iconBg={channel.companyIconBg}
                        className={styles.avatar}
                      />
                    ) : (
                      <span className={`${styles.avatar} ${styles.avatarPhone}`}>
                        <PhoneIcon size='1.25em' weight='fill' />
                      </span>
                    )}

                    <span className={styles.channelBody}>
                      <span className={styles.channelTop}>
                        <span className={styles.channelName}>
                          {channel.scope === 'personal'
                            ? (channel.companyName ?? 'Unknown business')
                            : channel.phoneNumber
                              ? globalThis.formatPhoneNumber(channel.phoneNumber)
                              : 'Unknown number'}
                        </span>
                        <span className={styles.channelTime}>
                          {formatRelativeTime(toRelativeMinutes(channel.lastMessageAt))}
                        </span>
                      </span>
                      <span className={styles.channelBottom}>
                        <span className={styles.channelPreview}>{channel.lastMessagePreview}</span>
                        {unread && <span className={styles.unreadDot} />}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {hasMore && <div ref={sentinelRef} className={styles.sentinel} aria-hidden='true' />}
          </>
        )}

        <div style={{ height: '1rem' }} />
      </div>
    </div>
  );
}
