/**
 * ACD Setup Guide — the guided build-order checklist.
 *
 * Ported from the prototype's `renderAcdSetup`. Every step inspects the live
 * database and reports whether that part of the contact centre is configured,
 * in the same order the Genesys Cloud CX course builds it: skills → agents →
 * wrap-up → queue → utilization → flow → call route → test.
 *
 * The final step's buttons opened tools that live on other pages in the
 * original (the number-plan Simulate Call drawer, the Architect flow editor);
 * here they navigate to the page that hosts each tool.
 */

import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { useDb } from '@/store/db';
export default function AcdSetupPage() {
  const db = useDb();
  const navigate = useNavigate();
  const agentsWithSkills = db.users.filter((u) => Object.keys(u.skills || {}).length).length;
  const queuesWithMembers = (db.queues || []).filter((q) => q.members.length).length;
  const flowsWithAcd = (db.flows || []).filter((f) => f.nodes.some((n) => n.type === 'acd')).length;
  const steps = [
    {
      n: 1,
      t: 'Create ACD skills & languages',
      d: 'Skills describe what an agent can handle (Billing, Technical…). Flows request them; queues evaluate them. Languages are a parallel routing attribute.',
      ok: db.skills.length > 0,
      detail: `${db.skills.length} skills, ${db.langs.length} languages`,
      page: 'skills',
      lab: 'Lab 1 — Creating Skills and Language',
    },
    {
      n: 2,
      t: 'Add agents and assign skills with proficiency',
      d: 'Every agent needs the Agent role, a queue-ready licence and skills rated 0–5. Proficiency drives “Best Available Skills” evaluation.',
      ok: agentsWithSkills > 0,
      detail: `${agentsWithSkills} agents carry skills`,
      page: 'people',
      lab: 'Lab 2 — Managing User Accounts',
    },
    {
      n: 3,
      t: 'Create wrap-up codes',
      d: 'Outcome labels agents pick in after-call work. Attach them per queue; they feed reporting and outbound list logic.',
      ok: (db.wrapup || []).length > 0,
      detail: `${(db.wrapup || []).length} codes defined`,
      page: 'wrapup',
      lab: 'Lab 2 — Creating Wrap-up Codes',
    },
    {
      n: 4,
      t: 'Build queues: members, routing & media settings',
      d: 'Pick the routing method (Standard/Bullseye/Preferred/Conditional) and evaluation method (All Skills/Best Available/Disregard), set SLA and ACW, attach wrap-up codes, in-queue flow and default script.',
      ok: queuesWithMembers > 0,
      detail: `${(db.queues || []).length} queues, ${queuesWithMembers} with members`,
      page: 'queues',
      lab: 'Lab 3 — Creating and Configure ACD Queues',
    },
    {
      n: 5,
      t: 'Set utilization (capacity & interrupts)',
      d: 'How many interactions per media type an agent handles at once, and which media may interrupt which. Controls omnichannel blending.',
      ok: !!db.util,
      detail: db.util
        ? `Voice ${db.util.Voice.cap} · Chat ${db.util.Chat.cap} · Email ${db.util.Email.cap}`
        : 'not set',
      page: 'util',
      lab: 'Lab 4 — Using Utilization',
    },
    {
      n: 6,
      t: 'Build the IVR flow with Transfer to ACD',
      d: 'Architect flow: greeting → schedule check → menu → Set Skills/priority → Transfer to ACD into your queue. Publish it — drafts never answer calls.',
      ok: flowsWithAcd > 0,
      detail: `${flowsWithAcd} flows contain Transfer to ACD`,
      page: 'flows',
      lab: 'Lab 10 — Creating ACD using Architect and IVR Routing',
    },
    {
      n: 7,
      t: 'Bind a DID to the flow (call route)',
      d: 'The “front door”: an inbound number from your DID ranges answered by the published flow. No call route = the IVR never rings.',
      ok: (db.callRoutes || []).length > 0,
      detail: `${(db.callRoutes || []).length} call routes bound`,
      page: 'callroute',
      lab: 'Chapter 4.10 — DIDs',
    },
    {
      n: 8,
      t: 'Test end-to-end',
      d: 'Use Simulate Call (dial plan → route → trunk), the flow Test Call (path walk incl. schedule + menu), the queue routing simulator (eligibility per evaluation method), then take a live call in the Agent Workspace.',
      ok: false,
      detail: 'run the three simulators',
      page: '',
      lab: '',
      custom: (
        <>
          <button
            className="btn sec"
            style={{
              height: 28,
            }}
            onClick={() => navigate('/admin/numplan')}
          >
            Simulate Call
          </button>{' '}
          <button
            className="btn sec"
            style={{
              height: 28,
            }}
            onClick={() => navigate('/admin/flows')}
          >
            Flow Test Call
          </button>{' '}
          <button
            className="btn sec"
            style={{
              height: 28,
            }}
            onClick={() => navigate('/admin/queues')}
          >
            Queue routing test
          </button>{' '}
          <button
            className="btn sec"
            style={{
              height: 28,
            }}
            onClick={() => navigate('/activity')}
          >
            Agent Workspace
          </button>
        </>
      ),
    },
  ];
  const done = steps.filter((s) => s.ok).length;
  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <a onClick={() => navigate('/admin')}>Admin</a> › Contact Center
          </>
        }
        title="ACD Setup Guide"
        actions={
          <span
            className="tag"
            style={{
              fontSize: 12,
              padding: '6px 12px',
            }}
          >
            {done} of 8 steps complete
          </span>
        }
        tabs={[
          {
            id: 'order',
            label: 'Build order from the Genesys Cloud CX course',
          },
        ]}
        activeTab="order"
      />

      <div className="pbody">
        <div
          style={{
            height: 6,
            background: '#eef1f6',
            borderRadius: 3,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              height: 6,
              borderRadius: 3,
              background: '#1f9d63',
              width: `${(done / 8) * 100}%`,
            }}
          />
        </div>

        {steps.map((step) => (
          <div
            key={step.n}
            style={{
              background: '#fff',
              border: '1px solid #dde3ec',
              borderRadius: 10,
              padding: '14px 18px',
              marginBottom: 10,
              display: 'flex',
              gap: 14,
              alignItems: 'flex-start',
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                color: '#fff',
                background: step.ok ? '#1f9d63' : '#c9d2df',
              }}
            >
              {step.ok ? '✓' : step.n}
            </div>

            <div
              style={{
                flex: 1,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <b
                  style={{
                    fontSize: 14,
                    color: '#152550',
                  }}
                >
                  {step.t}
                </b>
                {step.ok ? (
                  <span className="st ok">
                    <span className="d" />
                    Done
                  </span>
                ) : (
                  <span className="st wn">
                    <span className="d" />
                    To do
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: '#5b6b82',
                  lineHeight: 1.6,
                  margin: '4px 0 6px',
                }}
              >
                {step.d}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: '#8794a8',
                }}
              >
                Status: {step.detail}
                {step.lab ? ` · Course: ${step.lab}` : ''}
              </div>
            </div>

            <div
              style={{
                flexShrink: 0,
              }}
            >
              {step.custom ?? (
                <button
                  className={'btn' + (step.ok ? ' sec' : '')}
                  style={{
                    height: 30,
                  }}
                  onClick={() => navigate(`/admin/${step.page}`)}
                >
                  {step.ok ? 'Review' : 'Configure'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
