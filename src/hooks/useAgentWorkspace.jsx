import { useEffect, useMemo, useReducer, useRef } from 'react';
import { QUEUES, WRAPUP, CHAT_CAP } from '../data/workspace/queues';
import { USERS, ME_ID } from '../data/workspace/users';
import { CALLERS, CUST, OPENERS, CHAT_REPLIES, VMTXT } from '../data/workspace/callers';
import { seedCallbacks, seedVoicemails } from '../data/workspace/callbacksSeed';
import { seedKb, CANNED, suggFor } from '../data/workspace/kb';
import { SITES, classifyCall } from '../data/workspace/dialPlan';
import { fmt, clock, dayISO, hash, uid, eligibleMembers } from '../lib/workspace/helpers';
import { kbSearch, kbForText } from '../lib/workspace/kbSearch';

const ME = USERS.find((u) => u.id === ME_ID);
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

const initialState = {
  onQueue: false,
  callState: 'idle', // idle | alerting | dialing | talking | acw
  call: null,
  secs: 0,
  history: [],
  stats: { handled: 0, talk: 0 },
  chats: [],
  email: null,
  consult: null,
  cbOffer: null,
  qsel: QUEUES[0].id,
  queues: QUEUES.map((q) => ({ ...q, members: [...q.members] })),
  callbacks: seedCallbacks(),
  voicemails: seedVoicemails(),
  kb: seedKb(),
  ai: { copilot: true, predictive: { [QUEUES[0].id]: true }, used: 0 },
  station: 'FKHAN-WebRTC',
  membershipPrompt: null, // queue pending an ACD-membership confirm
};

function historyRow(kind, name, ani, queue, dur, result, wrap) {
  return { t: clock(), kind, name, ani, queue: queue || '', dur, result, wrap: wrap || '' };
}

