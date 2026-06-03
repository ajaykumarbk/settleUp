import { simplifyDebts } from './debtSimplifier.js';

// Mock users list
const users = [
  { id: 1, username: 'Alice' },
  { id: 2, username: 'Bob' },
  { id: 3, username: 'Charlie' },
  { id: 4, username: 'David' }
];

console.log('🧪 Starting Debt Simplification Tests...\n');

// Test Case 1: Simple 3-way circular debt
// Alice owes Bob $10, Bob owes Charlie $10, Charlie owes Alice $10 -> Net should be 0, no transactions
const balances1 = {
  1: 0, // Alice paid 10, owes 10 -> net 0
  2: 0, // Bob paid 10, owes 10 -> net 0
  3: 0  // Charlie paid 10, owes 10 -> net 0
};
const txs1 = simplifyDebts(balances1, users);
console.log('Test Case 1: Circular debts (Net 0)');
console.log('Result transactions (Expected: 0):', txs1.length);
console.log('-----------------------------------------');

// Test Case 2: Simple settlement
// Alice owes Bob $50, Charlie owes Bob $20
// Alice: -50, Charlie: -20, Bob: +70
const balances2 = {
  1: -50,
  2: 70,
  3: -20
};
const txs2 = simplifyDebts(balances2, users);
console.log('Test Case 2: Direct debts');
console.log('Result transactions (Expected: Alice pays Bob $50, Charlie pays Bob $20):');
txs2.forEach(tx => console.log(`👉 ${tx.fromUsername} pays ${tx.toUsername} $${tx.amount}`));
console.log('-----------------------------------------');

// Test Case 3: Complex multi-party split (Splitwise signature case)
// Alice paid $120 for dinner split equally between Alice, Bob, Charlie, David ($30 each).
// Bob paid $40 for drinks split equally between Bob, Charlie ($20 each).
// Charlie paid $60 for taxi split between Alice, Bob, Charlie ($20 each).
// Let's compute net balances:
// Alice:
//   Paid dinner: +120
//   Owes dinner: -30
//   Owes taxi: -20
//   Net: 120 - 30 - 20 = +70
// Bob:
//   Paid drinks: +40
//   Owes dinner: -30
//   Owes drinks: -20
//   Owes taxi: -20
//   Net: 40 - 30 - 20 - 20 = -30
// Charlie:
//   Paid taxi: +60
//   Owes dinner: -30
//   Owes drinks: -20
//   Owes taxi: -20
//   Net: 60 - 30 - 20 - 20 = -10
// David:
//   Owes dinner: -30
//   Net: -30
// Sum check: +70 (Alice) - 30 (Bob) - 10 (Charlie) - 30 (David) = 0. Correct!
const balances3 = {
  1: 70,  // Alice (Owed 70)
  2: -30, // Bob (Owes 30)
  3: -10, // Charlie (Owes 10)
  4: -30  // David (Owes 30)
};
const txs3 = simplifyDebts(balances3, users);
console.log('Test Case 3: Complex 4-party Splitwise scenario');
console.log('Result transactions (Expected: 2-3 simplified payments instead of 4):');
txs3.forEach(tx => console.log(`👉 ${tx.fromUsername} pays ${tx.toUsername} $${tx.amount}`));
console.log('-----------------------------------------');

console.log('✨ All tests executed.');
