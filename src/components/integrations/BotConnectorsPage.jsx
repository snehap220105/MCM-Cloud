import { useEffect, useMemo, useRef, useState } from "react";
import ColumnsDrawer from "../people/ColumnsDrawer.jsx";
import StatusFilterChip from "../people/StatusFilterChip.jsx";
import CreateBotConnectorDrawer, { PROVIDER_OPTIONS } from "./CreateBotConnectorDrawer.jsx";
import { downloadCsv } from "../../utils/csv.js";

const BOT_CONNECTORS = [
  { id: 1, name: "Retail_Triage_Bot", provider: "Amazon Lex V2", language: "en-GB", intents: 14, channels: "Voice, Web Messenger", confidenceThreshold: 0.72, status: "Live" },
  { id: 2, name: "Billing_FAQ_Bot", provider: "Dialogflow CX", language: "en-GB", intents: 22, channels: "Web Messenger, WhatsApp", confidenceThreshold: 0.68, status: "Live" },
  { id: 3, name: "Auth_Bot", provider: "Amazon Lex V2", language: "en-GB", intents: 4, channels: "Voice", confidenceThreshold: 0.85, status: "Live" },
  { id: 4, name: "Delivery_Tracking_Bot", provider: "Dialogflow CX", language: "en-GB", intents: 9, channels: "SMS, WhatsApp", confidenceThreshold: 0.70, status: "Live" },
  { id: 5, name: "Collections_Bot", provider: "MCM Native", language: "en-GB", intents: 11, channels: "Voice", confidenceThreshold: 0.75, status: "Training" },
  { id: 6, name: "Multilingual_Greeter", provider: "Dialogflow CX", language: "en-GB, fr-FR, pl-PL", intents: 6, channels: "Web Messenger", confidenceThreshold: 0.65, status: "Live" },
  { id: 7, name: "Legacy_FAQ_Bot", provider: "Custom webhook", language: "en-GB", intents: 18, channels: "Web Messenger", confidenceThreshold: 0.60, status: "Retired" },
];

const INTENTS_DATA = [
  { intent: "CheckBalance", utterances: 24, confidence: 0.94, keywords: ["balance"] },
  { intent: "MakePayment", utterances: 31, confidence: 0.91, keywords: ["pay", "payment"] },
  { intent: "OpeningHours", utterances: 12, confidence: 0.97, keywords: ["hours", "open", "closing", "close"] },
  { intent: "TalkToAgent", utterances: 18, confidence: 0.99, keywords: ["agent", "human", "representative", "talk to someone"] },
];

const TABS = ["Bots", "Intents", "Test Utterances"];
const COLUMNS = ["Column 1", "Bot", "Provider", "Language", "Intents", "Channels", "Confidence threshold", "Status", "Column 9"];
const STATUS_CLASS = { Live: "ok", Training: "wn", Retired: "of" };

function statusPill(status) {
  const cls = STATUS_CLASS[status] || "of";
  return <span className={"st " + cls}><span className="d" />{status}</span>;
}

function formToRow(form, existingRow) {
  return {
    name: form.name.trim(),
    provider: form.provider,
    language: form.language.trim() || "en-GB",
    intents: existingRow ? existingRow.intents : 0,
    channels: form.channels.trim(),
    confidenceThreshold: Number(form.confidenceThreshold) || 0,
    status: form.enabled ? "Live" : "Retired",
  };
}

function matchIntent(utterance) {
  const q = utterance.trim().toLowerCase();
  if (!q) return null;
  return INTENTS_DATA.find((i) => i.keywords.some((kw) => q.includes(kw))) ?? null;
}

// Per-row ⋮ popover — View/Edit/Disable/Delete, unlike the click-to-edit ⋮
// used on Integrations/Data Actions, since Disable and Delete are distinct
// destructive-ish actions here worth surfacing separately.
function BotRowMenu({ row, onEdit, onDisable, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [open]);

  function run(fn) { setOpen(false); fn(row); }

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }} onClick={(e) => e.stopPropagation()}>
      <span style={{ color: "#a9b3c2", cursor: "pointer" }} onClick={() => setOpen((v) => !v)}>⋮</span>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: "#fff", border: "1px solid #ccd4e0", borderRadius: 6, boxShadow: "0 8px 30px rgba(0,0,0,.16)", zIndex: 200, minWidth: 140, padding: "4px 0" }}>
          <div className="ddi" onClick={() => run(onEdit)}>View</div>
          <div className="ddi" onClick={() => run(onEdit)}>Edit</div>
          <div className="ddi" onClick={() => run(onDisable)}>Disable</div>
          <div className="ddi" style={{ color: "#c9401a" }} onClick={() => run(onDelete)}>Delete</div>
        </div>
      )}
    </div>
  );
}

