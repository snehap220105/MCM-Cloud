/**
 * Shared telephony UI: the drawer validation banner, the trunk status pill, the
 * site picker chip, and the Simulate Call drawer.
 *
 * These are used by more than one telephony page. Like `_telephony.js`, this
 * module has **no default export**, so the page registry never picks it up.
 */
import { useState } from 'react';
import { useUi } from '@/store/ui';
import { classifyCall, groupName, plansOf, setTelSite } from './_telephony';

/* ---------------------------------------------------------------- error box */

/** The inline validation banner the legacy drawers rendered through `errBox()`. */
export function ErrorBox({ messages }) {
  if (messages.length === 0) return null;
  return (
    <div
      style={{
        background: '#fdecea',
        border: '1px solid #f5c6c0',
        color: '#b3261e',
        borderRadius: 5,
        padding: '8px 11px',
        fontSize: 12.5,
        marginBottom: 10,
      }}
    >
      {messages.map((message, index) => (
        <div key={index}>{message}</div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- status pill */

/** `statusPill()` — up / partially working / down. */
export function StatusPill({ status }) {
  if (status === 'up')
    return (
      <span className="st ok">
        <span className="d"></span>Up and Running
      </span>
    );
  if (status === 'partial')
    return (
      <span className="st wn">
        <span className="d"></span>Working Partially
      </span>
    );
  return (
    <span
      className="st"
      style={{
        color: '#b3261e',
      }}
    >
      <span
        className="d"
        style={{
          background: '#b3261e',
        }}
      ></span>
      Error / Down
    </span>
  );
}

/* ------------------------------------------------------------- site selector */

/** The "Site: …" chip that scopes Number Plans and Outbound Routes. */
export function SiteSelector({ sites, current }) {
  return (
    <select
      className="chip"
      style={{
        cursor: 'pointer',
      }}
      value={current}
      onChange={(e) => setTelSite(e.target.value)}
    >
      {sites.map((site) => (
        <option key={site.id} value={site.id}>
          Site: {site.name}
          {site.def ? ' (default)' : ''}
        </option>
      ))}
    </select>
  );
}

/* ------------------------------------------------------ simulate call drawer */

function SimRow({ label, children }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        padding: '6px 0',
        borderBottom: '1px solid #f2f5f9',
      }}
    >
      <span
        style={{
          width: 150,
          color: '#6b7a90',
          fontWeight: 600,
          fontSize: 11.5,
          textTransform: 'uppercase',
          letterSpacing: '.4px',
        }}
      >
        {label}
      </span>
      <span
        style={{
          flex: 1,
        }}
      >
        {children}
      </span>
    </div>
  );
}

/**
 * Simulate Call — a configuration validator. It normalises the dialed digits,
 * matches number plans top-down, resolves the classification to an outbound
 * route and picks the trunk. No actual call is placed.
 */
export function SimulateCallDrawer({ db, site, onClose }) {
  const { toast } = useUi();
  const [number, setNumber] = useState('');
  const [exampleIndex, setExampleIndex] = useState(0);
  const [output, setOutput] = useState(null);
  function runSim(dialed) {
    const n = dialed.trim();
    if (!n) {
      toast('Enter digits to simulate');
      return;
    }
    const res = classifyCall(db, site.id, n);
    if (!res) return;
    let head;
    if (!res.plan) {
      head = (
        <div
          style={{
            background: '#fdecea',
            border: '1px solid #f5c6c0',
            borderRadius: 6,
            padding: '10px 12px',
            marginTop: 6,
          }}
        >
          <b
            style={{
              color: '#b3261e',
            }}
          >
            ✗ {res.reason}
          </b>
        </div>
      );
    } else {
      const ok = Boolean(res.trunk) || res.cls === 'Extension';
      head = (
        <>
          <div
            style={{
              background: ok ? '#e8f7ef' : '#fdecea',
              border: `1px solid ${ok ? '#bfe6cf' : '#f5c6c0'}`,
              borderRadius: 6,
              padding: '10px 12px',
              marginTop: 6,
            }}
          >
            <b
              style={{
                color: ok ? '#1f9d63' : '#b3261e',
              }}
            >
              {ok ? '✓ Call would complete' : '✗ Call would FAIL'}
            </b>
            {res.reason ? (
              <div
                style={{
                  fontSize: 12,
                  marginTop: 4,
                }}
              >
                {res.reason}
              </div>
            ) : null}
          </div>

          <SimRow label="Dialed">{res.digits}</SimRow>
          <SimRow label="Normalised number">
            <b>{res.normalized}</b>
          </SimRow>
          <SimRow label="Matched number plan">
            {res.plan.name}{' '}
            <span
              style={{
                color: '#8794a8',
              }}
            >
              ({res.plan.match})
            </span>
          </SimRow>
          <SimRow label="Classification">
            <span className="tag">{res.cls}</span>
          </SimRow>
          <SimRow label="Outbound route">
            {res.route ? (
              <>
                {res.route.name}{' '}
                <span
                  style={{
                    color: '#8794a8',
                  }}
                >
                  ({res.route.dist})
                </span>
              </>
            ) : res.cls === 'Extension' ? (
              '— internal, on-net'
            ) : (
              <span
                style={{
                  color: '#b3261e',
                }}
              >
                none
              </span>
            )}
          </SimRow>
          <SimRow label="Selected trunk">
            {res.trunk ? (
              <>
                <b>{res.trunk.name}</b>{' '}
                <span
                  style={{
                    color: '#8794a8',
                  }}
                >
                  {res.trunk.type} · {groupName(db, res.trunk.group)}
                </span>
              </>
            ) : res.cls === 'Extension' ? (
              '—'
            ) : (
              <span
                style={{
                  color: '#b3261e',
                }}
              >
                none
              </span>
            )}
          </SimRow>
        </>
      );
    }
    setOutput(
      <>
        {head}
        <div
          style={{
            marginTop: 10,
          }}
        >
          <b
            style={{
              fontSize: 11.5,
              color: '#6b7a90',
              textTransform: 'uppercase',
              letterSpacing: '.4px',
            }}
          >
            Evaluation log
          </b>
          {res.log.map((line, index) => (
            <div
              key={index}
              style={{
                fontFamily: 'monospace',
                fontSize: 11,
                color:
                  line.indexOf('MATCH') > -1 && line.indexOf('no match') < 0
                    ? '#1f9d63'
                    : '#8794a8',
                padding: '2px 0',
              }}
            >
              {line}
            </div>
          ))}
        </div>
      </>
    );
  }

  /** Cycles the canned examples, picking the set that suits the site's country. */
  function tryExamples() {
    const examples =
      site.name.indexOf('Mumbai') > -1
        ? ['02212345678', '00442071231234', '7101', '112', '+442071231234']
        : ['02071231234', '00912212345678', '7101', '999', '0901234567'];
    const next = (exampleIndex + 1) % examples.length;
    const value = examples[next] ?? '';
    setExampleIndex(next);
    setNumber(value);
    runSim(value);
  }
  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div
        id="drw"
        style={{
          width: 560,
        }}
      >
        <div className="dh">
          <h2>Simulate Call — {site.name}</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>

        <div className="db">
          <div
            style={{
              fontSize: 12,
              color: '#5b6b82',
              marginBottom: 10,
              lineHeight: 1.6,
            }}
          >
            A configuration validator — no actual call is placed. Enter the digits a user would
            dial; the simulator normalises the number, matches number plans top-down, resolves the
            classification to an outbound route, and picks the trunk.
          </div>

          <div className="fld">
            <label>Dialed digits</label>
            <input
              value={number}
              placeholder="e.g. 02071231234, 00912212345678, 7101, 999, 0901234567"
              onChange={(e) => setNumber(e.target.value)}
            />
          </div>

          <div className="fld">
            <label>&nbsp;</label>
            <button className="btn" onClick={() => runSim(number)}>
              Simulate Call
            </button>{' '}
            <button className="btn sec" onClick={tryExamples}>
              Try examples
            </button>
          </div>

          <div
            style={{
              fontSize: 12.5,
              color: '#33425c',
            }}
          >
            {output}
          </div>
        </div>

        <div className="df">
          <button className="btn sec" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </>
  );
}

/** Unique classifications configured on a site, in plan order. */
export function classificationsOf(site) {
  const all = [];
  plansOf(site).forEach((p) => {
    if (all.indexOf(p.cls) < 0) all.push(p.cls);
  });
  return all;
}
