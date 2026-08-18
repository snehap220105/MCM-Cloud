import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TopBar from './components/TopBar.jsx'
import Sidebar from './components/Sidebar.jsx'
import ActivityWorkspace from './components/activity/ActivityWorkspace.jsx'
import AdminHub from './components/pages/AdminHub.jsx'
import OrganizationSettings from './components/pages/OrganizationSettings.jsx'
import Purchases from './components/pages/Purchases.jsx'
import AuthorizedOrganizations from './components/pages/AuthorizedOrganizations.jsx'
import AuditLog from './components/pages/AuditLog.jsx'
import Subscription from './components/pages/Subscription.jsx'
import ScreenGallery from './components/pages/ScreenGallery.jsx'
import PlaceholderPage from './components/pages/PlaceholderPage.jsx'
import navigationData from './components/navigationData.js'
import People from './components/people/People.jsx'
import Roles from './components/people/Roles.jsx'
import Divisions from './components/people/Divisions.jsx'
import Groups from './components/people/Groups.jsx'
import SimpleListPage from './components/people/SimpleListPage.jsx'
import Licences from './components/people/Licences.jsx'
import SingleSignOn from './components/people/SingleSignOn.jsx'
import OAuthClients from './components/people/OAuthClients.jsx'
import { freshDB } from './components/people/data.js'
import WfmSetupGuide from './components/qualitywem/WfmSetupGuide.jsx'
import RecordingPolicies from './components/qualitywem/RecordingPolicies.jsx'
import EvaluationForms from './components/qualitywem/EvaluationForms.jsx'
import Calibrations from './components/qualitywem/Calibrations.jsx'
import Forecasts from './components/qualitywem/Forecasts.jsx'
import SchedulesWfm from './components/qualitywem/SchedulesWfm.jsx'
import Adherence from './components/qualitywem/Adherence.jsx'
import Gamification from './components/qualitywem/Gamification.jsx'
import { UiProvider } from './components/mcmcx/store/ui.jsx'
import { Drawer, ConfirmBox, Toasts } from './components/mcmcx/components/Overlays.jsx'
import { __setMcmcxNavigateBridge } from './components/mcmcx/router-shim.js'
import PerformanceView from './components/mcmcx/views/impl/perf.jsx'
import AppsView from './components/mcmcx/views/impl/apps.jsx'
import DirectoryView from './components/mcmcx/views/impl/directory.jsx'
import Trunks from './components/mcmcx/pages/impl/trunks.jsx'
import Sites from './components/mcmcx/pages/impl/sites.jsx'
import Edges from './components/mcmcx/pages/impl/edges.jsx'
import EdgeGroups from './components/mcmcx/pages/impl/edgegrp.jsx'
import PhoneManagement from './components/mcmcx/pages/impl/phones.jsx'
import PhoneBaseSettings from './components/mcmcx/pages/impl/basesets.jsx'
import DidNumbers from './components/mcmcx/pages/impl/dids.jsx'
import Extensions from './components/mcmcx/pages/impl/exts.jsx'
import NumberPlans from './components/mcmcx/pages/impl/numplan.jsx'
import OutboundRoutes from './components/mcmcx/pages/impl/outroute.jsx'
import CarrierConnections from './components/mcmcx/pages/impl/byoc.jsx'
import ArchitectFlows from './components/mcmcx/pages/impl/flows.jsx'
import ArchitectFlowEditor from './components/mcmcx/pages/impl/architect.jsx'
import Prompts from './components/mcmcx/pages/impl/prompts.jsx'
import CallRouting from './components/mcmcx/pages/impl/callroute.jsx'
import EmergencyGroups from './components/mcmcx/pages/impl/emergency.jsx'
import DigitalCertificates from './components/mcmcx/pages/impl/certs.jsx'
import Locations from './components/mcmcx/pages/impl/locations.jsx'
import ProfileFields from './components/mcmcx/pages/impl/profflds.jsx'
import ExternalContacts from './components/mcmcx/pages/impl/extcontacts.jsx'
import DocumentWorkspaces from './components/mcmcx/pages/impl/docws.jsx'
import Campaigns from './components/mcmcx/pages/impl/campaigns.jsx'
import ContactLists from './components/mcmcx/pages/impl/contactlists.jsx'
import DncLists from './components/mcmcx/pages/impl/dnclists.jsx'
import IntegrationsPage from './components/integrations/IntegrationsPage.jsx'
import DataActionsPage from './components/integrations/DataActionsPage.jsx'
import BotConnectorsPage from './components/integrations/BotConnectorsPage.jsx'
import AcdSetupGuide from './components/mcmcx/pages/impl/acdsetup.jsx'
import Queues from './components/mcmcx/pages/impl/queues.jsx'
import WrapUpCodes from './components/mcmcx/pages/impl/wrapup.jsx'
import Utilization from './components/mcmcx/pages/impl/util.jsx'
import EmailSettings from './components/mcmcx/pages/impl/emailset.jsx'
import MessageRouting from './components/mcmcx/pages/impl/msgroute.jsx'
import AlertRules from './components/mcmcx/pages/impl/alerts.jsx'
import CcScripts from './components/mcmcx/pages/impl/scripts.jsx'
import ScriptEditor from './components/mcmcx/pages/impl/scripteditor.jsx'
import CannedResponses from './components/mcmcx/pages/impl/canned.jsx'
import CcSchedules from './components/mcmcx/pages/impl/schedules.jsx'

