/**
 * Script Editor — the agent-script designer.
 *
 * Ported from the prototype's `scriptView` / `scrSel` / `scrPage` / `scrFilter`.
 * Three columns: the component palette on the left, the page canvas in the
 * middle, and the properties + variables panel on the right, with a page strip
 * under the toolbar and a status footer.
 *
 * The script itself (`SCR` in the original) is data, extracted to
 * `src/data/scriptDef.json`. Selecting a component or switching page only moves
 * the editor's cursor, so those live in component state rather than the store —
 * exactly the scope `SCR.sel` and `SCR.page` had in the prototype.
 *
 * Component copy in the script definition contains markup ("<b>Hello …</b>",
 * "&mdash;"), so those fragments are injected as HTML the way the original
 * string-built them. Everything else is ordinary JSX.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import scriptDef from '@/data/scriptDef.json';
import { useUi } from '@/store/ui';

/* ---------------------------------------------------------------- the data */

const SCR = scriptDef;

/** The component palette: [category, [[label, colour class], ...]][] */
const PALETTE = [
  [
    'Text',
    [
      ['Text block', ''],
      ['Rich text', ''],
      ['Heading', ''],
      ['Divider', ''],
    ],
  ],
  [
    'Input',
    [
      ['Text input', 'b'],
      ['Number input', 'b'],
      ['Date picker', 'b'],
      ['Dropdown', 'b'],
      ['Checkbox', 'b'],
      ['Radio group', 'b'],
      ['Text area', 'b'],
    ],
  ],
  [
    'Action',
    [
      ['Action button', 'g'],
      ['Transfer button', 'g'],
      ['Secure flow button', 'r'],
      ['Data action button', 'g'],
      ['Disposition picker', 'g'],
    ],
  ],
  [
    'Data',
    [
      ['Data table', 'p'],
      ['List', 'p'],
      ['Key/value pair', 'p'],
      ['Contact list field', 'p'],
    ],
  ],
  [
    'Media',
    [
      ['Image', 'y'],
      ['Web page (iframe)', 'y'],
      ['Video', 'y'],
    ],
  ],
  [
    'Layout',
    [
      ['Group box', ''],
      ['Two column', ''],
      ['Tab set', ''],
      ['Page break', ''],
    ],
  ],
];
const SECT = {
  background: '#f5f7fa',
  fontSize: 11,
  fontWeight: 700,
  color: '#6b7a90',
  textTransform: 'uppercase',
  letterSpacing: '.5px',
};

/** Renders a fragment of the script definition's stored markup. */
function Html({ html, className, style }) {
  return (
    <div
      className={className}
      style={style}
      dangerouslySetInnerHTML={{
        __html: html,
      }}
    />
  );
}

/* ------------------------------------------------------- canvas component */

function CanvasComponent({ comp }) {
  const [kind, , label, value] = comp;
  if (kind === 'head') {
    return (
      <>
        <div className="sclab">Text</div>
        <div
          style={{
            fontSize: 13.5,
            color: '#22304a',
            lineHeight: 1.65,
          }}
        >
          <b
            style={{
              display: 'block',
              marginBottom: 4,
              fontSize: 15,
            }}
          >
            {label}
          </b>
          <span
            dangerouslySetInnerHTML={{
              __html: value,
            }}
          />
        </div>
      </>
    );
  }
  if (kind === 'info') {
    return (
      <>
        <div className="sclab">{label}</div>
        <Html
          html={value}
          style={{
            fontSize: 12.5,
            color: '#33425c',
            background: '#f5f7fa',
            borderLeft: '3px solid #FF4F1F',
            padding: '9px 11px',
            borderRadius: '0 4px 4px 0',
            lineHeight: 1.6,
          }}
        />
      </>
    );
  }
  if (kind === 'field') {
    return (
      <>
        <div className="sclab">{label}</div>
        <div className="scfield">
          {value ? (
            <span
              dangerouslySetInnerHTML={{
                __html: value,
              }}
            />
          ) : (
            <span
              style={{
                color: '#a9b4c4',
              }}
            >
              Enter {label.toLowerCase()}
            </span>
          )}
        </div>
      </>
    );
  }
  if (kind === 'select') {
    return (
      <>
        <div className="sclab">{label}</div>
        <div
          className="scfield"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span
            dangerouslySetInnerHTML={{
              __html: value.split('|')[0],
            }}
          />
          <span
            style={{
              color: '#8794a8',
            }}
          >
            &#9662;
          </span>
        </div>
      </>
    );
  }
  if (kind === 'toggle') {
    return (
      <>
        <div className="sclab">Action button</div>
        <span
          className="scbtn"
          style={{
            background: '#d0342c',
          }}
        >
          &#128274;{' '}
          <span
            dangerouslySetInnerHTML={{
              __html: label,
            }}
          />
        </span>
      </>
    );
  }

  /* btnrow */
  return (
    <>
      <div className="sclab">Navigation</div>
      <span className="scbtn sec">&#8592; Back</span> <span className="scbtn">Next &#8594;</span>{' '}
      <span className="scbtn sec">Transfer</span>{' '}
      <span className="scbtn sec">Schedule callback</span>
    </>
  );
}

/* ------------------------------------------------------------------ page */

