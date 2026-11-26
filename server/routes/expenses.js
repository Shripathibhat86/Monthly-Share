import { Router } from 'express';
import { query } from '../db.js';
import { verifyMemberPinOrPassword } from '../auth.js';
import {
  calculateEqualSplit,
  calculatePercentageSplit,
  calculateWeightedSplit,
  validateCustomSplit
} from '../splitCalculator.js';

const router = Router();

function normalizeDate(d) {
  if (!d) return new Date().toISOString().slice(0, 10);
  if (typeof d === 'string') {
    const dmy = d.trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmy) {
      const day = dmy[1].padStart(2, '0');
      const month = dmy[2].padStart(2, '0');
      const year = dmy[3];
      return `${year}-${month}-${day}`;
    }
  }
  return d;
}

async function getOwnedMemberIds(userId) {
  const res = await query('SELECT id FROM members WHERE user_id = ?', [userId]);
  return new Set(res.rows.map((r) => Number(r.id)));
}

function validateAllocationsBelongToUser(allocations, ownedIds) {
  for (const alloc of allocations) {
    if (!ownedIds.has(Number(alloc.member_id))) {
      return false;
    }
  }
  return true;
}

// GET all expenses with filtering & sorting (scoped to signed-in user)
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
      WHERE e.user_id = ?
    `;
    const params = [req.user.id];

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
      sql += ' AND e.id IN (SELECT expense_id FROM expense_participants WHERE member_id = ?)';
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
    const expenseIds = expenses.map((e) => e.id);
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
    const result = expenses.map((e) => ({
      ...e,
      amount: Number(e.amount),
      participants: allParticipants
        .filter((p) => Number(p.expense_id) === Number(e.id))
        .map((p) => ({
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

// GET single expense by ID (scoped to signed-in user)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const expRes = await query(
      `SELECT e.*, m.name as payer_name 
       FROM expenses e 
       JOIN members m ON e.paid_by_member_id = m.id 
       WHERE e.id = ? AND e.user_id = ?`,
      [Number(id), req.user.id]
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
      [Number(id)]
    );

    expense.participants = partRes.rows.map((p) => ({
      ...p,
      allocated_amount: Number(p.allocated_amount),
      split_value: p.split_value != null ? Number(p.split_value) : null
    }));

    res.json(expense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET raw receipt attachment for an expense (scoped to signed-in user)
router.get('/:id/receipt', async (req, res) => {
  try {
    const { id } = req.params;
    const { download } = req.query;

    const expRes = await query(
      'SELECT receipt_data, receipt_filename FROM expenses WHERE id = ? AND user_id = ?',
      [Number(id), req.user.id]
    );

    if (expRes.rows.length === 0) {
      return res.status(404).send('Expense not found');
    }

    const { receipt_data, receipt_filename } = expRes.rows[0];

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
      res.setHeader('Cache-Control', 'private, max-age=86400');
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

// POST create expense (Auth + PIN/Password protected, scoped to signed-in user)
router.post('/', async (req, res) => {
  try {
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
      pin
    } = req.body;

    const checkPin = authorizing_pin || pin;
    const checkMemberId = authorizing_member_id || paid_by_member_id;

    if (!checkPin || !checkMemberId) {
      return res.status(401).json({ error: 'Password / PIN authorization is required to record an expense' });
    }

    const pinCheck = await verifyMemberPinOrPassword(req.user.id, checkMemberId, checkPin);
    if (!pinCheck.verified) {
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

    const ownedIds = await getOwnedMemberIds(req.user.id);
    if (!ownedIds.has(Number(paid_by_member_id))) {
      return res.status(403).json({ error: 'Selected payer does not belong to your account' });
    }

    const formattedDate = normalizeDate(date);

    // Calculate participant allocations
    let allocations = [];
    if (split_method === 'equal') {
      const pIds = Array.isArray(participants)
        ? participants.map((p) => (typeof p === 'object' ? p.member_id : p))
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

    if (!validateAllocationsBelongToUser(allocations, ownedIds)) {
      return res.status(403).json({ error: 'One or more participants do not belong to your account' });
    }

    const sumAllocated = allocations.reduce((s, a) => s + a.allocated_amount, 0);
    if (Math.abs(sumAllocated - numAmount) > 0.01) {
      return res.status(400).json({
        error: `Allocated shares sum (₹${sumAllocated.toFixed(2)}) must equal total expense amount (₹${numAmount.toFixed(2)})`
      });
    }

    const insertExp = await query(
      `INSERT INTO expenses 
       (user_id, title, date, category, amount, paid_by_member_id, split_method, notes, receipt_data, receipt_filename)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        req.user.id,
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

    const expenseId = insertExp.lastInsertRowid;

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

