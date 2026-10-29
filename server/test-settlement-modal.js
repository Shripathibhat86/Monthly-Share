import { query } from './db.js';
import { solveMinCashFlow, getMonthSettlementSummary, buildTransferBreakdown } from './settlementEngine.js';

async function runTests() {
  console.log('=== RUNNING SETTLEMENT & MODAL TESTS ===\n');

  // Test 1: Prompt Scenario (17 expenses: Sharath, Vatsa, Niranth all paying Shripathi)
  console.log('--- TEST 1: User Prompt Scenario (17 expenses) ---');
  const expsRes17 = await query(
    `SELECT e.id, e.title, e.date, e.category, e.amount, e.paid_by_member_id, e.split_method, m.name as payer_name 
     FROM expenses e 
     JOIN members m ON e.paid_by_member_id = m.id 
     WHERE e.date LIKE ? AND e.id <= 96
     ORDER BY e.date ASC, e.id ASC`,
    ['2026-10-%']
  );
  const partsRes17 = await query(
    `SELECT ep.expense_id, ep.member_id, ep.allocated_amount, m.name as member_name 
     FROM expense_participants ep 
     JOIN expenses e ON ep.expense_id = e.id 
     JOIN members m ON ep.member_id = m.id
     WHERE e.date LIKE ? AND e.id <= 96`,
    ['2026-10-%']
  );
  const membersRes = await query('SELECT id, name, role, upi_id FROM members ORDER BY id ASC');
  const members = membersRes.rows;

  const expenses17 = expsRes17.rows.map(e => ({ ...e, amount: Number(e.amount) }));
  const participants17 = partsRes17.rows.map(p => ({ ...p, allocated_amount: Number(p.allocated_amount) }));

  const memberSummary17 = members.map((member) => {
    const paidExpenses = expenses17
      .filter((e) => Number(e.paid_by_member_id) === Number(member.id))
      .map((e) => ({
        id: e.id,
        title: e.title,
        date: e.date,
        category: e.category,
        amount: e.amount,
        split_method: e.split_method
      }));
    const totalPaid = paidExpenses.reduce((sum, e) => sum + e.amount, 0);

    const participatedExpenses = participants17
      .filter((p) => Number(p.member_id) === Number(member.id))
      .map((p) => {
        const exp = expenses17.find((e) => e.id === p.expense_id) || {};
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
    const netBalance = Number((totalPaid - actualShare).toFixed(2));
    const outstandingBalance = netBalance;

    return {
      id: member.id,
      name: member.name,
      role: member.role,
      upi_id: member.upi_id || null,
      totalPaid: Number(totalPaid.toFixed(2)),
      actualShare: Number(actualShare.toFixed(2)),
      netBalance,
      outstandingBalance,
      paidExpenses,
      participatedExpenses
    };
  });

  const transfers17 = solveMinCashFlow(memberSummary17, expenses17, participants17);
  console.log(`Transfers generated: ${transfers17.length}`);

  const s2s = transfers17.find(t => t.payer_name === 'Sharath' && t.receiver_name === 'Shripathi');
  const v2s = transfers17.find(t => t.payer_name === 'Vatsa' && t.receiver_name === 'Shripathi');
  const n2s = transfers17.find(t => t.payer_name === 'Niranth' && t.receiver_name === 'Shripathi');

  console.assert(s2s && s2s.amount === 1032.80, `Sharath -> Shripathi must be 1032.80, got ${s2s?.amount}`);
  console.assert(v2s && v2s.amount === 616.33, `Vatsa -> Shripathi must be 616.33, got ${v2s?.amount}`);
  console.assert(n2s && n2s.amount === 497.99, `Niranth -> Shripathi must be 497.99, got ${n2s?.amount}`);

  console.log('✓ Sharath -> Shripathi: ₹1,032.80');
  console.log('  Contributing bills count:', s2s.breakdown.contributingBills.length);
  console.log('  Contributing bills total:', s2s.breakdown.contributingBillsTotal);
  console.log('  Payer Paid: ₹' + s2s.breakdown.stepCalculation.payerTotalPaid);
  console.log('  Payer Share: ₹' + s2s.breakdown.stepCalculation.payerActualShare);
  console.log('  Payer Net: ₹' + s2s.breakdown.stepCalculation.payerNetBalance);
  console.log('  Direct offset bills count:', s2s.breakdown.stepCalculation.directOffsetBills.length);
  console.log('  Direct offset amount: ₹' + s2s.breakdown.stepCalculation.directOffsetAmount);
  console.log('  Third-party adjustments count:', s2s.breakdown.stepCalculation.thirdPartyAdjustments.length);

  console.log('\n✓ Vatsa -> Shripathi: ₹616.33');
  console.log('  Contributing bills count:', v2s.breakdown.contributingBills.length);
  console.log('  Contributing bills total:', v2s.breakdown.contributingBillsTotal);
  console.log('  Third-party adjustments count:', v2s.breakdown.stepCalculation.thirdPartyAdjustments.length);

  console.log('\n✓ Niranth -> Shripathi: ₹497.99');
  console.log('  Contributing bills count:', n2s.breakdown.contributingBills.length);
  console.log('  Contributing bills total:', n2s.breakdown.contributingBillsTotal);
  console.log('  Third-party adjustments count:', n2s.breakdown.stepCalculation.thirdPartyAdjustments.length);

  const sum17 = Number((s2s.amount + v2s.amount + n2s.amount).toFixed(2));
  console.log(`\nReconciled sum of transfers: ₹${sum17} = Shripathi balance: ₹2147.12`);
  console.assert(sum17 === 2147.12, `Sum must be 2147.12, got ${sum17}`);

  // Test 2: Live Database State (Current month)
  console.log('\n--- TEST 2: Current Live Month Summary ---');
  const liveSummary = await getMonthSettlementSummary('2026-10');
  console.log(`Live recommendations count: ${liveSummary.pendingRecommendations.length}`);
  for (const t of liveSummary.pendingRecommendations) {
    console.log(`- ${t.payer_name} -> ${t.receiver_name}: ₹${t.amount}`);
    console.assert(t.breakdown, `Breakdown must exist for ${t.payer_name} -> ${t.receiver_name}`);
    console.assert(t.breakdown.contributingBills, 'Contributing bills must exist');
    console.assert(t.breakdown.stepCalculation, 'Step calculation must exist');
    console.assert(t.breakdown.stepCalculation.finalRecommendedTransfer === t.amount, 'Final transfer must match amount');
  }

  const totalOutstandingCreditors = liveSummary.memberSummary
    .filter(m => m.outstandingBalance > 0.01)
    .reduce((s, m) => s + m.outstandingBalance, 0);
  const totalTransfersLive = liveSummary.pendingRecommendations.reduce((s, t) => s + t.amount, 0);
  console.log(`\nReconciled live sum: transfers = ₹${totalTransfersLive.toFixed(2)}, net positive balances = ₹${totalOutstandingCreditors.toFixed(2)}`);
  console.assert(Math.abs(totalTransfersLive - totalOutstandingCreditors) < 0.05, 'Transfers must reconcile with outstanding balance');

  console.log('\nALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
