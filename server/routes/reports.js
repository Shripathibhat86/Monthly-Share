import { Router } from 'express';
import { query } from '../db.js';
import { getMonthSettlementSummary } from '../settlementEngine.js';

const router = Router();

// Helper to get previous month string 'YYYY-MM'
function getPreviousMonth(monthStr) {
  const [year, month] = monthStr.split('-').map(Number);
  if (month === 1) {
    return `${year - 1}-12`;
  }
  const prevMonth = month - 1;
  return `${year}-${prevMonth < 10 ? '0' : ''}${prevMonth}`;
}

// GET monthly detailed report + Month-over-Month comparison
router.get('/monthly', async (req, res) => {
  try {
    const { month } = req.query;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Valid month (YYYY-MM) is required' });
    }

    const currentSummary = await getMonthSettlementSummary(month);

    // Category breakdown for current month
    const categoryRes = await query(
      `SELECT category, SUM(amount) as total, COUNT(*) as count 
       FROM expenses 
       WHERE date LIKE ? 
       GROUP BY category 
       ORDER BY total DESC`,
      [`${month}-%`]
    );

    const categories = categoryRes.rows.map(c => ({
      category: c.category,
      total: Number(c.total),
      count: Number(c.count),
      percentage: currentSummary.totalExpenses > 0
        ? Number(((Number(c.total) / currentSummary.totalExpenses) * 100).toFixed(1))
        : 0
    }));

    // Previous month comparison
    const prevMonth = getPreviousMonth(month);
    const prevSummary = await getMonthSettlementSummary(prevMonth);

    const momDiff = currentSummary.totalExpenses - prevSummary.totalExpenses;
    const momPercent = prevSummary.totalExpenses > 0
      ? Number(((momDiff / prevSummary.totalExpenses) * 100).toFixed(1))
      : 0;

    res.json({
      month,
      currentSummary,
      categories,
      momComparison: {
        previousMonth: prevMonth,
        previousTotal: prevSummary.totalExpenses,
        differenceAmount: Number(momDiff.toFixed(2)),
        differencePercentage: momPercent,
        trend: momDiff > 0 ? 'increase' : momDiff < 0 ? 'decrease' : 'unchanged'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET yearly report
router.get('/yearly', async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear().toString();

    // 12 months array
    const months = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      return `${year}-${m < 10 ? '0' : ''}${m}`;
    });

    const membersRes = await query('SELECT id, name, role FROM members ORDER BY id ASC');
    const members = membersRes.rows;

    const monthlyTrends = [];

    for (const m of months) {
      const sum = await getMonthSettlementSummary(m);
      const memberShares = {};
      const memberPaid = {};
      for (const mb of sum.memberSummary) {
        memberShares[mb.name] = mb.actualShare;
        memberPaid[mb.name] = mb.totalPaid;
      }

      monthlyTrends.push({
        month: m,
        totalExpenses: sum.totalExpenses,
        expenseCount: sum.expenseCount,
        memberShares,
        memberPaid,
        isSettled: sum.isMonthSettled
      });
    }

    // Yearly total & category breakdown
    const yearlyCatRes = await query(
      `SELECT category, SUM(amount) as total, COUNT(*) as count 
       FROM expenses 
       WHERE date LIKE ? 
       GROUP BY category 
       ORDER BY total DESC`,
      [`${year}-%`]
    );

    const totalYearlyExpenses = monthlyTrends.reduce((s, m) => s + m.totalExpenses, 0);

    res.json({
      year,
      totalYearlyExpenses: Number(totalYearlyExpenses.toFixed(2)),
      monthlyTrends,
      categories: yearlyCatRes.rows.map(c => ({
        category: c.category,
        total: Number(c.total),
        count: Number(c.count)
      })),
      members
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET participation report (focuses on User4 occasional member vs others)
router.get('/participation', async (req, res) => {
  try {
    const { month } = req.query;
    const filterSql = month ? 'WHERE e.date LIKE ?' : '';
    const params = month ? [`${month}-%`] : [];

    const membersRes = await query('SELECT id, name, role FROM members ORDER BY id ASC');
    const members = membersRes.rows;

    const expensesRes = await query(
      `SELECT e.id, e.title, e.date, e.category, e.amount, e.paid_by_member_id, m.name as payer_name 
       FROM expenses e 
       JOIN members m ON e.paid_by_member_id = m.id 
       ${filterSql} 
       ORDER BY e.date DESC`,
      params
    );
    const expenses = expensesRes.rows;
    const totalExpensesCount = expenses.length;

    // Fetch all participants
    const partsRes = await query(
      `SELECT ep.expense_id, ep.member_id, ep.allocated_amount 
       FROM expense_participants ep 
       JOIN expenses e ON ep.expense_id = e.id 
       ${filterSql}`,
      params
    );
    const participants = partsRes.rows;

    const report = members.map((member) => {
      const participatedExpenses = expenses.filter(e =>
        participants.some(p => p.expense_id === e.id && p.member_id === member.id)
      );

      const skippedExpenses = expenses.filter(e =>
        !participants.some(p => p.expense_id === e.id && p.member_id === member.id)
      );

      const totalAllocated = participants
        .filter(p => p.member_id === member.id)
        .reduce((sum, p) => sum + Number(p.allocated_amount), 0);

      const totalPaid = expenses
        .filter(e => e.paid_by_member_id === member.id)
        .reduce((sum, e) => sum + Number(e.amount), 0);

      const participationRate = totalExpensesCount > 0
        ? Number(((participatedExpenses.length / totalExpensesCount) * 100).toFixed(1))
        : 0;

      return {
        id: member.id,
        name: member.name,
        role: member.role,
        participatedCount: participatedExpenses.length,
        skippedCount: skippedExpenses.length,
        participationRate,
        totalAllocated: Number(totalAllocated.toFixed(2)),
        totalPaid: Number(totalPaid.toFixed(2)),
        participatedExpenses: participatedExpenses.map(e => ({
          id: e.id,
          title: e.title,
          date: e.date,
          amount: Number(e.amount),
          payerName: e.payer_name
        }))
      };
    });

    res.json({
      month: month || 'All Time',
      totalExpensesCount,
      members: report
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
