import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { recordAuditEvent } from '../services/auditLog.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { search, division, status } = req.query;
    const conditions = [`relationship = 'Trustee'`];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(org ILIKE $${params.length} OR org_id ILIKE $${params.length})`);
    }
    if (division && division !== 'All') {
      params.push(division);
      conditions.push(`(divisions = 'All' OR divisions ILIKE '%' || $${params.length} || '%')`);
    }
    if (status && status !== 'Any') {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    const { rows } = await pool.query(
      `SELECT * FROM authorized_organizations WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/trustors', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT org, scope AS roles, expires AS expiry, status
       FROM authorized_organizations WHERE relationship = 'Trustor' ORDER BY org`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

const addTrustSchema = z.object({
  orgName: z.string().min(1),
  orgId: z.string().min(1),
  relationship: z.string(), // 'Trustee (they administer us)' | 'Trustor (we administer them)'
  rolesGranted: z.string(),
  divisions: z.string(),
  expiryDate: z.string(),
  allowCloning: z.boolean().default(false),
  notifyOnSignIn: z.boolean().default(true),
  who: z.string().default('Faisal Khan'),
});

router.post('/', async (req, res, next) => {
  try {
    const form = addTrustSchema.parse(req.body);
    const relationship = form.relationship.startsWith('Trustee') ? 'Trustee' : 'Trustor';

    const { rows } = await pool.query(
      `INSERT INTO authorized_organizations
         (org_id, org, relationship, scope, divisions, expires, status, allow_cloning, notify_on_signin)
       VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$8)
       ON CONFLICT (org_id) DO UPDATE SET
         org = EXCLUDED.org, relationship = EXCLUDED.relationship, scope = EXCLUDED.scope, divisions = EXCLUDED.divisions,
         expires = EXCLUDED.expires, allow_cloning = EXCLUDED.allow_cloning,
         notify_on_signin = EXCLUDED.notify_on_signin, updated_at = now()
       RETURNING *`,
      [form.orgId, form.orgName, relationship, form.rolesGranted, form.divisions, form.expiryDate, form.allowCloning, form.notifyOnSignIn]
    );

    await recordAuditEvent({
      who: form.who,
      action_type: 'create',
      action_label: `Added Trust — ${form.orgName}`,
      detail: `Relationship: ${relationship} — Scope: ${form.rolesGranted}`,
    });

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

const updateTrustSchema = z.object({
  relationship: z.enum(['Trustee', 'Trustor']).optional(),
  scope: z.string().optional(),
  divisions: z.string().optional(),
  expires: z.string().optional(),
  status: z.enum(['active', 'owner', 'expiring', 'revoked']).optional(),
  who: z.string().default('Faisal Khan'),
});

router.patch('/:orgId', async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const body = updateTrustSchema.parse(req.body);

    const { rows } = await pool.query(
      `UPDATE authorized_organizations
       SET relationship = COALESCE($1, relationship), scope = COALESCE($2, scope),
           divisions = COALESCE($3, divisions), expires = COALESCE($4, expires),
           status = COALESCE($5, status), updated_at = now()
       WHERE org_id = $6
       RETURNING *`,
      [body.relationship, body.scope, body.divisions, body.expires, body.status, orgId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Organization not found' });

    const isRevoke = body.status === 'revoked';
    await recordAuditEvent({
      who: body.who,
      action_type: isRevoke ? 'delete' : 'edit',
      action_label: isRevoke ? `Revoked Trust — ${rows[0].org}` : `Updated Trust — ${rows[0].org}`,
      detail: isRevoke ? 'Reason: revoked via API' : `Scope: ${rows[0].scope}`,
    });

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
