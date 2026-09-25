import type { Message } from '../types';

const at = (minutesAgo: number) => Date.now() - minutesAgo * 60_000;

/**
 * Dev-mode message history, keyed by the compound conversation id used by the
 * backend (`<companyId>:<phone>`). One history per conversation: `author`
 * decides the direction per viewer — `user` rows are outgoing for the
 * customer and incoming for the company, and vice versa for `employee` rows.
 */
export const SEED_MESSAGES: Record<string, Message[]> = {
  'c1:5550123456': [
    {
      id: -1,
      channelId: 'c1:5550123456',
      direction: 'outgoing',
      author: 'user',
      content: 'Morning! Are the Ethiopian beans back in stock today?',
      timestamp: at(28),
    },
    {
      id: -2,
      channelId: 'c1:5550123456',
      direction: 'incoming',
      content: 'They are — the last bag of the Yirgacheffe lot just went on the shelf.',
      timestamp: at(25),
    },
    {
      id: -3,
      channelId: 'c1:5550123456',
      direction: 'outgoing',
      author: 'user',
      content: 'Perfect. Could you hold one at the counter for me?',
      timestamp: at(22),
    },
    {
      id: -4,
      channelId: 'c1:5550123456',
      direction: 'incoming',
      content: 'Done — cortado will be waiting with it ☕',
      timestamp: at(2),
    },
  ],
  'c2:5552345678': [
    {
      id: -5,
      channelId: 'c2:5552345678',
      direction: 'outgoing',
      author: 'user',
      content: 'Hi! Is it still possible to book a table for four tonight?',
      timestamp: at(140),
    },
    {
      id: -6,
      channelId: 'c2:5552345678',
      direction: 'incoming',
      content: 'Of course. Table is confirmed for 7 PM under your number.',
      timestamp: at(45),
    },
  ],
  'c3:5553456789': [
    {
      id: -7,
      channelId: 'c3:5553456789',
      direction: 'outgoing',
      author: 'user',
      content: 'I ordered the weekly veg box — when can I pick it up?',
      timestamp: at(200),
    },
    {
      id: -8,
      channelId: 'c3:5553456789',
      direction: 'incoming',
      content: 'Your curbside order is ready — stall 4 when you arrive.',
      timestamp: at(180),
    },
  ],
  'c4:5554567890': [
    {
      id: -9,
      channelId: 'c4:5554567890',
      direction: 'outgoing',
      author: 'user',
      content: 'Could you do a half duck with extra pancakes for Sunday?',
      timestamp: at(1580),
    },
    {
      id: -10,
      channelId: 'c4:5554567890',
      direction: 'incoming',
      content: 'Yes, we can do the half duck with extra pancakes 👍',
      timestamp: at(1560),
    },
  ],
  'c5:5555678901': [
    {
      id: -11,
      channelId: 'c5:5555678901',
      direction: 'outgoing',
      author: 'user',
      content: 'Any chance the dahlia bouquet can be ready today?',
      timestamp: at(4340),
    },
    {
      id: -12,
      channelId: 'c5:5555678901',
      direction: 'incoming',
      content: 'It is wrapped and ready — pick up before 5 PM.',
      timestamp: at(4320),
    },
  ],
  'c6:5556789012': [
    {
      id: -13,
      channelId: 'c6:5556789012',
      direction: 'outgoing',
      author: 'user',
      content: 'Do you take appointments this week?',
      timestamp: at(8660),
    },
    {
      id: -14,
      channelId: 'c6:5556789012',
      direction: 'incoming',
      content: 'Walk-ins only this week, sorry! 🙏',
      timestamp: at(8640),
    },
  ],

  // Company-side threads: the customer's and the employees' views of the
  // same conversations, seeded with both sides' messages.
  'c1:5557651234': [
    {
      id: -15,
      channelId: 'c1:5557651234',
      direction: 'incoming',
      content: 'Can I grab a large oat cortado and two croissants?',
      timestamp: at(9),
    },
    {
      id: -16,
      channelId: 'c1:5557651234',
      direction: 'outgoing',
      author: 'employee',
      sentByEmployeeName: 'Maria',
      content: 'Absolutely — they will be ready in about ten minutes.',
      timestamp: at(7),
    },
  ],
  'c1:5559876543': [
    {
      id: -17,
      channelId: 'c1:5559876543',
      direction: 'incoming',
      content: 'Could I get a cortado and a slice of the lemon loaf?',
      timestamp: at(250),
    },
    {
      id: -18,
      channelId: 'c1:5559876543',
      direction: 'outgoing',
      author: 'employee',
      sentByEmployeeName: 'Maria',
      content: 'Of course — will that be for pickup?',
      timestamp: at(248),
    },
    {
      id: -19,
      channelId: 'c1:5559876543',
      direction: 'incoming',
      content: 'Perfect, thanks so much!',
      timestamp: at(240),
    },
  ],
  'c1:5553217890': [
    {
      id: -20,
      channelId: 'c1:5553217890',
      direction: 'incoming',
      content: 'Do you sell the Ethiopian beans retail?',
      timestamp: at(1472),
    },
    {
      id: -21,
      channelId: 'c1:5553217890',
      direction: 'outgoing',
      author: 'employee',
      sentByEmployeeName: 'Kenji',
      content: 'We do — 250g bags are behind the register.',
      timestamp: at(1470),
    },
  ],
  'c2:5551112222': [
    {
      id: -22,
      channelId: 'c2:5551112222',
      direction: 'incoming',
      content: 'Two omakase seats Saturday, in case of cancellations?',
      timestamp: at(1322),
    },
    {
      id: -23,
      channelId: 'c2:5551112222',
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
