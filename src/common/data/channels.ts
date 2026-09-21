import type { Channel } from '../types';

const minutesAgo = (minutes: number) => Date.now() - minutes * 60_000;

/**
 * Dev-mode fallback for the channels page (see SEED_COMPANIES / SEED_ANNOUNCEMENTS).
 * Personal channels are the player's conversations with companies; company
 * channels are customers messaging the business account. Replaced by the
 * backend once the DB schema and queries exist.
 */
export const SEED_CHANNELS: Channel[] = [
  // --- Personal scope: conversations with companies -------------------------
  {
    id: 'ch-p1',
    scope: 'personal',
    companyId: 'c1',
    companyName: 'The Roasted Bean',
    companyIcon: 'CoffeeBeanIcon',
    companyIconBg: '#6F4E37',
    phoneNumber: '5550123456',
    lastMessagePreview: 'Sounds good — your cortado will be waiting at the counter ☕',
    lastMessageAt: minutesAgo(2),
    unreadCount: 2,
  },
  {
    id: 'ch-p2',
    scope: 'personal',
    companyId: 'c2',
    companyName: 'Sakura Kitchen',
    companyIcon: '🌸',
    companyIconBg: '#E8647A',
    phoneNumber: '5552345678',
    lastMessagePreview: 'Your table for four is confirmed for 7 PM tonight.',
    lastMessageAt: minutesAgo(45),
    unreadCount: 0,
  },
  {
    id: 'ch-p3',
    scope: 'personal',
    companyId: 'c3',
    companyName: 'FreshMart',
    companyIcon: '🛒',
    companyIconBg: '#30B050',
    phoneNumber: '5553456789',
    lastMessagePreview: 'Your curbside order is ready — stall 4 when you arrive.',
    lastMessageAt: minutesAgo(180),
    unreadCount: 1,
  },
  {
    id: 'ch-p4',
    scope: 'personal',
    companyId: 'c4',
    companyName: 'Golden Dragon',
    companyIcon: '🐉',
    companyIconBg: '#C0392B',
    phoneNumber: '5554567890',
    lastMessagePreview: 'Yes, we can do the half duck with extra pancakes 👍',
    lastMessageAt: minutesAgo(1560),
    unreadCount: 0,
  },
  {
    id: 'ch-p5',
    scope: 'personal',
    companyId: 'c5',
    companyName: 'Bloom & Co.',
    companyIcon: '🌷',
    companyIconBg: '#9B59B6',
    phoneNumber: '5555678901',
    lastMessagePreview: 'The dahlia bouquet is wrapped and ready — pick up before 5 PM.',
    lastMessageAt: minutesAgo(4320),
    unreadCount: 0,
  },
  {
    id: 'ch-p6',
    scope: 'personal',
    companyId: 'c6',
    companyName: 'City Cuts',
    companyIcon: 'ScissorsIcon',
    companyIconBg: '#2C3E50',
    phoneNumber: '5556789012',
    lastMessagePreview: 'Walk-ins only this week, sorry! 🙏',
    lastMessageAt: minutesAgo(8640),
    unreadCount: 0,
  },

  // --- Company scope: customers messaging the business ----------------------
  {
    id: 'ch-c1',
    scope: 'company',
    companyId: 'c1',
    phoneNumber: '5557651234',
    lastMessagePreview: 'Can I grab a large oat cortado and two croissants?',
    lastMessageAt: minutesAgo(5),
    unreadCount: 2,
  },
  {
    id: 'ch-c2',
    scope: 'company',
    companyId: 'c1',
    phoneNumber: '5559876543',
    lastMessagePreview: 'Perfect, thanks so much!',
    lastMessageAt: minutesAgo(240),
    unreadCount: 0,
  },
  {
    id: 'ch-c3',
    scope: 'company',
    companyId: 'c1',
    phoneNumber: '5553217890',
    lastMessagePreview: 'Do you sell the Ethiopian beans retail?',
    lastMessageAt: minutesAgo(1470),
    unreadCount: 1,
  },
  {
    id: 'ch-c4',
    scope: 'company',
    companyId: 'c2',
    phoneNumber: '5551112222',
    lastMessagePreview: 'Two omakase seats Saturday, in case of cancellations?',
    lastMessageAt: minutesAgo(1320),
    unreadCount: 1,
  },
];
