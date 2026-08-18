// Seeds the database with the exact mock data currently hardcoded in the
// frontend's Account Settings pages, so the backend starts in sync with
// what the UI already shows.
import { pool } from './pool.js';

const ORG_SETTINGS = [
  // General
  ['General', 'Organization name', null, 'MCM Group PLC', null, 'Editable', 'text', null],
  ['General', 'Short name', 'Login identifier — cannot be changed after creation', 'mcmgroup', null, 'Locked', 'text', null],
  ['General', 'Organization ID', 'Give this to Customer Care when raising tickets', '8f14e45f-ceea-4d3b-9c7f-2b1a0d7e33aa', null, 'Locked', 'text', null],
  ['General', 'Home region', 'Set at org creation', 'EU (London) — euw2', null, 'Locked', 'text', null],
  ['General', 'Default country code', null, '+44 (United Kingdom)', null, 'Editable', 'select',
    ['+44 (United Kingdom)', '+1 (United States)', '+353 (Ireland)', '+61 (Australia)', '+91 (India)']],
  ['General', 'Default language', null, 'English (United Kingdom)', null, 'Editable', 'select',
    ['English (United Kingdom)', 'English (United States)', 'French (France)', 'German (Germany)']],
  ['General', 'Time zone', null, 'Europe/London', null, 'Editable', 'select',
    ['Europe/London', 'Europe/Dublin', 'America/New_York', 'UTC']],
  ['General', 'Date / time format', null, 'DD/MM/YYYY · 24 hour', null, 'Editable', 'select',
    ['DD/MM/YYYY · 24 hour', 'MM/DD/YYYY · 12 hour', 'YYYY-MM-DD · 24 hour']],

  // Security
  ['Security', 'Minimum password length', 'Genesys default minimum is 8', '12', null, 'Editable', 'text', null],
  ['Security', 'Password expiry (days)', null, '90', null, 'Editable', 'text', null],
  ['Security', 'Password history (previous passwords blocked)', null, '10', null, 'Editable', 'text', null],
  ['Security', 'Session idle timeout (minutes)', null, '60', null, 'Editable', 'text', null],
  ['Security', 'Require multi-factor authentication', 'Applies to native logins; SSO users authenticate at the IdP', null, 'enabled', 'Editable', 'checkbox', null],
  ['Security', 'Enforce SSO only (disable native passwords)', null, null, 'disabled', 'Editable', 'checkbox', null],
  ['Security', 'Allow MCM Care support access to configuration', null, null, 'enabled', 'Editable', 'checkbox', null],
  ['Security', 'Trusted IP ranges', null, '194.60.0.0/16, 10.20.0.0/16', null, 'Editable', 'text', null],

  // Branding
  ['Branding', 'Use custom logo in agent UI', null, null, 'enabled', 'Editable', 'checkbox', null],
  ['Branding', 'Theme', null, 'MCM Navy', null, 'Editable', 'select', ['MCM Navy', 'MCM Light', 'High Contrast']],
  ['Branding', 'Accent colour', null, '#FF4F1F', null, 'Editable', 'text', null],
  ['Branding', 'Login page message', null, 'Welcome to MCM Cloud CX', null, 'Editable', 'text', null],

  // Data Residency
  ['Data Residency', 'Core region (org home)', null, 'EU (London) — euw2', null, 'Locked', 'text', null],
  ['Data Residency', 'Preferred media region', null, 'EU (London)', null, 'Editable', 'select',
    ['EU (London)', 'EU (Frankfurt)', 'US East (Virginia)']],
  ['Data Residency', 'Call recording storage', 'Recordings stay in-region for UK-GDPR', 'EU (London)', null, 'Locked', 'text', null],
  ['Data Residency', 'Transcript & analytics storage', null, 'EU (London)', null, 'Locked', 'text', null],

  // Beta Programme
  ['Beta Programme', 'Agent Copilot summaries', 'AI wrap-up summaries after each call', null, 'enabled', 'Editable', 'checkbox', null],
  ['Beta Programme', 'New analytics workspace', null, null, 'enabled', 'Editable', 'checkbox', null],
  ['Beta Programme', 'WebRTC codec v2 (Opus FEC)', null, null, 'disabled', 'Editable', 'checkbox', null],
  ['Beta Programme', 'Predictive routing pilot', 'AI-matched agent selection on eligible queues', null, 'disabled', 'Editable', 'checkbox', null],
];