function AcdSkillsPage(props) {
  return <SimpleListPage kind="skills" {...props} />
}

function AcdLanguagesPage(props) {
  return <SimpleListPage kind="langs" {...props} />
}

const PAGES = {
  'organization-settings': OrganizationSettings,
  purchases: Purchases,
  'authorized-organizations': AuthorizedOrganizations,
  'audit-log': AuditLog,
  subscription: Subscription,
  'screen-gallery': ScreenGallery,
  people: People,
  'roles-permissions': Roles,
  divisions: Divisions,
  groups: Groups,
  'acd-skills': AcdSkillsPage,
  'acd-languages': AcdLanguagesPage,
  'licence-assignment': Licences,
  'single-sign-on': SingleSignOn,
  'oauth-clients': OAuthClients,
  'wfm-setup-guide': WfmSetupGuide,
  'recording-policies': RecordingPolicies,
  'evaluation-forms': EvaluationForms,
  calibrations: Calibrations,
  forecasts: Forecasts,
  'schedules-wfm': SchedulesWfm,
  adherence: Adherence,
  gamification: Gamification,
  trunks: Trunks,
  sites: Sites,
  edges: Edges,
  'edge-groups': EdgeGroups,
  'phone-management': PhoneManagement,
  'phone-base-settings': PhoneBaseSettings,
  'did-numbers': DidNumbers,
  extensions: Extensions,
  'number-plans': NumberPlans,
  'outbound-routes': OutboundRoutes,
  'carrier-connections': CarrierConnections,
  'architect-flows': ArchitectFlows,
  'architect-flow-editor': ArchitectFlowEditor,
  prompts: Prompts,
  'call-routing': CallRouting,
  'emergency-groups': EmergencyGroups,
  'digital-certificates': DigitalCertificates,
  locations: Locations,
  'profile-fields': ProfileFields,
  'external-contacts': ExternalContacts,
  'document-workspaces': DocumentWorkspaces,
  campaigns: Campaigns,
  'contact-lists': ContactLists,
  'dnc-lists': DncLists,
  integrations: IntegrationsPage,
  'data-actions': DataActionsPage,
  'bot-connectors': BotConnectorsPage,
  'acd-setup-guide': AcdSetupGuide,
  queues: Queues,
  'wrap-up-codes': WrapUpCodes,
  utilization: Utilization,
  'email-settings': EmailSettings,
  'message-routing': MessageRouting,
  'alert-rules': AlertRules,
  scripts: CcScripts,
  'script-editor': ScriptEditor,
  'canned-responses': CannedResponses,
  schedules: CcSchedules
}

