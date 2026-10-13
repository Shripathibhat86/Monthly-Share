import { query } from './db.js';

async function cleanup() {
  console.log('Cleaning up test data and placeholder User-named members...');

  // Remove test expenses from automated script
  await query('DELETE FROM expense_participants WHERE expense_id IN (1, 2)');
  await query('DELETE FROM expenses WHERE id IN (1, 2)');
  await query('DELETE FROM settlements WHERE id = 1');

  // Delete all members named 'User%'
  await query("DELETE FROM members WHERE name LIKE 'User%'");

  const remMembers = await query('SELECT id, name, role, pin FROM members ORDER BY id');
  console.log('\nActive Members:');
  console.table(remMembers.rows);

  const remExp = await query('SELECT id, title, amount, date FROM expenses ORDER BY id');
  console.log('\nCurrent Expenses:');
  console.table(remExp.rows);

  console.log('\nCleanup finished successfully.');
  process.exit(0);
}

cleanup().catch((err) => {
  console.error('Cleanup error:', err);
  process.exit(1);
});
