import type { Message } from '../types';

const at = (minutesAgo: number) => Date.now() - minutesAgo * 60_000;

export const SEED_MESSAGES: Record<string, Message[]> = {
  // personal
  'ch-p1': [
    {
      id: 'm-p1-1',
      channelId: 'ch-p1',
      direction: 'outgoing',
      author: 'user',
      content: 'Morning! Are the Ethiopian beans back in stock today?',
      timestamp: at(28),
    },
    {
      id: 'm-p1-2',
      channelId: 'ch-p1',
      direction: 'incoming',
      content: 'They are — the last bag of the Yirgacheffe lot just went on the shelf.',
      timestamp: at(25),
    },
    {
      id: 'm-p1-3',
      channelId: 'ch-p1',
      direction: 'outgoing',
      author: 'user',
      content: 'Perfect. Could you hold one at the counter for me?',
      timestamp: at(22),
    },
    {
      id: 'm-p1-4',
      channelId: 'ch-p1',
      direction: 'incoming',
      content: 'Done — cortado will be waiting with it ☕',
      timestamp: at(2),
    },
  ],
  'ch-p2': [
    {
      id: 'm-p2-1',
      channelId: 'ch-p2',
      direction: 'outgoing',
      author: 'user',
      content: 'Hi! Is it still possible to book a table for four tonight?',
      timestamp: at(140),
    },
    {
      id: 'm-p2-2',
      channelId: 'ch-p2',
      direction: 'incoming',
      content: 'Of course. Table is confirmed for 7 PM under your number.',
      timestamp: at(45),
    },
  ],
  'ch-p3': [
    {
      id: 'm-p3-1',
      channelId: 'ch-p3',
      direction: 'outgoing',
      author: 'user',
      content: 'I ordered the weekly veg box — when can I pick it up?',
      timestamp: at(200),
    },
    {
      id: 'm-p3-2',
      channelId: 'ch-p3',
      direction: 'incoming',
      content: 'Your curbside order is ready — stall 4 when you arrive.',
      timestamp: at(180),
    },
  ],
  'ch-p4': [
    {
      id: 'm-p4-1',
      channelId: 'ch-p4',
      direction: 'outgoing',
      author: 'user',
      content: 'Could you do a half duck with extra pancakes for Sunday?',
      timestamp: at(1580),
    },
    {
      id: 'm-p4-2',
      channelId: 'ch-p4',
      direction: 'incoming',
      content: 'Yes, we can do the half duck with extra pancakes 👍',
      timestamp: at(1560),
    },
  ],
  'ch-p5': [
    {
      id: 'm-p5-1',
      channelId: 'ch-p5',
      direction: 'outgoing',
      author: 'user',
      content: 'Any chance the dahlia bouquet can be ready today?',
      timestamp: at(4340),
    },
    {
      id: 'm-p5-2',
      channelId: 'ch-p5',
      direction: 'incoming',
      content: 'It is wrapped and ready — pick up before 5 PM.',
      timestamp: at(4320),
    },
  ],
  'ch-p6': [
    {
      id: 'm-p6-1',
      channelId: 'ch-p6',
      direction: 'outgoing',
      author: 'user',
      content: 'Do you take appointments this week?',
      timestamp: at(8660),
    },
    {
      id: 'm-p6-2',
      channelId: 'ch-p6',
      direction: 'incoming',
      content: 'Walk-ins only this week, sorry! 🙏',
      timestamp: at(8640),
    },
  ],

  // company
  'ch-c1': [
    {
      id: 'm-c1-1',
      channelId: 'ch-c1',
      direction: 'incoming',
      content: 'Can I grab a large oat cortado and two croissants?',
      timestamp: at(9),
    },
    {
      id: 'm-c1-2',
      channelId: 'ch-c1',
      direction: 'outgoing',
      author: 'employee',
      sentByEmployeeName: 'Maria',
      content: 'Absolutely — they will be ready in about ten minutes.',
      timestamp: at(7),
    },
    {
      id: 'm-c1-3',
      channelId: 'ch-c1',
      direction: 'outgoing',
      author: 'user',
      content: 'We just pulled the croissants out of the oven, still warm!',
      timestamp: at(5),
    },
  ],
  'ch-c2': [
    {
      id: 'm-c2-1',
      channelId: 'ch-c2',
      direction: 'incoming',
      content: 'Could I get a cortado and a slice of the lemon loaf?',
      timestamp: at(250),
    },
    {
      id: 'm-c2-2',
      channelId: 'ch-c2',
      direction: 'outgoing',
      author: 'user',
      content: 'Of course — will that be for pickup?',
      timestamp: at(248),
    },
    {
      id: 'm-c2-3',
      channelId: 'ch-c2',
      direction: 'incoming',
      content: 'Perfect, thanks so much!',
      timestamp: at(240),
    },
  ],
  'ch-c3': [
    {
      id: 'm-c3-1',
      channelId: 'ch-c3',
      direction: 'incoming',
      content: 'Do you sell the Ethiopian beans retail?',
      timestamp: at(1472),
    },
    {
      id: 'm-c3-2',
      channelId: 'ch-c3',
      direction: 'outgoing',
      author: 'user',
      content: 'We do — 250g bags are behind the register.',
      timestamp: at(1470),
    },
  ],
  'ch-c4': [
    {
      id: 'm-c4-1',
      channelId: 'ch-c4',
      direction: 'incoming',
      content: 'Two omakase seats Saturday, in case of cancellations?',
      timestamp: at(1322),
    },
    {
      id: 'm-c4-2',
      channelId: 'ch-c4',
      direction: 'outgoing',
      author: 'employee',
      sentByEmployeeName: 'Kenji',
      content: 'I have put you down as first on the waitlist.',
      timestamp: at(1320),
    },
  ],
};

export const getSeedMessages = (channelId: string): Message[] =>
  (SEED_MESSAGES[channelId] ?? []).map((m) => ({ ...m }));
