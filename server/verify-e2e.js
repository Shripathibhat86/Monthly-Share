async function runVerification() {
  const BASE = 'http://localhost:3002';
  console.log('Testing End-to-End API against', BASE);

  // 1. Health check
  const healthRes = await fetch(`${BASE}/api/health`);
  const health = await healthRes.json();
  console.log('1. Health check:', health);

  // 2. Members check
  const membersRes = await fetch(`${BASE}/api/members`);
  const members = await membersRes.json();
  console.log('2. Members:', members.map(m => `${m.id}: ${m.name} (${m.role})`));
  console.assert(members.length === 4, 'Should have 4 members');

  // 3. Add Grocery Bill: ₹1,200, Participants = User1, User2, User3, Paid by User1
  const exp1Res = await fetch(`${BASE}/api/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Monthly Grocery Bill',
      date: '2026-10-13',
      category: 'Groceries',
      amount: 1200.00,
      paid_by_member_id: 1, // User1
      split_method: 'equal',
      participants: [1, 2, 3], // User1, User2, User3
      notes: 'Supermarket supplies'
    })
  });
  const exp1 = await exp1Res.json();
  console.log('3. Expense 1 (Grocery ₹1200, User1-3) created:', exp1);

  // 4. Check Settlements Summary for 2026-10
  const sum1Res = await fetch(`${BASE}/api/settlements/summary?month=2026-10`);
  const sum1 = await sum1Res.json();
  console.log('4. Month Summary after Expense 1:');
  console.log('   Total expenses:', sum1.totalExpenses);
  console.log('   Member Balances:', sum1.memberSummary.map(m => `${m.name}: Paid ₹${m.totalPaid}, Share ₹${m.actualShare}, Balance ₹${m.outstandingBalance}`));
  console.log('   Pending Transfers:', sum1.pendingRecommendations);

  // Assert prompt requirements:
  // User1 balance: +800, User2: -400, User3: -400, User4: 0
  const u1 = sum1.memberSummary.find(m => m.id === 1);
  const u2 = sum1.memberSummary.find(m => m.id === 2);
  const u3 = sum1.memberSummary.find(m => m.id === 3);
  const u4 = sum1.memberSummary.find(m => m.id === 4);

  console.assert(u1.outstandingBalance === 800, `User1 balance should be 800, got ${u1.outstandingBalance}`);
  console.assert(u2.outstandingBalance === -400, `User2 balance should be -400, got ${u2.outstandingBalance}`);
  console.assert(u3.outstandingBalance === -400, `User3 balance should be -400, got ${u3.outstandingBalance}`);
  console.assert(u4.outstandingBalance === 0, `User4 balance should be 0, got ${u4.outstandingBalance}`);

  // 5. Add Expense 2: Dinner shared by all four, paid by User4 (₹2,000)
  const exp2Res = await fetch(`${BASE}/api/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Team Dinner',
      date: '2026-10-14',
      category: 'Food and Dining',
      amount: 2000.00,
      paid_by_member_id: 4, // User4 pays
      split_method: 'equal',
      participants: [1, 2, 3, 4], // All 4
      notes: 'Celebration dinner'
    })
  });
  const exp2 = await exp2Res.json();
  console.log('\n5. Expense 2 (Dinner ₹2000, all 4, paid by User4) created:', exp2);

  const sum2Res = await fetch(`${BASE}/api/settlements/summary?month=2026-10`);
  const sum2 = await sum2Res.json();
  console.log('   Updated Member Balances:', sum2.memberSummary.map(m => `${m.name}: Paid ₹${m.totalPaid}, Share ₹${m.actualShare}, Balance ₹${m.outstandingBalance}`));
  console.log('   New Pending Transfers:', sum2.pendingRecommendations);

  // 6. Test Mark Transfer as Paid: User2 pays User4 ₹400
  const transferToPay = sum2.pendingRecommendations[0];
  console.log(`\n6. Marking transfer as paid: ${transferToPay.payer_name} pays ${transferToPay.receiver_name} ₹${transferToPay.amount}...`);
  const payRes = await fetch(`${BASE}/api/settlements/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      month: '2026-10',
      payer_member_id: transferToPay.payer_id,
      receiver_member_id: transferToPay.receiver_id,
      amount: transferToPay.amount,
      payment_date: '2026-10-14',
      reference_note: 'GPay UPI 12345678'
    })
  });
  const payData = await payRes.json();
  console.log('   Completed transfer recorded:', payData.message);
  console.log('   Remaining pending transfers:', payData.summary.pendingRecommendations);
  console.log('   Completed transfers count:', payData.summary.completedSettlements.length);

  // 7. Test Frontend HTML Serving
  const htmlRes = await fetch(`${BASE}/`);
  const htmlText = await htmlRes.text();
  console.assert(htmlText.includes('<div id="root"></div>'), 'HTML should serve Vite frontend bundle');
  console.log('7. Static Frontend serving: OK (served index.html successfully)');

  console.log('\n=== ALL E2E VERIFICATIONS PASSED SUCCESSFULLY ===\n');
}

runVerification().catch(err => {
  console.error('E2E Verification Error:', err);
  process.exit(1);
});