function reducer(state, action) {
  switch (action.type) {
    case 'TOGGLE_QUEUE': {
      const onQueue = !state.onQueue;
      return { ...state, onQueue };
    }
    case 'SET_QSEL':
      return { ...state, qsel: action.qid };

    case 'SIMULATE_START': {
      const q = state.queues.find((x) => x.id === state.qsel) || state.queues[0];
      const c = rand(CALLERS);
      return {
        ...state,
        call: { type: 'inbound', name: c[0], ani: c[1], queue: q.name, qid: q.id, held: false, muted: false, alertTimeout: q.alert || 12 },
        callState: 'alerting', secs: 0,
      };
    }
    case 'ADD_ME_TO_QUEUE': {
      const queues = state.queues.map((q) => (q.id === action.qid ? { ...q, members: [...q.members, ME_ID] } : q));
      return { ...state, queues, membershipPrompt: null };
    }
    case 'SET_MEMBERSHIP_PROMPT':
      return { ...state, membershipPrompt: action.qid };
    case 'CLEAR_MEMBERSHIP_PROMPT':
      return { ...state, membershipPrompt: null };

    case 'ANSWER': {
      if (state.callState !== 'alerting') return state;
      return { ...state, call: { ...state.call, waitS: state.secs }, callState: 'talking', secs: 0 };
    }
    case 'DECLINE': {
      if (state.callState !== 'alerting') return state;
      const h = historyRow('Voice', state.call.name, state.call.ani, state.call.queue, '00:00', 'Declined');
      return { ...state, history: [h, ...state.history], callState: 'idle', call: null };
    }
    case 'HOLD':
      return state.call ? { ...state, call: { ...state.call, held: !state.call.held } } : state;
    case 'MUTE':
      return state.call ? { ...state, call: { ...state.call, muted: !state.call.muted } } : state;

    case 'END_CALL': {
      if (state.callState === 'dialing') {
        const h = historyRow('Voice', state.call.name, state.call.ani, state.call.via || '', '00:00', 'Cancelled');
        return { ...state, history: [h, ...state.history], callState: 'idle', call: null, consult: null };
      }
      if (state.callState !== 'talking') return state;
      return {
        ...state,
        call: { ...state.call, talkSecs: state.secs },
        stats: { ...state.stats, talk: state.stats.talk + state.secs },
        consult: null, callState: 'acw', secs: 0,
      };
    }

    case 'WRAP': {
      const { wrapName } = action;
      const c = state.call;
      const h = historyRow('Voice', c.name, c.ani, c.queue || c.via, fmt(c.talkSecs || 0), 'Handled', wrapName);
      let callbacks = state.callbacks;
      if (c.cbId) {
        callbacks = callbacks.map((cb) => (cb.id === c.cbId ? { ...cb, state: 'Completed', doneAt: clock() } : cb));
      }
      return {
        ...state,
        history: [h, ...state.history],
        callbacks,
        stats: { ...state.stats, handled: state.stats.handled + 1 },
        callState: 'idle', call: null,
      };
    }

    case 'CHAT_START': {
      const c = rand(CALLERS);
      const q = state.queues.find((x) => x.name.indexOf('Digital') > -1) || state.queues[0];
      const chat = { id: uid(), name: c[0], queue: q.name, qid: q.id, secs: 0, replyIx: 0, typing: false, msgs: [{ who: 'cust', t: 'Hi — I have a question about my last bill, it looks higher than usual.' }] };
      return { ...state, chats: [...state.chats, chat] };
    }
    case 'MSG_START': {
      const c = rand(CUST);
      const q = state.queues.find((x) => /messag/i.test(x.name)) || state.queues[0];
      const open = rand(OPENERS[action.channel]);
      const chat = { id: uid(), name: c[0], ani: c[1], channel: action.channel, queue: q.name, qid: q.id, secs: 0, replyIx: 0, typing: false, msgs: [{ who: 'cust', t: open }] };
      return { ...state, chats: [...state.chats, chat] };
    }
    case 'CHAT_SEND': {
      const chats = state.chats.map((ch, i) => (i === action.i ? { ...ch, msgs: [...ch.msgs, { who: 'agent', t: action.text }], typing: true, typeLeft: 2 + Math.floor(Math.random() * 3) } : ch));
      return { ...state, chats };
    }
    case 'CHAT_END': {
      const ch = state.chats[action.i];
      if (!ch) return state;
      const chats = state.chats.filter((_, i) => i !== action.i);
      const h = historyRow(ch.channel || 'Chat', ch.name, ch.ani || 'web chat', ch.queue, fmt(ch.secs), 'Handled', 'Resolved');
      return { ...state, chats, history: [h, ...state.history], stats: { ...state.stats, handled: state.stats.handled + 1 } };
    }

    case 'EMAIL_START': {
      const c = rand(CALLERS);
      const email = {
        from: c[0] + ' <' + c[0].split(' ')[0].toLowerCase() + '@example.com>',
        subject: 'Question about my direct debit',
        body: 'Hello,\nMy direct debit was taken twice this month. Please can you check and refund the duplicate?\nThanks, ' + c[0].split(' ')[0],
        secs: 0, name: c[0],
      };
      return { ...state, email };
    }
    case 'EMAIL_END': {
      const e = state.email;
      if (!e) return state;
      const h = historyRow('Email', e.name, 'email', 'Email', fmt(e.secs), action.replied ? 'Handled' : 'Discarded', action.replied ? 'Resolved' : '');
      return {
        ...state,
        email: null,
        history: [h, ...state.history],
        stats: action.replied ? { ...state.stats, handled: state.stats.handled + 1 } : state.stats,
      };
    }

    case 'DIAL_OUTCOME': {
      const h = action.failHistory ? [action.failHistory, ...state.history] : state.history;
      if (!action.call) return { ...state, history: h };
      return { ...state, call: action.call, callState: 'dialing', secs: 0, history: h };
    }

    case 'TRANSFER_BLIND': {
      const { target } = action;
      const agentName = target.agent ? target.agent.name : target.label;
      const h = historyRow('Voice', state.call.name, state.call.ani, state.call.queue, fmt(state.secs), 'Transferred', '→ ' + agentName);
      return {
        ...state,
        history: [h, ...state.history],
        stats: { ...state.stats, talk: state.stats.talk + state.secs, handled: state.stats.handled + 1 },
        callState: 'idle', call: null, consult: null,
      };
    }
    case 'TRANSFER_CONSULT_START': {
      const { target } = action;
      return {
        ...state,
        call: { ...state.call, held: true },
        consult: { name: target.agent ? target.agent.name : target.label, state: 'ringing', rsecs: 0, secs: 0 },
      };
    }
    case 'TRANSFER_COMPLETE': {
      if (!state.consult) return state;
      const h = historyRow('Voice', state.call.name, state.call.ani, state.call.queue, fmt(state.secs), 'Transferred', '→ ' + state.consult.name + ' (consult)');
      return {
        ...state,
        history: [h, ...state.history],
        stats: { ...state.stats, talk: state.stats.talk + state.secs, handled: state.stats.handled + 1 },
        callState: 'idle', call: null, consult: null,
      };
    }
    case 'CONFERENCE': {
      if (!state.consult) return state;
      return { ...state, call: { ...state.call, conference: true, held: false, name: state.call.name + ' + ' + state.consult.name }, consult: null };
    }
    case 'CANCEL_CONSULT': {
      if (!state.consult) return state;
      return { ...state, consult: null, call: { ...state.call, held: false } };
    }

    case 'CB_ACCEPT': {
      const cb = state.callbacks.find((x) => x.id === action.id);
      if (!cb) return state;
      const callbacks = state.callbacks.map((x) => (x.id === action.id ? { ...x, state: 'In progress', attempts: x.attempts + 1, agent: ME.name } : x));
      return {
        ...state, callbacks, cbOffer: null,
        call: { type: 'callback', name: cb.customer, ani: cb.ani, queue: cb.queue, via: 'Callback — ' + cb.queue, held: false, muted: false, cbId: cb.id, waitS: 0 },
        callState: 'dialing', secs: 0,
      };
    }
    case 'CB_SKIP': {
      const now = new Date();
      const mins = now.getMinutes() + 10 > 59 ? 59 : now.getMinutes() + 10;
      const due = String(now.getHours()).padStart(2, '0') + ':' + String(mins).padStart(2, '0');
      const callbacks = state.callbacks.map((x) => (x.id === action.id && !x.due ? { ...x, due } : x));
      return { ...state, callbacks, cbOffer: null };
    }
    case 'CB_NEW': {
      const cb = { id: uid(), customer: action.name, ani: action.num, queue: action.queue, reqAt: clock(), due: action.when || null, state: 'Waiting', attempts: 0, by: 'Agent scheduled', notes: action.notes };
      return { ...state, callbacks: [...state.callbacks, cb] };
    }
    case 'RANDOM_CALLBACK': {
      const cb = { id: uid(), customer: action.customer, ani: action.ani, queue: action.queue, reqAt: clock(), due: null, state: 'Waiting', attempts: 0, by: 'IVR offer (pressed 1 in queue)', notes: '' };
      return { ...state, callbacks: [...state.callbacks, cb] };
    }
    case 'RANDOM_VOICEMAIL': {
      const vm = { id: uid(), from: action.customer, ani: action.ani, queue: action.queue, at: clock(), dur: action.dur, transcript: action.transcript, state: 'New' };
      return { ...state, voicemails: [...state.voicemails, vm] };
    }
    case 'CB_OFFER': {
      return { ...state, cbOffer: action.id };
    }
    case 'CB_OFFER_CLEAR': {
      return { ...state, cbOffer: null };
    }

    case 'VM_HEARD': {
      const voicemails = state.voicemails.map((v) => (v.id === action.id && v.state === 'New' ? { ...v, state: 'Heard' } : v));
      return { ...state, voicemails };
    }
    case 'VM_CALL': {
      const vm = state.voicemails.find((x) => x.id === action.id);
      if (!vm) return state;
      const voicemails = state.voicemails.map((x) => (x.id === action.id ? { ...x, state: 'Heard' } : x));
      return {
        ...state, voicemails,
        call: { type: 'outbound', name: vm.from, ani: vm.ani, via: 'Voicemail return — ' + vm.queue, queue: vm.queue, held: false, muted: false, waitS: 0 },
        callState: 'dialing', secs: 0,
      };
    }

    case 'COP_USED':
      return { ...state, ai: { ...state.ai, used: state.ai.used + 1 } };
    case 'KB_SAVE': {
      const exists = state.kb.some((a) => a.id === action.article.id);
      const kb = exists ? state.kb.map((a) => (a.id === action.article.id ? action.article : a)) : [...state.kb, action.article];
      return { ...state, kb };
    }
    case 'AI_SETTINGS_SAVE':
      return { ...state, ai: { ...state.ai, copilot: action.copilot, predictive: action.predictive } };

    case 'TICK': {
      let next = { ...state };
      if (state.callState === 'alerting') {
        const secs = state.secs + 1;
        if (state.call && secs >= state.call.alertTimeout) {
          const h = historyRow('Voice', state.call.name, state.call.ani, state.call.queue, '00:00', 'Missed (RONA)');
          next = { ...next, history: [h, ...state.history], callState: 'idle', call: null, onQueue: false, secs: 0 };
        } else {
          next.secs = secs;
        }
      } else if (state.callState === 'dialing') {
        const secs = state.secs + 1;
        if (secs >= 2) {
          next.callState = 'talking'; next.secs = 0;
        } else next.secs = secs;
      } else if (state.callState === 'talking') {
        next.secs = state.secs + 1;
        if (state.call && state.call.held) next.call = { ...state.call, holdS: (state.call.holdS || 0) + 1 };
        if (state.consult) {
          if (state.consult.state === 'ringing') {
            const rsecs = state.consult.rsecs + 1;
            next.consult = rsecs >= 2 ? { ...state.consult, state: 'connected', rsecs, secs: 0 } : { ...state.consult, rsecs };
          } else {
            next.consult = { ...state.consult, secs: state.consult.secs + 1 };
          }
        }
      } else if (state.callState === 'acw') {
        next.secs = state.secs + 1;
      }
      next.chats = state.chats.map((ch) => {
        let nc = { ...ch, secs: ch.secs + 1 };
        if (ch.typing) {
          const typeLeft = ch.typeLeft - 1;
          if (typeLeft <= 0) {
            const reply = CHAT_REPLIES[ch.replyIx % CHAT_REPLIES.length];
            nc = { ...nc, typing: false, replyIx: ch.replyIx + 1, msgs: [...ch.msgs, { who: 'cust', t: reply }] };
          } else {
            nc.typeLeft = typeLeft;
          }
        }
        return nc;
      });
      if (state.email) next.email = { ...state.email, secs: state.email.secs + 1 };
      return next;
    }

    default:
      return state;
  }
}

