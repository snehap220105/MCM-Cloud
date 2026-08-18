import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { recordAuditEvent } from '../services/auditLog.js';
import { requestOtp, confirmOtp } from '../services/telnyx.js';

const router = Router();

// In-memory map of phone_number -> Telnyx verification id, for the short
// window between request-otp and confirm-otp. Fine for a single-instance
// demo server; a real deployment would use a table with an expiry.
const pendingVerifications = new Map();

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM organization_settings ORDER BY tab_name, id'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

const patchRowSchema = z.object({
  value: z.string().nullable().optional(),
  state: z.enum(['enabled', 'disabled']).nullable().optional(),
  who: z.string().default('Faisal Khan'),
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const body = patchRowSchema.parse(req.body);

    const { rows: existingRows } = await pool.query(
      'SELECT * FROM organization_settings WHERE id = $1',
      [id]
    );
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: 'Setting not found' });
    if (existing.status === 'Locked') return res.status(409).json({ error: 'This setting is locked' });

    const { rows } = await pool.query(
      `UPDATE organization_settings
       SET value = COALESCE($1, value), state = COALESCE($2, state), last_changed = now(), updated_at = now()
       WHERE id = $3
       RETURNING *`,
      [body.value ?? null, body.state ?? null, id]
    );
    const updated = rows[0];

    await recordAuditEvent({
      who: body.who,
      action_type: 'edit',
      action_label: `Updated Organization Settings — ${updated.tab_name}`,
      detail: `${updated.setting_label} changed to ${updated.value ?? updated.state}`,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

const otpRequestSchema = z.object({ phone_number: z.string().min(8) });

router.post('/contact-phone/request-otp', async (req, res, next) => {
  try {
    const { phone_number } = otpRequestSchema.parse(req.body);
    const verificationId = await requestOtp(phone_number);
    pendingVerifications.set(phone_number, verificationId);
    res.json({ status: 'pending' });
  } catch (err) {
    next(err);
  }
});

const otpConfirmSchema = z.object({
  phone_number: z.string().min(8),
  code: z.string().min(3),
  who: z.string().default('Faisal Khan'),
});

router.post('/contact-phone/confirm-otp', async (req, res, next) => {
  try {
    const { phone_number, code, who } = otpConfirmSchema.parse(req.body);
    const verificationId = pendingVerifications.get(phone_number);
    if (!verificationId) {
      return res.status(400).json({ error: 'No pending verification for this phone number' });
    }

    const verified = await confirmOtp(verificationId, code);
    if (!verified) return res.status(400).json({ error: 'Incorrect code' });

    pendingVerifications.delete(phone_number);

    const { rows } = await pool.query(
      `INSERT INTO organization_contact_phone (phone_number, verified, verified_at, telnyx_verification_id)
       VALUES ($1, true, now(), $2)
       RETURNING *`,
      [phone_number, verificationId]
    );

    await recordAuditEvent({
      who,
      action_type: 'edit',
      action_label: 'Updated Organization Settings — General',
      detail: `Contact phone ${phone_number} verified`,
    });

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
