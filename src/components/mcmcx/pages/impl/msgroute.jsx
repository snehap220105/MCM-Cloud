/**
 * Message Routing — the digital channel configuration.
 *
 * Three channels live here, all read from `db.msgcfg`: the web Messenger
 * (colour, greeting, launcher position and the queue it routes into, plus a
 * copy-paste deployment snippet), the SMS long-code numbers, and the WhatsApp
 * Business profile. Everything routes into ACD as Chat or Message media.
 *
 * Ported from the prototype's `renderMsgFx` engine (`msgEditWidget`,
 * `msgSaveWidget`, `msgEditSms`, `msgSaveSms`, `msgEditWa`, `msgSaveWa`,
 * `msgCopySnip`, `msgPreview`).
 */
import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { audit, mutate, useDb } from '@/store/db';
import { useUi } from '@/store/ui';

/**
 * The WhatsApp channel is a single profile object in the seed data, which the
 * shared `MessagingConfig` type describes loosely. Narrow it here rather than
 * casting, so both reads and writes stay type-safe.
 */

function isWaChannel(value) {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'num' in value && 'name' in value && 'status' in value && 'queue' in value && 'enabled' in value
  );
}

/** The WhatsApp profile held by a database instance, or null if unconfigured. */
function readWa(database) {
  const raw = database.msgcfg.wa;
  return isWaChannel(raw) ? raw : null;
}
const LAUNCHER_COLOURS = ['#FF4F1F', '#1f6feb', '#1f9d63', '#7b61c9', '#152550'];

/* --------------------------------------------------------------- helpers */

function QueueSelect({ value, onChange }) {
  const db = useDb();
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      {db.queues.map((queue) => (
        <option key={queue.id} value={queue.id}>
          {queue.name}
        </option>
      ))}
    </select>
  );
}
function OffPill() {
  return (
    <span
      className="st"
      style={{
        color: '#8a94a6',
      }}
    >
      <span
        className="d"
        style={{
          background: '#8a94a6',
        }}
      />
      Off
    </span>
  );
}

/** The deployment snippet, derived from the Messenger name and colour. */
function snippetFor(widget) {
  const deployment = widget.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    '<script src="https://apps.mcmcloudcx.example/messenger.js"\n' +
    `        data-deployment="${deployment}-prod"\n` +
    `        data-color="${widget.color}"></script>`
  );
}

/* ------------------------------------------------------------ web messenger */

function WidgetDrawer({ onClose }) {
  const db = useDb();
  const { toast, user } = useUi();
  const widget = db.msgcfg.widget;
  const [name, setName] = useState(widget.name);
  const [color, setColor] = useState(widget.color);
  const [greeting, setGreeting] = useState(widget.greeting);
  const [queue, setQueue] = useState(widget.queue);
  const [enabled, setEnabled] = useState(widget.enabled);
  function save() {
    let queueLabel = '';
    mutate((database) => {
      const target = database.msgcfg.widget;
      target.name = name.trim() || target.name;
      target.color = color;
      target.greeting = greeting.trim() || target.greeting;
      target.queue = queue;
      target.enabled = enabled;
      queueLabel = database.queues.find((q) => q.id === target.queue)?.name ?? '—';
    });
    audit('Edit Messenger config', `${name.trim() || widget.name} → ${queueLabel}`, user.name);
    onClose();
    toast('Messenger saved — the deployment snippet updates automatically');
  }
  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div
        id="drw"
        style={{
          width: 430,
          height: 'auto',
          top: '12%',
          bottom: 'auto',
          borderRadius: '8px 0 0 8px',
        }}
      >
        <div className="dh">
          <h2>Web Messenger</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          <div className="fld">
            <label>Name</label>
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="fld">
            <label>Launcher colour</label>
            <select value={color} onChange={(event) => setColor(event.target.value)}>
              {LAUNCHER_COLOURS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label>Greeting message</label>
            <input value={greeting} onChange={(event) => setGreeting(event.target.value)} />
          </div>
          <div className="fld">
            <label>Routes to queue</label>
            <QueueSelect value={queue} onChange={setQueue} />
          </div>
          <div className="tgl">
            <input
              type="checkbox"
              checked={enabled}
              style={{
                width: 'auto',
                marginRight: 4,
              }}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            Messenger enabled on the site
          </div>
        </div>

        <div className="df">
          <button className="btn sec" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </>
  );
}

