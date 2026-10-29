import { query } from './db.js';

/**
 * Minimum Cash Flow Transfer Solver
 * Input: list of member objects with outstandingBalance
 */
/**
 * Helper to build user-friendly, transparent calculation breakdown for a recommended transfer
 */
export function buildTransferBreakdown(transfer, memberSummary = [], allExpenses = [], allParticipants = []) {
  const payer = memberSummary.find((m) => Number(m.id) === Number(transfer.payer_id)) || {
    id: transfer.payer_id,
    name: transfer.payer_name,
    totalPaid: transfer.payer_total_paid || 0,
    actualShare: transfer.payer_actual_share || 0,
    netBalance: -(transfer.amount || 0)
  };
  const receiver = memberSummary.find((m) => Number(m.id) === Number(transfer.receiver_id)) || {
    id: transfer.receiver_id,
    name: transfer.receiver_name,
    totalPaid: transfer.receiver_total_paid || 0,
    actualShare: transfer.receiver_actual_share || 0,
    netBalance: transfer.amount || 0
  };

  const payerTotalPaid = Number((payer.totalPaid || 0).toFixed(2));
  const payerActualShare = Number((payer.actualShare || 0).toFixed(2));
  const payerNetBalance = Number((payerTotalPaid - payerActualShare).toFixed(2));

  // Direct bills: Expenses paid by Receiver where Payer was a participant
  const payerOwedBillsToReceiver = (payer.participatedExpenses || [])
    .filter((p) => Number(p.payer_id) === Number(receiver.id))
    .map((p) => ({
      id: p.id,
      date: p.date,
      title: p.title,
      category: p.category,
      total_bill: Number(p.total_bill),
      paid_by_id: Number(receiver.id),
      paid_by_name: receiver.name,
      payer_share: Number(p.allocated_share),
      is_receiver_bill: true,
      explanation: `${payer.name} owes this share because ${receiver.name} paid the bill.`
    }));

  // Direct offsets: Expenses paid by Payer where Receiver was a participant
  const receiverOwedBillsToPayer = [];
  if (allParticipants.length > 0 && allExpenses.length > 0) {
    const payerExpenseIds = allExpenses
      .filter((e) => Number(e.paid_by_member_id) === Number(payer.id))
      .map((e) => e.id);

    allParticipants
      .filter((p) => payerExpenseIds.includes(p.expense_id) && Number(p.member_id) === Number(receiver.id))
      .forEach((p) => {
        const exp = allExpenses.find((e) => e.id === p.expense_id);
        if (exp) {
          receiverOwedBillsToPayer.push({
            id: exp.id,
            date: exp.date,
            title: exp.title,
            category: exp.category,
            total_bill: Number(exp.amount),
            paid_by_id: Number(payer.id),
            paid_by_name: payer.name,
            receiver_share: Number(p.allocated_amount)
          });
        }
      });
  }

  const directOwedToReceiver = Number(payerOwedBillsToReceiver.reduce((s, b) => s + b.payer_share, 0).toFixed(2));
  const directOffsetFromPayer = Number(receiverOwedBillsToPayer.reduce((s, b) => s + b.receiver_share, 0).toFixed(2));
  const directNetDebt = Number((directOwedToReceiver - directOffsetFromPayer).toFixed(2));

  let contributingBills = [];
  let initialAmountOwed = 0;
  let initialAmountOwedLabel = '';
  const thirdPartyAdjustments = [];

  if (payerTotalPaid <= 0.01) {
    // Pure debtor: All bills payer participated in contribute directly to their debt
    contributingBills = (payer.participatedExpenses || []).map((p) => {
      const isRec = Number(p.payer_id) === Number(receiver.id);
      return {
        id: p.id,
        date: p.date,
        title: p.title,
        category: p.category,
        total_bill: Number(p.total_bill),
        paid_by_id: Number(p.payer_id),
        paid_by_name: p.payer_name,
        payer_share: Number(p.allocated_share),
        is_receiver_bill: isRec,
        explanation: isRec
          ? `${payer.name} owes this share because ${receiver.name} paid the bill.`
          : `${payer.name} owes this share for a bill paid by ${p.payer_name}, consolidated into transfer to ${receiver.name}.`
      };
    });

    initialAmountOwed = directOwedToReceiver;
    initialAmountOwedLabel = `Direct share of bills paid by ${receiver.name}`;

    for (const other of memberSummary) {
      if (Number(other.id) === Number(payer.id) || Number(other.id) === Number(receiver.id)) continue;
      const owesOther = (payer.participatedExpenses || [])
        .filter((p) => Number(p.payer_id) === Number(other.id))
        .reduce((s, p) => s + Number(p.allocated_share), 0);

      if (owesOther > 0.009) {
        const otherIsDebtor = (other.outstandingBalance || 0) < -0.01;
        const description = otherIsDebtor
          ? `${payer.name} owes ₹${owesOther.toFixed(2)} for bills paid by ${other.name}. Because ${other.name} is also a net debtor in the group, the settlement algorithm directs ${payer.name} to transfer this share directly to ${receiver.name} (settling ${payer.name}'s debt to ${other.name} and crediting ${other.name}'s balance).`
          : `${payer.name} owes ₹${owesOther.toFixed(2)} for bills paid by ${other.name}. In the consolidated settlement, ${payer.name} transfers this share directly to ${receiver.name} to settle net balances in the fewest payments.`;

        thirdPartyAdjustments.push({
          member_id: other.id,
          member_name: other.name,
          amount: Number(owesOther.toFixed(2)),
          type: 'add',
          label: `Consolidated debt for bills paid by ${other.name}`,
          description
        });
      }
    }
  } else {
    // Payer who also paid expenses: contributing bills are bills paid by receiver that payer participated in
    contributingBills = payerOwedBillsToReceiver;
    initialAmountOwed = directOwedToReceiver;
    initialAmountOwedLabel = `Initial amount owed (bills paid by ${receiver.name})`;

    for (const other of memberSummary) {
      if (Number(other.id) === Number(payer.id) || Number(other.id) === Number(receiver.id)) continue;

      let otherOwesPayer = 0;
      let payerOwesOther = 0;

      if (allParticipants.length > 0 && allExpenses.length > 0) {
        const payerExpenseIds = allExpenses
          .filter((e) => Number(e.paid_by_member_id) === Number(payer.id))
          .map((e) => e.id);
        otherOwesPayer = allParticipants
          .filter((p) => payerExpenseIds.includes(p.expense_id) && Number(p.member_id) === Number(other.id))
          .reduce((s, p) => s + Number(p.allocated_amount), 0);

        const otherExpenseIds = allExpenses
          .filter((e) => Number(e.paid_by_member_id) === Number(other.id))
          .map((e) => e.id);
        payerOwesOther = allParticipants
          .filter((p) => otherExpenseIds.includes(p.expense_id) && Number(p.member_id) === Number(payer.id))
          .reduce((s, p) => s + Number(p.allocated_amount), 0);
      }

      const netWithOther = Number((otherOwesPayer - payerOwesOther).toFixed(2));

      if (netWithOther > 0.009) {
        thirdPartyAdjustments.push({
          member_id: other.id,
          member_name: other.name,
          amount: netWithOther,
          type: 'less',
          label: `${other.name}'s debt to ${payer.name} transferred to ${receiver.name}`,
          description: `${other.name} owes ₹${netWithOther.toFixed(2)} to ${payer.name} for expenses paid by ${payer.name}. In the consolidated settlement, ${other.name} pays ${receiver.name} directly, reducing ${payer.name}'s required transfer to ${receiver.name} by ₹${netWithOther.toFixed(2)}.`
        });
      } else if (netWithOther < -0.009) {
        const debtToOther = Math.abs(netWithOther);
        thirdPartyAdjustments.push({
          member_id: other.id,
          member_name: other.name,
          amount: debtToOther,
          type: 'add',
          label: `Consolidated debt for bills paid by ${other.name}`,
          description: `${payer.name} owes ₹${debtToOther.toFixed(2)} for bills paid by ${other.name}. In the consolidated settlement, this is routed directly to ${receiver.name} to minimize transactions.`
        });
      }
    }
  }

  const contributingBillsTotal = Number(contributingBills.reduce((s, b) => s + b.payer_share, 0).toFixed(2));

  return {
    summaryExplanation:
      'This amount is calculated from the difference between the amount you paid and your share of the expenses, after accounting for the other participants\' balances.',
    contributingBills,
    contributingBillsTotal,
    stepCalculation: {
      payerTotalPaid,
      payerActualShare,
      payerNetBalance,
      payerStatusText: `${payer.name} owes an overall net balance of ₹${Math.abs(payerNetBalance).toFixed(2)} across all expenses.`,
      initialAmountOwed,
      initialAmountOwedLabel,
      directOffsetBills: receiverOwedBillsToPayer,
      directOffsetAmount: directOffsetFromPayer,
      directNetDebt,
      thirdPartyAdjustments,
      totalAdjustmentsAmount: Number(thirdPartyAdjustments.reduce((s, a) => s + a.amount, 0).toFixed(2)),
      finalRecommendedTransfer: transfer.amount
    }
  };
}

/**
 * Minimum Cash Flow Transfer Solver
 * Input: list of member objects with outstandingBalance
 */
export function solveMinCashFlow(memberBalances, allExpenses = [], allParticipants = []) {
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

    const rawTransfer = {
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

      // Itemized History for this transfer (backward-compatible fields)
      sharedExpenses,
      allPayerParticipatedExpenses: debtor.participatedExpenses || [],
      allPayerPaidExpenses: debtor.paidExpenses || [],
      allReceiverPaidExpenses: creditor.paidExpenses || []
    };

    // Attach rich, transparent calculation breakdown
    rawTransfer.breakdown = buildTransferBreakdown(
      rawTransfer,
      memberBalances,
      allExpenses,
      allParticipants
    );

    transfers.push(rawTransfer);

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
  const pendingRecommendations = solveMinCashFlow(memberSummary, expenses, participants);

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
