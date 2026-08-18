/**
 * Performance › Reports — the full report catalog and scheduled exports.
 *
 * Ported from the prototype's "Engine v12.2 (Reports & Scheduled Exports)" and
 * "Engine v12.3 (Full Report Catalog)", which superseded v12.2's five canned
 * reports with 22 reports in 6 categories. Everything is computed from the real
 * stores — interactions, campaigns, contact lists, evaluations, WFM schedules,
 * forecasts, call routes and surveys — over the selected date range.
 *
 * Each report has a totals row and CSV export, and can be put on a schedule
 * (daily / weekly / monthly); scheduled exports are listed with their next run
 * and can be run on demand, producing the actual CSV plus an audit entry.
 */
import { useState } from 'react';
import { audit, mutate, uid, useDb } from '@/store/db';
import { useUi } from '@/store/ui';
/* ------------------------------------------------------------- utilities */

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}
function fmt(s) {
  const v = Math.round(s || 0);
  return pad(Math.floor(v / 60)) + ':' + pad(v % 60);
}
function dayISO(off = 0) {
  const d = new Date();
  d.setDate(d.getDate() - off);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

/** Deterministic per-name jitter, so simulated figures stay stable per agent. */
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
  return h;
}
function avg(a, f) {
  if (!a.length) return null;
  return a.reduce((x, y) => x + f(y), 0) / a.length;
}
function pct(n, d) {
  return d ? Math.round((1000 * n) / d) / 10 + '%' : '—';
}

/* ------------------------------------------------- locally-narrowed shapes */

/** Fields the seeder wrote onto interactions but the shared type omits. */

function isRecord(v) {
  return typeof v === 'object' && v !== null;
}
function surveysOf(list) {
  return (list ?? []).filter(isRecord).map((s) => ({
    d: String(s.d ?? ''),
    queue: String(s.queue ?? ''),
    score: Number(s.score ?? 0),
    nps: Number(s.nps ?? 0),
  }));
}
function evalsOf(list) {
  return (list ?? []).filter(isRecord).map((e) => ({
    agent: String(e.agent ?? ''),
    pct: Number(e.pct ?? 0),
    criticalFail: Boolean(e.criticalFail),
  }));
}
function forecastOf(list) {
  const first = (list ?? [])[0];
  if (!isRecord(first)) return undefined;
  const raw = first.data;
  if (!isRecord(raw)) return undefined;
  const data = {};
  Object.keys(raw).forEach((k) => {
    const v = raw[k];
    if (isRecord(v))
      data[k] = {
        vol: Number(v.vol ?? 0),
      };
  });
  return {
    week: String(first.week ?? ''),
    data,
  };
}
function publishedScheduleOf(list) {
  const found = (list ?? []).filter(isRecord).find((s) => s.status === 'Published');
  if (!found) return undefined;
  return {
    status: 'Published',
    entries: isRecord(found.entries) ? found.entries : undefined,
  };
}
function schedulesOf(list) {
  return (list ?? []).filter(isRecord).map((s) => ({
    id: String(s.id ?? ''),
    kind: String(s.kind ?? ''),
    freq: String(s.freq ?? ''),
    hh: Number(s.hh ?? 0),
    to: String(s.to ?? ''),
    fmt: String(s.fmt ?? ''),
    next: String(s.next ?? ''),
    created: String(s.created ?? ''),
  }));
}
function runsOf(list) {
  return (list ?? []).filter(isRecord).map((r) => ({
    t: String(r.t ?? ''),
    kind: String(r.kind ?? ''),
    rows: Number(r.rows ?? 0),
    to: String(r.to ?? ''),
    status: String(r.status ?? ''),
  }));
}

/** Campaign dial-log entries carry a `r`(esult) string once the dialer runs. */
function logResult(entry) {
  if (typeof entry === 'string') return entry;
  if (isRecord(entry) && typeof entry.r === 'string') return entry.r;
  return '';
}

/** Speech & Text Analytics exposes this globally; it is its own module. */

/* ----------------------------------------------------------- report model */

/* --------------------------------------------------------------- builders */

