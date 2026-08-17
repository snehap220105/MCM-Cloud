/**
 * Contact Centre Performance.
 *
 * In the prototype this view was assembled by successive patch scripts, each
 * appending a tab to the strip and branching inside `renderPerfBody()`. Here
 * the tab set is declared once, and each tab lives in its own module under
 * `src/views/perf/`.
 */
import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Wallboard } from '../perf/_wallboard';
/**
 * The tab strip, in the order the original ends up with.
 *
 * The prototype started with five tabs (`var TABS=['Queues Activity','Agents',
 * 'Interactions','Flows','Dashboards']`) and each later patch script appended
 * its own — Live Interactions, then Callbacks, then Reports, with Speech & Text
 * inserted immediately *before* Reports. That leaves Reports last.
 *
 * There is deliberately no "My Performance" tab: in the reference that screen is
 * an alternate whole-view for `APP.role === 'agent'` (`renderPerf` returns
 * `renderMyPerf()` for agents), never an entry in this strip.
 */
const TABS = [
  {
    label: 'Queues Activity',
    module: 'QueuesActivity',
  },
  {
    label: 'Agents',
    module: 'Agents',
  },
  {
    label: 'Interactions',
    module: 'Interactions',
  },
  {
    label: 'Flows',
    module: 'Flows',
  },
  {
    label: 'Dashboards',
    module: 'Dashboards',
  },
  {
    label: 'Live Interactions',
    module: 'LiveInteractions',
  },
  {
    label: 'Callbacks',
    module: 'Callbacks',
  },
  {
    label: 'Speech & Text',
    module: 'SpeechText',
  },
  {
    label: 'Reports',
    module: 'Reports',
  },
];
const tabModules = import.meta.glob('../perf/*.jsx', {
  eager: true,
});
function tabComponent(moduleName) {
  return tabModules[`../perf/${moduleName}.jsx`]?.default;
}
function NotPorted({ label }) {
  return (
    <div className="pbody">
      <div
        style={{
          background: '#fff',
          border: '1px solid #dde3ec',
          borderRadius: 6,
          padding: '40px 24px',
          textAlign: 'center',
          color: '#7b8798',
        }}
      >
        <div
          style={{
            fontSize: 15,
            color: '#152550',
            marginBottom: 6,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 12.5,
          }}
        >
          This tab has not been ported yet.
        </div>
      </div>
    </div>
  );
}
export default function PerformanceView() {
  const [activeTab, setActiveTab] = useState(TABS[0].label);
  const [wallboard, setWallboard] = useState(false);
  const spec = TABS.find((tab) => tab.label === activeTab) ?? TABS[0];
  const Tab = tabComponent(spec.module);
  if (wallboard) return <Wallboard onClose={() => setWallboard(false)} />;
  return (
    <>
      <PageHeader
        breadcrumb="Performance"
        title="Contact Centre Performance"
        actions={
          <>
            <button className="btn sec" onClick={() => setWallboard(true)}>
              ▣ Wallboard
            </button>
            <button className="btn" onClick={() => setActiveTab('Dashboards')}>
              My dashboards
            </button>
          </>
        }
        tabs={TABS.map((tab) => ({
          id: tab.label,
          label: tab.label,
        }))}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      {Tab ? <Tab onOpenWallboard={() => setWallboard(true)} /> : <NotPorted label={spec.label} />}
    </>
  );
}
