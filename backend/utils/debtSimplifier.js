/**
 * Greedy debt simplification algorithm.
 * Takes net balances of users and returns a list of minimal transactions to settle all debts.
 * 
 * @param {Object} memberBalances - Map of user_id to net balance (positive = owed, negative = owes)
 * @param {Array} usersList - Array of user objects (id, username, email, etc.) to append user metadata
 * @returns {Array} List of simplified transactions: { fromUser: Object, toUser: Object, amount: Number }
 */
export function simplifyDebts(memberBalances, usersList = []) {
  const userMap = new Map(usersList.map(u => [u.id, u]));

  // Separate into debtors and creditors
  let debtors = [];
  let creditors = [];

  for (const [userIdStr, balance] of Object.entries(memberBalances)) {
    const userId = parseInt(userIdStr);
    const roundedBalance = Math.round(balance * 100) / 100; // Round to 2 decimal places

    if (roundedBalance < -0.01) {
      debtors.push({ userId, balance: roundedBalance });
    } else if (roundedBalance > 0.01) {
      creditors.push({ userId, balance: roundedBalance });
    }
  }

  const transactions = [];

  // Sort debtors ascending (most negative first)
  // Sort creditors descending (most positive first)
  debtors.sort((a, b) => a.balance - b.balance);
  creditors.sort((a, b) => b.balance - a.balance);

  let debtorIdx = 0;
  let creditorIdx = 0;

  while (debtorIdx < debtors.length && creditorIdx < creditors.length) {
    const debtor = debtors[debtorIdx];
    const creditor = creditors[creditorIdx];

    // Amount to settle is the minimum of debtor's debt or creditor's credit
    const debtorOwes = -debtor.balance;
    const creditorOwed = creditor.balance;
    const settleAmount = Math.round(Math.min(debtorOwes, creditorOwed) * 100) / 100;

    if (settleAmount > 0) {
      const fromUser = userMap.get(debtor.userId) || { id: debtor.userId, username: `User ${debtor.userId}` };
      const toUser = userMap.get(creditor.userId) || { id: creditor.userId, username: `User ${creditor.userId}` };

      transactions.push({
        from: debtor.userId,
        to: creditor.userId,
        fromUsername: fromUser.username,
        toUsername: toUser.username,
        amount: settleAmount
      });
    }

    // Update balances
    debtor.balance += settleAmount;
    creditor.balance -= settleAmount;

    // Move pointers if fully settled
    if (Math.abs(debtor.balance) < 0.01) {
      debtorIdx++;
    }
    if (Math.abs(creditor.balance) < 0.01) {
      creditorIdx++;
    }
  }

  return transactions;
}