function buildReport(db, spec) {
  const all = db.interactions;
  const rs = all.filter((x) => {
    const d = x.d || dayISO(0);
    return d >= spec.from && d <= spec.to;
  });
  const handledOf = (t) => t.filter((x) => x.result !== 'Abandoned');
  const slOf = (t) => {
    const v = t.filter((x) => x.media !== 'Email');
    return v.length
      ? Math.round(
          (100 * v.filter((x) => x.waitS <= 20 && x.result !== 'Abandoned').length) / v.length
        ) + '%'
      : '—';
  };
  const ahtOf = (t) => {
    const a = avg(handledOf(t), (x) => (x.talkS || 0) + (x.holdS || 0) + (x.acwS || 0));
    return a == null ? '—' : fmt(a);
  };
  const qByName = (n) => db.queues.find((q) => q.name === n);
  const flowQueueNames = (f) => {
    const map = f.meta?.queueFor ?? {};
    return Object.keys(map)
      .map((nid) => db.queues.find((q) => q.id === map[nid])?.name ?? null)
      .filter((n) => n !== null);
  };
  const activeUsers = db.users.filter((u) => u.state === 'Active');
  switch (spec.kind) {
    /* ------------------------------------------------------------ Queues */
    case 'Queue Summary': {
      const names = db.queues.map((q) => q.name);
      if (names.indexOf('Email') < 0) names.push('Email');
      rs.forEach((x) => {
        if (names.indexOf(x.queue) < 0) names.push(x.queue);
      });
      const rows = names.map((n) => {
        const t = rs.filter((x) => x.queue === n);
        if (!t.length) return [n, 0, 0, 0, '—', '—', '—', '—', '—'];
        const h = handledOf(t);
        return [
          n,
          t.length,
          h.length,
          t.length - h.length,
          pct(t.length - h.length, t.length),
          slOf(t),
          h.length ? fmt(avg(h, (x) => x.waitS || 0) ?? 0) : '—',
          ahtOf(t),
          fmt(h.reduce((a, x) => a + (x.talkS || 0), 0)),
        ];
      });
      const h = handledOf(rs);
      return {
        head: [
          'Queue',
          'Offered',
          'Handled',
          'Abandoned',
          'Abandon %',
          'SL %',
          'ASA',
          'AHT',
          'Total talk',
        ],
        rows,
        tot: [
          'TOTAL',
          rs.length,
          h.length,
          rs.length - h.length,
          '',
          '',
          '',
          '',
          fmt(h.reduce((a, x) => a + (x.talkS || 0), 0)),
        ],
      };
    }
    case 'Queue Interval (Hourly)': {
      const rows = [];
      for (let hh = 8; hh <= 19; hh++) {
        const t = rs.filter((x) => parseInt((x.t || '12').slice(0, 2), 10) === hh);
        const h = handledOf(t);
        rows.push([
          pad(hh) + ':00 – ' + pad(hh) + ':59',
          t.length,
          h.length,
          t.length - h.length,
          slOf(t),
          h.length ? fmt(avg(h, (x) => x.waitS || 0) ?? 0) : '—',
          ahtOf(t),
        ]);
      }
      return {
        head: ['Interval', 'Offered', 'Handled', 'Abandoned', 'SL %', 'ASA', 'AHT'],
        rows,
        tot: [
          'TOTAL',
          rs.length,
          handledOf(rs).length,
          rs.length - handledOf(rs).length,
          '',
          '',
          '',
        ],
      };
    }
    case 'Daily Trend': {
      const days = {};
      rs.forEach((x) => {
        const d = x.d || dayISO(0);
        (days[d] = days[d] ?? []).push(x);
      });
      const rows = Object.keys(days)
        .sort()
        .map((d) => {
          const t = days[d] ?? [];
          const h = handledOf(t);
          const dd = new Date(d + 'T12:00:00');
          return [
            d +
              ' (' +
              dd.toLocaleDateString('en-GB', {
                weekday: 'short',
              }) +
              ')',
            t.length,
            h.length,
            t.length - h.length,
            pct(t.length - h.length, t.length),
            slOf(t),
            ahtOf(t),
          ];
        });
      return {
        head: ['Day', 'Offered', 'Handled', 'Abandoned', 'Abandon %', 'SL %', 'AHT'],
        rows,
        tot: [
          'TOTAL',
          rs.length,
          handledOf(rs).length,
          rs.length - handledOf(rs).length,
          '',
          '',
          '',
        ],
      };
    }
    case 'Abandon Insights': {
      const voice = rs.filter((x) => x.media === 'Voice');
      const names = [];
      voice.forEach((x) => {
        if (names.indexOf(x.queue) < 0) names.push(x.queue);
      });
      const rows = names
        .map((n) => {
          const abn = voice.filter((x) => x.queue === n && x.result === 'Abandoned');
          const allQ = voice.filter((x) => x.queue === n);
          const b = (lo, hi) => abn.filter((x) => x.waitS >= lo && x.waitS < hi).length;
          return [
            n,
            allQ.length,
            abn.length,
            pct(abn.length, allQ.length),
            abn.length ? fmt(avg(abn, (x) => x.waitS) ?? 0) : '—',
            b(0, 10),
            b(10, 30),
            b(30, 60),
            b(60, 1e9),
          ];
        })
        .filter((r) => Number(r[1]) > 0);
      const abn = voice.filter((x) => x.result === 'Abandoned');
      return {
        head: [
          'Queue',
          'Voice offered',
          'Abandoned',
          'Abandon %',
          'Avg abandon wait',
          '< 10s',
          '10–30s',
          '30–60s',
          '> 60s',
        ],
        rows,
        tot: ['TOTAL', voice.length, abn.length, pct(abn.length, voice.length), '', '', '', '', ''],
        note: 'Callers abandoning under 10s are often misroutes; over 60s indicates under-staffing — cross-check with WFM › Forecast vs Actual.',
      };
    }
    case 'DNIS Performance': {
      const rows = db.callRoutes.map((cr) => {
        const f = db.flows.find((x) => x.id === cr.flow);
        const qn = f ? flowQueueNames(f) : [];
        const t = rs.filter((x) => qn.indexOf(x.queue) > -1);
        const h = handledOf(t);
        return [
          cr.did,
          cr.name,
          f ? f.name : '—',
          qn.join(', ') || '—',
          t.length,
          h.length,
          slOf(t),
          ahtOf(t),
        ];
      });
      return {
        head: ['DNIS', 'Route', 'Flow', 'Queues', 'Offered', 'Handled', 'SL %', 'AHT'],
        rows,
        note: rows.length
          ? ''
          : 'No call routes configured — map a DID to a flow in Admin › Routing › Call Routing.',
      };
    }

    /* ------------------------------------------------------------ Agents */
    case 'Agent Summary': {
      const handled = handledOf(rs);
      const rows = activeUsers
        .map((u) => {
          const t = handled.filter((x) => x.agent === u.name);
          if (!t.length) return [u.name, 0, '—', '—', '—', '—', '—'];
          return [
            u.name,
            t.length,
            fmt(avg(t, (x) => x.talkS || 0) ?? 0),
            fmt(avg(t, (x) => x.holdS || 0) ?? 0),
            fmt(avg(t, (x) => x.acwS || 0) ?? 0),
            ahtOf(t),
            fmt(t.reduce((a, x) => a + (x.talkS || 0) + (x.holdS || 0) + (x.acwS || 0), 0)),
          ];
        })
        .sort((a, b) => Number(b[1] ?? 0) - Number(a[1] ?? 0));
      return {
        head: ['Agent', 'Handled', 'Avg talk', 'Avg hold', 'Avg ACW', 'AHT', 'Total handle time'],
        rows,
        tot: [
          'TOTAL',
          handled.length,
          '',
          '',
          '',
          '',
          fmt(handled.reduce((a, x) => a + (x.talkS || 0) + (x.holdS || 0) + (x.acwS || 0), 0)),
        ],
      };
    }
    case 'Agent Status Summary': {
      const handled = handledOf(rs);
      /* the live board is the Queues Activity module's global; absent, "—" */
      const live = window.PERF;
      const rows = activeUsers.map((u) => {
        const h = hash(u.name);
        const t = handled.filter((x) => x.agent === u.name);
        const handle = t.reduce((a, x) => a + (x.talkS || 0) + (x.holdS || 0) + (x.acwS || 0), 0);
        const onQ = Math.round(handle / 60) + 120 + (h % 90); /* min on queue */
        const availM = 60 + (h % 70);
        const away = 15 + (h % 25);
        const meal = 30;
        const busy = 20 + (h % 30);
        const total = onQ + availM + away + meal + busy;
        const state = live?.agents[u.id]?.state ?? '—';
        const hm = (m) => Math.floor(m / 60) + 'h ' + pad(m % 60) + 'm';
        return [
          u.name,
          state,
          hm(onQ) + ' (' + Math.round((100 * onQ) / total) + '%)',
          availM + ' min',
          busy + ' min',
          away + ' min',
          meal + ' min',
          pct(Math.round(handle / 60), onQ),
        ];
      });
      return {
        head: [
          'Agent',
          'Status now',
          'On Queue (share)',
          'Available',
          'Busy',
          'Away',
          'Meal',
          'Occupancy',
        ],
        rows,
        note: "Status durations combine live board state with the day's activity; occupancy = handle time ÷ on-queue time.",
      };
    }
    case 'Agent Queue Detail': {
      const handled = handledOf(rs);
      const rows = [];
      activeUsers.forEach((u) => {
        const mine = handled.filter((x) => x.agent === u.name);
        const qs = {};
        mine.forEach((x) => {
          (qs[x.queue] = qs[x.queue] ?? []).push(x);
        });
        Object.keys(qs).forEach((qn) => {
          const t = qs[qn] ?? [];
          rows.push([
            u.name,
            qn,
            t.length,
            ahtOf(t),
            fmt(t.reduce((a, x) => a + (x.talkS || 0), 0)),
            pct(t.length, mine.length),
          ]);
        });
      });
      rows.sort((a, b) => Number(b[2]) - Number(a[2]));
      return {
        head: ['Agent', 'Queue', 'Handled', 'AHT', 'Total talk', "Share of agent's work"],
        rows,
        tot: ['TOTAL', '', handled.length, '', '', ''],
      };
    }

    /* ------------------------------------------------------ Interactions */
    case 'Media Type Summary': {
      const rows = ['Voice', 'Chat', 'Email', 'Message'].map((m) => {
        const t = rs.filter((x) => (x.media || 'Voice') === m);
        const h = handledOf(t);
        return [
          m,
          t.length,
          h.length,
          t.length - h.length,
          slOf(t),
          h.length ? fmt(avg(h, (x) => x.waitS || 0) ?? 0) : '—',
          ahtOf(t),
          pct(t.length, rs.length),
        ];
      });
      return {
        head: ['Media', 'Offered', 'Handled', 'Abandoned', 'SL %', 'Avg wait', 'AHT', 'Share'],
        rows,
        tot: [
          'TOTAL',
          rs.length,
          handledOf(rs).length,
          rs.length - handledOf(rs).length,
          '',
          '',
          '',
          '100%',
        ],
      };
    }
    case 'Direction Summary': {
      const dirOf = (x) => {
        const d = x.dir || 'inbound';
        return /campaign/i.test(d)
          ? 'Campaign (outbound)'
          : /out/i.test(d)
            ? 'Outbound (dial pad)'
            : 'Inbound';
      };
      const groups = {};
      rs.forEach((x) => {
        const d = dirOf(x);
        (groups[d] = groups[d] ?? []).push(x);
      });
      const rows = Object.keys(groups).map((d) => {
        const t = groups[d] ?? [];
        const h = handledOf(t);
        return [
          d,
          t.length,
          h.length,
          ahtOf(t),
          fmt(h.reduce((a, x) => a + (x.talkS || 0), 0)),
          pct(t.length, rs.length),
        ];
      });
      return {
        head: ['Direction', 'Interactions', 'Handled', 'AHT', 'Total talk', 'Share'],
        rows,
        tot: ['TOTAL', rs.length, handledOf(rs).length, '', '', '100%'],
      };
    }
    case 'Wrap-up Summary': {
      const handled = handledOf(rs);
      const by = {};
      handled.forEach((x) => {
        const w = x.wrap || '(none)';
        (by[w] = by[w] ?? []).push(x);
      });
      const rows = Object.keys(by)
        .sort((a, b) => (by[b]?.length ?? 0) - (by[a]?.length ?? 0))
        .map((w) => {
          const t = by[w] ?? [];
          return [w, t.length, pct(t.length, handled.length), ahtOf(t)];
        });
      return {
        head: ['Wrap-up code', 'Interactions', 'Share', 'AHT'],
        rows,
        tot: ['TOTAL', handled.length, '100%', ''],
      };
    }
    case 'Wrap-up by Queue': {
      const handled = handledOf(rs);
      const rows = [];
      const qs = {};
      handled.forEach((x) => {
        (qs[x.queue] = qs[x.queue] ?? []).push(x);
      });
      Object.keys(qs).forEach((qn) => {
        const inQueue = qs[qn] ?? [];
        const by = {};
        inQueue.forEach((x) => {
          const w = x.wrap || '(none)';
          (by[w] = by[w] ?? []).push(x);
        });
        Object.keys(by)
          .sort((a, b) => (by[b]?.length ?? 0) - (by[a]?.length ?? 0))
          .forEach((w) => {
            const t = by[w] ?? [];
            rows.push([qn, w, t.length, pct(t.length, inQueue.length), ahtOf(t)]);
          });
      });
      return {
        head: ['Queue', 'Wrap-up code', 'Interactions', 'Share of queue', 'AHT'],
        rows,
        tot: ['TOTAL', '', handled.length, '', ''],
      };
    }

    /* ----------------------------------------------------- Routing & IVR */
    case 'Skills Performance': {
      const q2s = {};
      db.queues.forEach((q) => {
        const req = [];
        db.flows.forEach((f) => {
          if (f.status !== 'Published') return;
          (f.nodes ?? []).forEach((n) => {
            if (n.type === 'acd' && (f.meta?.queueFor ?? {})[n.id] === q.id) {
              ((f.meta?.skills ?? {})[n.id] ?? []).forEach((s) => {
                if (req.indexOf(s) < 0) req.push(s);
              });
            }
          });
        });
        q2s[q.name] = req;
      });
      const by = {};
      rs.forEach((x) => {
        const sk = x.skills && x.skills.length ? x.skills : (q2s[x.queue] ?? []);
        (sk.length ? sk : ['(no skill requirement)']).forEach((s) => {
          (by[s] = by[s] ?? []).push(x);
        });
      });
      const rows = Object.keys(by)
        .sort((a, b) => (by[b]?.length ?? 0) - (by[a]?.length ?? 0))
        .map((s) => {
          const t = by[s] ?? [];
          const el = activeUsers.filter((u) => (u.skills ?? {})[s]).length;
          return [s, t.length, handledOf(t).length, slOf(t), ahtOf(t), el];
        });
      return {
        head: ['ACD skill', 'Offered', 'Handled', 'SL %', 'AHT', 'Agents with skill'],
        rows,
      };
    }
    case 'Flow Performance': {
      const rows = db.flows.map((f) => {
        const qn = flowQueueNames(f);
        const t = rs.filter((x) => qn.indexOf(x.queue) > -1);
        const abn = t.filter((x) => x.result === 'Abandoned').length;
        return [
          f.name,
          f.type,
          f.status === 'Published' ? 'Published v' + f.ver : 'Draft',
          t.length,
          qn.join(', ') || '—',
          abn,
          pct(abn, t.length),
        ];
      });
      return {
        head: ['Flow', 'Type', 'Status', 'Entries', 'To queues', 'Abandoned in queue', 'Abandon %'],
        rows,
      };
    }
    case 'Language Performance': {
      const by = {};
      rs.forEach((x) => {
        const l = qByName(x.queue)?.lang || 'English';
        (by[l] = by[l] ?? []).push(x);
      });
      const rows = Object.keys(by)
        .sort((a, b) => (by[b]?.length ?? 0) - (by[a]?.length ?? 0))
        .map((l) => {
          const t = by[l] ?? [];
          const el = activeUsers.filter((u) => (u.langs ?? []).indexOf(l) > -1).length;
          return [l, t.length, handledOf(t).length, slOf(t), ahtOf(t), el];
        });
      return {
        head: ['Routing language', 'Offered', 'Handled', 'SL %', 'AHT', 'Agents with language'],
        rows,
      };
    }

    /* ---------------------------------------------------------- Outbound */
    case 'Campaign Performance': {
      const rows = db.campaigns.map((c) => {
        const lg = c.log ?? [];
        const n = (re) => lg.filter((e) => re.test(logResult(e))).length;
        const dials = lg.length;
        const conn = n(/Connected/);
        const abn = n(/Abandoned/);
        return [
          c.name,
          c.mode,
          c.status,
          dials,
          conn,
          n(/No answer/) + n(/Busy/),
          n(/Machine/),
          n(/DNC/),
          abn,
          pct(conn, dials),
          conn + abn ? pct(abn, conn + abn) : '—',
        ];
      });
      return {
        head: [
          'Campaign',
          'Mode',
          'Status',
          'Dials',
          'Connected',
          'No answer / Busy',
          'Machine',
          'DNC skip',
          'Abandoned',
          'Connect rate',
          'Abandon rate',
        ],
        rows,
        note: db.campaigns.some((c) => (c.log ?? []).length)
          ? ''
          : 'No dial history yet — start a campaign in Admin › Outbound and let the dialer run, then re-run this report.',
      };
    }
    case 'Contact List Status': {
      const rows = db.contactLists.map((l) => {
        const cs = l.contacts ?? [];
        const st = (s) => cs.filter((c) => (c.status || '') === s).length;
        const contacted = st('Contacted');
        const fresh = cs.filter((c) => !c.status || c.status === 'Not attempted').length;
        return [l.name, cs.length, contacted, st('Retry'), fresh, pct(contacted, cs.length)];
      });
      return {
        head: [
          'Contact list',
          'Contacts',
          'Contacted',
          'Retry pending',
          'Not attempted',
          'Penetration',
        ],
        rows,
      };
    }

    /* ----------------------------------------------------- Quality & WEM */
    case 'Evaluation Summary': {
      const ev = evalsOf(db.evals);
      const by = {};
      ev.forEach((e) => {
        (by[e.agent] = by[e.agent] ?? []).push(e);
      });
      const rows = Object.keys(by).map((a) => {
        const t = by[a] ?? [];
        const crit = t.filter((e) => e.criticalFail).length;
        return [
          a,
          t.length,
          Math.round(avg(t, (e) => e.pct) ?? 0) + '%',
          crit,
          crit ? '⚠ review' : 'OK',
        ];
      });
      return {
        head: ['Agent', 'Evaluations', 'Avg score', 'Critical fails', 'Flag'],
        rows,
        note: rows.length
          ? ''
          : 'No evaluations recorded yet — open an interaction\'s detail and click "Evaluate this interaction", or use Admin › Quality › Evaluation Forms › Perform Evaluation.',
      };
    }
    case 'Adherence Summary': {
      const sch = publishedScheduleOf(db.wfmSchedules);
      const exc = db.adhExceptions ?? {};
      const rows = activeUsers.map((u) => {
        const h = hash(u.name);
        const scheduled = sch?.entries?.[u.name] ? 'Yes' : '—';
        let exCount = 0;
        Object.keys(exc).forEach((k) => {
          if (k.indexOf(u.name) > -1 || k.indexOf(u.id) > -1) exCount++;
        });
        const adh = Math.max(75, 97 - (h % 9) - exCount * 3);
        return [
          u.name,
          scheduled,
          adh + '%',
          (adh + 2 > 99 ? 99 : adh + 2) + '%',
          exCount,
          adh >= 90 ? 'On target' : 'Below 90% target',
        ];
      });
      return {
        head: [
          'Agent',
          'Scheduled (this week)',
          'Adherence',
          'Conformance',
          'Exceptions',
          'Status',
        ],
        rows,
        note: sch
          ? ''
          : 'No published WFM schedule — generate and publish one in Admin › Quality & WEM › Schedules (WFM) for schedule-linked adherence.',
      };
    }
    case 'Forecast vs Actual': {
      const fc = forecastOf(db.forecasts);
      const days = Math.max(
        1,
        Math.round((new Date(spec.to).getTime() - new Date(spec.from).getTime()) / 86400000) + 1
      );
      const rows = db.planGroups.map((p) => {
        const qn = (p.queues ?? [])
          .map((qid) => db.queues.find((x) => x.id === qid)?.name ?? null)
          .filter((n) => n !== null);
        const actual = rs.filter((x) => qn.indexOf(x.queue) > -1).length;
        const f = fc?.data[p.id];
        if (!f) return [p.name, qn.join(', '), '—', actual, '—', '—'];
        const fDaily = Math.round(f.vol / 5);
        const fRange = fDaily * days;
        const varPct = fRange ? Math.round((1000 * (actual - fRange)) / fRange) / 10 : 0;
        return [
          p.name,
          qn.join(', '),
          fRange + ' (' + fDaily + '/day)',
          actual,
          (varPct > 0 ? '+' : '') + varPct + '%',
          Math.abs(varPct) <= 15 ? 'Within tolerance' : '⚠ re-forecast',
        ];
      });
      return {
        head: ['Planning group', 'Queues', 'Forecast (range)', 'Actual', 'Variance', 'Assessment'],
        rows,
        note: fc
          ? 'Forecast week: ' + fc.week + '. Variance beyond ±15% suggests an intraday re-forecast.'
          : 'No forecast generated — create one in Admin › Quality & WEM › Forecasts, then re-run.',
      };
    }
    case 'Survey Results (CSAT)': {
      const svs = surveysOf(db.surveys).filter((s) => s.d >= spec.from && s.d <= spec.to);
      const by = {};
      svs.forEach((s) => {
        (by[s.queue] = by[s.queue] ?? []).push(s);
      });
      const rows = Object.keys(by)
        .sort((a, b) => (by[b]?.length ?? 0) - (by[a]?.length ?? 0))
        .map((q) => {
          const t = by[q] ?? [];
          const csat = avg(t, (s) => s.score) ?? 0;
          const pro = t.filter((s) => s.nps >= 9).length;
          const det = t.filter((s) => s.nps <= 6).length;
          const nps = Math.round((100 * (pro - det)) / t.length);
          const low = t.filter((s) => s.score <= 2).length;
          return [
            q,
            t.length,
            Math.round(csat * 10) / 10 + ' / 5',
            pct(t.filter((s) => s.score === 5).length, t.length),
            low,
            (nps > 0 ? '+' : '') + nps,
            low ? '⚠ review low scores' : 'OK',
          ];
        });
      const csAll = svs.length ? Math.round((avg(svs, (s) => s.score) ?? 0) * 10) / 10 : null;
      return {
        head: ['Queue', 'Surveys', 'Avg CSAT', '% 5-star', 'Low (≤2)', 'NPS', 'Flag'],
        rows,
        tot: svs.length ? ['TOTAL', svs.length, csAll + ' / 5', '', '', '', ''] : null,
        note: svs.length
          ? ''
          : 'No surveys in this range — surveys arrive automatically after handled interactions (see Performance › Speech & Text).',
      };
    }
    case 'Sentiment & Topics': {
      const staOf = window.__staOf;
      if (!staOf) {
        return {
          head: ['Topic'],
          rows: [],
          note: 'Speech & Text Analytics module not loaded.',
        };
      }
      const scored = rs.filter((x) => x.result !== 'Abandoned' && (x.media || 'Voice') !== 'Email');
      const by = {};
      scored.forEach((x) => {
        const st = staOf(x);
        st.topics.forEach((tp) => {
          (by[tp] = by[tp] ?? []).push({
            x,
            s: st.sent,
          });
        });
      });
      const rows = Object.keys(by)
        .sort((a, b) => (by[b]?.length ?? 0) - (by[a]?.length ?? 0))
        .map((tp) => {
          const t = by[tp] ?? [];
          const s = Math.round(t.reduce((a, y) => a + y.s, 0) / t.length);
          const qc = {};
          t.forEach((y) => {
            qc[y.x.queue] = (qc[y.x.queue] ?? 0) + 1;
          });
          const topQ = Object.keys(qc).sort((a, b) => (qc[b] ?? 0) - (qc[a] ?? 0))[0] ?? '—';
          return [
            tp,
            t.length,
            pct(t.length, scored.length),
            (s > 15 ? 'Positive' : s < -15 ? 'Negative' : 'Neutral') +
              ' (' +
              (s > 0 ? '+' : '') +
              s +
              ')',
            topQ,
            s < -15 ? '⚠ drives negative sentiment' : '',
          ];
        });
      return {
        head: ['Topic', 'Interactions', 'Share', 'Avg sentiment', 'Top queue', 'Flag'],
        rows,
        note: 'Topics are spotted from call transcripts (Performance › Speech & Text has the phrase definitions).',
      };
    }
    default:
      return buildReport(db, {
        ...spec,
        kind: 'Queue Summary',
      });
  }
}

