import type { Account, Transaction } from '@/lib/types';

// Helper: create a date relative to today
function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// -- Chequing transactions (~90 days) ----------------------------------------

const chequingTransactions: Transaction[] = [
  // Biweekly salary deposits (6 deposits over ~90 days, ~$4,750/mo take-home)
  { id: 'chq-1', date: daysAgo(3), description: 'EMPLOYER DIRECT DEPOSIT', amount: 2375.00, category: 'income', isRecurring: true },
  { id: 'chq-2', date: daysAgo(17), description: 'EMPLOYER DIRECT DEPOSIT', amount: 2375.00, category: 'income', isRecurring: true },
  { id: 'chq-3', date: daysAgo(31), description: 'EMPLOYER DIRECT DEPOSIT', amount: 2375.00, category: 'income', isRecurring: true },
  { id: 'chq-4', date: daysAgo(45), description: 'EMPLOYER DIRECT DEPOSIT', amount: 2375.00, category: 'income', isRecurring: true },
  { id: 'chq-5', date: daysAgo(59), description: 'EMPLOYER DIRECT DEPOSIT', amount: 2375.00, category: 'income', isRecurring: true },
  { id: 'chq-6', date: daysAgo(73), description: 'EMPLOYER DIRECT DEPOSIT', amount: 2375.00, category: 'income', isRecurring: true },

  // Rent (3 months - $1,900/mo Toronto rental)
  { id: 'chq-7', date: daysAgo(1), description: 'E-TRANSFER TO LANDLORD', amount: -1900, category: 'other', isRecurring: true },
  { id: 'chq-8', date: daysAgo(30), description: 'E-TRANSFER TO LANDLORD', amount: -1900, category: 'other', isRecurring: true },
  { id: 'chq-9', date: daysAgo(61), description: 'E-TRANSFER TO LANDLORD', amount: -1900, category: 'other', isRecurring: true },

  // Transit - TTC monthly pass (3 months)
  { id: 'chq-10', date: daysAgo(2), description: 'PRESTO - TTC MONTHLY PASS', amount: -156.00, category: 'transportation', isRecurring: true },
  { id: 'chq-11', date: daysAgo(32), description: 'PRESTO - TTC MONTHLY PASS', amount: -156.00, category: 'transportation', isRecurring: true },
  { id: 'chq-12', date: daysAgo(63), description: 'PRESTO - TTC MONTHLY PASS', amount: -156.00, category: 'transportation', isRecurring: true },

  // Hydro (3 months)
  { id: 'chq-13', date: daysAgo(8), description: 'TORONTO HYDRO', amount: -72.50, category: 'utilities', isRecurring: true },
  { id: 'chq-14', date: daysAgo(38), description: 'TORONTO HYDRO', amount: -68.90, category: 'utilities', isRecurring: true },
  { id: 'chq-15', date: daysAgo(69), description: 'TORONTO HYDRO', amount: -74.15, category: 'utilities', isRecurring: true },

  // Internet ($55/mo - renter plan)
  { id: 'chq-16', date: daysAgo(20), description: 'BELL INTERNET', amount: -55.00, category: 'utilities', isRecurring: true },
  { id: 'chq-17', date: daysAgo(50), description: 'BELL INTERNET', amount: -55.00, category: 'utilities', isRecurring: true },
  { id: 'chq-18', date: daysAgo(81), description: 'BELL INTERNET', amount: -55.00, category: 'utilities', isRecurring: true },

  // Phone ($50/mo)
  { id: 'chq-19', date: daysAgo(7), description: 'KOODO MOBILE', amount: -50.00, category: 'utilities', isRecurring: true },
  { id: 'chq-20', date: daysAgo(37), description: 'KOODO MOBILE', amount: -50.00, category: 'utilities', isRecurring: true },
  { id: 'chq-21', date: daysAgo(68), description: 'KOODO MOBILE', amount: -50.00, category: 'utilities', isRecurring: true },

  // Tenant insurance ($30/mo)
  { id: 'chq-22', date: daysAgo(10), description: 'SQUARE ONE INSURANCE', amount: -30.00, category: 'insurance', isRecurring: true },
  { id: 'chq-23', date: daysAgo(40), description: 'SQUARE ONE INSURANCE', amount: -30.00, category: 'insurance', isRecurring: true },
  { id: 'chq-24', date: daysAgo(71), description: 'SQUARE ONE INSURANCE', amount: -30.00, category: 'insurance', isRecurring: true },

  // E-transfers (casual)
  { id: 'chq-25', date: daysAgo(10), description: 'E-TRANSFER SENT - ROOMMATE', amount: -50.00, category: 'transfer' },
  { id: 'chq-26', date: daysAgo(22), description: 'E-TRANSFER RECEIVED', amount: 35.00, category: 'transfer' },
  { id: 'chq-27', date: daysAgo(55), description: 'E-TRANSFER SENT - DINNER SPLIT', amount: -28.00, category: 'transfer' },
  { id: 'chq-28', date: daysAgo(78), description: 'E-TRANSFER SENT - UTILITIES SPLIT', amount: -40.00, category: 'transfer' },
];

