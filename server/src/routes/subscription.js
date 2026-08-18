import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { recordAuditEvent } from '../services/auditLog.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const [licences, usage, invoices, plan] = await Promise.all([
      pool.query('SELECT * FROM subscription_licences ORDER BY id'),
      pool.query('SELECT * FROM subscription_usage ORDER BY id'),
      pool.query('SELECT * FROM subscription_invoices ORDER BY id'),
      pool.query('SELECT plan_label FROM subscription_plan WHERE id = 1'),
    ]);
    res.json({
      licences: licences.rows,
      usage: usage.rows,
      invoices: invoices.rows,
      planLabel: plan.rows[0]?.plan_label ?? null,
    });
  } catch (err) {
    next(err);
  }
});

const changePlanSchema = z.object({ planLabel: z.string().min(1), who: z.string().default('Faisal Khan') });

router.patch('/plan', async (req, res, next) => {
  try {
    const { planLabel, who } = changePlanSchema.parse(req.body);
    const { rows } = await pool.query(
      `UPDATE subscription_plan SET plan_label = $1, updated_at = now() WHERE id = 1 RETURNING plan_label`,
      [planLabel]
    );
    await recordAuditEvent({
      who,
      action_type: 'edit',
      action_label: 'Changed subscription plan',
      detail: `Plan changed to ${planLabel}`,
    });
    res.json({ planLabel: rows[0].plan_label });
  } catch (err) {
    next(err);
  }
});

export default router;