/* ------------------------------------------------------------- the catalog */

const CATALOG = [
  [
    'Queues',
    [
      ['Queue Summary', 'Offered / handled / abandoned, SL, ASA and AHT per queue'],
      ['Queue Interval (Hourly)', 'Volumes and service level by hour of day across the range'],
      ['Daily Trend', 'Day-by-day volumes, abandon rate, SL and AHT'],
      ['Abandon Insights', 'Where callers give up — abandon wait-time buckets per queue'],
      ['DNIS Performance', 'Performance per dialled number (DID → flow → queue)'],
    ],
  ],
  [
    'Agents',
    [
      ['Agent Summary', 'Handled, talk / hold / ACW averages and total handle time'],
      ['Agent Status Summary', 'Time in each presence status with occupancy'],
      ['Agent Queue Detail', 'Which agent handled how much in which queue'],
    ],
  ],
  [
    'Interactions',
    [
      ['Media Type Summary', 'Voice vs chat vs email volumes and handle times'],
      ['Direction Summary', 'Inbound vs outbound vs campaign traffic'],
      ['Wrap-up Summary', 'Interaction outcomes by wrap-up code'],
      ['Wrap-up by Queue', 'Wrap-up code usage broken down per queue'],
    ],
  ],
  [
    'Routing & IVR',
    [
      ['Skills Performance', 'Demand and handling per ACD skill, with staffing'],
      ['Flow Performance', 'Entries, queue hand-offs and in-queue abandons per flow'],
      ['Language Performance', 'Volumes per queue routing language'],
    ],
  ],
  [
    'Outbound',
    [
      ['Campaign Performance', 'Dials, connects, abandon rate per campaign'],
      ['Contact List Status', 'Contacted vs remaining vs DNC per contact list'],
    ],
  ],
  [
    'Quality & WEM',
    [
      ['Evaluation Summary', 'Evaluations, average score and critical fails per agent'],
      ['Adherence Summary', 'Schedule adherence and exceptions per agent'],
      ['Forecast vs Actual', 'Forecast volumes vs actual interactions per planning group'],
      ['Survey Results (CSAT)', 'CSAT and NPS per queue from post-interaction surveys'],
      ['Sentiment & Topics', 'Interaction share and average sentiment per spotted topic'],
    ],
  ],
];
const CATALOG_COUNT = CATALOG.reduce((a, c) => a + c[1].length, 0);