// -- Credit card transactions (~90 days) -------------------------------------

const creditCardTransactions: Transaction[] = [
  // Groceries (~15 txns totalling ~$1,350/3mo = $450/mo)
  { id: 'cc-1', date: daysAgo(2), description: 'LOBLAWS #1247', amount: -78.43, category: 'groceries' },
  { id: 'cc-2', date: daysAgo(7), description: 'NO FRILLS', amount: -52.18, category: 'groceries' },
  { id: 'cc-3', date: daysAgo(12), description: 'METRO INC', amount: -63.90, category: 'groceries' },
  { id: 'cc-4', date: daysAgo(18), description: 'LOBLAWS #1247', amount: -98.25, category: 'groceries' },
  { id: 'cc-5', date: daysAgo(24), description: 'NO FRILLS', amount: -45.67, category: 'groceries' },
  { id: 'cc-6', date: daysAgo(30), description: 'LOBLAWS #1247', amount: -82.10, category: 'groceries' },
  { id: 'cc-7', date: daysAgo(36), description: 'METRO INC', amount: -71.30, category: 'groceries' },
  { id: 'cc-8', date: daysAgo(42), description: 'NO FRILLS', amount: -55.92, category: 'groceries' },
  { id: 'cc-9', date: daysAgo(49), description: 'LOBLAWS #1247', amount: -93.88, category: 'groceries' },
  { id: 'cc-10', date: daysAgo(55), description: 'METRO INC', amount: -49.55, category: 'groceries' },
  { id: 'cc-11', date: daysAgo(62), description: 'NO FRILLS', amount: -66.41, category: 'groceries' },
  { id: 'cc-12', date: daysAgo(69), description: 'LOBLAWS #1247', amount: -103.20, category: 'groceries' },
  { id: 'cc-13', date: daysAgo(76), description: 'METRO INC', amount: -58.30, category: 'groceries' },
  { id: 'cc-14', date: daysAgo(82), description: 'NO FRILLS', amount: -72.15, category: 'groceries' },
  { id: 'cc-15', date: daysAgo(88), description: 'LOBLAWS #1247', amount: -88.76, category: 'groceries' },

  // Dining/entertainment (~12 txns totalling ~$900/3mo = $300/mo)
  { id: 'cc-16', date: daysAgo(4), description: 'PAI NORTHERN THAI', amount: -42.50, category: 'dining' },
  { id: 'cc-17', date: daysAgo(11), description: 'STARBUCKS', amount: -6.85, category: 'dining' },
  { id: 'cc-18', date: daysAgo(19), description: 'UBER EATS', amount: -34.20, category: 'dining' },
  { id: 'cc-19', date: daysAgo(25), description: 'CINEPLEX VARSITY', amount: -17.50, category: 'entertainment' },
  { id: 'cc-20', date: daysAgo(33), description: 'KING WEST PUB', amount: -48.75, category: 'dining' },
  { id: 'cc-21', date: daysAgo(40), description: 'RAMEN ISSHIN', amount: -22.40, category: 'dining' },
  { id: 'cc-22', date: daysAgo(47), description: 'UBER EATS', amount: -38.90, category: 'dining' },
  { id: 'cc-23', date: daysAgo(54), description: 'STARBUCKS', amount: -5.95, category: 'dining' },
  { id: 'cc-24', date: daysAgo(60), description: 'CINEPLEX VARSITY', amount: -21.00, category: 'entertainment' },
  { id: 'cc-25', date: daysAgo(68), description: 'TIM HORTONS', amount: -8.45, category: 'dining' },
  { id: 'cc-26', date: daysAgo(77), description: 'STEAM GAMES', amount: -29.99, category: 'entertainment' },
  { id: 'cc-27', date: daysAgo(85), description: 'UBER EATS', amount: -33.50, category: 'dining' },

  // Subscriptions (3 months each - Spotify $12, Netflix $21, iCloud $4, Crave $10 = ~$47/mo)
  { id: 'cc-28', date: daysAgo(6), description: 'SPOTIFY PREMIUM', amount: -11.99, category: 'subscriptions', isRecurring: true },
  { id: 'cc-29', date: daysAgo(36), description: 'SPOTIFY PREMIUM', amount: -11.99, category: 'subscriptions', isRecurring: true },
  { id: 'cc-30', date: daysAgo(67), description: 'SPOTIFY PREMIUM', amount: -11.99, category: 'subscriptions', isRecurring: true },
  { id: 'cc-31', date: daysAgo(7), description: 'NETFLIX', amount: -20.99, category: 'subscriptions', isRecurring: true },
  { id: 'cc-32', date: daysAgo(37), description: 'NETFLIX', amount: -20.99, category: 'subscriptions', isRecurring: true },
  { id: 'cc-33', date: daysAgo(68), description: 'NETFLIX', amount: -20.99, category: 'subscriptions', isRecurring: true },
  { id: 'cc-34', date: daysAgo(14), description: 'APPLE ICLOUD+', amount: -3.99, category: 'subscriptions', isRecurring: true },
  { id: 'cc-35', date: daysAgo(44), description: 'APPLE ICLOUD+', amount: -3.99, category: 'subscriptions', isRecurring: true },
  { id: 'cc-36', date: daysAgo(75), description: 'APPLE ICLOUD+', amount: -3.99, category: 'subscriptions', isRecurring: true },
  { id: 'cc-37', date: daysAgo(9), description: 'CRAVE + MOVIES', amount: -9.99, category: 'subscriptions', isRecurring: true },
  { id: 'cc-38', date: daysAgo(39), description: 'CRAVE + MOVIES', amount: -9.99, category: 'subscriptions', isRecurring: true },
  { id: 'cc-39', date: daysAgo(70), description: 'CRAVE + MOVIES', amount: -9.99, category: 'subscriptions', isRecurring: true },

  // Health & fitness - GoodLife $55/mo (3x), Shoppers 2x ~$20
  { id: 'cc-40', date: daysAgo(14), description: 'GOODLIFE FITNESS', amount: -55.00, category: 'health', isRecurring: true },
  { id: 'cc-41', date: daysAgo(44), description: 'GOODLIFE FITNESS', amount: -55.00, category: 'health', isRecurring: true },
  { id: 'cc-42', date: daysAgo(75), description: 'GOODLIFE FITNESS', amount: -55.00, category: 'health', isRecurring: true },
  { id: 'cc-43', date: daysAgo(30), description: 'SHOPPERS DRUG MART', amount: -18.49, category: 'health' },
  { id: 'cc-44', date: daysAgo(72), description: 'SHOPPERS DRUG MART', amount: -24.99, category: 'health' },

  // Shopping (4 txns ~$240/3mo = $80/mo)
  { id: 'cc-45', date: daysAgo(20), description: 'AMAZON.CA', amount: -45.99, category: 'shopping' },
  { id: 'cc-46', date: daysAgo(38), description: 'UNIQLO EATON CENTRE', amount: -72.90, category: 'shopping' },
  { id: 'cc-47', date: daysAgo(58), description: 'AMAZON.CA', amount: -27.99, category: 'shopping' },
  { id: 'cc-48', date: daysAgo(80), description: 'WINNERS', amount: -52.45, category: 'shopping' },

  // Credit card payments (3x - keeps balance near zero)
  { id: 'cc-49', date: daysAgo(15), description: 'PAYMENT - THANK YOU', amount: 900.00, category: 'transfer' },
  { id: 'cc-50', date: daysAgo(45), description: 'PAYMENT - THANK YOU', amount: 850.00, category: 'transfer' },
  { id: 'cc-51', date: daysAgo(75), description: 'PAYMENT - THANK YOU', amount: 780.00, category: 'transfer' },
];

// -- Seed banking accounts ---------------------------------------------------

export const SEED_CHEQUING_ACCOUNT: Account = {
  id: 'seed-chequing',
  name: 'Wealthsimple Chequing',
  type: 'chequing',
  marketValue: 5000,
  holdings: [],
  transactions: chequingTransactions.sort((a, b) => b.date.localeCompare(a.date)),
};

export const SEED_CREDIT_CARD_ACCOUNT: Account = {
  id: 'seed-credit-card',
  name: 'Wealthsimple Credit Card',
  type: 'credit-card',
  marketValue: -800,
  holdings: [],
  transactions: creditCardTransactions.sort((a, b) => b.date.localeCompare(a.date)),
};
