let seq = 0;
export function uid() {
  seq += 1;
  return "id" + seq.toString(36) + Math.random().toString(36).slice(2, 6);
}

export const PERMS = {
  directory: ["user:add", "user:edit", "user:view", "user:delete", "group:add", "group:edit", "location:add", "location:edit"],
  authorization: ["role:add", "role:edit", "role:view", "role:delete", "division:add", "division:edit", "division:delete", "grant:add"],
  routing: ["queue:add", "queue:edit", "queue:view", "skill:add", "skill:edit", "wrapupCode:add", "email:manage", "message:manage"],
  conversation: ["call:accept", "call:record", "call:monitor", "call:coach", "call:barge", "callback:add", "email:accept", "message:accept"],
  analytics: ["view:view", "dashboard:add", "dashboard:edit", "alert:add", "alert:edit", "export:add"],
  quality: ["evaluation:add", "evaluation:edit", "calibration:add", "recording:view", "recordingPolicy:edit"],
  telephony: ["plugin:all", "trunk:edit", "site:edit", "edge:edit", "phone:add", "phone:assign", "did:edit", "extension:edit"],
  architect: ["flow:add", "flow:edit", "flow:publish", "flow:delete", "prompt:add", "datatable:edit"],
  outbound: ["campaign:add", "campaign:edit", "contactList:add", "dnc:edit", "ruleSet:edit"],
  wem: ["schedule:add", "schedule:edit", "forecast:add", "adherence:view", "gamification:edit"],
};

export function freshDB() {
  const divisions = [
    { id: "d_home", name: "Home", desc: "Default division — cannot be deleted", home: true },
    { id: "d_ret", name: "UK Retail", desc: "Retail contact centre" },
    { id: "d_dig", name: "UK Digital", desc: "Digital / messaging teams" },
    { id: "d_col", name: "UK Collections", desc: "Collections & recoveries" },
    { id: "d_man", name: "Partner — Manila", desc: "BPO partner site" },
  ];

  const mk = (n, d, base, perms) => ({ id: uid(), name: n, desc: d, base, perms });
  const all = [];
  Object.keys(PERMS).forEach((dm) => PERMS[dm].forEach((p) => all.push(dm + ":" + p)));

  const roles = [
    mk("Master Admin", "Full organisation control", true, all.slice()),
    mk("Admin", "Administer most settings", true, all.filter((p) => p.indexOf("authorization:division:delete") < 0)),
    mk("Employee", "Base role for every user", true, ["directory:user:view", "conversation:call:accept", "conversation:callback:add"]),
    mk("Agent", "Handle ACD interactions", true, ["directory:user:view", "conversation:call:accept", "conversation:email:accept", "conversation:message:accept", "conversation:callback:add", "routing:queue:view", "analytics:view:view"]),
    mk("Supervisor", "Queue & agent management", true, ["directory:user:view", "routing:queue:view", "routing:queue:edit", "conversation:call:monitor", "conversation:call:coach", "conversation:call:barge", "analytics:view:view", "analytics:dashboard:add", "analytics:alert:add", "wem:adherence:view"]),
    mk("Telephony Admin", "Edges, trunks, phones, numbers", true, ["telephony:plugin:all", "telephony:trunk:edit", "telephony:site:edit", "telephony:edge:edit", "telephony:phone:add", "telephony:phone:assign", "telephony:did:edit", "telephony:extension:edit"]),
    mk("Quality Evaluator", "Evaluations & calibration", true, ["quality:evaluation:add", "quality:evaluation:edit", "quality:calibration:add", "quality:recording:view", "analytics:view:view"]),
  ];

  const skills = [
    { id: uid(), name: "Billing", desc: "Billing & payments" },
    { id: uid(), name: "Technical", desc: "Technical support" },
    { id: uid(), name: "Retention", desc: "Save desk" },
    { id: uid(), name: "Sales", desc: "New business" },
    { id: uid(), name: "Collections", desc: "Arrears handling" },
  ];
  const langs = [{ id: uid(), name: "English" }, { id: uid(), name: "Spanish" }, { id: uid(), name: "Hindi" }, { id: uid(), name: "French" }];
  const licenses = { "CX 1": 40, "CX 2": 60, "CX 3": 25, "CX 4": 10, Communicate: 50 };

  const rid = (n) => roles.filter((r) => r.name === n)[0].id;
  const mkU = (n, e, t, dep, div, rl, l, sk, lg, st, state) => ({
    id: uid(), name: n, email: e, title: t, dept: dep, division: div,
    roles: rl.map(rid).concat([rid("Employee")]), license: l,
    skills: sk, langs: lg, station: st, state: state || "Active", created: "04 Jan 2026",
  });

  const users = [
    mkU("Faisal Khan", "fkhan@mcmgroup.com", "Head of CX", "Operations", "d_home", ["Master Admin", "Supervisor"], "CX 3", {}, ["English"], "WebRTC softphone"),
    mkU("Adnan Shaikh", "ashaikh@mcmgroup.com", "Platform Admin", "IT", "d_home", ["Admin", "Telephony Admin"], "CX 2", {}, ["English", "Hindi"], "WebRTC softphone"),
    mkU("Sofia Petrova", "spetrova@mcmgroup.com", "Advisor", "Customer Care", "d_ret", ["Agent"], "CX 2", { Billing: 5, Retention: 3 }, ["English"], "WebRTC softphone"),
    mkU("James Okafor", "jokafor@mcmgroup.com", "Advisor", "Customer Care", "d_ret", ["Agent"], "CX 1", { Billing: 4 }, ["English"], "Physical phone"),
    mkU("Priya Nair", "pnair@mcmgroup.com", "Senior Advisor", "Customer Care", "d_ret", ["Agent"], "CX 2", { Billing: 5, Technical: 4 }, ["English", "Hindi"], "WebRTC softphone"),
    mkU("Marco Rossi", "mrossi@mcmgroup.com", "Team Leader", "Customer Care", "d_ret", ["Supervisor"], "CX 3", {}, ["English"], "WebRTC softphone"),
    mkU("Aisha Rahman", "arahman@mcmgroup.com", "Advisor", "Digital", "d_dig", ["Agent"], "CX 2", { Technical: 5 }, ["English"], "WebRTC softphone"),
    mkU("Carlos Mendez", "cmendez@mcmgroup.com", "Advisor", "Digital", "d_dig", ["Agent"], "CX 2", { Sales: 4 }, ["English", "Spanish"], "Remote station"),
    mkU("Grace Adeyemi", "gadeyemi@mcmgroup.com", "QA Analyst", "Quality", "d_home", ["Quality Evaluator"], "CX 3", {}, ["English"], "WebRTC softphone"),
    mkU("Rajan Patel", "rpatel@mcmgroup.com", "Collections Agent", "Collections", "d_col", ["Agent"], "CX 1", { Collections: 5 }, ["English", "Hindi"], "Physical phone"),
    mkU("Maria Santos", "msantos@partner.mnl", "Partner Agent", "Partner Ops", "d_man", ["Agent"], "CX 1", { Billing: 3 }, ["English"], "WebRTC softphone", "Pending invite"),
    mkU("Liam Walsh", "lwalsh@mcmgroup.com", "Workforce Analyst", "Planning", "d_home", ["Supervisor"], "CX 3", {}, ["English"], "WebRTC softphone", "Inactive"),
  ];

  const u = (n) => { const x = users.find((x) => x.name === n); return x ? x.id : null; };
  const groupsList = [
    { id: uid(), name: "Customer Care Supervisors", type: "Official", ext: "7100", ring: "Broadcast", members: [u("Marco Rossi"), u("Faisal Khan")].filter(Boolean), vm: true },
    { id: uid(), name: "IT Helpdesk", type: "Official", ext: "7200", ring: "Sequential", members: [u("Adnan Shaikh")].filter(Boolean), vm: true },
    { id: uid(), name: "Running Club", type: "Social", ext: "", ring: "", members: [], vm: false },
  ];

  return {
    divisions, roles, skills, langs, users, licenses, groupsList,
    audit: [
      { t: "04 Jan 2026 09:12", who: "System", act: "Org provisioned", obj: "mcmgroup" },
      { t: "04 Jan 2026 09:30", who: "F. Khan", act: "Bulk import", obj: "12 users created" },
    ],
  };
}

