import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { recordAuditEvent } from '../services/auditLog.js';

const router = Router();

router.get('/orders', async (req, res, next) => {
  try {
    const { search, division, status } = req.query;
    const conditions = [];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(id ILIKE $${params.length} OR item ILIKE $${params.length} OR requested_by ILIKE $${params.length})`);
    }
    if (division && division !== 'All') {
      params.push(division);
      conditions.push(`division = $${params.length}`);
    }
    if (status && status !== 'Any') {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT * FROM purchase_orders ${where} ORDER BY created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

async function nextOrderId() {
  const { rows } = await pool.query(
    `SELECT id FROM purchase_orders ORDER BY id DESC LIMIT 1`
  );
  const lastNum = rows[0] ? Number(rows[0].id.replace('ORD-', '')) : 4471;
  return `ORD-${lastNum + 1}`;
}

const newOrderSchema = z.object({
  product: z.string(),
  licenceModel: z.string(),
  quantity: z.coerce.number().int().positive(),
  startDate: z.string(),
  costCentre: z.string().optional(),
  approver: z.string().optional(),
  autoAssign: z.boolean().default(false),
  requestedBy: z.string().default('F. Khan'),
  division: z.string().default('Sales'),
});

router.post('/orders', async (req, res, next) => {
  try {
    const form = newOrderSchema.parse(req.body);
    const id = await nextOrderId();
    const item = `${form.product} (${form.licenceModel})`;

    const { rows } = await pool.query(
      `INSERT INTO purchase_orders (id, item, qty, status, requested_by, division, order_date, cost_centre, approver, auto_assign)
       VALUES ($1,$2,$3,'pending',$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [id, item, form.quantity, form.requestedBy, form.division, form.startDate, form.costCentre, form.approver, form.autoAssign]
    );

    await recordAuditEvent({
      who: form.requestedBy,
      action_type: 'create',
      action_label: `Created Purchase ${id}`,
      detail: `${item} — Qty ${form.quantity} — Pending approval`,
    });

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

const updateOrderSchema = z.object({
  item: z.string().optional(),
  qty: z.coerce.number().int().positive().optional(),
  status: z.enum(['provisioned', 'pending', 'cancelled']).optional(),
  requestedBy: z.string().optional(),
  date: z.string().optional(),
  who: z.string().default('Faisal Khan'),
});

router.patch('/orders/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const body = updateOrderSchema.parse(req.body);

    const { rows } = await pool.query(
      `UPDATE purchase_orders
       SET item = COALESCE($1, item), qty = COALESCE($2, qty), status = COALESCE($3, status),
           requested_by = COALESCE($4, requested_by), order_date = COALESCE($5, order_date), updated_at = now()
       WHERE id = $6
       RETURNING *`,
      [body.item, body.qty, body.status, body.requestedBy, body.date, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Order not found' });

    await recordAuditEvent({
      who: body.who,
      action_type: body.status === 'cancelled' ? 'delete' : 'edit',
      action_label: body.status === 'cancelled' ? `Cancelled Purchase ${id}` : `Updated Purchase ${id}`,
      detail: `${rows[0].item} — Qty ${rows[0].qty}`,
    });

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.get('/marketplace', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM marketplace_addons ORDER BY id');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/addons', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM active_addons ORDER BY id');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

const addToOrderSchema = z.object({ who: z.string().default('F. Khan') });

router.post('/marketplace/:id/add-to-order', async (req, res, next) => {
  try {
    const { who } = addToOrderSchema.parse(req.body ?? {});
    const { rows: addonRows } = await pool.query('SELECT * FROM marketplace_addons WHERE id = $1', [req.params.id]);
    const addon = addonRows[0];
    if (!addon) return res.status(404).json({ error: 'Add-on not found' });

    const id = await nextOrderId();
    const { rows } = await pool.query(
      `INSERT INTO purchase_orders (id, item, qty, status, requested_by, division, order_date)
       VALUES ($1,$2,1,'pending',$3,'Sales', to_char(now(), 'DD Mon YYYY'))
       RETURNING *`,
      [id, addon.name, who]
    );

    await recordAuditEvent({
      who,
      action_type: 'create',
      action_label: `Created Purchase ${id}`,
      detail: `${addon.name} — Qty 1 — Pending approval`,
    });

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