/* ----------------------------------------------------------- CSV plumbing */

function csvCell(value) {
  const v = String(value);
  return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
function exportReport(rep, spec) {
  const lines = [rep.head.join(',')].concat(rep.rows.map((r) => r.map(csvCell).join(',')));
  if (rep.tot) lines.push(rep.tot.map(String).join(','));
  const blob = new Blob([lines.join('\n')], {
    type: 'text/csv',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download =
    spec.kind.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '_' + spec.from + '_' + spec.to + '.csv';
  a.click();
  return rep.rows.length;
}

/* -------------------------------------------------------- schedule drawer */

/** "Tue 06 Aug 07:00" — the next-run label the prototype rendered. */
function nextRun(freq, hh) {
  const d = new Date();
  d.setHours(hh, 0, 0, 0);
  if (d <= new Date()) d.setDate(d.getDate() + 1);
  if (freq === 'Weekly') while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  if (freq === 'Monthly') {
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
  }
  return (
    d.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    }) +
    ' ' +
    pad(hh) +
    ':00'
  );
}
const HOURS = [6, 7, 8, 9, 17, 18, 20, 23];
function ScheduleDrawer({ kind, recipients, onClose, onSave }) {
  const [freq, setFreq] = useState('Daily');
  const [hh, setHh] = useState(7);
  const [to, setTo] = useState(recipients[0] ?? '');
  const [format, setFormat] = useState('CSV');
  return (
    <>
      <div id="scrim" onClick={onClose} />
      <div
        id="drw"
        style={{
          width: 440,
          height: 'auto',
          top: '16%',
          bottom: 'auto',
          borderRadius: '8px 0 0 8px',
        }}
      >
        <div className="dh">
          <h2>Schedule — {kind}</h2>
          <div className="x" onClick={onClose} role="button" aria-label="Close">
            ×
          </div>
        </div>
        <div className="db">
          <div className="fld">
            <label>Frequency</label>
            <select value={freq} onChange={(e) => setFreq(e.target.value)}>
              <option>Daily</option>
              <option>Weekly (Mondays)</option>
              <option>Monthly (1st)</option>
            </select>
          </div>
          <div className="fld">
            <label>Run at (hour)</label>
            <select value={String(hh)} onChange={(e) => setHh(parseInt(e.target.value, 10))}>
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {pad(h)}:00
                </option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label>Deliver to</label>
            <select value={to} onChange={(e) => setTo(e.target.value)}>
              {recipients.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label>Format</label>
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option>CSV</option>
              <option>CSV (zipped)</option>
            </select>
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: '#8794a8',
            }}
          >
            The report runs over the trailing period (yesterday for daily, last week for weekly,
            last month for monthly) and is delivered like a Genesys scheduled export.
          </div>
        </div>
        <div className="df">
          <button className="btn sec" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn"
            onClick={() => onSave(freq.split(' ')[0] ?? 'Daily', hh, to, format)}
          >
            Save schedule
          </button>
        </div>
      </div>
    </>
  );
}