// Maps the ported mcmcx pages' own internal page ids (used in their
// navigate('/admin/<id>') calls) to this app's navigationData ids, where they
// differ. Anything not listed here is assumed to already match.
const MCMCX_ID_MAP = {
  edgegrp: 'edge-groups',
  phones: 'phone-management',
  basesets: 'phone-base-settings',
  dids: 'did-numbers',
  exts: 'extensions',
  numplan: 'number-plans',
  outroute: 'outbound-routes',
  byoc: 'carrier-connections',
  flows: 'architect-flows',
  architect: 'architect-flow-editor',
  callroute: 'call-routing',
  emergency: 'emergency-groups',
  evalforms: 'evaluation-forms',
  subs: 'subscription',
  auditlog: 'audit-log',
  certs: 'digital-certificates',
  profflds: 'profile-fields',
  extcontacts: 'external-contacts',
  docws: 'document-workspaces',
  contactlists: 'contact-lists',
  dnclists: 'dnc-lists',
  acdsetup: 'acd-setup-guide',
  wrapup: 'wrap-up-codes',
  util: 'utilization',
  emailset: 'email-settings',
  msgroute: 'message-routing',
  alerts: 'alert-rules',
  scripteditor: 'script-editor',
  canned: 'canned-responses'
}

// These two consume `initialTab` — force a remount when re-navigated to with
// a different tab target (e.g. from WFM Setup Guide's step links), matching
// the source app's own navSeq/key pattern; other pages keep their state.
const TAB_AWARE_PAGES = new Set(['schedules-wfm', 'forecasts'])

// These pages are full-bleed canvases (own header, own scroll region) that
// fill the whole viewport in the source app — the admin sidebar hides for
// them the same way it already does for Directory/Activity/Performance/Apps.
const FULL_CANVAS_PAGES = new Set(['architect-flow-editor', 'script-editor'])

const VIEW_LABELS = { performance: 'Performance', apps: 'Apps' }
const RECENT_LIMIT = 8

function ToastItem({ msg }) {
  if (typeof msg === 'string') {
    return <div className="toast" dangerouslySetInnerHTML={{ __html: msg }} />
  }
  return <div className="toast">{msg}</div>
}