export default function ScriptEditorPage() {
  const navigate = useNavigate();
  const { toast } = useUi();
  const [page, setPage] = useState(SCR.page);
  const [sel, setSel] = useState(SCR.sel);
  const [paletteFilter, setPaletteFilter] = useState('');
  const comps = SCR.comps[String(page)] || [];
  const fields = SCR.props[sel] || [
    ['sect', 'Component'],
    ['Name', 'text', sel],
    ['tgl', 'Visible', 1],
  ];
  const term = paletteFilter.toLowerCase();
  return (
    <div className="scv">
      <div className="archbar">
        <span className="ttl">MCM Script Editor</span>
        <span className="crumb">
          &#8250;{' '}
          <b
            style={{
              color: '#fff',
            }}
          >
            {SCR.name}
          </b>{' '}
          &nbsp;v7 &middot; published
        </span>
        <span className="sp" />
        <button className="abtn" onClick={() => toast('Preview opened in agent view')}>
          Preview
        </button>
        <button className="abtn" onClick={() => toast('Script saved')}>
          Save
        </button>
        <button className="abtn pri" onClick={() => toast(`${SCR.name} published as v8`)}>
          Publish
        </button>
        <button className="abtn" onClick={() => navigate('/admin/scripts')}>
          Close
        </button>
      </div>

      {/* page strip */}
      <div
        style={{
          background: '#fff',
          borderBottom: '1px solid #dde3ec',
          padding: '8px 14px',
          display: 'flex',
          gap: 7,
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#6b7a90',
            textTransform: 'uppercase',
            letterSpacing: '.5px',
            marginRight: 6,
          }}
        >
          Pages
        </span>
        {SCR.pages.map((p, i) => (
          <button
            key={p}
            className={'pgbtn abtn' + (page === i + 1 ? ' pri' : '')}
            onClick={() => setPage(i + 1)}
          >
            {p}
          </button>
        ))}
        <button
          className="abtn"
          style={{
            background: '#eef2f8',
            color: '#33425c',
            borderColor: '#cfd7e3',
          }}
          onClick={() => toast('New page added')}
        >
          + Page
        </button>
      </div>

      <div className="archmain">
        {/* ------------------------------------------------ component palette */}
        <div className="tbox">
          <div className="th">Components</div>
          <div className="sr2">
            <input
              placeholder="Search components"
              value={paletteFilter}
              onChange={(e) => setPaletteFilter(e.target.value)}
            />
          </div>
          {PALETTE.map(([category, items]) => (
            <div key={category}>
              <div className="tcat">
                {category}
                <span>&#9662;</span>
              </div>
              {items.map(([label, colour]) => (
                <div
                  key={label}
                  className="titem"
                  style={
                    label.toLowerCase().indexOf(term) > -1
                      ? undefined
                      : {
                          display: 'none',
                        }
                  }
                >
                  <span className={'ic ' + colour} />
                  {label}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* -------------------------------------------------------- canvas */}
        <div className="sccanvas">
          <div className="scpage">
            <div className="sctitle">
              {SCR.name} &mdash; {SCR.pages[page - 1]}
            </div>
            {comps.map((c) => (
              <div
                key={c[1]}
                className={'sccomp' + (sel === c[1] ? ' sel' : '')}
                onClick={() => setSel(c[1])}
              >
                <CanvasComponent comp={c} />
              </div>
            ))}
          </div>
        </div>

        {/* ---------------------------------------------- properties panel */}
        <div className="props">
          <div className="ph">Properties</div>

          {fields.map((f, i) => {
            const rowKey = sel + ':' + i;
            if (f[0] === 'sect') {
              return (
                <div className="pf" style={SECT} key={rowKey}>
                  {f[1]}
                </div>
              );
            }
            if (f[0] === 'tgl') {
              return (
                <div
                  className="pf"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                  }}
                  key={rowKey}
                >
                  <input
                    type="checkbox"
                    defaultChecked={Boolean(f[2])}
                    style={{
                      width: 'auto',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      color: '#33425c',
                    }}
                  >
                    {f[1]}
                  </span>
                </div>
              );
            }
            if (f[1] === 'sel') {
              return (
                <div className="pf" key={rowKey}>
                  <label>{f[0]}</label>
                  <select defaultValue={String(f[2]).split('|')[0]}>
                    {String(f[2])
                      .split('|')
                      .map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                  </select>
                </div>
              );
            }
            return (
              <div className="pf" key={rowKey}>
                <label>{f[0]}</label>
                <input defaultValue={String(f[2])} />
              </div>
            );
          })}

          <div className="pf" style={SECT}>
            Variables
          </div>
          <div className="pf">
            {SCR.vars.map((v) => (
              <div
                key={v[0]}
                style={{
                  display: 'flex',
                  gap: 8,
                  fontSize: 11.5,
                  padding: '4px 0',
                  borderBottom: '1px solid #f2f5f9',
                }}
              >
                <span
                  style={{
                    flex: 1,
                    color: '#22304a',
                  }}
                >
                  {v[0]}
                </span>
                <span className={'tag' + (v[1] === 'Built-in' ? '' : ' o')}>{v[1]}</span>
                <span
                  style={{
                    color: '#8794a8',
                    width: 52,
                    textAlign: 'right',
                  }}
                >
                  {v[2]}
                </span>
              </div>
            ))}
          </div>

          <div className="pf" style={SECT}>
            Assigned to
          </div>
          <div
            className="pf"
            style={{
              fontSize: 12,
              color: '#33425c',
              lineHeight: 1.8,
            }}
          >
            Queue: Retail_Billing_L1
            <br />
            Queue: Retail_Complaints
            <br />
            Campaign: Collections_Q3
          </div>
        </div>
      </div>

      <div className="archfoot">
        <span>{comps.length} components on page</span>
        <span>4 pages</span>
        <span>{SCR.vars.length} variables</span>
        <span>Autosaved 12:53</span>
      </div>
    </div>
  );
}
