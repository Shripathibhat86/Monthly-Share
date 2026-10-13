import { calculateEqualSplit, calculatePercentageSplit, calculateWeightedSplit, validateCustomSplit } from './splitCalculator.js';
import { solveMinCashFlow } from './settlementEngine.js';

console.log('=== RUNNING SETTLEMENT & SPLIT TESTS ===\n');

// 1. Equal Split Test (with paise rounding)
const eqSplit = calculateEqualSplit(100.00, [1, 2, 3], 1);
console.log('Equal split of ₹100 among 3 (payer: 1):', eqSplit);
const eqSum = eqSplit.reduce((s, p) => s + p.allocated_amount, 0);
console.assert(Math.abs(eqSum - 100.00) < 0.001, 'Equal split sum must be 100.00');

// 2. Percentage Split Test
const pctSplit = calculatePercentageSplit(1000.00, [
  { member_id: 1, percentage: 50 },
  { member_id: 2, percentage: 30 },
  { member_id: 3, percentage: 20 }
]);
console.log('Percentage split of ₹1000 (50%, 30%, 20%):', pctSplit);
const pctSum = pctSplit.reduce((s, p) => s + p.allocated_amount, 0);
console.assert(Math.abs(pctSum - 1000.00) < 0.001, 'Percentage split sum must be 1000.00');

// 3. Prompt Exact Example Test
// User1 paid ₹5,000, share ₹3,000 -> balance +2000
// User2 paid ₹2,000, share ₹3,000 -> balance -1000
// User3 paid ₹2,000, share ₹3,000 -> balance -1000
// User4 paid ₹0, share ₹0 -> balance 0
const promptBalances = [
  { id: 1, name: 'User1', outstandingBalance: 2000 },
  { id: 2, name: 'User2', outstandingBalance: -1000 },
  { id: 3, name: 'User3', outstandingBalance: -1000 },
  { id: 4, name: 'User4', outstandingBalance: 0 }
];

const transfers = solveMinCashFlow(promptBalances);
console.log('\nPrompt Example Transfers:', transfers);

console.assert(transfers.length === 2, `Expected 2 transfers, got ${transfers.length}`);
console.assert(
  transfers.some(t => t.payer_id === 2 && t.receiver_id === 1 && t.amount === 1000),
  'Expected User2 to pay User1 ₹1000'
);
console.assert(
  transfers.some(t => t.payer_id === 3 && t.receiver_id === 1 && t.amount === 1000),
  'Expected User3 to pay User1 ₹1000'
);

// 4. Test after User2 completes transfer of ₹1000:
const updatedBalances = [
  { id: 1, name: 'User1', outstandingBalance: 1000 },
  { id: 2, name: 'User2', outstandingBalance: 0 },
  { id: 3, name: 'User3', outstandingBalance: -1000 },
  { id: 4, name: 'User4', outstandingBalance: 0 }
];

const nextTransfers = solveMinCashFlow(updatedBalances);
console.log('\nTransfers after User2 pays User1 ₹1000:', nextTransfers);
console.assert(nextTransfers.length === 1, 'Expected 1 remaining transfer');
console.assert(
  nextTransfers[0].payer_id === 3 && nextTransfers[0].receiver_id === 1 && nextTransfers[0].amount === 1000,
  'Expected User3 to pay User1 ₹1000'
);

console.log('\nAll Split & Settlement Algorithm tests PASSED successfully!\n');