export const MENU = [
  ["Account Settings", [["orgset", "Organization Settings"], ["subs", "Subscription"], ["purch", "Purchases"], ["authorg", "Authorized Organizations"]]],
  ["People & Permissions", [["people", "People"], ["roles", "Roles / Permissions"], ["divisions", "Divisions"], ["groups", "Groups"], ["skills", "ACD Skills"], ["langs", "ACD Languages"], ["licences", "Licence Assignment"], ["sso", "Single Sign-on"], ["oauth", "OAuth Clients"]]],
  ["Directory", [["locations", "Locations"], ["profflds", "Profile Fields"], ["extcontacts", "External Contacts"], ["docws", "Document Workspaces"]]],
  ["Contact Center", [["queues", "Queues"], ["wrapup", "Wrap-up Codes"], ["util", "Utilization"], ["emailset", "Email Settings"], ["msgroute", "Message Routing"], ["alerts", "Alert Rules"], ["scripts", "Scripts"], ["scripteditor", "Script Editor"], ["canned", "Canned Responses"], ["schedules", "Schedules"]]],
  ["Telephony", [["trunks", "Trunks"], ["sites", "Sites"], ["edges", "Edges"], ["edgegrp", "Edge Groups"], ["phones", "Phone Management"], ["basesets", "Phone Base Settings"], ["dids", "DID Numbers"], ["exts", "Extensions"], ["numplan", "Number Plans"], ["outroute", "Outbound Routes"], ["certs", "Digital Certificates"]]],
  ["Routing", [["flows", "Architect Flows"], ["architect", "Architect — Flow Editor"], ["prompts", "Prompts"], ["callroute", "Call Routing"], ["emergency", "Emergency Groups"]]],
  ["Integrations", [["integ", "Integrations"], ["dataact", "Data Actions"], ["bots", "Bot Connectors"]]],
  ["Quality & WEM", [["recpol", "Recording Policies"], ["evalforms", "Evaluation Forms"], ["calib", "Calibrations"], ["forecast", "Forecasts"], ["sched2", "Schedules (WFM)"], ["adher", "Adherence"], ["gamif", "Gamification"]]],
  ["UI Map", [["gallery", "Screen Gallery"]]],
];

