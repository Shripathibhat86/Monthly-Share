import { Router } from 'express';
import { query } from '../db.js';
import {
  calculateEqualSplit,
  calculatePercentageSplit,
  calculateWeightedSplit,
  validateCustomSplit
} from '../splitCalculator.js';

const router = Router();

// Helper to normalize dates to YYYY-MM-DD
function normalizeDate(d) {
  if (!d) return new Date().toISOString().slice(0, 10);
  // If DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(d)) {
    const [day, month, year] = d.split('-');
    return `${year}-${month}-${day}`;
  }
  return d;
}

// GET all expenses with filtering & sorting
router.get('/', async (req, res) => {
  try {
    const { month, category, payerId, participantId, search, sortBy = 'date', sortOrder = 'desc' } = req.query;

    let sql = `
      SELECT e.id, e.title, e.date, e.category, e.amount, e.paid_by_member_id, e.split_method, e.notes,
             e.receipt_filename, CASE WHEN e.receipt_data IS NOT NULL THEN 1 ELSE 0 END as has_receipt,
             e.created_at, e.updated_at,
             m.name as payer_name
      FROM expenses e
      JOIN members m ON e.paid_by_member_id = m.id
      WHERE 1=1
    `;
    const params = [];

    if (month) {
      sql += ' AND e.date LIKE ?';
      params.push(`${month}-%`);
    }

    if (category) {
      sql += ' AND e.category = ?';
      params.push(category);
    }

    if (payerId) {
      sql += ' AND e.paid_by_member_id = ?';
      params.push(Number(payerId));
    }

    if (search) {
      sql += ' AND (e.title LIKE ? OR e.notes LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (participantId) {
      sql += ` AND e.id IN (SELECT expense_id FROM expense_participants WHERE member_id = ?)`;
      params.push(Number(participantId));
    }

    // Sort column validation
    const validSortCols = ['date', 'amount', 'created_at', 'title'];
    const col = validSortCols.includes(sortBy) ? sortBy : 'date';
    const direction = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    sql += ` ORDER BY e.${col} ${direction}, e.id ${direction}`;

    const expensesRes = await query(sql, params);
    const expenses = expensesRes.rows;

    if (expenses.length === 0) {
      return res.json([]);
    }

    // Fetch participants for these expenses
    const expenseIds = expenses.map(e => e.id);
    const placeholders = expenseIds.map(() => '?').join(',');
    const partSql = `
      SELECT ep.expense_id, ep.member_id, ep.allocated_amount, ep.split_value, m.name as member_name
      FROM expense_participants ep
      JOIN members m ON ep.member_id = m.id
      WHERE ep.expense_id IN (${placeholders})
    `;
    const participantsRes = await query(partSql, expenseIds);
    const allParticipants = participantsRes.rows;

    // Attach participants to each expense
    const result = expenses.map(e => ({
      ...e,
      amount: Number(e.amount),
      participants: allParticipants.filter(p => p.expense_id === e.id).map(p => ({
        member_id: p.member_id,
        member_name: p.member_name,
        allocated_amount: Number(p.allocated_amount),
        split_value: p.split_value != null ? Number(p.split_value) : null
      }))
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single expense by ID (includes receipt data)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const expRes = await query(
      `SELECT e.*, m.name as payer_name 
       FROM expenses e 
       JOIN members m ON e.paid_by_member_id = m.id 
       WHERE e.id = ?`,
      [id]
    );

    if (expRes.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const expense = expRes.rows[0];
    expense.amount = Number(expense.amount);

    const partRes = await query(
      `SELECT ep.*, m.name as member_name, m.role as member_role 
       FROM expense_participants ep 
       JOIN members m ON ep.member_id = m.id 
       WHERE ep.expense_id = ?`,
      [id]
    );

    expense.participants = partRes.rows.map(p => ({
      ...p,
      allocated_amount: Number(p.allocated_amount),
      split_value: p.split_value != null ? Number(p.split_value) : null
    }));

    res.json(expense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET raw receipt attachment for an expense (image or PDF)
router.get('/:id/receipt', async (req, res) => {
  try {
    const { id } = req.params;
    const { download } = req.query;

    const expRes = await query(
      `SELECT receipt_data, receipt_filename, title FROM expenses WHERE id = ?`,
      [id]
    );

    if (expRes.rows.length === 0) {
      return res.status(404).send('Expense not found');
    }

    const { receipt_data, receipt_filename, title } = expRes.rows[0];

    if (!receipt_data) {
      return res.status(404).send('No receipt attached to this expense');
    }

    const safeFilename = receipt_filename || `receipt-${id}.png`;

    const matches = receipt_data.match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
      const contentType = matches[1];
      const buffer = Buffer.from(matches[2], 'base64');

      res.setHeader('Content-Type', contentType);
      const disposition = download ? 'attachment' : 'inline';
      res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(safeFilename)}"`);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(buffer);
    }

    if (receipt_data.startsWith('http://') || receipt_data.startsWith('https://')) {
      return res.redirect(receipt_data);
    }

    res.setHeader('Content-Type', 'text/plain');
    res.send(receipt_data);
  } catch (err) {
    res.status(500).send(`Error retrieving receipt: ${err.message}`);
  }
});

// POST create expense (Protected with Password / PIN)
router.post('/', async (req, res) => {
  try {
    const {
      title,
      date,
      category,
      amount,
      paid_by_member_id,
      split_method,
      participants, // Array of member IDs or objects { member_id, percentage/weight/amount }
      notes,
      receipt_data,
      receipt_filename,
      authorizing_pin,
      authorizing_member_id,
      pin
    } = req.body;

    const checkPin = authorizing_pin || pin;
    const checkMemberId = authorizing_member_id || paid_by_member_id;

    if (!checkPin || !checkMemberId) {
      return res.status(401).json({ error: 'Password / PIN authorization is required to record an expense' });
    }

    const pinRes = await query('SELECT pin FROM members WHERE id = ?', [checkMemberId]);
    if (pinRes.rows.length === 0 || pinRes.rows[0].pin.trim() !== checkPin.toString().trim()) {
      return res.status(401).json({ error: 'Incorrect authorization password / PIN' });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Expense title is required' });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Expense amount must be a positive number' });
    }

    if (!paid_by_member_id) {
      return res.status(400).json({ error: 'Paid By member is required' });
    }

    const formattedDate = normalizeDate(date);

    // Calculate participant allocations
    let allocations = [];
    if (split_method === 'equal') {
      const pIds = Array.isArray(participants)
        ? participants.map(p => (typeof p === 'object' ? p.member_id : p))
        : [];
      allocations = calculateEqualSplit(numAmount, pIds, Number(paid_by_member_id));
    } else if (split_method === 'custom') {
      allocations = validateCustomSplit(numAmount, participants);
    } else if (split_method === 'percentage') {
      allocations = calculatePercentageSplit(numAmount, participants);
    } else if (split_method === 'weighted') {
      allocations = calculateWeightedSplit(numAmount, participants);
    } else {
      return res.status(400).json({ error: `Invalid split method: ${split_method}` });
    }

    // Verify sum matches amount to 2 decimal places
    const sumAllocated = allocations.reduce((s, a) => s + a.allocated_amount, 0);
    if (Math.abs(sumAllocated - numAmount) > 0.01) {
      return res.status(400).json({
        error: `Allocated shares sum (₹${sumAllocated.toFixed(2)}) must equal total expense amount (₹${numAmount.toFixed(2)})`
      });
    }

    // Insert into expenses
    const insertExp = await query(
      `INSERT INTO expenses 
       (title, date, category, amount, paid_by_member_id, split_method, notes, receipt_data, receipt_filename)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title.trim(),
        formattedDate,
        category || 'Other',
        numAmount,
        Number(paid_by_member_id),
        split_method,
        notes || null,
        receipt_data || null,
        receipt_filename || null
      ]
    );

    // In SQLite or Postgres, fetch inserted ID
    let expenseId = insertExp.lastInsertRowid;
    if (!expenseId) {
      const lastExp = await query('SELECT MAX(id) as id FROM expenses');
      expenseId = lastExp.rows[0].id;
    }

    // Insert participants
    for (const alloc of allocations) {
      await query(
        `INSERT INTO expense_participants (expense_id, member_id, allocated_amount, split_value)
         VALUES (?, ?, ?, ?)`,
        [expenseId, alloc.member_id, alloc.allocated_amount, alloc.split_value]
      );
    }

    res.status(201).json({
      success: true,
      expenseId,
      message: 'Expense recorded successfully'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update expense (PIN protected)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      date,
      category,
      amount,
      paid_by_member_id,
      split_method,
      participants,
      notes,
      receipt_data,
      receipt_filename,
      authorizing_pin,
      authorizing_member_id,
      pin,
      memberId
    } = req.body;

    const checkPin = authorizing_pin || pin;
    const checkMemberId = authorizing_member_id || memberId || paid_by_member_id;

    if (!checkPin || !checkMemberId) {
      return res.status(401).json({ error: 'Password / PIN authorization is required to edit an expense' });
    }

    const pinCheck = await query('SELECT pin FROM members WHERE id = ?', [checkMemberId]);
    if (pinCheck.rows.length === 0 || pinCheck.rows[0].pin.trim() !== checkPin.toString().trim()) {
      return res.status(401).json({ error: 'Incorrect authorization password / PIN' });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Valid expense amount is required' });
    }

    const formattedDate = normalizeDate(date);

    // Calculate participant allocations
    let allocations = [];
    if (split_method === 'equal') {
      const pIds = Array.isArray(participants)
        ? participants.map(p => (typeof p === 'object' ? p.member_id : p))
        : [];
      allocations = calculateEqualSplit(numAmount, pIds, Number(paid_by_member_id));
    } else if (split_method === 'custom') {
      allocations = validateCustomSplit(numAmount, participants);
    } else if (split_method === 'percentage') {
      allocations = calculatePercentageSplit(numAmount, participants);
    } else if (split_method === 'weighted') {
      allocations = calculateWeightedSplit(numAmount, participants);
    } else {
      return res.status(400).json({ error: `Invalid split method: ${split_method}` });
    }

    // Update expense record
    if (receipt_data !== undefined) {
      await query(
        `UPDATE expenses 
         SET title = ?, date = ?, category = ?, amount = ?, paid_by_member_id = ?, 
             split_method = ?, notes = ?, receipt_data = ?, receipt_filename = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          title.trim(),
          formattedDate,
          category,
          numAmount,
          Number(paid_by_member_id),
          split_method,
          notes || null,
          receipt_data,
          receipt_filename,
          id
        ]
      );
    } else {
      await query(
        `UPDATE expenses 
         SET title = ?, date = ?, category = ?, amount = ?, paid_by_member_id = ?, 
             split_method = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [title.trim(), formattedDate, category, numAmount, Number(paid_by_member_id), split_method, notes || null, id]
      );
    }

    // Replace participants
    await query('DELETE FROM expense_participants WHERE expense_id = ?', [id]);
    for (const alloc of allocations) {
      await query(
        `INSERT INTO expense_participants (expense_id, member_id, allocated_amount, split_value)
         VALUES (?, ?, ?, ?)`,
        [id, alloc.member_id, alloc.allocated_amount, alloc.split_value]
      );
    }

    res.json({ success: true, message: 'Expense updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Handler for deleting all or scoped expenses (PIN protected)
async function handleDeleteAll(req, res) {
  try {
    const {
      pin,
      memberId,
      authorizing_pin,
      authorizing_member_id,
      scope = 'month', // 'month', 'all', or 'filtered'
      month,
      expenseIds
    } = req.body;

    const checkPin = pin || authorizing_pin;
    const checkMemberId = memberId || authorizing_member_id;

    if (!checkPin || !checkPin.toString().trim()) {
      return res.status(401).json({ error: 'Password / PIN authorization is required to delete expenses' });
    }

    const cleanPin = checkPin.toString().trim();

    // Verify PIN against specific member or any member
    let verified = false;
    let authorizedMember = null;

    if (checkMemberId && checkMemberId !== 'any' && Number(checkMemberId) > 0) {
      const pinCheck = await query('SELECT id, name, pin FROM members WHERE id = ?', [Number(checkMemberId)]);
      if (pinCheck.rows.length > 0 && pinCheck.rows[0].pin.trim() === cleanPin) {
        verified = true;
        authorizedMember = pinCheck.rows[0];
      }
    } else {
      const allMembers = await query('SELECT id, name, pin FROM members');
      const matched = allMembers.rows.find((m) => m.pin.trim() === cleanPin);
      if (matched) {
        verified = true;
        authorizedMember = matched;
      }
    }

    if (!verified) {
      return res.status(401).json({ error: 'Incorrect authorization password / PIN' });
    }

    let deletedCount = 0;

    if (scope === 'filtered' && Array.isArray(expenseIds) && expenseIds.length > 0) {
      const validIds = expenseIds.map(Number).filter((n) => !isNaN(n) && n > 0);
      if (validIds.length > 0) {
        const placeholders = validIds.map(() => '?').join(',');
        await query(`DELETE FROM expense_participants WHERE expense_id IN (${placeholders})`, validIds);
        const delRes = await query(`DELETE FROM expenses WHERE id IN (${placeholders})`, validIds);
        deletedCount = delRes.changes || validIds.length;
      }
    } else if (scope === 'all') {
      const allExp = await query('SELECT id FROM expenses');
      deletedCount = allExp.rows.length;
      await query('DELETE FROM expense_participants');
      await query('DELETE FROM expenses');
    } else {
      // Default: scoped to month
      const targetMonth = month || new Date().toISOString().slice(0, 7);
      const monthExp = await query('SELECT id FROM expenses WHERE date LIKE ?', [`${targetMonth}-%`]);
      deletedCount = monthExp.rows.length;
      const ids = monthExp.rows.map((r) => r.id);
      if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        await query(`DELETE FROM expense_participants WHERE expense_id IN (${placeholders})`, ids);
        await query(`DELETE FROM expenses WHERE id IN (${placeholders})`, ids);
      }
    }

    res.json({
      success: true,
      message: `Successfully deleted ${deletedCount} expense record${deletedCount === 1 ? '' : 's'}`,
      deletedCount,
      authorizedBy: authorizedMember?.name
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// DELETE all or scoped expenses (mounted before /:id)
router.delete('/all', handleDeleteAll);
router.delete('/', handleDeleteAll);

// DELETE single expense (PIN protected)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (id === 'all') {
      return handleDeleteAll(req, res);
    }

    const { pin, memberId, authorizing_pin, authorizing_member_id } = req.body;
    const checkPin = pin || authorizing_pin;
    const checkMemberId = memberId || authorizing_member_id;

    if (!checkPin) {
      return res.status(401).json({ error: 'Password / PIN authorization is required to delete an expense' });
    }

    const cleanPin = checkPin.toString().trim();
    let verified = false;

    if (checkMemberId && checkMemberId !== 'any' && Number(checkMemberId) > 0) {
      const pinCheck = await query('SELECT pin FROM members WHERE id = ?', [Number(checkMemberId)]);
      if (pinCheck.rows.length > 0 && pinCheck.rows[0].pin.trim() === cleanPin) {
        verified = true;
      }
    } else {
      const allMembers = await query('SELECT pin FROM members');
      if (allMembers.rows.some((m) => m.pin.trim() === cleanPin)) {
        verified = true;
      }
    }

    if (!verified) {
      return res.status(401).json({ error: 'Incorrect authorization password / PIN' });
    }

    await query('DELETE FROM expense_participants WHERE expense_id = ?', [id]);
    await query('DELETE FROM expenses WHERE id = ?', [id]);

    res.json({ success: true, message: 'Expense deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
