import { pool } from '../db/pool.js';
import { sendSms } from './telnyx.js';

/**
 * Which audit events also fire a security-alert SMS: Security-tab edits on
 * Organization Settings, and any new authorized organization (trust) added.
 */
function isSecurityAlertEvent({ action_type, action_label }) {
  if (action_type === 'edit' && action_label.includes('Organization Settings — Security')) return true;
  if (action_type === 'create' && action_label.startsWith('Added Trust —')) return true;
  return false;
}

/**
 * Writes an audit_log row and, for security-relevant events, sends an SMS
 * via Telnyx to ALERT_NOTIFY_PHONE. The SMS never blocks or fails the
 * write — a Telnyx error is logged and swallowed.
 */
export async function recordAuditEvent({ who, action_type, action_label, detail }) {
  const { rows } = await pool.query(
    `INSERT INTO audit_log (when_display, who, action_type, action_label, detail)
     VALUES (to_char(now(), 'DD Mon HH24:MI'), $1, $2, $3, $4)
     RETURNING *`,
    [who, action_type, action_label, detail]
  );
  const entry = rows[0];

  if (isSecurityAlertEvent(entry) && process.env.ALERT_NOTIFY_PHONE) {
    try {
      await sendSms(
        process.env.ALERT_NOTIFY_PHONE,
        `MCM Cloud CX security alert: ${action_label} by ${who}. ${detail ?? ''}`.trim()
      );
    } catch (err) {
      console.error('Failed to send security-alert SMS:', err.message);
    }
  }

  return entry;
}
