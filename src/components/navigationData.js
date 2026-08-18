const navigationData = [
  {
    heading: 'ACCOUNT SETTINGS',
    items: [
      { label: 'Organization Settings', id: 'organization-settings', starred: false },
      { label: 'Subscription', id: 'subscription', starred: false },
      { label: 'Purchases', id: 'purchases', starred: false },
      { label: 'Authorized Organizations', id: 'authorized-organizations', starred: false },
      { label: 'Audit Log', id: 'audit-log', starred: false }
    ]
  },
  {
    heading: 'PEOPLE & PERMISSIONS',
    items: [
      { label: 'People', id: 'people', starred: false },
      { label: 'Roles / Permissions', id: 'roles-permissions', starred: false },
      { label: 'Divisions', id: 'divisions', starred: false },
      { label: 'Groups', id: 'groups', starred: false },
      { label: 'ACD Skills', id: 'acd-skills', starred: false },
      { label: 'ACD Languages', id: 'acd-languages', starred: false },
      { label: 'Licence Assignment', id: 'licence-assignment', starred: false },
      { label: 'Single Sign-on', id: 'single-sign-on', starred: false },
      { label: 'OAuth Clients', id: 'oauth-clients', starred: false }
    ]
  },
  {
    heading: 'DIRECTORY',
    items: [
      { label: 'Locations', id: 'locations', starred: false },
      { label: 'Profile Fields', id: 'profile-fields', starred: false },
      { label: 'External Contacts', id: 'external-contacts', starred: false },
      { label: 'Document Workspaces', id: 'document-workspaces', starred: false }
    ]
  },
  {
    heading: 'CONTACT CENTER',
    items: [
      { label: 'ACD Setup Guide', id: 'acd-setup-guide', starred: true },
      { label: 'Queues', id: 'queues', starred: false },
      { label: 'Wrap-up Codes', id: 'wrap-up-codes', starred: false },
      { label: 'Utilization', id: 'utilization', starred: false },
      { label: 'Email Settings', id: 'email-settings', starred: false },
      { label: 'Message Routing', id: 'message-routing', starred: false },
      { label: 'Alert Rules', id: 'alert-rules', starred: false },
      { label: 'Scripts', id: 'scripts', starred: false },
      { label: 'Script Editor', id: 'script-editor', starred: false },
      { label: 'Canned Responses', id: 'canned-responses', starred: false },
      { label: 'Schedules', id: 'schedules', starred: false }
    ]
  },
  {
    heading: 'TELEPHONY',
    items: [
      { label: 'Carrier Connections (BYOC)', id: 'carrier-connections', starred: false },
      { label: 'Trunks', id: 'trunks', starred: false },
      { label: 'Sites', id: 'sites', starred: false },
      { label: 'Edges', id: 'edges', starred: false },
      { label: 'Edge Groups', id: 'edge-groups', starred: false },
      { label: 'Phone Management', id: 'phone-management', starred: false },
      { label: 'Phone Base Settings', id: 'phone-base-settings', starred: false },
      { label: 'DID Numbers', id: 'did-numbers', starred: false },
      { label: 'Extensions', id: 'extensions', starred: false },
      { label: 'Number Plans', id: 'number-plans', starred: false },
      { label: 'Outbound Routes', id: 'outbound-routes', starred: false },
      { label: 'Digital Certificates', id: 'digital-certificates', starred: false }
    ]
  },
  {
    heading: 'ROUTING',
    items: [
      { label: 'Architect Flows', id: 'architect-flows', starred: false },
      { label: 'Architect — Flow Editor', id: 'architect-flow-editor', starred: false },
      { label: 'Prompts', id: 'prompts', starred: false },
      { label: 'Call Routing', id: 'call-routing', starred: false },
      { label: 'Emergency Groups', id: 'emergency-groups', starred: false }
    ]
  },
  {
    heading: 'INTEGRATIONS',
    items: [
      { label: 'Integrations', id: 'integrations', starred: false },
      { label: 'Data Actions', id: 'data-actions', starred: false },
      { label: 'Bot Connectors', id: 'bot-connectors', starred: false }
    ]
  },
  {
    heading: 'OUTBOUND',
    items: [
      { label: 'Campaigns', id: 'campaigns', starred: false },
      { label: 'Contact Lists', id: 'contact-lists', starred: false },
      { label: 'DNC Lists', id: 'dnc-lists', starred: false }
    ]
  },
  {
    heading: 'QUALITY & WEM',
    items: [
      { label: 'WFM Setup Guide', id: 'wfm-setup-guide', starred: true },
      { label: 'Recording Policies', id: 'recording-policies', starred: false },
      { label: 'Evaluation Forms', id: 'evaluation-forms', starred: false },
      { label: 'Calibrations', id: 'calibrations', starred: false },
      { label: 'Forecasts', id: 'forecasts', starred: false },
      { label: 'Schedules (WFM)', id: 'schedules-wfm', starred: false },
      { label: 'Adherence', id: 'adherence', starred: false },
      { label: 'Gamification', id: 'gamification', starred: false }
    ]
  },
  {
    heading: 'UI MAP',
    items: [
      { label: 'Screen Gallery', id: 'screen-gallery', starred: false }
    ]
  }
]

export default navigationData