const LICENCES = [
  ['CX 1', 40, 2, 38, '£60/seat'],
  ['CX 2', 60, 5, 55, '£95/seat'],
  ['CX 3', 25, 3, 22, '£125/seat'],
  ['CX 4', 10, 0, 10, '£150/seat'],
  ['Communicate', 50, 0, 50, '£18/seat'],
];

const USAGE = [
  ['Telephony minutes (this month)', '1193 min', '£14.32'],
  ['SMS / WhatsApp messages', '59 conversations', '£2.36'],
  ['Recording storage', '42.1 GB (234 recordings)', '£14.74'],
];

const INVOICES = [
  ['August 2026', '£970', '£1,090', 'open'],
  ['July 2026', '£970', '£1,083', 'paid'],
  ['June 2026', '£970', '£1,076', 'paid'],
];

const PLAN_LABEL = 'CX 3 (Annual, named users)';

const ORDERS = [
  ['ORD-4471', 'MCM CX 3 — WEM (Named)', 25, 'provisioned', 'F. Khan', 'Sales', '02 Aug 2026'],
  ['ORD-4468', 'AI Experience token pack — 50k', 2, 'provisioned', 'F. Khan', 'Sales', '21 Jul 2026'],
  ['ORD-4455', 'Speech & Text Analytics', 50, 'pending', 'S. Patel', 'Support', '06 Jul 2026'],
  ['ORD-4441', 'Predictive Engagement', 50, 'provisioned', 'F. Khan', 'Sales', '14 Jun 2026'],
  ['ORD-4402', 'Additional storage — 5 TB', 1, 'provisioned', 'IT Ops', 'IT Ops', '30 Apr 2026'],
  ['ORD-4388', 'MCM CX 2 Concurrent', 20, 'cancelled', 'S. Patel', 'Support', '12 Mar 2026'],
];

const MARKETPLACE_ADDONS = [
  ['Speech & Text Analytics', 'WEM', '$40/user/mo'],
  ['WEM Upgrade (CX 3)', 'WEM', '$40/user/mo'],
  ['AI Token Pack (500)', 'AI', '$350/mo'],
  ['Extra Storage 1 TB', 'Platform', '$250/mo'],
];

const ACTIVE_ADDONS = [
  ['Quality Management', 'Jan 2026', '$1,850'],
  ['BYOC Cloud', 'Jan 2026', 'usage-based'],
];

const AUTHORIZED_ORGS = [
  // org_id, org, relationship, scope, divisions, expires, status
  ['a19c...44f', 'MCM Retail Ireland', 'Trustee', 'Contact Centre Admin', 'UK Retail, IE Retail', '31 Dec 2026', 'active'],
  ['77bd...9a1', 'Northstar BPO', 'Trustee', 'Supervisor, Agent', 'Partner — Manila', '30 Sep 2026', 'active'],
  ['8f14...3aa', 'MCM Group PLC', 'Trustor', '—', 'All', '—', 'owner'],
  ['32ee...0c8', 'Cloudline Partners', 'Trustee', 'Read-only Admin', 'UK Digital', '11 Aug 2026', 'expiring'],
  ['be40...712', 'Vertex Consulting', 'Trustee', 'Implementation', 'All', '—', 'revoked'],
  ['mcm-sandbox', 'mcm-sandbox', 'Trustor', 'Full admin', 'All', '—', 'active'],
];

