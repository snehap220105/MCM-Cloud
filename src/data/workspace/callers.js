// Ported from the Activity IIFE's CALLERS (lines 5915-5916) and the
// Callback/Voicemail IIFE's CUST + VMTXT (lines 7985-7990), plus the
// Message Routing IIFE's OPENERS (lines 8781-8783).
export const CALLERS = [
  ['Oliver Smith', '+447700900101'], ['Amelia Jones', '+447700900102'], ['Zara Khan', '+447811223344'],
  ['Tom Hughes', '+447922334455'], ['Nina Gupta', '+912298765432'], ['Sam Carter', '+14155550142'],
  ['Lucy Ford', '+447700111222'],
];

export const CUST = [
  ['Oliver Smith', '+447700900101'], ['Amelia Jones', '+447700900102'], ['Zara Khan', '+447811223344'],
  ['Tom Hughes', '+447922334455'], ['Lucy Ford', '+447700111222'], ['Harry Cole', '+447700333444'],
];

export const OPENERS = {
  SMS: [
    'Hi, my bill looks wrong this month, can you check? Ref MCM-4471',
    'STOP sending me promo texts but I do need help with my plan',
    'Hi — did my payment go through? I got an error at the bank',
  ],
  WhatsApp: [
    'Hello 👋 I saw your message about my renewal — what are my options?',
    'Hi, my router is offline again, third time this week 😤',
    'Hey, can I move my engineer visit to Saturday?',
  ],
};

// Simulated customer replies while a chat is "typing" (line 5917).
export const CHAT_REPLIES = [
  'Thanks — let me check that.',
  'That makes sense, thank you.',
  'Hmm, it still shows the old amount on my side.',
  'Could you confirm when this takes effect?',
  'Perfect, that solves it. Thanks for your help!',
];

export const VMTXT = [
  'Hi, I was on hold for ages about my bill being wrong this month. Please call me back — it\'s urgent.',
  'Hello, my direct debit bounced and I want to sort a payment plan before it goes further. Thanks.',
  'Hi, I tried to upgrade online but the page errored at the last step. Can someone ring me back today?',
  'Calling about the engineer visit — nobody turned up in the slot. I need this rebooked please.',
];
