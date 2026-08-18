// Ported from ensureAI()'s DB.kb (lines 9011-9023), DB.canned (lines
// 3940-3942), and SUGG (lines 9040-9046) used by suggFor().
export function seedKb() {
  return [
    { id: 'kb1', cat: 'Billing', title: 'Duplicate charge / bill higher than usual', kws: ['charged twice', 'higher', 'overcharged', 'bill', 'duplicate'],
      body: '1. Open Billing › Transactions and compare the last two cycles.\n2. If a duplicate direct debit is visible, raise refund code RB-2 (auto-approves under £150).\n3. Tell the customer the refund lands in 3–5 working days.\n4. Wrap: Resolved.' },
    { id: 'kb2', cat: 'Billing', title: 'Set up a payment arrangement', kws: ['payment plan', 'instalments', 'more time', 'arrears', "can't pay"],
      body: "1. Check arrears balance and eligibility (no plan in last 6 months).\n2. Offer 3 or 6 month spread; first payment today locks the plan.\n3. Send SMS confirmation with the schedule.\n4. Wrap: Payment Taken." },
    { id: 'kb3', cat: 'Retention', title: 'Customer threatening to cancel — save offers', kws: ['cancel', 'leaving', 'switch', 'better deal', 'competitor'],
      body: "1. Acknowledge and ask what's driving the move.\n2. Loyalty matrix: 12m+ tenure → 20% for 6 months; 24m+ → free speed upgrade.\n3. If declined twice, do NOT push a third time — hand to Retention queue.\n4. Wrap: Escalated or Resolved." },
    { id: 'kb4', cat: 'Technical', title: 'Router offline / connection drops', kws: ['router', 'offline', 'not working', 'drops', 'no service', 'error'],
      body: '1. Run a line test from the account page (takes ~40s — tell the customer).\n2. If the line is clean: guided reboot + factory reset.\n3. Two failed resets in 7 days → book an engineer, no charge.\n4. Wrap: Resolved or Follow-up required.' },
    { id: 'kb5', cat: 'Field', title: 'Rebook or chase an engineer visit', kws: ['engineer', 'visit', 'appointment', 'slot', 'nobody came', 'rebook'],
      body: '1. Apologise for the miss — check the dispatch note first.\n2. Offer the next two AM/PM slots; Saturday slots are released Thursdays.\n3. Missed-visit credit: one month line rental, code MV-1.\n4. Wrap: Follow-up required.' },
    { id: 'kb6', cat: 'Payments', title: 'Direct debit bounced or failed', kws: ['direct debit', 'bounced', 'failed', 'payment failed', 'bank'],
      body: '1. Never re-run a bounced DD the same day — bank blocks it.\n2. Take a card payment now or set a retry date within 10 days.\n3. Waive the late fee on first occurrence (code LF-0).\n4. Wrap: Payment Taken.' },
  ];
}

export const CANNED = [
  { id: 'cn1', name: 'Greeting — email', text: 'Dear {{Contact.FirstName}}, thank you for contacting MCM Support.' },
  { id: 'cn2', name: 'Payment received', text: 'We confirm receipt of your payment. Your balance is now {{Contact.Balance}}.' },
];

export const SUGG = [
  [/charged twice|higher|overcharged|bill/i, "I can see why that's worrying — I'm checking your last two bills side by side right now, and if there's a duplicate charge I'll refund it today."],
  [/payment plan|instalments|more time|can.?t pay/i, "We can absolutely spread this out. I can set up a 3-month plan right now — the first payment today locks it in, and I'll text you the schedule."],
  [/cancel|leaving|switch|better deal/i, "Before you decide — you've been with us a while, so let me check what loyalty offers I can apply. Give me one moment."],
  [/router|offline|not working|drops|error/i, "Let's get that fixed. I'm running a line test from here — it takes about 40 seconds, then I'll know exactly where the fault is."],
  [/engineer|visit|appointment|slot|rebook/i, "I'm sorry about the missed visit. I can rebook you into the next available slot and I've added a one-month credit for the inconvenience."],
  [/direct debit|bounced|payment failed/i, "No problem — that happens. I can take a card payment now, or set a retry date that suits you, and I've waived the late fee."],
];

export function suggFor(txt) {
  for (let i = 0; i < SUGG.length; i++) if (SUGG[i][0].test(txt)) return SUGG[i][1];
  return "Thanks for your patience — I'm looking into this for you right now.";
}
