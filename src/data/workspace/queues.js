// Ported from DB.wrapup (lines 1120-1127) and DB.queues (lines 1138-1160).
export const WRAPUP = [
  { id: 'w_resolved', name: 'Resolved', desc: 'Issue fully resolved' },
  { id: 'w_escalated', name: 'Escalated', desc: 'Passed to tier 2 / manager' },
  { id: 'w_callback', name: 'Callback Requested', desc: 'Customer asked for a call back' },
  { id: 'w_wrongnum', name: 'Wrong Number', desc: 'Misdial / not our customer' },
  { id: 'w_nosale', name: 'No Sale', desc: 'Offer declined' },
  { id: 'w_payment', name: 'Payment Taken', desc: 'Payment collected securely' },
];

export const QUEUES = [
  {
    id: 'q_billing', name: 'Retail_Billing_L1', desc: 'Retail billing tier 1',
    members: ['u_spetrova', 'u_jokafor', 'u_pnair', 'u_mrossi'],
    evalm: 'Best Available Skills', acw: 'Optional', alert: 12,
    wrapup: ['Resolved', 'Escalated', 'Callback Requested', 'Wrong Number'],
  },
  {
    id: 'q_complaints', name: 'Retail_Complaints', desc: 'Complaints & escalations',
    members: ['u_pnair', 'u_mrossi'],
    evalm: 'All Skills Matching', acw: 'Mandatory', alert: 15,
    wrapup: ['Resolved', 'Escalated'],
  },
  {
    id: 'q_digital', name: 'Digital_Messaging', desc: 'Web chat & WhatsApp',
    members: ['u_arahman', 'u_cmendez'],
    evalm: 'Best Available Skills', acw: 'Optional', alert: 12,
    wrapup: ['Resolved', 'Escalated', 'No Sale'],
  },
  {
    id: 'q_collections', name: 'Collections_Arrears', desc: 'Arrears & payment plans',
    members: ['u_rpatel'],
    evalm: 'All Skills Matching', acw: 'Mandatory', alert: 15,
    wrapup: ['Resolved', 'Payment Taken', 'Callback Requested'],
  },
];

// DB.util.Chat.cap (line 1130) — Chat capacity, shared by chat/SMS/WhatsApp.
export const CHAT_CAP = 2;