/* --------------------------------------------------------------------- SMS */

function SmsDrawer({ id, onClose }) {
  const db = useDb();
  const { toast, user } = useUi();
  const sms = db.msgcfg.sms.find((entry) => entry.id === id);
  const [label, setLabel] = useState(sms ? sms.label : '');
  const [queue, setQueue] = useState(sms ? sms.queue : '');
  const [enabled, setEnabled] = useState(sms ? sms.enabled : false);
  if (!sms) return null;
  const number = sms.num;
  function save() {
    let queueLabel = '';
    mutate((database) => {
      const target = database.msgcfg.sms.find((entry) => entry.id === id);
      if (!target) return;
      target.label = label.trim() || target.label;
      target.queue = queue;
      target.enabled = enabled;
      queueLabel = database.queues.find((q) => q.id === target.queue)?.name ?? '—';
    });
    audit('Edit SMS channel', `${number} → ${queueLabel}`, user.name);
    onClose();
    toast('SMS channel saved');
  }
  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div
        id="drw"
        style={{
          width: 400,
          height: 'auto',
          top: '16%',
          bottom: 'auto',
          borderRadius: '8px 0 0 8px',
        }}
      >
        <div className="dh">
          <h2>SMS — {sms.num}</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          <div className="fld">
            <label>Label</label>
            <input value={label} onChange={(event) => setLabel(event.target.value)} />
          </div>
          <div className="fld">
            <label>Routes to queue</label>
            <QueueSelect value={queue} onChange={setQueue} />
          </div>
          <div className="tgl">
            <input
              type="checkbox"
              checked={enabled}
              style={{
                width: 'auto',
                marginRight: 4,
              }}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            Number active
          </div>
        </div>

        <div className="df">
          <button className="btn sec" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- WhatsApp */

function WaDrawer({ onClose }) {
  const db = useDb();
  const { toast, user } = useUi();
  const wa = readWa(db);
  const [name, setName] = useState(wa ? wa.name : '');
  const [queue, setQueue] = useState(wa ? wa.queue : '');
  const [enabled, setEnabled] = useState(wa ? wa.enabled : false);
  if (!wa) return null;
  const number = wa.num;
  function save() {
    let queueLabel = '';
    mutate((database) => {
      const target = readWa(database);
      if (!target) return;
      target.name = name.trim() || target.name;
      target.queue = queue;
      target.enabled = enabled;
      queueLabel = database.queues.find((q) => q.id === target.queue)?.name ?? '—';
    });
    audit('Edit WhatsApp channel', `${number} → ${queueLabel}`, user.name);
    onClose();
    toast('WhatsApp channel saved');
  }
  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div
        id="drw"
        style={{
          width: 400,
          height: 'auto',
          top: '16%',
          bottom: 'auto',
          borderRadius: '8px 0 0 8px',
        }}
      >
        <div className="dh">
          <h2>WhatsApp Business</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          <div className="fld">
            <label>Profile name</label>
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="fld">
            <label>Routes to queue</label>
            <QueueSelect value={queue} onChange={setQueue} />
          </div>
          <div className="tgl">
            <input
              type="checkbox"
              checked={enabled}
              style={{
                width: 'auto',
                marginRight: 4,
              }}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            Channel enabled
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: '#8794a8',
              marginTop: 6,
            }}
          >
            Number and Meta approval are managed with your WhatsApp BSP; templates are required
            outside the 24-hour customer service window.
          </div>
        </div>

        <div className="df">
          <button className="btn sec" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------- widget preview */