export const HELP = {
  people: {
    t: "People",
    topics: [
      "Create users manually, by CSV import or via directory sync",
      "Set primary email, phone extension and title/department",
      "Assign licence, roles, divisions, skills and languages",
      "Configure the agent station (WebRTC, remote, desk phone)",
      "Deactivate and reactivate users, reset passwords",
    ],
    kws: ["User", "Add person", "CSV import", "Station", "WebRTC phone", "Deactivate", "Reset password", "Manager"],
    vids: [
      ["Lab 2 – Managing User Accounts", "Implementation Video Lab", "09:05"],
      ["Chapter 3.4 – Adding People to the Contact Center", "Implementation", "06:15"],
      ["Chapter 6.2 – Managing Agent, Role and Permission", "Implementation", "12:30"],
    ],
  },
  roles: {
    t: "Roles & Permissions",
    topics: [
      "Base roles supplied by MCM vs custom roles you clone",
      "Permission = domain : entity : action (e.g. routing:queue:edit)",
      "Divisions scope a role assignment to a subset of objects",
      "Assign a role to a user, group or as a default role",
      "Audit which users hold a given permission",
    ],
    kws: ["Base role", "Custom role", "Permission", "Division scope", "routing:queue:edit", "Role assignment", "Least privilege"],
    vids: [
      ["Lab 4 – Managing Roles and Permission", "Implementation Video Lab", "10:40"],
      ["Chapter 5 – Managing Roles, Permission and Division", "Study Kits", "15:10"],
    ],
  },
  divisions: {
    t: "Divisions",
    topics: [
      "Home division contains everything by default",
      "Create divisions to segment queues, flows, users and campaigns",
      "Role + division = scoped access control",
      "Move objects between divisions",
    ],
    kws: ["Home division", "Object segmentation", "Scoped access", "Division-aware"],
    vids: [["Chapter 5 – Managing Roles, Permission and Division", "Study Kits", "15:10"]],
  },
  groups: {
    t: "Groups",
    topics: [
      "Official groups (admin managed) vs social groups (user created)",
      "Add members manually or by dynamic rule",
      "Group-based routing, group ring and group voicemail",
      "Use groups as a target for alerts and document workspaces",
    ],
    kws: ["Official group", "Social group", "Group ring", "Group voicemail", "Dynamic membership"],
    vids: [["Lab 5 – Creating and Managing Groups", "Implementation Video Lab", "08:20"]],
  },
  skills: {
    t: "ACD Skills",
    topics: [
      "Create skills that describe agent capability",
      "Assign skills to agents with a proficiency 1–5",
      "Skill expressions in queues/flows narrow the eligible pool",
      "Bullseye routing removes skills ring by ring",
    ],
    kws: ["Skill", "Proficiency", "Skill expression", "Bullseye", "Preferred agent"],
    vids: [["Lab 1 – Creating Skills and Language for Agent", "Contact Center Video Lab", "07:15"]],
  },
  langs: {
    t: "ACD Languages",
    topics: [
      "Define spoken languages as routing attributes",
      "Assign per agent with proficiency rating",
      "Route by language skill from Architect or the queue",
    ],
    kws: ["Language skill", "Proficiency", "Language routing"],
    vids: [["Lab 1 – Creating Skills and Language for Agent", "Contact Center Video Lab", "07:15"]],
  },
  licassign: {
    t: "License Assignment",
    topics: [
      "Bulk assign and revoke licences across users",
      "Filter by division, role or current licence",
      "See consumed vs available seats in real time",
      "Downgrade/upgrade a user between CX 1/2/3",
    ],
    kws: ["Seat", "Assign licence", "Revoke", "Bulk update", "Available seats"],
    vids: [],
  },
  sso: {
    t: "Single Sign-on",
    topics: [
      "Configure an identity provider: Entra ID, Okta, PingFederate, ADFS, generic SAML",
      "Upload the IdP certificate and set the target URL",
      "Map the SAML NameID to the MCM user email",
      "Optional SCIM provisioning for user lifecycle",
    ],
    kws: ["SAML", "IdP", "Entra ID", "Okta", "ADFS", "NameID", "SCIM", "Certificate"],
    vids: [],
  },
  oauth: {
    t: "OAuth Clients",
    topics: [
      "Grant types: client credentials, code authorization, implicit, SAML2 bearer",
      "Scope the client with roles and divisions",
      "Token duration and secret rotation",
      "Use for API access and custom apps",
    ],
    kws: ["OAuth", "Client credentials", "Grant type", "Scope", "Token duration", "API"],
    vids: [],
  },
};
