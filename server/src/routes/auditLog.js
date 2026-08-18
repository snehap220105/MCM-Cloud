import { Router } from 'express';
import { pool } from '../db/pool.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { search, who, type } = req.query;
    const conditions = [];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(action_label ILIKE $${params.length} OR detail ILIKE $${params.length})`);
    }
    if (who && who !== 'Everyone') {
      params.push(who);
      conditions.push(`who = $${params.length}`);
    }
    if (type && type !== 'All') {
      params.push(type);
      conditions.push(`action_type = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT * FROM audit_log ${where} ORDER BY occurred_at DESC, id DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