/** "Try the widget" — the configured Messenger exactly as a visitor sees it. */
function WidgetPreview({ widget, queueLabel, onClose }) {
  const [draft, setDraft] = useState('');
  const [log, setLog] = useState([]);
  function send() {
    const text = draft.trim();
    if (!text) return;
    const id = Date.now();
    setLog((current) => [
      ...current,
      {
        id,
        from: 'visitor',
        text,
      },
    ]);
    setDraft('');
    window.setTimeout(() => {
      setLog((current) => [
        ...current,
        {
          id: id + 1,
          from: 'agent',
          text: `Thanks! You're in the queue for ${queueLabel} — an agent will be right with you.`,
        },
      ]);
    }, 900);
  }
  return (
    <div
      id="msgprev"
      style={{
        position: 'fixed',
        right: 26,
        bottom: 26,
        width: 320,
        zIndex: 9999,
        boxShadow: '0 12px 40px rgba(10,20,50,.35)',
        borderRadius: 14,
        overflow: 'hidden',
        background: '#fff',
        fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          background: widget.color,
          color: '#fff',
          padding: '13px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 9,
        }}
      >
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: '50%',
            background: '#7cf5b0',
          }}
        />
        <b
          style={{
            fontSize: 13.5,
          }}
        >
          {widget.name}
        </b>
        <span
          style={{
            marginLeft: 'auto',
            cursor: 'pointer',
            fontSize: 17,
          }}
          onClick={onClose}
          role="button"
          aria-label="Close preview"
        >
          ×
        </span>
      </div>

      <div
        style={{
          padding: 12,
          height: 200,
          overflow: 'auto',
          background: '#f6f8fb',
        }}
      >
        <div
          style={{
            background: '#fff',
            border: '1px solid #e4e9f0',
            borderRadius: '10px 10px 10px 3px',
            padding: '8px 11px',
            fontSize: 12.5,
            maxWidth: '85%',
          }}
        >
          {widget.greeting}
        </div>
        {log.map((message) =>
          message.from === 'visitor' ? (
            <div
              key={message.id}
              style={{
                background: widget.color,
                color: '#fff',
                borderRadius: '10px 10px 3px 10px',
                padding: '8px 11px',
                fontSize: 12.5,
                maxWidth: '85%',
                margin: '8px 0 0 auto',
                width: 'fit-content',
              }}
            >
              {message.text}
            </div>
          ) : (
            <div
              key={message.id}
              style={{
                background: '#fff',
                border: '1px solid #e4e9f0',
                borderRadius: '10px 10px 10px 3px',
                padding: '8px 11px',
                fontSize: 12.5,
                maxWidth: '85%',
                marginTop: 8,
              }}
            >
              {message.text}
            </div>
          )
        )}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 6,
          padding: 10,
          borderTop: '1px solid #eef1f6',
        }}
      >
        <input
          placeholder="Type a message…"
          value={draft}
          style={{
            flex: 1,
            height: 32,
            border: '1px solid #ccd4e0',
            borderRadius: 16,
            padding: '0 12px',
            fontSize: 12.5,
          }}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') send();
          }}
        />
        <button
          className="btn"
          style={{
            height: 32,
            borderRadius: 16,
            background: widget.color,
          }}
          onClick={send}
        >
          ➤
        </button>
      </div>

      <div
        style={{
          textAlign: 'center',
          fontSize: 10,
          color: '#a9b3c2',
          padding: '0 0 8px',
        }}
      >
        Preview — routes to {queueLabel}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- the page */

