import { query } from './db.js';

/**
 * Minimum Cash Flow Transfer Solver
 * Input: list of { id, name, balance } where balance is outstandingBalance
 * Positive = Creditor (should receive)
 * Negative = Debtor (owes)
 */
export function solveMinCashFlow(memberBalances) {
  // Use paise integers to eliminate floating point issues
  const debtors = [];
  const creditors = [];

  for (const mb of memberBalances) {
    const paise = Math.round(mb.outstandingBalance * 100);
    if (paise < -1) {
      debtors.push({ id: mb.id, name: mb.name, amountPaise: Math.abs(paise) });
    } else if (paise > 1) {
      creditors.push({ id: mb.id, name: mb.name, amountPaise: paise });
    }
  }

  const transfers = [];

  while (debtors.length > 0 && creditors.length > 0) {
    // Sort descending by amount
    debtors.sort((a, b) => b.amountPaise - a.amountPaise);
    creditors.sort((a, b) => b.amountPaise - a.amountPaise);

    const debtor = debtors[0];
    const creditor = creditors[0];

    const transferPaise = Math.min(debtor.amountPaise, creditor.amountPaise);
    transfers.push({
      payer_id: debtor.id,
      payer_name: debtor.name,
      receiver_id: creditor.id,
      receiver_name: creditor.name,
      amount: Number((transferPaise / 100).toFixed(2))
    });

    debtor.amountPaise -= transferPaise;
    creditor.amountPaise -= transferPaise;

    if (debtor.amountPaise <= 1) {
      debtors.shift();
    }
    if (creditor.amountPaise <= 1) {
      creditors.shift();
    }
  }

  return transfers;
}

/**
 * Calculates complete balances, settlements, and engine recommendations for a month (YYYY-MM)
 */
export async function getMonthSettlementSummary(month) {
  // 1. Get all members
  const membersRes = await query('SELECT id, name, role FROM members ORDER BY id ASC');
  const members = membersRes.rows;

  // 2. Get all expenses for this month
  const expensesRes = await query(
    'SELECT id, title, date, category, amount, paid_by_member_id FROM expenses WHERE date LIKE ? ORDER BY date ASC, id ASC',
    [`${month}-%`]
  );
  const expenses = expensesRes.rows;

  // 3. Get all participants for these expenses
  const participantsRes = await query(
    `SELECT ep.expense_id, ep.member_id, ep.allocated_amount 
     FROM expense_participants ep 
     JOIN expenses e ON ep.expense_id = e.id 
     WHERE e.date LIKE ?`,
    [`${month}-%`]
  );
  const participants = participantsRes.rows;

  // 4. Get all recorded settlements for this month
  const settlementsRes = await query(
    `SELECT s.id, s.month, s.payer_member_id, s.receiver_member_id, s.amount, s.status, s.payment_date, s.reference_note, s.created_at, s.completed_at,
            mp.name as payer_name, mr.name as receiver_name
     FROM settlements s
     JOIN members mp ON s.payer_member_id = mp.id
     JOIN members mr ON s.receiver_member_id = mr.id
     WHERE s.month = ?
     ORDER BY s.id ASC`,
    [month]
  );
  const allSettlements = settlementsRes.rows;
  const completedSettlements = allSettlements.filter(s => s.status === 'completed');

  // 5. Calculate member-wise balances
  const totalExpensesAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const memberSummary = members.map((member) => {
    // Total paid by member
    const totalPaid = expenses
      .filter((e) => Number(e.paid_by_member_id) === Number(member.id))
      .reduce((sum, e) => sum + Number(e.amount), 0);

    // Actual share allocated to member
    const actualShare = participants
      .filter((p) => Number(p.member_id) === Number(member.id))
      .reduce((sum, p) => sum + Number(p.allocated_amount), 0);

    // Net expense balance = Paid - Share
    const netBalance = Number((totalPaid - actualShare).toFixed(2));

    // Completed settlements paid by member
    const settlementPaid = completedSettlements
      .filter((s) => Number(s.payer_member_id) === Number(member.id))
      .reduce((sum, s) => sum + Number(s.amount), 0);

    // Completed settlements received by member
    const settlementReceived = completedSettlements
      .filter((s) => Number(s.receiver_member_id) === Number(member.id))
      .reduce((sum, s) => sum + Number(s.amount), 0);

    // Settlement adjustment: paid increases balance, received decreases balance
    const settlementOffset = Number((settlementPaid - settlementReceived).toFixed(2));

    // Outstanding balance: what is still owed / receivable
    const outstandingBalance = Number((netBalance + settlementOffset).toFixed(2));

    let status = 'settled';
    if (outstandingBalance > 0.01) {
      status = 'receivable';
    } else if (outstandingBalance < -0.01) {
      status = 'payable';
    }

    return {
      id: member.id,
      name: member.name,
      role: member.role,
      totalPaid: Number(totalPaid.toFixed(2)),
      actualShare: Number(actualShare.toFixed(2)),
      netBalance,
      settlementPaid: Number(settlementPaid.toFixed(2)),
      settlementReceived: Number(settlementReceived.toFixed(2)),
      settlementOffset,
      outstandingBalance,
      status
    };
  });

  // 6. Generate recommended settlements using min-cash-flow on remaining outstanding balances
  const pendingRecommendations = solveMinCashFlow(memberSummary);

  // 7. Calculate month overview metrics
  const totalOutstandingToSettle = memberSummary
    .filter((m) => m.outstandingBalance > 0.01)
    .reduce((sum, m) => sum + m.outstandingBalance, 0);

  const pendingSettlementCount = pendingRecommendations.length;
  const isMonthSettled = expenses.length === 0 || (Math.abs(totalOutstandingToSettle) < 0.01 && pendingSettlementCount === 0);

  return {
    month,
    totalExpenses: Number(totalExpensesAmount.toFixed(2)),
    expenseCount: expenses.length,
    totalAmountPaid: Number(totalExpensesAmount.toFixed(2)),
    memberSummary,
    pendingRecommendations,
    completedSettlements,
    allSettlements,
    totalOutstandingToSettle: Number(totalOutstandingToSettle.toFixed(2)),
    pendingSettlementCount,
    isMonthSettled,
    settlementStatus: isMonthSettled ? (expenses.length === 0 ? 'No Expenses' : 'Settled') : 'Pending Settlements'
  };
}
