// Ported from freshDB()'s `users` array (MCM_Cloud_CX_v15_2.html lines
// 602-614) — only the fields the Agent Workspace engine actually reads:
// id, name, ext (dial-pad extension routing), skills, state.
// Every seeded user has ext:'' in the source, so extension dialing
// legitimately never resolves — that's the real seed data, not a gap.
export const USERS = [
  { id: 'u_fkhan', name: 'Faisal Khan', ext: '', skills: {}, state: 'Active' },
  { id: 'u_ashaikh', name: 'Adnan Shaikh', ext: '', skills: {}, state: 'Active' },
  { id: 'u_spetrova', name: 'Sofia Petrova', ext: '', skills: { Billing: 5, Retention: 3 }, state: 'Active' },
  { id: 'u_jokafor', name: 'James Okafor', ext: '', skills: { Billing: 4 }, state: 'Active' },
  { id: 'u_pnair', name: 'Priya Nair', ext: '', skills: { Billing: 5, Technical: 4 }, state: 'Active' },
  { id: 'u_mrossi', name: 'Marco Rossi', ext: '', skills: {}, state: 'Active' },
  { id: 'u_arahman', name: 'Aisha Rahman', ext: '', skills: { Technical: 5 }, state: 'Active' },
  { id: 'u_cmendez', name: 'Carlos Mendez', ext: '', skills: { Sales: 4 }, state: 'Active' },
  { id: 'u_gadeyemi', name: 'Grace Adeyemi', ext: '', skills: {}, state: 'Active' },
  { id: 'u_rpatel', name: 'Rajan Patel', ext: '', skills: { Collections: 5 }, state: 'Active' },
  { id: 'u_msantos', name: 'Maria Santos', ext: '', skills: { Billing: 3 }, state: 'Pending invite' },
  { id: 'u_lwalsh', name: 'Liam Walsh', ext: '', skills: {}, state: 'Inactive' },
];

// The logged-in demo user throughout the prototype.
export const ME_ID = 'u_fkhan';
