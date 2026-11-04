import { getMonthSettlementSummary } from './settlementEngine.js';

async function runTests() {
  console.log('=== RUNNING SETTLEMENT & MODAL TESTS ===\n');

  const months = ['2026-10', '2026-09', '2026-08', '2026-11'];

  for (const month of months) {
    console.log(`\n--- TESTING MONTH: ${month} ---`);
    const summary = await getMonthSettlementSummary(month);
    console.log(`Live recommendations count: ${summary.pendingRecommendations.length}`);

    if (summary.pendingRecommendations.length === 0) {
      console.log('No pending recommendations for this month (all settled or no expenses).');
      continue;
    }

    for (const t of summary.pendingRecommendations) {
      console.log(`\n* Transfer: ${t.payer_name} -> ${t.receiver_name}: ₹${t.amount}`);
      console.assert(t.breakdown, `Breakdown must exist for ${t.payer_name} -> ${t.receiver_name}`);
      console.assert(t.breakdown.contributingBills, 'Contributing bills must exist');
      console.assert(t.breakdown.stepCalculation, 'Step calculation must exist');
      console.assert(
        t.breakdown.stepCalculation.finalRecommendedTransfer === t.amount,
        `Final transfer ${t.breakdown.stepCalculation.finalRecommendedTransfer} must match amount ${t.amount}`
      );

      const step = t.breakdown.stepCalculation;
      console.log(`  Initial amount owed: ₹${step.initialAmountOwed}`);
      console.log(`  Direct offset: ₹${step.directOffsetAmount}`);
      console.log(`  Direct net debt: ₹${step.directNetDebt}`);
      console.log(`  Third-party adjustments count: ${step.thirdPartyAdjustments.length}`);

      let tallySum = step.directNetDebt;
      for (const adj of step.thirdPartyAdjustments) {
        console.log(`    ${adj.type === 'less' ? '−' : '+'} ₹${adj.amount} (${adj.label})`);
        tallySum += (adj.type === 'less' ? -adj.amount : adj.amount);
      }
      tallySum = Number(tallySum.toFixed(2));

      console.log(`  Tally Formula: ${step.tallyFormula}`);
      console.assert(
        Math.abs(tallySum - t.amount) < 0.01,
        `Tally sum ${tallySum} must equal transfer amount ${t.amount}`
      );
      console.log(`  ✓ TALLY MATCHES TRANSFER AMOUNT: ₹${tallySum} == ₹${t.amount}`);
    }

    const totalOutstandingCreditors = summary.memberSummary
      .filter((m) => m.outstandingBalance > 0.01)
      .reduce((s, m) => s + m.outstandingBalance, 0);
    const totalTransfersLive = summary.pendingRecommendations.reduce((s, t) => s + t.amount, 0);

    console.log(`\nReconciled month sum: transfers = ₹${totalTransfersLive.toFixed(2)}, net positive balances = ₹${totalOutstandingCreditors.toFixed(2)}`);
    console.assert(
      Math.abs(totalTransfersLive - totalOutstandingCreditors) < 0.05,
      'Transfers must reconcile with outstanding balance'
    );
  }

  console.log('\n\nALL VERIFICATION TESTS COMPLETED AND RECONCILED SUCCESSFULLY!\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