const AUDIT_ENTRIES = [
  ['15 Aug 14:58', 'Faisal Khan', 'alert', 'ALERT: Queue backlog — Retail Billing', 'Interactions waiting is 20 (> 5 sustained 2 min) — notified Marco Rossi, Faisal Khan'],
  ['15 Aug 14:53', 'Faisal Khan', 'alert', 'ALERT: Queue backlog — Retail Billing', 'Interactions waiting is 16 (> 5 sustained 2 min) — notified Marco Rossi, Faisal Khan'],
  ['15 Aug 14:48', 'Faisal Khan', 'alert', 'ALERT: Queue backlog — Retail Billing', 'Interactions waiting is 15 (> 5 sustained 2 min) — notified Marco Rossi, Faisal Khan'],
  ['15 Aug 14:43', 'Faisal Khan', 'alert', 'ALERT: Queue backlog — Retail Billing', 'Interactions waiting is 10 (> 5 sustained 2 min) — notified Marco Rossi, Faisal Khan'],
  ['15 Aug 14:38', 'Faisal Khan', 'alert', 'ALERT: Queue backlog — Retail Billing', 'Interactions waiting is 24 (> 5 sustained 2 min) — notified Marco Rossi, Faisal Khan'],
  ['15 Aug 14:33', 'Faisal Khan', 'alert', 'ALERT: Queue backlog — Retail Billing', 'Interactions waiting is 21 (> 5 sustained 2 min) — notified Marco Rossi, Faisal Khan'],
  ['15 Aug 14:28', 'System', 'alert', 'ALERT: Queue backlog — Retail Billing', 'Interactions waiting is 18 (> 5 sustained 2 min) — notified Marco Rossi, Faisal Khan'],
  ['15 Aug 14:23', 'System', 'alert', 'ALERT: Queue backlog — Retail Billing', 'Interactions waiting is 12 (> 5 sustained 2 min) — notified Marco Rossi, Faisal Khan'],
  ['15 Aug 14:18', 'System', 'alert', 'ALERT: Queue backlog — Retail Billing', 'Interactions waiting is 9 (> 5 sustained 2 min) — notified Marco Rossi, Faisal Khan'],
  ['15 Aug 14:13', 'System', 'alert', 'ALERT: Queue backlog resolved — Retail Billing', 'Interactions waiting dropped below threshold — auto-cleared'],
  ['15 Aug 12:04', 'Faisal Khan', 'edit', 'Updated Organization Settings — General', 'Default language changed to English (United Kingdom)'],
  ['15 Aug 11:47', 'Faisal Khan', 'edit', 'Updated Organization Settings — Security', 'Minimum password length changed from 10 to 12'],
  ['15 Aug 11:20', 'S. Patel', 'create', 'Created Purchase ORD-4455', 'Speech & Text Analytics — Qty 50 — Pending approval'],
  ['15 Aug 10:58', 'Faisal Khan', 'create', 'Added Trust — Cloudline Partners', 'Relationship: Trustee — Scope: Read-only Admin'],
  ['15 Aug 10:31', 'Faisal Khan', 'delete', 'Revoked Trust — Vertex Consulting', 'Reason: contract ended'],
  ['15 Aug 09:52', 'IT Ops', 'sign-in', 'Signed in', 'Method: SSO — IP 194.60.12.4'],
  ['15 Aug 09:15', 'Marco Rossi', 'sign-in', 'Signed in', 'Method: SSO — IP 194.60.12.9'],
  ['14 Aug 18:40', 'Faisal Khan', 'export', 'Exported CSV — Purchases', '6 rows exported'],
  ['14 Aug 17:22', 'Faisal Khan', 'edit', 'Updated Organization Settings — Branding', 'Accent colour changed to #FF4F1F'],
  ['14 Aug 16:05', 'S. Patel', 'create', 'Created Purchase ORD-4441', 'Predictive Engagement — Qty 50 — Provisioned'],
  ['14 Aug 15:38', 'Faisal Khan', 'edit', 'Updated Roles / Permissions — S. Patel', 'Role changed to Supervisor'],
  ['14 Aug 14:12', 'IT Ops', 'create', 'Created Purchase ORD-4402', 'Additional storage — 5 TB — Qty 1 — Provisioned'],
  ['14 Aug 11:03', 'Faisal Khan', 'create', 'Added Trust — Northstar BPO', 'Relationship: Trustee — Scope: Supervisor, Agent'],
  ['13 Aug 17:47', 'Marco Rossi', 'sign-in', 'Signed in', 'Method: Native — IP 10.20.4.18'],
  ['13 Aug 16:20', 'Faisal Khan', 'edit', 'Updated Organization Settings — Data Residency', 'Preferred media region changed to EU (London)'],
  ['13 Aug 09:44', 'S. Patel', 'delete', 'Cancelled Purchase ORD-4388', 'MCM CX 2 Concurrent — Qty 20'],
  ['12 Aug 18:02', 'Faisal Khan', 'edit', 'Updated Organization Settings — Beta Programme', 'Predictive routing pilot disabled'],
  ['12 Aug 15:16', 'IT Ops', 'sign-in', 'Signed in', 'Method: SSO — IP 194.60.12.4'],
  ['12 Aug 10:33', 'Faisal Khan', 'export', 'Exported CSV — Audit Log', '27 rows exported'],
  ['11 Aug 19:05', 'Faisal Khan', 'create', 'Added Trust — MCM Retail Ireland', 'Relationship: Trustee — Scope: Contact Centre Admin'],
  ['11 Aug 12:48', 'S. Patel', 'create', 'Created Purchase ORD-4471', 'MCM CX 3 — WEM (Named) — Qty 25 — Provisioned'],
  ['10 Aug 09:27', 'Faisal Khan', 'sign-in', 'Signed in', 'Method: SSO — IP 194.60.12.4'],
];