export default function MessageRoutingPage() {
  const db = useDb();
  const { toast } = useUi();
  const [editingWidget, setEditingWidget] = useState(false);
  const [editingSms, setEditingSms] = useState(null);
  const [editingWa, setEditingWa] = useState(false);
  const [preview, setPreview] = useState(false);
  const widget = db.msgcfg.widget;
  const smsNumbers = db.msgcfg.sms;
  const wa = readWa(db);
  function queueLabel(queueId) {
    return db.queues.find((queue) => queue.id === queueId)?.name ?? '—';
  }
  const snippet = snippetFor(widget);

  /** `msgCopySnip()` — put the deployment snippet on the clipboard. */
  function copySnippet() {
    void navigator.clipboard?.writeText(snippet).catch(() => undefined);
    toast('Snippet copied to clipboard');
  }
  return (
    <>
      <PageHeader
        breadcrumb="Admin › Contact Center"
        title="Message Routing"
        actions={
          <>
            <button className="btn sec" onClick={() => setPreview((open) => !open)}>
              ▶ Try the widget
            </button>
            <button className="btn" onClick={() => setEditingWidget(true)}>
              Edit Messenger
            </button>
          </>
        }
        tabs={[
          {
            id: 'channels',
            label: `Channels (${1 + smsNumbers.length + 1})`,
          },
        ]}
        activeTab="channels"
      />

      <div className="pbody">
        <div className="two">
          <div className="panel">
            <h3>
              Web Messenger <span className="sp" />
              {widget.enabled ? (
                <span className="st ok">
                  <span className="d" />
                  Deployed
                </span>
              ) : (
                <span className="st wn">
                  <span className="d" />
                  Disabled
                </span>
              )}
            </h3>

            <table className="dt">
              <tbody>
                <tr>
                  <td
                    style={{
                      width: 150,
                      color: '#8794a8',
                    }}
                  >
                    Name
                  </td>
                  <td>
                    <b>{widget.name}</b>
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      color: '#8794a8',
                    }}
                  >
                    Launcher colour
                  </td>
                  <td>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        background: widget.color,
                        verticalAlign: -2,
                      }}
                    />{' '}
                    {widget.color}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      color: '#8794a8',
                    }}
                  >
                    Greeting
                  </td>
                  <td>{widget.greeting}</td>
                </tr>
                <tr>
                  <td
                    style={{
                      color: '#8794a8',
                    }}
                  >
                    Position
                  </td>
                  <td>{widget.position}</td>
                </tr>
                <tr>
                  <td
                    style={{
                      color: '#8794a8',
                    }}
                  >
                    Routes to
                  </td>
                  <td>
                    <b>{queueLabel(widget.queue)}</b> (media: Chat)
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="sect">Deployment snippet — paste before &lt;/body&gt; on your site</div>
            <pre
              id="msg_snip"
              style={{
                background: '#152550',
                color: '#b8e0f5',
                borderRadius: 8,
                padding: 12,
                fontSize: 11.5,
                lineHeight: 1.6,
                overflow: 'auto',
              }}
            >
              {snippet}
            </pre>
            <button
              className="btn sec"
              style={{
                fontSize: 12,
              }}
              onClick={copySnippet}
            >
              ⧉ Copy snippet
            </button>
          </div>

          <div>
            <div
              className="panel"
              style={{
                marginBottom: 16,
              }}
            >
              <h3>
                SMS numbers <span className="sp" />
                <small>long-code numbers route into ACD as Message media</small>
              </h3>
              <table className="dt">
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Label</th>
                    <th>Routes to</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {smsNumbers.map((sms) => (
                    <tr key={sms.id} onClick={() => setEditingSms(sms.id)}>
                      <td>
                        <b className="lnk">{sms.num}</b>
                      </td>
                      <td>{sms.label}</td>
                      <td>{queueLabel(sms.queue)}</td>
                      <td>
                        {sms.enabled ? (
                          <span className="st ok">
                            <span className="d" />
                            Active
                          </span>
                        ) : (
                          <OffPill />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {wa ? (
              <div className="panel">
                <h3>
                  WhatsApp Business <span className="sp" />
                  {wa.enabled ? (
                    <span className="st ok">
                      <span className="d" />
                      {wa.status}
                    </span>
                  ) : (
                    <span className="st wn">
                      <span className="d" />
                      Disabled
                    </span>
                  )}
                </h3>
                <table className="dt">
                  <tbody>
                    <tr>
                      <td
                        style={{
                          width: 150,
                          color: '#8794a8',
                        }}
                      >
                        Number
                      </td>
                      <td>
                        <b>{wa.num}</b>
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          color: '#8794a8',
                        }}
                      >
                        Profile name
                      </td>
                      <td>{wa.name}</td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          color: '#8794a8',
                        }}
                      >
                        Meta approval
                      </td>
                      <td>{wa.status}</td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          color: '#8794a8',
                        }}
                      >
                        Routes to
                      </td>
                      <td>
                        <b>{queueLabel(wa.queue)}</b> (media: Message)
                      </td>
                    </tr>
                  </tbody>
                </table>
                <button
                  className="btn sec"
                  style={{
                    fontSize: 12,
                    marginTop: 8,
                  }}
                  onClick={() => setEditingWa(true)}
                >
                  Edit WhatsApp channel
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {editingWidget ? <WidgetDrawer onClose={() => setEditingWidget(false)} /> : null}
      {editingSms ? <SmsDrawer id={editingSms} onClose={() => setEditingSms(null)} /> : null}
      {editingWa ? <WaDrawer onClose={() => setEditingWa(false)} /> : null}
      {preview ? (
        <WidgetPreview
          widget={widget}
          queueLabel={queueLabel(widget.queue)}
          onClose={() => setPreview(false)}
        />
      ) : null}
    </>
  );
}
