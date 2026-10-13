import { query } from './db.js';

/**
 * Minimum Cash Flow Transfer Solver
 * Input: list of member objects with outstandingBalance
 */
export function solveMinCashFlow(memberBalances) {
  const debtors = [];
  const creditors = [];

  for (const mb of memberBalances) {
    const paise = Math.round(mb.outstandingBalance * 100);
    if (paise < -1) {
      debtors.push({ ...mb, amountPaise: Math.abs(paise) });
    } else if (paise > 1) {
      creditors.push({ ...mb, amountPaise: paise });
    }
  }

  const transfers = [];

  while (debtors.length > 0 && creditors.length > 0) {
    debtors.sort((a, b) => b.amountPaise - a.amountPaise);
    creditors.sort((a, b) => b.amountPaise - a.amountPaise);

    const debtor = debtors[0];
    const creditor = creditors[0];

    const transferPaise = Math.min(debtor.amountPaise, creditor.amountPaise);
    const amount = Number((transferPaise / 100).toFixed(2));

    // Shared expenses: Expenses paid by Creditor where Debtor was a participant
    const sharedExpenses = (debtor.participatedExpenses || []).filter(
      (e) => Number(e.payer_id) === Number(creditor.id)
    );

    transfers.push({
      payer_id: debtor.id,
      payer_name: debtor.name,
      payer_role: debtor.role,
      payer_upi_id: debtor.upi_id || null,
      payer_total_paid: debtor.totalPaid,
      payer_actual_share: debtor.actualShare,
      payer_net_debt: Math.abs(debtor.outstandingBalance),

      receiver_id: creditor.id,
      receiver_name: creditor.name,
      receiver_role: creditor.role,
      receiver_upi_id: creditor.upi_id || null,
      receiver_total_paid: creditor.totalPaid,
      receiver_actual_share: creditor.actualShare,
      receiver_net_credit: creditor.outstandingBalance,

      amount,

      // Itemized History for this transfer
      sharedExpenses,
      allPayerParticipatedExpenses: debtor.participatedExpenses || [],
      allPayerPaidExpenses: debtor.paidExpenses || [],
      allReceiverPaidExpenses: creditor.paidExpenses || []
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
  const membersRes = await query('SELECT id, name, role, upi_id FROM members ORDER BY id ASC');
  const members = membersRes.rows;

  // 2. Get all expenses for this month with payer details
  const expensesRes = await query(
    `SELECT e.id, e.title, e.date, e.category, e.amount, e.paid_by_member_id, e.split_method,
            m.name as payer_name
     FROM expenses e
     JOIN members m ON e.paid_by_member_id = m.id
     WHERE e.date LIKE ?
     ORDER BY e.date ASC, e.id ASC`,
    [`${month}-%`]
  );
  const expenses = expensesRes.rows.map((e) => ({
    ...e,
    amount: Number(e.amount)
  }));

  // 3. Get all participants for these expenses
  const participantsRes = await query(
    `SELECT ep.expense_id, ep.member_id, ep.allocated_amount, m.name as member_name 
     FROM expense_participants ep 
     JOIN expenses e ON ep.expense_id = e.id 
     JOIN members m ON ep.member_id = m.id
     WHERE e.date LIKE ?`,
    [`${month}-%`]
  );
  const participants = participantsRes.rows.map((p) => ({
    ...p,
    allocated_amount: Number(p.allocated_amount)
  }));

  // 4. Get all recorded settlements for this month
  const settlementsRes = await query(
    `SELECT s.id, s.month, s.payer_member_id, s.receiver_member_id, s.amount, s.status, s.payment_date, s.reference_note, s.created_at, s.completed_at,
            mp.name as payer_name, mr.name as receiver_name, mr.upi_id as receiver_upi_id
     FROM settlements s
     JOIN members mp ON s.payer_member_id = mp.id
     JOIN members mr ON s.receiver_member_id = mr.id
     WHERE s.month = ?
     ORDER BY s.id ASC`,
    [month]
  );
  const allSettlements = settlementsRes.rows.map((s) => ({
    ...s,
    amount: Number(s.amount)
  }));
  const completedSettlements = allSettlements.filter((s) => s.status === 'completed');

  // 5. Calculate member-wise balances and attach full itemized expenses
  const totalExpensesAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

  const memberSummary = members.map((member) => {
    // Expenses paid by this member
    const paidExpenses = expenses
      .filter((e) => Number(e.paid_by_member_id) === Number(member.id))
      .map((e) => {
        const expParts = participants.filter((p) => p.expense_id === e.id);
        return {
          id: e.id,
          title: e.title,
          date: e.date,
          category: e.category,
          amount: e.amount,
          split_method: e.split_method,
          participants_count: expParts.length
        };
      });

    const totalPaid = paidExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Expenses this member participated in
    const participatedExpenses = participants
      .filter((p) => Number(p.member_id) === Number(member.id))
      .map((p) => {
        const exp = expenses.find((e) => e.id === p.expense_id) || {};
        return {
          id: p.expense_id,
          title: exp.title,
          date: exp.date,
          category: exp.category,
          total_bill: exp.amount,
          payer_id: exp.paid_by_member_id,
          payer_name: exp.payer_name,
          allocated_share: p.allocated_amount
        };
      });

    const actualShare = participatedExpenses.reduce((sum, p) => sum + p.allocated_share, 0);

    // Net expense balance = Paid - Share
    const netBalance = Number((totalPaid - actualShare).toFixed(2));

    // Completed settlements paid by member
    const settlementPaid = completedSettlements
      .filter((s) => Number(s.payer_member_id) === Number(member.id))
      .reduce((sum, s) => sum + s.amount, 0);

    // Completed settlements received by member
    const settlementReceived = completedSettlements
      .filter((s) => Number(s.receiver_member_id) === Number(member.id))
      .reduce((sum, s) => sum + s.amount, 0);

    const settlementOffset = Number((settlementPaid - settlementReceived).toFixed(2));
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
      upi_id: member.upi_id || null,
      totalPaid: Number(totalPaid.toFixed(2)),
      actualShare: Number(actualShare.toFixed(2)),
      netBalance,
      settlementPaid: Number(settlementPaid.toFixed(2)),
      settlementReceived: Number(settlementReceived.toFixed(2)),
      settlementOffset,
      outstandingBalance,
      status,
      paidExpenses,
      participatedExpenses
    };
  });

  // 6. Generate recommended settlements using min-cash-flow
  const pendingRecommendations = solveMinCashFlow(memberSummary);

  // 7. Calculate month overview metrics
  const totalOutstandingToSettle = memberSummary
    .filter((m) => m.outstandingBalance > 0.01)
    .reduce((sum, m) => sum + m.outstandingBalance, 0);

  const pendingSettlementCount = pendingRecommendations.length;
  const isMonthSettled =
    expenses.length === 0 || (Math.abs(totalOutstandingToSettle) < 0.01 && pendingSettlementCount === 0);

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
    settlementStatus: isMonthSettled
      ? expenses.length === 0
        ? 'No Expenses'
        : 'Settled'
      : 'Pending Settlements'
  };
}
