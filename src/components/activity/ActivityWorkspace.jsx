import { useState } from 'react';
import { useAgentWorkspace } from '../../hooks/useAgentWorkspace';
import { fmt } from '../../lib/workspace/helpers';
import { CHAT_CAP } from '../../data/workspace/queues';
import { ME_ID } from '../../data/workspace/users';
import CallPanel from './CallPanel';
import ChatCard from './ChatCard';
import EmailCard from './EmailCard';
import AgentCopilotPanel from './AgentCopilotPanel';
import CallbacksVoicemailSection from './CallbacksVoicemailSection';
import InteractionHistory from './InteractionHistory';
import TransferDrawer from './TransferDrawer';
import DialPadDrawer from './DialPadDrawer';
import ScheduleCallbackDrawer from './ScheduleCallbackDrawer';
import VoicemailDrawer from './VoicemailDrawer';
import KnowledgeBaseDrawer from './KnowledgeBaseDrawer';
import AISettingsDrawer from './AISettingsDrawer';
import MembershipConfirmDrawer from './MembershipConfirmDrawer';

// Ported from window.go('activity')'s final handler (v11, lines 6421-6428)
// and drawA() (lines 5989-6111) — the real, dynamic Agent Workspace, not
// the unused static window.SNAP['__activity'] cache this app never reads.
export default function ActivityWorkspace({ showToast, setPresence }) {
  const { state, actions } = useAgentWorkspace(showToast, setPresence);
  const [drawer, setDrawer] = useState(null); // null | 'transfer' | 'dialpad' | 'cbnew' | {type:'vm',id} | {type:'kb',id?} | 'aisettings'
  const [chatDrafts, setChatDrafts] = useState({});
  const [emailReply, setEmailReply] = useState('');

  function insertChat(i, text) {
    const ch = state.chats[i];
    if (ch) setChatDrafts((d) => ({ ...d, [ch.id]: text }));
  }

  return (
    <>
      <div className="phd">
        <div className="bc">MCM Cloud CX › Activity</div>
        <div className="tt">
          <h1>Agent Workspace</h1>
          <div className="rt">
            <button className={'btn' + (state.onQueue ? '' : ' sec')} onClick={actions.toggleQueue}>
              {state.onQueue ? '● On Queue — click to go Off' : 'Go On Queue'}
            </button>
            <select className="btn sec" style={{ padding: '0 10px' }} value={state.qsel} onChange={(e) => actions.setQsel(e.target.value)}>
              {state.queues.map((qq) => (
                <option value={qq.id} key={qq.id}>
                  {qq.name}{qq.members.indexOf(ME_ID) > -1 ? '' : ' — not a member'}
                </option>
              ))}
            </select>
            <button className="btn sec" onClick={actions.simulate}>Simulate inbound call</button>
            <button className="btn sec" onClick={actions.chatStart}>Simulate chat</button>
            <button className="btn sec" onClick={() => actions.msgStart('SMS')}>+ SMS</button>
            <button className="btn sec" onClick={() => actions.msgStart('WhatsApp')}>+ WhatsApp</button>
            <button className="btn sec" onClick={actions.emailStart}>Simulate email</button>
            <button className="btn" onClick={() => setDrawer('dialpad')}>☎ Dial pad</button>
          </div>
        </div>
        <div className="tabs">
          <div className="tb on">
            Handled: {state.stats.handled} · Talk: {fmt(state.stats.talk)} · Station: {state.station || 'none'} · Chats {state.chats.length}/{CHAT_CAP}
          </div>
        </div>
      </div>

      <div className="pbody">
        <CallPanel state={state} actions={actions} onTransfer={() => setDrawer('transfer')} />
        {state.chats.map((ch, i) => (
          <ChatCard
            key={ch.id}
            chat={ch}
            index={i}
            actions={actions}
            draft={chatDrafts[ch.id] || ''}
            onDraftChange={(v) => setChatDrafts((d) => ({ ...d, [ch.id]: v }))}
          />
        ))}
        {state.email && (
          <EmailCard email={state.email} actions={actions} reply={emailReply} onReplyChange={setEmailReply} />
        )}

        <AgentCopilotPanel
          state={state}
          actions={actions}
          onManageKb={(id) => setDrawer({ type: 'kb', id })}
          onAiSettings={() => setDrawer('aisettings')}
          onInsertChat={insertChat}
          onInsertEmail={setEmailReply}
        />
        <CallbacksVoicemailSection
          state={state}
          actions={actions}
          onSchedule={() => setDrawer('cbnew')}
          onPlayVoicemail={(id) => setDrawer({ type: 'vm', id })}
        />

        <InteractionHistory history={state.history} />
      </div>

      {drawer === 'transfer' && <TransferDrawer state={state} actions={actions} onClose={() => setDrawer(null)} />}
      {drawer === 'dialpad' && <DialPadDrawer actions={actions} onClose={() => setDrawer(null)} />}
      {drawer === 'cbnew' && <ScheduleCallbackDrawer state={state} actions={actions} onClose={() => setDrawer(null)} />}
      {drawer === 'aisettings' && <AISettingsDrawer state={state} actions={actions} onClose={() => setDrawer(null)} />}
      {drawer && drawer.type === 'kb' && (
        <KnowledgeBaseDrawer kb={state.kb} actions={actions} initialArticleId={drawer.id} onClose={() => setDrawer(null)} />
      )}
      {drawer && drawer.type === 'vm' && (
        <VoicemailDrawer
          vm={state.voicemails.find((v) => v.id === drawer.id)}
          actions={actions}
          onClose={() => setDrawer(null)}
          onCallBack={actions.vmCall}
        />
      )}
      {state.membershipPrompt && (
        <MembershipConfirmDrawer
          queue={state.queues.find((x) => x.id === state.membershipPrompt)}
          actions={actions}
          onClose={actions.cancelMembershipPrompt}
        />
      )}
    </>
  );
}