async function seed() {
  await pool.query('BEGIN');
  try {
    for (const row of ORG_SETTINGS) {
      await pool.query(
        `INSERT INTO organization_settings
           (tab_name, setting_label, hint, value, state, status, field_type, options)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (tab_name, setting_label) DO NOTHING`,
        [row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7] ? JSON.stringify(row[7]) : null]
      );
    }

    for (const [licence, purchased, assigned, available, price] of LICENCES) {
      await pool.query(
        `INSERT INTO subscription_licences (licence, purchased, assigned, available, price)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (licence) DO NOTHING`,
        [licence, purchased, assigned, available, price]
      );
    }

    for (const [item, usage, charge] of USAGE) {
      await pool.query(
        `INSERT INTO subscription_usage (item, usage, charge) VALUES ($1,$2,$3)`,
        [item, usage, charge]
      );
    }

    for (const [period, seats, total, status] of INVOICES) {
      await pool.query(
        `INSERT INTO subscription_invoices (period, seats, total, status) VALUES ($1,$2,$3,$4)`,
        [period, seats, total, status]
      );
    }

    await pool.query(
      `INSERT INTO subscription_plan (id, plan_label) VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET plan_label = EXCLUDED.plan_label`,
      [PLAN_LABEL]
    );

    for (const [id, item, qty, status, requestedBy, division, orderDate] of ORDERS) {
      await pool.query(
        `INSERT INTO purchase_orders (id, item, qty, status, requested_by, division, order_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
        [id, item, qty, status, requestedBy, division, orderDate]
      );
    }

    for (const [name, category, price] of MARKETPLACE_ADDONS) {
      await pool.query(
        `INSERT INTO marketplace_addons (name, category, price) VALUES ($1,$2,$3)
         ON CONFLICT (name) DO NOTHING`,
        [name, category, price]
      );
    }

    for (const [name, since, monthly] of ACTIVE_ADDONS) {
      await pool.query(
        `INSERT INTO active_addons (name, since, monthly) VALUES ($1,$2,$3)
         ON CONFLICT (name) DO NOTHING`,
        [name, since, monthly]
      );
    }

    for (const [orgId, org, relationship, scope, divisions, expires, status] of AUTHORIZED_ORGS) {
      await pool.query(
        `INSERT INTO authorized_organizations
           (org_id, org, relationship, scope, divisions, expires, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (org_id) DO NOTHING`,
        [orgId, org, relationship, scope, divisions, expires, status]
      );
    }

    // Insert oldest-first so `occurred_at` (defaulted to now() per-row) sorts
    // the same way the frontend's hardcoded array already does.
    for (const [when, who, type, label, detail] of [...AUDIT_ENTRIES].reverse()) {
      await pool.query(
        `INSERT INTO audit_log (when_display, who, action_type, action_label, detail)
         VALUES ($1,$2,$3,$4,$5)`,
        [when, who, type, label, detail]
      );
    }

    await pool.query('COMMIT');
    console.log(`Seeded: ${ORG_SETTINGS.length} settings, ${ORDERS.length} orders, ${AUTHORIZED_ORGS.length} orgs, ${AUDIT_ENTRIES.length} audit entries.`);
  } catch (err) {
    await pool.query('ROLLBACK');
    throw err;
  } finally {
    await pool.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