export default function BotConnectorsPage({ onNavigate }) {
  const [tab, setTab] = useState("Bots");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [hiddenCols, setHiddenCols] = useState(() => new Set());
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [list, setList] = useState(BOT_CONNECTORS);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState(null);
  const [testUtterance, setTestUtterance] = useState("how much do I owe?");
  const [matchResult, setMatchResult] = useState(null);
  const [tested, setTested] = useState(false);

  function showToast(msg) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  }

  function toggleCol(i) {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  const statusValues = [...new Set(BOT_CONNECTORS.map((r) => r.status))];
  const filtered = useMemo(() => list.filter((r) =>
    (!q || (r.name + " " + r.provider + " " + r.language + " " + r.channels).toLowerCase().includes(q.toLowerCase())) &&
    (!statusFilter || r.status === statusFilter)
  ), [list, q, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * rowsPerPage;
  const rows = filtered.slice(start, start + rowsPerPage);

  function openCreate() { setEditingRow(null); setDrawerOpen(true); }
  function openEdit(row) { setEditingRow(row); setDrawerOpen(true); }
  function closeDrawer() { setDrawerOpen(false); setEditingRow(null); }

  function saveConnector(form) {
    if (editingRow) {
      setList((prev) => prev.map((r) => (r.id === editingRow.id ? { ...formToRow(form, editingRow), id: editingRow.id } : r)));
      showToast("Bot saved");
    } else {
      const nextId = list.reduce((max, r) => Math.max(max, r.id), 0) + 1;
      setList((prev) => [...prev, { ...formToRow(form, null), id: nextId }]);
      showToast("Bot added");
    }
    closeDrawer();
  }

  function disableConnector(row) {
    setList((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: "Retired" } : r)));
    showToast(`${row.name} disabled`);
  }

  function deleteConnector(row) {
    setList((prev) => prev.filter((r) => r.id !== row.id));
    showToast(`${row.name} deleted`);
  }

  function handleExport() {
    downloadCsv("bot-connectors.csv", ["Bot", "Provider", "Language", "Intents", "Channels", "Confidence threshold", "Status"],
      filtered.map((r) => [r.name, r.provider, r.language, r.intents, r.channels, r.confidenceThreshold.toFixed(2), r.status]));
    showToast("Exported to CSV");
  }

  return (
    <div className="pg legacy-shell">
      <div className="phd">
        <div className="bc"><a onClick={() => onNavigate('admin-hub')}>Admin</a> › Integrations</div>
        <div className="tt">
          <h1>Bot Connectors</h1>
          <div className="rt">
            <button className="btn" onClick={openCreate}>+ Add Bot</button>
            <button className="btn sec" onClick={handleExport}>Export</button>
          </div>
        </div>
        <div className="tabs">
          {TABS.map((t) => (
            <div key={t} className={"tb" + (tab === t ? " on" : "")} onClick={() => setTab(t)}>{t}</div>
          ))}
        </div>
      </div>

      <div className="pbody">
        {tab === "Intents" ? (
          <div className="tblw">
            <table className="dt">
              <thead><tr><th>Intent</th><th>Utterances</th><th>Confidence</th></tr></thead>
              <tbody>
                {INTENTS_DATA.map((r) => (
                  <tr key={r.intent}><td><b>{r.intent}</b></td><td>{r.utterances}</td><td>{r.confidence.toFixed(2)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === "Test Utterances" ? (
          <div style={{ maxWidth: 480 }}>
            <div style={{ fontSize: 12, color: "#5b6b82", marginBottom: 14 }}>Type what a customer might say; the bot matches an intent:</div>
            <div className="fld">
              <label>Utterance</label>
              <input value={testUtterance} onChange={(e) => setTestUtterance(e.target.value)} />
            </div>
            <button className="btn" style={{ marginBottom: 14 }} onClick={() => { setMatchResult(matchIntent(testUtterance)); setTested(true); }}>Match intent</button>
            {tested && (
              matchResult ? (
                <div className="st ok" style={{ background: "#e8f7ef", border: "1px solid #cfeddd", borderRadius: 6, padding: "10px 14px" }}>
                  Matched <b>{matchResult.intent}</b> — confidence {matchResult.confidence.toFixed(2)}
                </div>
              ) : (
                <div style={{ background: "#fdf4e7", border: "1px solid #f3ddb0", color: "#8a6d1f", borderRadius: 6, padding: "10px 14px", fontSize: 12.5 }}>
                  No intent above threshold — bot asks a clarifying question, then offers an agent.
                </div>
              )
            )}
          </div>
        ) : (
          <>
            <div className="tbar">
              <input className="s" placeholder="Search bot connectors" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
              <select className="chip" value="All" onChange={() => {}}>
                <option>Division: All</option>
              </select>
              <StatusFilterChip label="Status" values={statusValues} value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} />
              <div className="sp" />
              <div className="chip" onClick={() => setColumnsOpen(true)}>⚙ Columns</div>
              <div className="chip" onClick={() => { setQ(""); setStatusFilter(""); }}>↻ Refresh</div>
            </div>

            <div className="tblw">
              <table className="dt">
                <thead>
                  <tr>
                    {!hiddenCols.has(0) && <th style={{ width: 34 }}><input type="checkbox" /></th>}
                    {!hiddenCols.has(1) && <th>Bot ⇅</th>}
                    {!hiddenCols.has(2) && <th>Provider ⇅</th>}
                    {!hiddenCols.has(3) && <th>Language ⇅</th>}
                    {!hiddenCols.has(4) && <th>Intents ⇅</th>}
                    {!hiddenCols.has(5) && <th>Channels ⇅</th>}
                    {!hiddenCols.has(6) && <th>Confidence ⇅</th>}
                    {!hiddenCols.has(7) && <th>Status ⇅</th>}
                    {!hiddenCols.has(8) && <th style={{ width: 40 }} />}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={9 - hiddenCols.size} style={{ textAlign: "center", color: "#8794a8", padding: 26 }}>No bot connectors match the current filters</td></tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id} onClick={() => openEdit(r)}>
                        {!hiddenCols.has(0) && <td onClick={(e) => e.stopPropagation()}><input type="checkbox" /></td>}
                        {!hiddenCols.has(1) && <td><b className="lnk">{r.name}</b></td>}
                        {!hiddenCols.has(2) && <td>{r.provider}</td>}
                        {!hiddenCols.has(3) && <td>{r.language}</td>}
                        {!hiddenCols.has(4) && <td>{r.intents}</td>}
                        {!hiddenCols.has(5) && <td>{r.channels}</td>}
                        {!hiddenCols.has(6) && <td>{r.confidenceThreshold.toFixed(2)}</td>}
                        {!hiddenCols.has(7) && <td>{statusPill(r.status)}</td>}
                        {!hiddenCols.has(8) && (
                          <td>
                            <BotRowMenu row={r} onEdit={openEdit} onDisable={disableConnector} onDelete={deleteConnector} />
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="pgr">
                <span>Showing <b>{filtered.length ? start + 1 + "–" + Math.min(start + rowsPerPage, filtered.length) : 0}</b> of <b>{filtered.length}</b></span>
                <div className="sp" />
                <span>Rows per page{" "}
                  <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(1); }} style={{ border: "none", background: "transparent", fontWeight: 600 }}>
                    {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </span>
                <span style={{ display: "flex", gap: 4 }}>
                  <button className="btn sec" style={{ height: 26, padding: "0 8px" }} disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
                  <button className="btn sec" style={{ height: 26, padding: "0 8px" }} disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>›</button>
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {drawerOpen && (
        <CreateBotConnectorDrawer
          open={drawerOpen}
          onClose={closeDrawer}
          onSave={saveConnector}
          initialForm={editingRow ? {
            provider: PROVIDER_OPTIONS.includes(editingRow.provider) ? editingRow.provider : PROVIDER_OPTIONS[0],
            name: editingRow.name,
            language: editingRow.language,
            channels: editingRow.channels,
            confidenceThreshold: String(editingRow.confidenceThreshold),
            enabled: editingRow.status !== "Retired",
          } : undefined}
        />
      )}
      {columnsOpen && <ColumnsDrawer columns={COLUMNS} hidden={hiddenCols} onToggle={toggleCol} onClose={() => setColumnsOpen(false)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