// POST batch import expenses (scoped to signed-in user)
router.post('/import', async (req, res) => {
  try {
    const {
      expenses: importList,
      authorizing_member_id,
      pin,
      authorizing_pin
    } = req.body;

    const checkPin = authorizing_pin || pin;
    if (!checkPin || !authorizing_member_id) {
      return res.status(401).json({ error: 'Password / PIN authorization is required to import expenses' });
    }

    const pinCheck = await verifyMemberPinOrPassword(req.user.id, authorizing_member_id, checkPin);
    if (!pinCheck.verified) {
      return res.status(401).json({ error: 'Incorrect authorization password / PIN' });
    }

    if (!Array.isArray(importList) || importList.length === 0) {
      return res.status(400).json({ error: 'No expenses provided in import list' });
    }

    const membersRes = await query('SELECT id, name FROM members WHERE user_id = ?', [req.user.id]);
    const allMembers = membersRes.rows;
    const allMemberIds = allMembers.map((m) => Number(m.id));
    const ownedIds = new Set(allMemberIds);

    let importedCount = 0;
    const insertedIds = [];

    for (const item of importList) {
      const {
        title,
        date,
        category,
        amount,
        paid_by_member_id,
        split_method = 'equal',
        participants = [],
        notes
      } = item;

      if (!title || !title.trim()) continue;
      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) continue;
      if (!paid_by_member_id || !ownedIds.has(Number(paid_by_member_id))) continue;

      const payerId = Number(paid_by_member_id);
      const formattedDate = normalizeDate(date);

      let pIds = Array.isArray(participants) && participants.length > 0
        ? participants
            .map((p) => Number(typeof p === 'object' ? p.member_id : p))
            .filter((id) => !isNaN(id) && ownedIds.has(id))
        : allMemberIds;

      if (pIds.length === 0) {
        pIds = allMemberIds;
      }

      let allocations = [];
      if (split_method === 'equal') {
        allocations = calculateEqualSplit(numAmount, pIds, payerId);
      } else if (split_method === 'custom' && Array.isArray(participants) && typeof participants[0] === 'object') {
        const filteredCustom = participants.filter((p) => ownedIds.has(Number(p.member_id)));
        allocations = validateCustomSplit(numAmount, filteredCustom);
      } else {
        allocations = calculateEqualSplit(numAmount, pIds, payerId);
      }

      const insertExp = await query(
        `INSERT INTO expenses 
         (user_id, title, date, category, amount, paid_by_member_id, split_method, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        [
          req.user.id,
          title.trim(),
          formattedDate,
          category || 'Other',
          numAmount,
          payerId,
          split_method || 'equal',
          notes ? notes.trim() : null
        ]
      );

      const expenseId = insertExp.lastInsertRowid;
      if (expenseId) {
        insertedIds.push(expenseId);
        for (const alloc of allocations) {
          await query(
            `INSERT INTO expense_participants (expense_id, member_id, allocated_amount, split_value)
             VALUES (?, ?, ?, ?)`,
            [expenseId, alloc.member_id, alloc.allocated_amount, alloc.split_value || null]
          );
        }
        importedCount++;
      }
    }

    res.status(201).json({
      success: true,
      message: `Successfully imported ${importedCount} expenses!`,
      importedCount,
      insertedIds
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update expense (scoped to signed-in user)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existingExp = await query('SELECT id FROM expenses WHERE id = ? AND user_id = ?', [Number(id), req.user.id]);
    if (existingExp.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

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

    const pinCheck = await verifyMemberPinOrPassword(req.user.id, checkMemberId, checkPin);
    if (!pinCheck.verified) {
      return res.status(401).json({ error: 'Incorrect authorization password / PIN' });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Valid expense amount is required' });
    }

    const ownedIds = await getOwnedMemberIds(req.user.id);
    if (!ownedIds.has(Number(paid_by_member_id))) {
      return res.status(403).json({ error: 'Selected payer does not belong to your account' });
    }

    const formattedDate = normalizeDate(date);

    let allocations = [];
    if (split_method === 'equal') {
      const pIds = Array.isArray(participants)
        ? participants.map((p) => (typeof p === 'object' ? p.member_id : p))
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

    if (!validateAllocationsBelongToUser(allocations, ownedIds)) {
      return res.status(403).json({ error: 'One or more participants do not belong to your account' });
    }

    if (receipt_data !== undefined) {
      await query(
        `UPDATE expenses 
         SET title = ?, date = ?, category = ?, amount = ?, paid_by_member_id = ?, 
             split_method = ?, notes = ?, receipt_data = ?, receipt_filename = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?`,
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
          Number(id),
          req.user.id
        ]
      );
    } else {
      await query(
        `UPDATE expenses 
         SET title = ?, date = ?, category = ?, amount = ?, paid_by_member_id = ?, 
             split_method = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?`,
        [title.trim(), formattedDate, category, numAmount, Number(paid_by_member_id), split_method, notes || null, Number(id), req.user.id]
      );
    }

    await query('DELETE FROM expense_participants WHERE expense_id = ?', [Number(id)]);
    for (const alloc of allocations) {
      await query(
        `INSERT INTO expense_participants (expense_id, member_id, allocated_amount, split_value)
         VALUES (?, ?, ?, ?)`,
        [Number(id), alloc.member_id, alloc.allocated_amount, alloc.split_value]
      );
    }

    res.json({ success: true, message: 'Expense updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Handler for deleting all or scoped expenses (strictly scoped to signed-in user)
async function handleDeleteAll(req, res) {
  try {
    const {
      pin,
      memberId,
      authorizing_pin,
      authorizing_member_id,
      scope = 'month',
      month,
      expenseIds
    } = req.body;

    const checkPin = pin || authorizing_pin;
    const checkMemberId = memberId || authorizing_member_id;

    if (!checkPin || !checkPin.toString().trim()) {
      return res.status(401).json({ error: 'Password / PIN authorization is required to delete expenses' });
    }

    const pinCheck = await verifyMemberPinOrPassword(req.user.id, checkMemberId || 'any', checkPin);
    if (!pinCheck.verified) {
      return res.status(401).json({ error: 'Incorrect authorization password / PIN' });
    }

    let deletedCount = 0;

    if (scope === 'filtered' && Array.isArray(expenseIds) && expenseIds.length > 0) {
      const validIds = expenseIds.map(Number).filter((n) => !isNaN(n) && n > 0);
      if (validIds.length > 0) {
        const placeholders = validIds.map(() => '?').join(',');
        const ownedRes = await query(
          `SELECT id FROM expenses WHERE user_id = ? AND id IN (${placeholders})`,
          [req.user.id, ...validIds]
        );
        const ownedExpIds = ownedRes.rows.map((r) => Number(r.id));
        if (ownedExpIds.length > 0) {
          const ownedPh = ownedExpIds.map(() => '?').join(',');
          await query(`DELETE FROM expense_participants WHERE expense_id IN (${ownedPh})`, ownedExpIds);
          const delRes = await query(
            `DELETE FROM expenses WHERE user_id = ? AND id IN (${ownedPh})`,
            [req.user.id, ...ownedExpIds]
          );
          deletedCount = delRes.changes || ownedExpIds.length;
        }
      }
    } else if (scope === 'all') {
      const allExp = await query('SELECT id FROM expenses WHERE user_id = ?', [req.user.id]);
      deletedCount = allExp.rows.length;
      if (deletedCount > 0) {
        await query(
          'DELETE FROM expense_participants WHERE expense_id IN (SELECT id FROM expenses WHERE user_id = ?)',
          [req.user.id]
        );
        await query('DELETE FROM expenses WHERE user_id = ?', [req.user.id]);
      }
    } else {
      const targetMonth = month || new Date().toISOString().slice(0, 7);
      const monthExp = await query(
        'SELECT id FROM expenses WHERE user_id = ? AND date LIKE ?',
        [req.user.id, `${targetMonth}-%`]
      );
      deletedCount = monthExp.rows.length;
      const ids = monthExp.rows.map((r) => Number(r.id));
      if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        await query(`DELETE FROM expense_participants WHERE expense_id IN (${placeholders})`, ids);
        await query(
          `DELETE FROM expenses WHERE user_id = ? AND id IN (${placeholders})`,
          [req.user.id, ...ids]
        );
      }
    }

    res.json({
      success: true,
      message: `Successfully deleted ${deletedCount} expense record${deletedCount === 1 ? '' : 's'}`,
      deletedCount,
      authorizedBy: pinCheck.member?.name
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

router.delete('/all', handleDeleteAll);
router.delete('/', handleDeleteAll);

// DELETE single expense (scoped to signed-in user)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (id === 'all') {
      return handleDeleteAll(req, res);
    }

    const expCheck = await query('SELECT id FROM expenses WHERE id = ? AND user_id = ?', [Number(id), req.user.id]);
    if (expCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const { pin, memberId, authorizing_pin, authorizing_member_id } = req.body;
    const checkPin = pin || authorizing_pin;
    const checkMemberId = memberId || authorizing_member_id;

    if (!checkPin) {
      return res.status(401).json({ error: 'Password / PIN authorization is required to delete an expense' });
    }

    const pinCheck = await verifyMemberPinOrPassword(req.user.id, checkMemberId || 'any', checkPin);
    if (!pinCheck.verified) {
      return res.status(401).json({ error: 'Incorrect authorization password / PIN' });
    }

    await query('DELETE FROM expense_participants WHERE expense_id = ?', [Number(id)]);
    await query('DELETE FROM expenses WHERE id = ? AND user_id = ?', [Number(id), req.user.id]);

    res.json({ success: true, message: 'Expense deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