function App() {
  const [topView, setTopView] = useState('admin')
  const [activeId, setActiveId] = useState('admin-hub')
  const [searchValue, setSearchValue] = useState('')
  const [recentIds, setRecentIds] = useState([])
  const [toasts, setToasts] = useState([])
  const [confirmState, setConfirmState] = useState(null)
  const [presence, setPresenceState] = useState(null)
  const [peopleDb, setPeopleDb] = useState(() => freshDB())
  const [pendingTab, setPendingTab] = useState(null)
  const [navSeq, setNavSeq] = useState(0)
  const toastSeq = useRef(0)

  const showToast = useCallback((msg) => {
    const id = ++toastSeq.current
    setToasts((t) => [...t, { id, msg }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])

  const askConfirm = useCallback((msg, onYes) => {
    setConfirmState({ msg, onYes })
  }, [])

  const setPresence = useCallback((text, color) => {
    setPresenceState({ text, color })
    showToast(<>Presence set to <b>{text}</b></>)
  }, [showToast])

  const navigateTo = (id, tab) => {
    setActiveId(id)
    setPendingTab(tab || null)
    setNavSeq((n) => n + 1)
    if (id !== 'admin-hub') {
      setRecentIds((prev) => [id, ...prev.filter((existing) => existing !== id)].slice(0, RECENT_LIMIT))
    }
  }

  const openAdminPage = (id) => {
    setTopView('admin')
    navigateTo(id)
  }

  useEffect(() => {
    __setMcmcxNavigateBridge((pathname) => {
      if (pathname === '/admin') { openAdminPage('admin-hub'); return }
      if (pathname.startsWith('/admin/')) {
        const rawId = pathname.slice('/admin/'.length)
        openAdminPage(MCMCX_ID_MAP[rawId] || rawId)
        return
      }
      if (pathname === '/activity') { setTopView('activity'); return }
      if (pathname === '/directory') { setTopView('directory'); return }
      if (pathname === '/perf') { setTopView('performance'); return }
      if (pathname === '/apps') { setTopView('apps'); return }
    })
  }, [])

  const active = useMemo(() => {
    for (const section of navigationData) {
      const item = section.items.find((i) => i.id === activeId)
      if (item) return { label: item.label, section: section.heading }
    }
    return { label: 'Content Area', section: 'Admin' }
  }, [activeId])

  const Page = PAGES[activeId]
  const pageKey = TAB_AWARE_PAGES.has(activeId) ? `${activeId}-${navSeq}` : activeId

  return (
    <UiProvider>
    <div className="app">
      <TopBar activeTab={topView} onTabChange={setTopView} presence={presence} />
      <div className="app-body">
        {topView === 'admin' && !FULL_CANVAS_PAGES.has(activeId) && (
          <Sidebar
            sections={navigationData}
            activeId={activeId}
            onSelect={navigateTo}
            searchValue={searchValue}
            onSearchChange={setSearchValue}
          />
        )}
        <main className="main-content">
          {topView === 'admin' ? (
            activeId === 'admin-hub' ? (
              <AdminHub onNavigate={navigateTo} onOpenView={setTopView} recentIds={recentIds} />
            ) : Page ? (
              <div className="legacy-shell">
                <Page
                  key={pageKey}
                  onNavigate={navigateTo}
                  onOpenView={setTopView}
                  db={peopleDb}
                  setDb={setPeopleDb}
                  toast={showToast}
                  askConfirm={askConfirm}
                  initialTab={pendingTab}
                />
              </div>
            ) : (
              <PlaceholderPage title={active.label} section={titleCase(active.section)} />
            )
          ) : topView === 'directory' ? (
            <div className="legacy-shell">
              <DirectoryView />
            </div>
          ) : topView === 'activity' ? (
            <div className="legacy-shell">
              <ActivityWorkspace showToast={showToast} setPresence={setPresence} />
            </div>
          ) : topView === 'performance' ? (
            <div className="legacy-shell">
              <PerformanceView />
            </div>
          ) : topView === 'apps' ? (
            <div className="legacy-shell">
              <AppsView toast={showToast} />
            </div>
          ) : (
            <div className="legacy-shell notbuilt">
              <b>{VIEW_LABELS[topView] || topView}</b> isn&rsquo;t part of this conversion pass — only Admin, Directory,
              Activity, Performance and Apps were ported.{' '}
              <a onClick={() => setTopView('admin')} style={{ color: '#c9401a', cursor: 'pointer' }}>Back to Admin</a>
            </div>
          )}
        </main>
      </div>

      <div id="toastwrap">
        {toasts.map((t) => <ToastItem msg={t.msg} key={t.id} />)}
      </div>

      {confirmState && (
        <div id="cscrim" onClick={() => setConfirmState(null)}>
          <div className="cbox" onClick={(e) => e.stopPropagation()}>
            <div className="ch">
              <h2>Please confirm</h2>
              <button className="x" onClick={() => setConfirmState(null)}>×</button>
            </div>
            <p dangerouslySetInnerHTML={{ __html: confirmState.msg }} />
            <div className="df">
              <button className="btn sec" onClick={() => setConfirmState(null)}>Cancel</button>
              <button
                className="btn"
                onClick={() => {
                  const fn = confirmState.onYes
                  setConfirmState(null)
                  fn()
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <Drawer />
      <ConfirmBox />
      <Toasts />
    </div>
    </UiProvider>
  )
}

function titleCase(heading) {
  return heading
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export default App