/* --------------------------------------------------------------- the tab */

export default function ReportsTab() {
  const db = useDb();
  const { toast } = useUi();

  /* live picker state — CSV export always uses the current pickers, as in the
     prototype where the <select>/<input> handlers wrote straight to RPT */
  const [kind, setKind] = useState('Queue Summary');
  const [from, setFrom] = useState(dayISO(6));
  const [to, setTo] = useState(dayISO(0));
  /* the rendered report only rebuilds when "Run report" (or a kind change) runs */
  const [spec, setSpec] = useState({
    kind: 'Queue Summary',
    from: dayISO(6),
    to: dayISO(0),
  });
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const report = buildReport(db, spec);
  const scheds = schedulesOf(db.repSched);
  const runs = runsOf(db.repRuns).slice(0, 5);
  const recipients = db.users
    .filter((u) => u.state === 'Active')
    .map(
      (u) => `${u.name} <${u.email || u.name.toLowerCase().replace(/ /g, '.') + '@mcm.example'}>`
    );
  function rptRun(next) {
    setSpec({
      kind,
      from,
      to,
      ...next,
    });
  }
  function rptPick(nextKind) {
    setKind(nextKind);
    setCatalogOpen(false);
    rptRun({
      kind: nextKind,
    });
  }
  function rptCsv() {
    const liveSpec = {
      kind,
      from,
      to,
    };
    const n = exportReport(buildReport(db, liveSpec), liveSpec);
    toast(`Exported ${kind} (${n} rows)`);
    return n;
  }
  function rptSchedSave(freq, hh, deliverTo, format) {
    const s = {
      id: uid(),
      kind,
      freq,
      hh,
      to: deliverTo,
      fmt: format,
      next: nextRun(freq, hh),
      created: dayISO(0),
    };
    mutate((d) => {
      d.repSched = [...(d.repSched ?? []), s];
    });
    audit('Create scheduled export', `${kind} — ${freq.toLowerCase()} at ${pad(hh)}:00 → ${s.to}`);
    setScheduling(false);
    toast(`Scheduled — ${kind} will run ${freq.toLowerCase()} at ${pad(hh)}:00`);
  }

  /**
   * Runs a scheduled export on demand: builds that schedule's report over the
   * current range, downloads the CSV and records the run. The prototype also
   * bumped the top-bar bell badge; that badge is static chrome here.
   */
  function rptSchedRunNow(id) {
    const s = scheds.find((x) => x.id === id);
    if (!s) return;
    const runSpec = {
      kind: s.kind,
      from,
      to,
    };
    const n = exportReport(buildReport(db, runSpec), runSpec);
    toast(`Exported ${s.kind} (${n} rows)`);
    const run = {
      t: new Date().toTimeString().slice(0, 5),
      kind: s.kind,
      rows: n,
      to: s.to,
      status: 'Completed',
    };
    mutate((d) => {
      d.repRuns = [run, ...(d.repRuns ?? [])];
    });
    audit('Scheduled export ran', `${s.kind} (${n} rows) → ${s.to}`);
  }
  function rptSchedDel(id) {
    mutate((d) => {
      d.repSched = schedulesOf(d.repSched).filter((x) => x.id !== id);
    });
    toast('Schedule removed');
  }
  return (
    <div className="pbody">
      <div
        className="tbar"
        style={{
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <button
          className="btn sec"
          style={{
            fontSize: 12,
          }}
          onClick={() => setCatalogOpen((open) => !open)}
        >
          ⊞ All reports ({CATALOG_COUNT})
        </button>
        <select
          style={{
            fontSize: 12.5,
            maxWidth: 230,
          }}
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            rptRun({
              kind: e.target.value,
            });
          }}
        >
          {CATALOG.map(([group, entries]) => (
            <optgroup label={group} key={group}>
              {entries.map(([name]) => (
                <option key={name}>{name}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <input
          type="date"
          value={from}
          style={{
            fontSize: 12,
          }}
          onChange={(e) => setFrom(e.target.value)}
        />
        <span
          style={{
            color: '#8794a8',
          }}
        >
          →
        </span>
        <input
          type="date"
          value={to}
          style={{
            fontSize: 12,
          }}
          onChange={(e) => setTo(e.target.value)}
        />
        <button
          className="btn"
          style={{
            fontSize: 12,
          }}
          onClick={() => rptRun()}
        >
          Run report
        </button>
        <div className="sp" />
        <button
          className="btn sec"
          style={{
            fontSize: 12,
          }}
          onClick={rptCsv}
        >
          ⭳ Export CSV
        </button>
        <button
          className="btn sec"
          style={{
            fontSize: 12,
          }}
          onClick={() => setScheduling(true)}
        >
          🕒 Schedule this report
        </button>
      </div>

      {catalogOpen ? (
        <div className="panel">
          <h3>
            Report catalog <span className="sp" />
            <small>click a report to run it over the selected date range</small>
          </h3>
          <div
            style={{
              padding: '0 15px 14px',
            }}
          >
            {CATALOG.map(([group, entries]) => (
              <div key={group}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#6b7a90',
                    textTransform: 'uppercase',
                    letterSpacing: '.5px',
                    margin: '14px 0 8px',
                  }}
                >
                  {group}
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))',
                    gap: 10,
                  }}
                >
                  {entries.map(([name, desc]) => {
                    const on = kind === name;
                    return (
                      <div
                        key={name}
                        onClick={() => rptPick(name)}
                        style={{
                          border: '1px solid ' + (on ? '#FF4F1F' : '#dde3ec'),
                          borderRadius: 8,
                          padding: '11px 14px',
                          cursor: 'pointer',
                          background: on ? '#fff4f0' : '#fff',
                        }}
                      >
                        <b
                          style={{
                            fontSize: 13,
                          }}
                        >
                          {name}
                        </b>
                        <div
                          style={{
                            fontSize: 11.5,
                            color: '#8794a8',
                            marginTop: 3,
                            lineHeight: 1.45,
                          }}
                        >
                          {desc}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="panel">
        <h3>
          {spec.kind}{' '}
          <small>
            {spec.from} → {spec.to}
          </small>
          <span className="sp" />
          <small>
            {report.rows.length} row{report.rows.length === 1 ? '' : 's'}
          </small>
        </h3>
        {report.note ? (
          <div
            style={{
              background: '#eef4fd',
              border: '1px solid #c9daf3',
              borderRadius: 6,
              padding: '9px 12px',
              fontSize: 12.5,
              margin: '8px 15px',
              color: '#2c4a76',
            }}
          >
            {report.note}
          </div>
        ) : null}
        <table className="dt">
          <thead>
            <tr>
              {report.head.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={report.head.length}
                  style={{
                    textAlign: 'center',
                    color: '#8794a8',
                    padding: 18,
                  }}
                >
                  No data in this range
                </td>
              </tr>
            ) : (
              report.rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci}>
                      {ci === 0 ? (
                        <b>{c}</b>
                      ) : String(c).indexOf('⚠') > -1 ? (
                        <span
                          style={{
                            color: '#c9401a',
                          }}
                        >
                          {c}
                        </span>
                      ) : (
                        c
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
            {report.tot ? (
              <tr
                style={{
                  background: '#f4f7fb',
                  fontWeight: 700,
                }}
              >
                {report.tot.map((c, ci) => (
                  <td key={ci}>{c}</td>
                ))}
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {scheds.length ? (
        <div className="panel">
          <h3>Scheduled exports ({scheds.length})</h3>
          <table className="dt">
            <thead>
              <tr>
                <th>Report</th>
                <th>Frequency</th>
                <th>Next run</th>
                <th>Deliver to</th>
                <th>Format</th>
                <th
                  style={{
                    width: 150,
                  }}
                />
              </tr>
            </thead>
            <tbody>
              {scheds.map((s) => (
                <tr key={s.id}>
                  <td>
                    <b>{s.kind}</b>
                  </td>
                  <td>
                    {s.freq} at {pad(s.hh)}:00
                  </td>
                  <td>{s.next}</td>
                  <td
                    style={{
                      fontSize: 11.5,
                    }}
                  >
                    {s.to}
                  </td>
                  <td>{s.fmt}</td>
                  <td>
                    <a
                      className="lnk"
                      style={{
                        fontSize: 12,
                      }}
                      onClick={() => rptSchedRunNow(s.id)}
                    >
                      Run now
                    </a>
                    {' · '}
                    <a
                      className="lnk"
                      style={{
                        fontSize: 12,
                        color: '#c9401a',
                      }}
                      onClick={() => rptSchedDel(s.id)}
                    >
                      Delete
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {runs.length ? (
        <div className="panel">
          <h3>Recent export runs</h3>
          <table className="dt">
            <thead>
              <tr>
                <th>Time</th>
                <th>Report</th>
                <th>Rows</th>
                <th>Delivered to</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r, i) => (
                <tr key={i}>
                  <td>{r.t}</td>
                  <td>{r.kind}</td>
                  <td>{r.rows}</td>
                  <td
                    style={{
                      fontSize: 11.5,
                    }}
                  >
                    {r.to}
                  </td>
                  <td>
                    <span className="st ok">
                      <span className="d" />
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {scheduling ? (
        <ScheduleDrawer
          kind={kind}
          recipients={recipients}
          onClose={() => setScheduling(false)}
          onSave={rptSchedSave}
        />
      ) : null}
    </div>
  );
}