// Ported from the Activity IIFE's drawA()/agt*/agc*/cb*/vm*/cop* functions
// (MCM_Cloud_CX_v15_2.html, roughly lines 3124-3291 superseded by 5901-9230
// — see the two research passes for exact line citations). `showToast` and
// `setPresence` are the app-level equivalents of window.toast()/setPres().
export function useAgentWorkspace(showToast, setPresence) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Ticking timer — window.__agcTick, setInterval(...,1000) at line 6115.
  useEffect(() => {
    const id = setInterval(() => {
      const before = stateRef.current;
      dispatch({ type: 'TICK' });
      if (before.callState === 'dialing' && before.secs + 1 >= 2) {
        showToast('Connected');
      }
      if (before.callState === 'alerting' && before.call && before.secs + 1 >= before.call.alertTimeout) {
        showToast('⚠ Alert timed out — interaction requeued; you are set to Not Responding');
        setPresence('Not Responding', '#e0a200');
      }
    }, 1000);
    return () => clearInterval(id);
  }, [showToast, setPresence]);

  // cbTick (lines 8012-8047), 2s interval. The "busy queue" half normally
  // reads window.PERF.q[qid].waiting, populated by a separate Live
  // Performance simulation (queue-depth/agent-state engine, v12) that runs
  // continuously in the background regardless of which page is open —
  // confirmed live: window.PERF.q holds real per-queue waiting counts, so
  // this random generation genuinely fires in the original, it isn't dead
  // code. That whole engine is its own subsystem (the Performance tab),
  // out of scope here, so this reproduces the same *observable* behavior —
  // a new callback or voicemail appearing every ~40s — by picking a random
  // queue instead of the busiest one by live depth.
  const simTick = useRef(0);
  useEffect(() => {
    const id = setInterval(() => {
      simTick.current++;
      const s = stateRef.current;
      if (simTick.current % 20 === 0) {
        const busyQ = s.queues.find((q) => !/chat|email/i.test(q.name));
        if (busyQ) {
          const c = rand(CUST);
          const waitingCb = s.callbacks.filter((x) => x.state === 'Waiting').length;
          const newVm = s.voicemails.filter((x) => x.state === 'New').length;
          if (Math.random() < 0.6 && waitingCb < 5) {
            dispatch({ type: 'RANDOM_CALLBACK', customer: c[0], ani: c[1], queue: busyQ.name });
            showToast(<>↩ A caller in <b>{busyQ.name}</b> opted for a callback — kept their queue position</>);
          } else if (newVm < 4) {
            dispatch({ type: 'RANDOM_VOICEMAIL', customer: c[0], ani: c[1], queue: busyQ.name, dur: 20 + Math.floor(Math.random() * 30), transcript: rand(VMTXT) });
            showToast(<>📼 New voicemail left in <b>{busyQ.name}</b></>);
          }
        }
      }
      if (s.onQueue && s.callState === 'idle' && !s.cbOffer && s.station) {
        const due = s.callbacks.find((x) => {
          if (x.state !== 'Waiting') return false;
          if (x.due && x.due > clock()) return false;
          const q = s.queues.find((qq) => qq.name === x.queue);
          return q && q.members.indexOf(ME_ID) > -1;
        });
        if (due) dispatch({ type: 'CB_OFFER', id: due.id });
      }
      if (s.cbOffer && (s.callState !== 'idle' || !s.onQueue)) {
        const cbo = s.callbacks.find((x) => x.id === s.cbOffer);
        if (!cbo || cbo.state !== 'Waiting') dispatch({ type: 'CB_OFFER_CLEAR' });
      }
    }, 2000);
    return () => clearInterval(id);
  }, [showToast]);

  const actions = useMemo(() => {
    const meLabel = () => ME;

    function resolveTarget(value) {
      const kind = value.slice(0, 1), id = value.slice(2);
      if (kind === 'q') {
        const q = stateRef.current.queues.find((x) => x.id === id);
        const el = eligibleMembers(q, USERS, ME_ID);
        return { label: q.name, agent: el.length ? el[0] : null, queue: q };
      }
      const u = USERS.find((x) => x.id === id);
      return { label: u.name, agent: u };
    }

    return {
      toggleQueue() {
        const onQueue = !stateRef.current.onQueue;
        dispatch({ type: 'TOGGLE_QUEUE' });
        setPresence(onQueue ? 'On Queue' : 'Available', onQueue ? '#FF4F1F' : '#1f9d63');
      },
      setQsel(qid) { dispatch({ type: 'SET_QSEL', qid }); },

      simulate() {
        const s = stateRef.current;
        if (s.callState !== 'idle') { showToast('Finish the current voice interaction first'); return; }
        if (!s.onQueue) { showToast(<>Go <b>On Queue</b> first — ACD only routes to on-queue agents</>); return; }
        if (!s.station) { showToast('No station selected — pick a phone first'); return; }
        const q = s.queues.find((x) => x.id === s.qsel) || s.queues[0];
        if (!q) { showToast('No queues configured'); return; }
        if (q.members.indexOf(ME_ID) < 0) { dispatch({ type: 'SET_MEMBERSHIP_PROMPT', qid: q.id }); return; }
        dispatch({ type: 'SIMULATE_START' });
      },
      confirmMembership(qid) {
        dispatch({ type: 'ADD_ME_TO_QUEUE', qid });
        setTimeout(() => actionsRef.current.simulate(), 0);
      },
      cancelMembershipPrompt() { dispatch({ type: 'CLEAR_MEMBERSHIP_PROMPT' }); },

      answer() {
        dispatch({ type: 'ANSWER' });
        showToast(<>Connected to <b>{stateRef.current.call?.name}</b></>);
      },
      decline() {
        dispatch({ type: 'DECLINE' });
        showToast('Declined — requeued to next agent');
      },
      hold() { dispatch({ type: 'HOLD' }); },
      mute() { dispatch({ type: 'MUTE' }); },
      endCall() { dispatch({ type: 'END_CALL' }); },

      wrap(wrapName) {
        const s = stateRef.current;
        const q = s.queues.find((x) => x.id === s.call.qid);
        const mandatory = q && q.acw !== 'Optional' && (q.wrapup || []).length;
        if (mandatory && !wrapName) { showToast('Select a wrap-up code — mandatory on this queue'); return; }
        dispatch({ type: 'WRAP', wrapName: wrapName || '' });
        showToast(wrapName ? <>Interaction completed — wrapped as <b>{wrapName}</b></> : 'Interaction completed');
      },

      chatStart() {
        const s = stateRef.current;
        if (s.chats.length >= CHAT_CAP) { showToast('Utilization limit — Chat capacity is ' + CHAT_CAP + ' (Admin › Contact Center › Utilization)'); return; }
        if (!s.onQueue) { showToast('Go On Queue to receive chats'); return; }
        dispatch({ type: 'CHAT_START' });
      },
      msgStart(channel) {
        const s = stateRef.current;
        if (s.chats.length >= CHAT_CAP) { showToast('Utilization limit — Message shares Chat capacity (' + CHAT_CAP + ')'); return; }
        if (!s.onQueue) { showToast('Go On Queue to receive messages'); return; }
        dispatch({ type: 'MSG_START', channel });
      },
      chatSend(i, text) {
        const ch = stateRef.current.chats[i];
        if (!ch) return;
        const t = (text || '').trim();
        if (!t) return;
        if (ch.channel === 'SMS' && t.length > 160) {
          showToast('SMS is ' + t.length + ' chars — sent as ' + Math.ceil(t.length / 153) + ' segments');
        }
        dispatch({ type: 'CHAT_SEND', i, text: t });
      },
      chatCanned(chatIndex, cannedId) {
        const cn = CANNED.find((c) => c.id === cannedId);
        if (!cn) return '';
        const ch = stateRef.current.chats[chatIndex];
        return cn.text.replace(/{{[^}]+}}/g, () => (ch ? ch.name.split(' ')[0] : 'customer'));
      },
      chatEnd(i) {
        dispatch({ type: 'CHAT_END', i });
        showToast('Chat completed');
      },

      emailStart() {
        const s = stateRef.current;
        if (s.email) { showToast('Finish the open email first'); return; }
        if (!s.onQueue) { showToast('Go On Queue to receive email'); return; }
        dispatch({ type: 'EMAIL_START' });
      },
      emailSend(text) {
        if (!text || text.trim().length < 5) { showToast('Type a reply first'); return; }
        dispatch({ type: 'EMAIL_END', replied: true });
        showToast('Reply sent — email completed');
      },
      emailDiscard() {
        dispatch({ type: 'EMAIL_END', replied: false });
        showToast('Email discarded');
      },

      dial(numberRaw) {
        const s = stateRef.current;
        const n = (numberRaw || '').trim();
        if (!n) { showToast('Enter a number'); return; }
        const site = SITES[0];
        const res = classifyCall(site.id, n);
        if (!res || !res.plan) {
          showToast('✗ Reorder tone — no number plan matched "' + n + '"');
          dispatch({ type: 'DIAL_OUTCOME', call: null, failHistory: historyRow('Voice', n, n, '', '00:00', 'Failed (no plan)') });
          return;
        }
        if (res.cls === 'Extension') {
          const target = USERS.find((u) => u.ext === res.digits);
          if (!target) {
            showToast('Extension ' + res.digits + ' is not assigned');
            dispatch({ type: 'DIAL_OUTCOME', call: null, failHistory: historyRow('Voice', 'Ext ' + res.digits, res.digits, '', '00:00', 'Failed (unassigned)') });
            return;
          }
          if (target.state !== 'Active') {
            showToast(<>{target.name} is inactive — voicemail</>);
            dispatch({ type: 'DIAL_OUTCOME', call: null, failHistory: historyRow('Voice', target.name, res.digits, '', '00:00', 'Voicemail') });
            return;
          }
          dispatch({ type: 'DIAL_OUTCOME', call: { type: 'outbound', name: target.name, ani: 'ext ' + res.digits, via: 'On-net — extension dialing', qid: '', held: false, muted: false } });
          return;
        }
        if (!res.trunk) {
          showToast('✗ Call FAILED — ' + (res.reason || 'no route serves classification ' + res.cls));
          dispatch({ type: 'DIAL_OUTCOME', call: null, failHistory: historyRow('Voice', n, res.normalized, '', '00:00', 'Blocked (' + res.cls + ')') });
          return;
        }
        dispatch({ type: 'DIAL_OUTCOME', call: { type: 'outbound', name: res.normalized, ani: res.normalized, via: res.cls + ' via ' + res.route.name + ' → trunk ' + res.trunk.name, qid: '', held: false, muted: false } });
      },

      transferBlind(targetValue) {
        const target = resolveTarget(targetValue);
        if (target.queue && !target.agent) {
          showToast(<>⚠ No eligible agent on <b>{target.label}</b> — the caller would wait in queue. Transfer sent.</>);
        } else {
          showToast(<>Transferred to <b>{target.agent ? target.agent.name : target.label}</b></>);
        }
        dispatch({ type: 'TRANSFER_BLIND', target });
      },
      transferConsult(targetValue) {
        const target = resolveTarget(targetValue);
        if (target.queue && !target.agent) { showToast('No eligible agent to consult on ' + target.label); return; }
        dispatch({ type: 'TRANSFER_CONSULT_START', target });
        showToast(<>Caller on hold — consulting {target.agent ? target.agent.name : target.label}</>);
      },
      completeTransfer() {
        const name = stateRef.current.consult?.name;
        dispatch({ type: 'TRANSFER_COMPLETE' });
        if (name) showToast(<>Transfer completed — <b>{name}</b> now owns the call</>);
      },
      conference() {
        dispatch({ type: 'CONFERENCE' });
        showToast('Conference established — 3 parties');
      },
      cancelConsult() {
        dispatch({ type: 'CANCEL_CONSULT' });
        showToast('Consult cancelled — back with the caller');
      },
      dtmf() { showToast('DTMF keypad sent in-call tones (demo)'); },

      cbAccept(id) {
        const s = stateRef.current;
        const cb = s.callbacks.find((x) => x.id === id);
        if (!cb) return;
        if (s.callState !== 'idle') { showToast('Finish the current interaction first'); return; }
        dispatch({ type: 'CB_ACCEPT', id });
        showToast(<>Dialling <b>{cb.customer}</b> — callback keeps the customer's queue priority</>);
      },
      cbSkip(id) {
        dispatch({ type: 'CB_SKIP', id });
        showToast('Callback deferred 10 minutes — it stays in the queue list');
      },
      cbNew(payload) {
        if ((payload.name || '').trim().length < 2 || (payload.num || '').trim().length < 6) {
          showToast('Enter a customer name and a valid number'); return false;
        }
        dispatch({ type: 'CB_NEW', ...payload });
        showToast('Callback saved — it will be offered when due');
        return true;
      },

      vmHeard(id) { dispatch({ type: 'VM_HEARD', id }); },
      vmCall(id) {
        const s = stateRef.current;
        const vm = s.voicemails.find((x) => x.id === id);
        if (!vm) return;
        if (s.callState !== 'idle') { showToast('Finish the current interaction first'); return; }
        if (!s.station) { showToast('Pick a station first'); return; }
        dispatch({ type: 'VM_CALL', id });
        showToast(<>Dialling <b>{vm.from}</b> back…</>);
      },

      copSearch(q) { return kbSearch(stateRef.current.kb, q); },
      copForText(txt) { return kbForText(stateRef.current.kb, txt); },
      copInsert() { dispatch({ type: 'COP_USED' }); },
      copSummary() {
        dispatch({ type: 'COP_USED' });
        const c = stateRef.current.call;
        if (!c) return null;
        let topic = 'the account';
        if (/bill/i.test(c.queue || '')) topic = 'a billing query';
        else if (/complaint/i.test(c.queue || '')) topic = 'a complaint';
        else if (/collect|arrear/i.test(c.queue || '')) topic = 'an arrears / payment discussion';
        else if (/messag|digital/i.test(c.queue || '')) topic = 'a digital service issue';
        const txt = 'Customer ' + c.name + ' (' + c.ani + ') contacted ' + (c.queue || 'us') + ' regarding ' + topic + '. ' +
          'Waited ' + (c.waitS || 0) + 's, talk time ' + fmt(c.talkSecs || 0) + (c.holdS ? ' (incl. ' + c.holdS + 's hold)' : '') + '. ' +
          'Issue was reviewed and next steps agreed with the customer. No further action required unless the customer calls back within 5 working days.';
        const w = WRAPUP.find((x) => /resolv/i.test(x.name)) || WRAPUP[0];
        showToast('✨ Summary drafted — edit it, then complete the wrap-up');
        return { text: txt, suggestedWrap: w.name };
      },
      suggFor,
      hashFit(name) { return 80 + (hash(name) % 18); },

      kbSave(article) {
        dispatch({ type: 'KB_SAVE', article: article.id ? article : { ...article, id: uid() } });
        showToast('Article saved — Copilot suggests it immediately');
      },
      aiSettingsSave(copilot, predictive) {
        dispatch({ type: 'AI_SETTINGS_SAVE', copilot, predictive });
        showToast('AI settings saved');
      },

      resolveTarget,
      me: meLabel,
      dayISO,
    };
  }, [showToast, setPresence]);

  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  return { state, actions, queuesData: state.queues, users: USERS, wrapupCodes: WRAPUP };
}
