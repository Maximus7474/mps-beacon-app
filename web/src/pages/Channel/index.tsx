import { getSeedMessages } from '@common/data/channelMessages';
import type { GetMessagesRequest, Message, NewMessagePush, SendMessageResponse } from '@common/types';
import { CaretLeftIcon, PaperPlaneTiltIcon, PhoneIcon } from '@phosphor-icons/react/dist/ssr';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BrandMark } from '~/components/BrandMark';
import { useNuiEvent } from '~/hooks/useNuiEvent';
import { fetchNui } from '~/utils/fetchNui';
import { devMode } from '~/utils/utils';
import styles from './index.module.scss';

/** Page size for message-history paging (backend offset/limit once wired). */
const PAGE_SIZE = 30;

const isSameDay = (a: number, b: number) => {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
};

const formatDayLabel = (timestamp: number) => {
  const days = Math.round((Date.now() - timestamp) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return new Date(timestamp).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
};

const formatClock = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** A rendered row: one message plus its merge state within the run. */
type Bubble = {
  message: Message;
  /** First bubble of a consecutive run from the same side (shows caption). */
  lead: boolean;
  /** Day changed since the previous message (renders a divider above). */
  dayBoundary: boolean;
};

const buildBubbles = (messages: Message[]): Bubble[] =>
  messages.map((message, i) => {
    const prev = messages[i - 1];
    const sameSide = prev !== undefined && prev.direction === message.direction;
    const closeEnough = prev !== undefined && message.timestamp - prev.timestamp < 5 * 60_000;
    return {
      message,
      lead: !prev || !sameSide || !closeEnough,
      dayBoundary: !prev || !isSameDay(prev.timestamp, message.timestamp),
    };
  });

interface ChannelPageProps {
  channel: Channel;
  onBack: () => void;
}

export function ChannelPage({ channel, onBack }: ChannelPageProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<HTMLDivElement | null>(null);

  const personal = channel.scope === 'personal';
  // Company scope: the viewer is an employee of the business. Personal scope:
  // the viewer is the customer and business replies arrive anonymously.
  const viewerIsEmployee = channel.scope === 'company';

  // Header identity: personal shows company branding, company shows the
  // customer's phone number.
  const title = personal
    ? (channel.companyName ?? 'Unknown business')
    : channel.phoneNumber
      ? globalThis.formatPhoneNumber(channel.phoneNumber)
      : 'Unknown number';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    // Dev fallback mirrors fetchNui's mockData contract.
    const mock = devMode ? getSeedMessages(channel.id) : undefined;

    fetchNui<Message[]>('beaconapp:getmessages', { channelId: channel.id } satisfies GetMessagesRequest, mock)
      .then((rows) => {
        if (cancelled) return;
        setMessages([...rows].sort((a, b) => a.timestamp - b.timestamp));
        setVisibleCount(PAGE_SIZE);
      })
      .catch((err) => {
        console.error('[beaconapp] failed to load messages', err);
        if (!cancelled) setMessages([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [channel.id]);

  // One fetch per mount. Later updates come in as pushes: the client runtime
  // forwards the server's newmessage event for this channel, and the page
  // appends rows that are not already held (the optimistic row from a local
  // send is matched by the id the server echoes back, so nothing duplicates).
  useNuiEvent<NewMessagePush>('beaconapp:newmessage', (push) => {
    if (!push || push.channelId !== channel.id) return;

    const incoming: Message = {
      id: push.message.id,
      channelId: push.channelId,
      direction:
        (viewerIsEmployee && push.senderSide === 'company') || (!viewerIsEmployee && push.senderSide === 'user')
          ? 'outgoing'
          : 'incoming',
      author: push.message.author,
      sentByEmployeeName: push.message.sentByEmployeeName,
      content: push.message.content,
      timestamp: push.message.timestamp,
    };

    setMessages((prev) => {
      // Already held (echo of an optimistic send, or a duplicate push): keep
      // the authoritative row if ids collide, otherwise append.
      const existing = prev.find((m) => m.id === incoming.id || (m.id < 0 && m.content === incoming.content));
      if (existing) return prev.map((m) => (m.id === existing.id ? incoming : m));
      return [...prev, incoming];
    });
  });

  // Keep the conversation pinned to the latest message.
  useEffect(() => {
    if (messages.length === 0) return;
    anchorRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  // Progressive scroll for older history: growing the window while the user
  // is at the top mirrors the channels list, so backend paging slots in.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop < 40) setVisibleCount((c) => Math.min(c + PAGE_SIZE, messages.length));
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [messages.length]);

  const visible = useMemo(() => messages.slice(-visibleCount), [messages, visibleCount]);
  const bubbles = useMemo(() => buildBubbles(visible), [visible]);

  const canSend = draft.trim().length > 0;

  const send = () => {
    const content = draft.trim();
    if (!content) return;

    // author: 'user' — the viewer's own sends; colleagues carry
    // author: 'employee' + sentByEmployeeName (internal data only). The id is
    // a negative placeholder: it cannot collide with the DB's auto-increment
    // ids, and marks the row as not-yet-confirmed.
    const message: Message = {
      id: -Date.now(),
      channelId: channel.id,
      direction: 'outgoing',
      author: 'user',
      content,
      timestamp: Date.now(),
    };

    // Optimistic append now; the server's response replaces the bubble with
    // the stored row (authoritative id) or drops it.
    setMessages((prev) => [...prev, message]);
    setDraft('');

    fetchNui<SendMessageResponse>(
      'beaconapp:sendmessage',
      { channelId: channel.id, content },
      // Dev stand-in: the round-trip succeeds with the local bubble as-is.
      { success: true, message },
    )
      .then((res) => {
        if (!res.success) {
          console.error('[beaconapp] failed to send message:', res.message);
          setMessages((prev) => prev.filter((m) => m.id !== message.id));
          return;
        }
        setMessages((prev) => prev.map((m) => (m.id === message.id ? res.message : m)));
      })
      .catch((err) => {
        console.error('[beaconapp] failed to send message', err);
        setMessages((prev) => prev.filter((m) => m.id !== message.id));
      });
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type='button' className={styles.back} onClick={onBack} aria-label='Go back'>
          <CaretLeftIcon size='1.125rem' weight='bold' />
        </button>
        {personal ? (
          <BrandMark
            image={channel.companyImage}
            icon={channel.companyIcon}
            iconBg={channel.companyIconBg}
            className={styles.headerAvatar}
          />
        ) : (
          // Company scope shows a neutral phone tile; the number itself is the
          // title. Employee names stay out of the external-facing header.
          <span className={`${styles.headerAvatar} ${styles.headerAvatarPhone}`} aria-hidden='true'>
            <PhoneIcon size='1em' weight='fill' />
          </span>
        )}
        <div className={styles.headerText}>
          <div className={styles.headerTitle}>{title}</div>
          <div className={styles.headerSubtitle}>{personal ? 'Business' : 'Customer'}</div>
        </div>
      </header>

      <div className={styles.scroll} ref={scrollRef}>
        {loading ? (
          <div className={styles.empty}>Loading…</div>
        ) : visible.length === 0 ? (
          <div className={styles.empty}>No messages yet</div>
        ) : (
          <>
            {messages.length > visible.length && <div className={styles.historyHint}>Earlier messages</div>}
            <div className={styles.thread}>
              {bubbles.map(({ message, lead, dayBoundary }) => (
                <div key={message.id} className={styles.rowWrapper}>
                  {dayBoundary && <div className={styles.dayDivider}>{formatDayLabel(message.timestamp)}</div>}
                  <div
                    className={[
                      styles.row,
                      message.direction === 'outgoing' ? styles.rowOutgoing : styles.rowIncoming,
                      lead ? '' : styles.rowMerged,
                    ].join(' ')}
                  >
                    {lead && viewerIsEmployee && message.direction === 'outgoing' && (
                      <div className={styles.caption}>{message.sentByEmployeeName ?? 'You'}</div>
                    )}
                    <div className={styles.bubble}>{message.content}</div>
                    <div className={styles.time}>{formatClock(message.timestamp)}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        <div ref={anchorRef} style={{ height: 1 }} />
      </div>

      <div className={styles.composer}>
        <input
          className={styles.input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
          placeholder={personal ? 'Message business' : 'Reply to customer'}
          aria-label='Message input'
        />
        <button type='button' className={styles.send} onClick={send} disabled={!canSend} aria-label='Send message'>
          <PaperPlaneTiltIcon size='1.25em' weight='fill' />
        </button>
      </div>
    </div>
  );
}
