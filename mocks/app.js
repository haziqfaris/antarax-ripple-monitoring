/* Outcomes console mock: routing, computation over the example observations, charts and the interactive flows.
   Plain JavaScript, no libraries. Every figure is computed from data.js. */
(function () {
  'use strict';
  const M = window.MOCK;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ------------------------------------------------------------------ state
  const state = {
    role: 'daniel',
    range: 30,
    audience: 'staff',
    solTab: 'outcomes',
    demoState: 'live',
    approvalSel: 'apr_41',
    approvals: M.approvals.map((a) => Object.assign({}, a)),
    audit: M.audit.slice(),
    connect: { step: 1, auth: 'signed', log: [], proposals: null, decided: {} },
    reportApproved: false,
    narrativeApproved: false,
  };
  try { const r = localStorage.getItem('outcomes-mock-role'); if (r && M.staff[r]) state.role = r; } catch (e) { /* storage blocked: default role */ }

  const me = () => M.staff[state.role];
  const has = (right) => me().rights.includes(right);
  const RUNGS = ['Viewer', 'Support', 'Operator', 'Admin', 'Owner'];
  const atLeast = (rung) => RUNGS.indexOf(me().rung) >= RUNGS.indexOf(rung);

  // ------------------------------------------------------------------ formats (brand kit 13)
  const nf = (n, dp = 0) => n.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const SYM = { MYR: 'RM', USD: 'US$' };
  const money = (amount, cur) => (SYM[cur] || cur + ' ') + nf(amount);
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = (s) => { const d = M.toDate(s.slice(0, 10)); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); };
  const dayShort = (s) => { const d = M.toDate(s.slice(0, 10)); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const q = (quality) => `<span class="q ${quality}">${quality[0].toUpperCase() + quality.slice(1)}</span>`;
  const dash = (why) => `<span class="dash">–</span>${why ? ` <span class="needs">${esc(why)}</span>` : ''}`;
  const SPARK = 'assets/sparkle.svg';
  const aiTag = (text) => `<span class="ai"><img src="${SPARK}" alt="">${esc(text || 'Proposed by AI. A person approves.')}</span>`;

  // ------------------------------------------------------------------ computation
  const windowDays = (n, end) => { const last = end || M.LAST_DAY; return M.dayRange(M.addDays(last, -(n - 1)), last); };
  const seriesOf = (sol, metric) => (M.series[sol] && M.series[sol][metric]) || [];
  const firstDay = (sol, metric) => { const s = seriesOf(sol, metric); return s.length ? s[0].d : null; };

  /** Sum a counter over days. Days before collection started are "not yet collecting"; later days with no value are gaps. */
  function sumMetric(sol, metric, days) {
    const map = new Map(seriesOf(sol, metric).map((p) => [p.d, p.v]));
    const start = firstDay(sol, metric);
    let sum = 0, n = 0, missing = 0;
    days.forEach((d) => {
      if (!start || d < start) return;
      const v = map.has(d) ? map.get(d) : null;
      if (v === null || v === undefined) { missing++; return; }
      sum += v; n++;
    });
    return { sum, n, missing, expected: n + missing };
  }

  /** Daily impact for a solution, in hours, with the range (PRD §10.3). */
  function impactDaily(sol, days) {
    const def = M.impact[sol];
    if (!def) return null;
    const vol = new Map(seriesOf(sol, def.volume).map((p) => [p.d, p.v]));
    const start = firstDay(sol, def.volume);
    const dur = def.machine ? new Map(seriesOf(sol, def.machine.metric).map((p) => [p.d, p.v])) : null;
    const rev = def.reviewMetric ? new Map(seriesOf(sol, def.reviewMetric).map((p) => [p.d, p.v])) : null;
    return days.map((d) => {
      if (!start || d < start) return { d, before: true };
      const v = vol.has(d) ? vol.get(d) : null;
      if (v === null || v === undefined) return { d, gap: true };
      const B = def.baseline;
      if (dur) { // document workflow: baseline - measured machine time - sampled review time
        const m = dur.get(d) / 60;
        const R = def.review;
        return { d, vol: v, mid: v * (B.mid - m - R.mid) / 60, low: v * (B.low - m - R.high) / 60, high: v * (B.high - m - R.low) / 60, machine: m };
      }
      if (rev) { // shift planner: baseline - measured review minutes
        const r = rev.get(d);
        return { d, vol: v, mid: v * (B.mid - r) / 60, low: v * (B.low - r) / 60, high: v * (B.high - r) / 60, review: r };
      }
      const R = def.review; // quote drafter: baseline - estimated review time
      return { d, vol: v, mid: v * (B.mid - R.mid) / 60, low: v * (B.low - R.high) / 60, high: v * (B.high - R.low) / 60 };
    });
  }

  function impactSum(sol, days) {
    const rows = impactDaily(sol, days);
    if (!rows) return null;
    const out = { mid: 0, low: 0, high: 0, vol: 0, missing: 0, n: 0, machine: 0 };
    rows.forEach((r) => {
      if (r.before) return;
      if (r.gap) { out.missing++; return; }
      out.mid += r.mid; out.low += r.low; out.high += r.high; out.vol += r.vol; out.n++;
      if (r.machine !== undefined) out.machine += r.machine * r.vol;
    });
    out.machineMean = out.vol ? out.machine / out.vol : 0; // weighted by volume, never averaged averages
    return out;
  }

  const ROLLED = ['doc-workflow', 'shift-planner', 'quote-drafter'];
  function portfolioImpact(days) {
    const t = { mid: 0, low: 0, high: 0, missing: 0 };
    ROLLED.forEach((s) => { const r = impactSum(s, days); t.mid += r.mid; t.low += r.low; t.high += r.high; t.missing += r.missing; });
    return t;
  }

  /** Group daily points into weeks (Monday start) for longer ranges. */
  function bucket(points, weekly) {
    if (!weekly) return points.map((p) => Object.assign({ label: dayShort(p.d), from: p.d, to: p.d }, p));
    const out = [];
    points.forEach((p) => {
      const wd = (M.weekday(p.d) + 6) % 7;
      const wk = M.addDays(p.d, -wd);
      let b = out[out.length - 1];
      if (!b || b.wk !== wk) { b = { wk, from: p.d, to: p.d, label: 'w/c ' + dayShort(wk), mid: 0, low: 0, high: 0, v: 0, has: 0, gaps: 0, before: 0 }; out.push(b); }
      b.to = p.d;
      if (p.before) { b.before++; return; }
      if (p.gap || p.v === null) { b.gaps++; return; }
      b.has++;
      ['mid', 'low', 'high'].forEach((k) => { if (p[k] !== undefined) b[k] += p[k]; });
      if (p.v !== undefined) b.v += p.v;
    });
    out.forEach((b) => { if (!b.has) { b.gap = b.gaps > 0; b.before = b.gaps === 0; } });
    return out;
  }

  // ------------------------------------------------------------------ charts (inline SVG, drawn to scale)
  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return step * p;
  }

  /** points: [{label, mid?, low?, high?, v?, gap?, before?, from, to}] */
  function drawChart(el, points, opt) {
    if (!el) return;
    const W = Math.max(300, el.clientWidth || 640), H = opt.height || 220;
    const m = { l: 48, r: 14, t: 14, b: 28 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const val = (p) => opt.kind === 'band' ? p.high : p.v;
    const maxData = Math.max(opt.baseline || 0, ...points.filter((p) => !p.gap && !p.before).map(val), 0);
    const ymax = niceMax(maxData * 1.08);
    const y = (v) => m.t + ih - (v / ymax) * ih;
    const n = points.length;
    const bw = iw / n;
    const xc = (i) => m.l + bw * i + bw / 2;
    const ticks = [0, ymax / 2, ymax];
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.label)}">`;
    s += `<defs><pattern id="hatch-${opt.id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--s1-soft)"/><line x1="0" y1="0" x2="0" y2="6" stroke="var(--s1)" stroke-width="2"/></pattern></defs>`;
    ticks.forEach((t) => {
      s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)" stroke-dasharray="${t ? '2 4' : ''}" fill="none"/>`;
      s += `<text x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end">${nf(t, t < 10 && t % 1 ? 1 : 0)}</text>`;
    });
    // x labels: first, middle, last
    [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i).forEach((i, k, arr) => {
      const anchor = k === 0 ? 'start' : k === arr.length - 1 ? 'end' : 'middle';
      const x = k === 0 ? m.l : k === arr.length - 1 ? W - m.r : xc(i);
      s += `<text x="${x}" y="${H - 8}" text-anchor="${anchor}">${esc(points[i].label)}</text>`;
    });
    if (opt.kind === 'band') {
      // range band + line, broken at gaps; estimated, so the line sits on a hatched band
      let segs = [], cur = [];
      points.forEach((p, i) => { if (p.gap || p.before) { if (cur.length) segs.push(cur); cur = []; } else cur.push([i, p]); });
      if (cur.length) segs.push(cur);
      segs.forEach((sg) => {
        const top = sg.map(([i, p]) => `${xc(i)},${y(p.high)}`).join(' ');
        const bot = sg.slice().reverse().map(([i, p]) => `${xc(i)},${y(p.low)}`).join(' ');
        s += `<polygon points="${top} ${bot}" fill="url(#hatch-${opt.id})" opacity=".55"/>`;
        s += `<polyline points="${sg.map(([i, p]) => `${xc(i)},${y(p.mid)}`).join(' ')}" fill="none" stroke="var(--s1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      });
      const li = points.map((p, i) => [i, p]).filter(([, p]) => !p.gap && !p.before).pop();
      if (li) s += `<circle cx="${xc(li[0])}" cy="${y(li[1].mid)}" r="5" fill="var(--s1)" stroke="var(--raised)" stroke-width="2.5"/>`;
    } else {
      points.forEach((p, i) => {
        const w = Math.max(2, bw - (n > 60 ? 1 : 3));
        const x = m.l + bw * i + (bw - w) / 2;
        if (p.before) return;
        if (p.gap) { s += `<rect x="${x}" y="${m.t + ih - 18}" width="${w}" height="18" rx="2" fill="none" stroke="var(--warn)" stroke-dasharray="2 2"/>`; return; }
        const h = Math.max(p.v ? 1.5 : 0, ih - (y(p.v) - m.t));
        s += `<rect x="${x}" y="${y(p.v)}" width="${w}" height="${h}" rx="${Math.min(3, w / 3)}" fill="${opt.color || 'var(--s1)'}"/>`;
      });
    }
    if (opt.baseline) {
      s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(opt.baseline)}" y2="${y(opt.baseline)}" stroke="var(--baseline)" stroke-width="1.5" stroke-dasharray="6 4" fill="none"/>`;
      s += `<text x="${W - m.r}" y="${y(opt.baseline) - 6}" text-anchor="end" style="fill:var(--body)">${esc(opt.baselineLabel)}</text>`;
    }
    s += `<line class="xh" x1="0" x2="0" y1="${m.t}" y2="${m.t + ih}" stroke="var(--line-strong)" visibility="hidden" fill="none"/>`;
    s += `<rect class="hit" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="transparent"/></svg>`;
    el.innerHTML = s + '<div class="tip" hidden></div>';
    const svg = $('svg', el), tip = $('.tip', el), xh = $('.xh', el);
    const move = (ev) => {
      const r = svg.getBoundingClientRect();
      const px = (ev.clientX - r.left) * (W / r.width);
      const i = Math.max(0, Math.min(n - 1, Math.floor((px - m.l) / bw)));
      const p = points[i];
      xh.setAttribute('x1', xc(i)); xh.setAttribute('x2', xc(i)); xh.setAttribute('visibility', 'visible');
      tip.hidden = false;
      tip.innerHTML = `<b>${esc(p.from === p.to ? day(p.from) : day(p.from) + ' to ' + day(p.to))}</b>` + opt.tip(p);
      const left = (xc(i) / W) * r.width;
      tip.style.left = Math.min(r.width - 170, Math.max(0, left + 12)) + 'px';
      tip.style.top = '8px';
    };
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerleave', () => { tip.hidden = true; xh.setAttribute('visibility', 'hidden'); });
  }

  function sparkline(values, w = 96, h = 26) {
    const vals = values.filter((v) => v !== null);
    if (!vals.length) return '';
    const max = Math.max(...vals) || 1, min = 0;
    const x = (i) => 2 + (i / Math.max(1, values.length - 1)) * (w - 6);
    const y = (v) => h - 3 - ((v - min) / (max - min || 1)) * (h - 6);
    let d = '', pen = false, last = null;
    values.forEach((v, i) => { if (v === null) { pen = false; return; } d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1); pen = true; last = [x(i), y(v)]; });
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" fill="none" stroke="var(--s1)" stroke-width="1.6" stroke-linejoin="round"/>${last ? `<circle cx="${last[0]}" cy="${last[1]}" r="2.6" fill="var(--s1)"/>` : ''}</svg>`;
  }

  // ------------------------------------------------------------------ shared bits
  const orgById = (id) => M.orgs.find((o) => o.id === id);
  const STATUS = {
    fresh: ['ok', 'On time'], stale: ['warn', 'Stale'], failing: ['fault', 'Failing'], not_connected: ['idle', 'Not connected'], paused: ['idle', 'Paused'], late: ['warn', 'Late'],
  };
  const statusPill = (st) => { const [c, w] = STATUS[st]; return `<span class="pill ${c}"><span class="dot ${c}"></span>${w}</span>`; };
  const stagePill = (st) => `<span class="pill ${st === 'live' ? 'info' : 'idle'}">${st[0].toUpperCase() + st.slice(1)}</span>`;
  const solStatus = (id) => (id === 'doc-workflow' && state.demoState !== 'live') ? state.demoState : M.solutions[id].status;
  const rangeLabel = () => ({ 7: 'last 7 days', 30: 'last 30 days', 90: 'last 90 days', 365: 'last 12 months' }[state.range]);
  const rangeSeg = () => `<div class="seg" role="group" aria-label="Range">${[[7, '7 days'], [30, '30 days'], [90, '90 days'], [365, '12 months']].map(([v, l]) => `<button type="button" data-range="${v}" aria-pressed="${state.range === v}">${l}</button>`).join('')}</div>`;
  const gate = (ok, label, need, attrs = '', cls = 'btn primary') => ok
    ? `<button ${/type=/.test(attrs) ? '' : 'type="button"'} class="${cls}" ${attrs}>${label}</button>`
    : `<span class="gated"><button type="button" class="${cls}" disabled>${label}</button><span class="needs">${need}</span></span>`;
  const pageHead = (o) => `
    <header class="page-head">
      <div style="min-width:0">
        ${o.crumbs ? `<nav class="crumbs" aria-label="Breadcrumbs">${o.crumbs}</nav>` : ''}
        <h1>${o.title}</h1>
        <p class="lead">${o.lead}</p>
        ${o.state ? `<p class="state-line">${o.state}</p>` : ''}
        ${o.how ? `<details class="how"><summary>How this page works</summary><div>${o.how}</div></details>` : ''}
      </div>
      <div class="head-actions">${o.actions || ''}</div>
    </header>`;
  const audienceSeg = () => `<div class="seg" role="group" aria-label="Audience"><button type="button" data-aud="staff" aria-pressed="${state.audience === 'staff'}">Staff view</button><button type="button" data-aud="client" aria-pressed="${state.audience === 'client'}">As the client sees it</button></div>`;
  const clientView = () => state.audience === 'client';

  function toast(text, undo) {
    const box = $('#toasts');
    const t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status');
    t.innerHTML = `<span>${esc(text)}</span>${undo ? '<button type="button">Undo</button>' : ''}`;
    if (undo) $('button', t).addEventListener('click', () => { undo(); t.remove(); });
    box.appendChild(t);
    setTimeout(() => t.remove(), 6000);
  }
  const now = () => '15 Oct 2026, ' + new Date().toTimeString().slice(0, 5);
  const log = (what) => state.audit.unshift([now(), `${me().name} · ${me().rung}`, what]);

  // ------------------------------------------------------------------ KPI cards per solution
  function kpiCards(sol, days) {
    const s = M.solutions[sol];
    const st = solStatus(sol);
    const staleNote = st === 'stale' ? `Stale since ${s.since || '14 Oct 2026, 06:00'}: last good period shown` : st === 'failing' ? `Source failing since ${s.since || '14 Oct 2026, 06:00'}: last good period shown` : null;
    const fresh = `Updated ${s.lastPull || '–'} MYT`;
    const cards = [];
    const imp = M.impact[sol];
    if (imp) {
      const r = impactSum(sol, days);
      cards.push({ ref: 'K1', name: imp.name, quality: 'estimated', value: nf(r.mid), unit: 'h',
        cmp: [['Range', `${nf(r.low)} to ${nf(r.high)} h`], ['Volume', `${nf(r.vol)} ${imp.unitWord}s`], ['Baseline', `${imp.baseline.mid} min per ${imp.unitWord} (v${imp.baseline.version || 1})`]],
        src: `${imp.volume} × (baseline − current minutes) ÷ 60 · ${r.missing ? `${r.missing} day${r.missing > 1 ? 's' : ''} missing, not filled` : 'no missing days'} · ${fresh}`, staleNote });
    }
    if (sol === 'doc-workflow') {
      const g = sumMetric(sol, 'documents.generated', days), rc = sumMetric(sol, 'documents.returned_for_correction', days);
      const imp2 = impactSum(sol, days);
      cards.push({ ref: 'K2', name: 'Documents processed', quality: 'measured', value: nf(g.sum), unit: '', cmp: [['Days with data', `${g.n} of ${g.expected}`]], src: `sum(documents.generated) · ${fresh}`, staleNote });
      cards.push({ ref: 'K3', name: 'Return-for-correction rate', quality: 'derived', value: nf(100 * rc.sum / g.sum, 1), unit: '%', cmp: [['Baseline', '7.4% (system data, Mar to May 2026)'], ['Target', '4.0% (target)']], src: `sum(returned) ÷ sum(generated), recomputed from parts · ${fresh}`, staleNote });
      cards.push({ ref: 'K4', name: 'Machine time per document', quality: 'measured', value: nf(imp2.machineMean * 60, 0), unit: 's', cmp: [['Aggregation', 'mean, weighted by volume']], src: `documents.generation_duration · ${fresh}`, staleNote });
    }
    if (sol === 'invoice-triage') {
      const t = sumMetric(sol, 'invoices.triaged', days);
      const ct = seriesOf(sol, 'invoices.cycle_time_median').filter((p) => p.d <= days[days.length - 1]).slice(-1)[0];
      cards.push({ ref: 'K1', name: 'Invoice cycle time (median)', quality: 'derived', value: nf(ct.v, 1), unit: 'days', cmp: [['Baseline', '4.5 days (system data, Jan to Jun 2026)'], ['Week of', day(ct.d)]], src: `median(invoices.cycle_time) · ${fresh}` });
      cards.push({ ref: 'K2', name: 'Invoices triaged', quality: 'measured', value: nf(t.sum), unit: '', cmp: [['Days with data', `${t.n} of ${t.expected}`]], src: `sum(invoices.triaged) · ${fresh}` });
      cards.push({ ref: 'K3', name: 'Hours saved on triage', quality: 'unavailable', value: null, why: 'Not rolled up: shares the AP workflow overlap group with Document workflow, which already counts these hours', cmp: [], src: 'Waiting for an overlap share to be agreed' });
    }
    if (sol === 'shift-planner') {
      const p = sumMetric(sol, 'plans.generated', days);
      cards.push({ ref: 'K2', name: 'Shift plans generated', quality: 'measured', value: nf(p.sum), unit: '', cmp: [['Days with data', `${p.n} of ${p.expected}`]], src: `sum(plans.generated) · last pull ${s.lastPull} MYT`, staleNote });
    }
    if (sol === 'enquiry-triage') {
      const e = sumMetric(sol, 'enquiries.received', days);
      cards.push({ ref: 'K1', name: 'Enquiries handled', quality: 'measured', value: nf(e.sum), unit: '', cmp: [['Days with data', `${e.n} of ${e.expected}`]], src: `sum(enquiries.received) · ${fresh}` });
      cards.push({ ref: 'K2', name: 'Front-desk hours saved', quality: 'unavailable', value: null, why: 'No baseline yet', cmp: [], src: 'Proposed by AI, blocked until a baseline is approved', action: '<a href="#approvals">Add baseline</a>' });
    }
    if (sol === 'quote-drafter') {
      const qd = sumMetric(sol, 'quotes.drafted', days);
      cards.push({ ref: 'K2', name: 'Quotations drafted', quality: 'measured', value: nf(qd.sum), unit: '', cmp: [['Days with data', `${qd.n} of ${qd.expected}`], ['Weekends', 'closed: a true 0']], src: `sum(quotes.drafted) · last pull ${s.lastPull} MYT`, staleNote });
    }
    if (st === 'not_connected') return [];
    if (st === 'failing' && sol === 'doc-workflow') cards.forEach((c) => { c.value = null; c.why = 'Couldn’t reach the source. Last good values are on the Collection tab'; });
    return cards;
  }

  const kpiCardHtml = (c) => `
    <article class="card kpi">
      <div class="top"><div><span class="ref">${c.ref}</span><h3>${esc(c.name)}</h3></div>${q(c.quality)}</div>
      <div class="fig"><div class="value ${c.staleNote ? 'stale-val' : ''}">${c.value === null ? dash() : `${c.value}<small>${c.unit}</small>`}</div>
        ${c.value === null ? `<div class="hint">${esc(c.why || '')} ${c.action || ''}</div>` : ''}
        ${c.staleNote ? `<div class="hint"><span class="pill warn"><span class="dot warn"></span>${esc(c.staleNote)}</span></div>` : ''}
      </div>
      ${c.cmp.length ? `<dl class="cmp">${c.cmp.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''}
      <p class="src">${esc(c.src)}</p>
    </article>`;

  // ------------------------------------------------------------------ pages
  const pages = {};

  // ---------- Portfolio
  pages.portfolio = () => {
    const days = windowDays(state.range);
    const imp = portfolioImpact(days);
    const waiting = state.approvals.filter((a) => a.status === 'waiting').length;
    const blocked = state.approvals.filter((a) => a.status === 'blocked').length;
    const kApproved = Object.values(M.solutions).reduce((a, s) => a + s.kpis.approved, 0) + state.approvals.filter((a) => a.type === 'KPI' && a.status === 'approved').length;
    const kTotal = Object.values(M.solutions).reduce((a, s) => a + s.kpis.total, 0);
    const commercial = has('Commercial');
    const byCur = (key) => { const t = {}; M.orgs.forEach((o) => { const v = o[key]; if (v) t[v.currency] = (t[v.currency] || 0) + v.amount; }); return Object.entries(t).map(([c, a]) => money(a, c)).join(' + '); };

    const order = ['bina-jaya', 'acme-plastics', 'sampel-medik', 'teladan-properties', 'contoh-logistik'];
    const rows = order.map((id) => {
      const o = orgById(id);
      const sols = o.projects.flatMap((p) => p.solutions);
      const worst = ['failing', 'stale', 'not_connected', 'fresh'].find((st) => sols.some((s) => solStatus(s) === st));
      const k = sols.reduce((a, s) => [a[0] + M.solutions[s].kpis.approved, a[1] + M.solutions[s].kpis.total], [0, 0]);
      const rolled = sols.filter((s) => ROLLED.includes(s));
      let saved, spark = '';
      if (rolled.length) {
        const r = rolled.map((s) => impactSum(s, days)).reduce((a, b) => ({ mid: a.mid + b.mid, missing: a.missing + b.missing }), { mid: 0, missing: 0 });
        const st = solStatus(rolled[0]);
        saved = `<span class="mono ${st !== 'fresh' ? 'stale-val' : ''}">${nf(r.mid)} h</span> ${q('estimated')}${r.missing ? `<div class="sub">${r.missing} day${r.missing > 1 ? 's' : ''} missing</div>` : ''}`;
        const daily = impactDaily(rolled[0], windowDays(Math.min(state.range, 90)));
        spark = sparkline(bucket(daily, state.range > 30).map((p) => (p.gap || p.before) ? null : p.mid));
      } else if (id === 'sampel-medik') saved = dash('No baseline yet');
      else if (id === 'teladan-properties') saved = dash('Not connected');
      else saved = dash();
      const contract = commercial ? `<span class="mono">${money(o.contract.amount, o.contract.currency)}</span><div class="sub">a ${o.contract.per}</div>` : dash('Needs the Commercial right');
      return `<tr class="link" data-go="organisation-${o.id}" tabindex="0">
        <td><span class="name">${esc(o.short)}</span><span class="sub mono">${o.id}</span></td>
        <td>${stagePill(o.stage)}</td>
        <td class="num">${sols.length}</td>
        <td><span class="mono">${k[0]} of ${k[1] || '–'}</span><div class="sub">KPIs approved</div></td>
        <td>${statusPill(worst)}</td>
        <td>${spark || '<span class="sub">No series</span>'}</td>
        <td>${saved}</td>
        <td>${contract}</td>
        <td class="mono">${o.renewal}</td></tr>`;
    }).join('');

    const items = [
      ['fault', 'Quote drafter stopped answering', 'Bina Jaya', 'since 14 Oct 2026, 22:00', '503 from /health, 3 attempts', '#solution-quote-drafter', 'Check integration'],
      ['warn', 'Shift planner is stale: 2 pulls missed', 'Acme Plastics', 'since 13 Oct 2026, 09:00', 'Figures show the last good period', '#solution-shift-planner', 'Open diagnostics'],
      ['warn', `${waiting} item${waiting === 1 ? '' : 's'} waiting for approval`, 'Sampel Medik, Contoh Logistik', 'oldest 13 Oct 2026', has('Approve') ? 'Some are yours to approve' : 'Needs the Approve right to decide', '#approvals', 'Review'],
      ['warn', 'Front-desk hours saved has no baseline', 'Sampel Medik', 'since 14 Oct 2026', 'Impact can’t be shown until one is approved', '#approvals', 'Add baseline'],
      ['info', 'Manifest changed under an approved KPI', 'Contoh Logistik', '15 Oct 2026, 06:00', 'New reason dimension on returned documents', '#approvals', 'Review change'],
      ['info', state.reportApproved ? 'September report approved, ready to send' : 'September report is ready for review', 'Contoh Logistik', 'due 17 Oct 2026', 'Drafted by AI, edited by Nurul Aina', '#report', state.reportApproved ? 'Open report' : 'Review draft'],
    ];

    return `
    ${pageHead({ title: 'Portfolio', lead: 'What needs a person, and whether every client solution is healthy, used and delivering its agreed outcome.',
      state: `<span>Example data · ${rangeLabel()}, to ${day(M.LAST_DAY)}</span><span>Compute ran 15 Oct 2026, 06:10 MYT</span>`,
      how: `<p>Figures come from approved KPIs only, computed by code from collected observations. Estimates are hatched and always carry a range.</p><p>Hours saved adds up only solutions with an approved rollup rule: <b>Invoice triage</b> shares an overlap group with Document workflow, so it is counted once; <b>Enquiry triage</b> has no baseline yet; <b>Lease reader</b> isn't connected.</p><p>A stale or failing source never shows as zero. You see its last good value, greyed, and why.</p>`,
      actions: rangeSeg() })}

    <section class="strip" aria-label="Status">
      <a class="tile ok" href="#collection"><span class="t">Collection</span><span class="v"><span class="dot ok"></span>3 on time</span><span class="d">of 6 solutions</span></a>
      <a class="tile warn" href="#solution-shift-planner"><span class="t">Stale</span><span class="v"><span class="dot warn"></span>1 source</span><span class="d">Shift planner</span></a>
      <a class="tile fault" href="#solution-quote-drafter"><span class="t">Failing</span><span class="v"><span class="dot fault"></span>1 source</span><span class="d">Quote drafter</span></a>
      <a class="tile ok" href="#collection"><span class="t">KPI compute</span><span class="v"><span class="dot ok"></span>Ran 06:10</span><span class="d">16 KPIs, 0 errors</span></a>
      <a class="tile ${waiting ? 'warn' : 'ok'}" href="#approvals"><span class="t">Approvals</span><span class="v"><span class="dot ${waiting ? 'warn' : 'ok'}"></span>${waiting} waiting</span><span class="d">${blocked} blocked</span></a>
      <a class="tile ${state.reportApproved ? 'ok' : 'warn'}" href="#report"><span class="t">Reports</span><span class="v"><span class="dot ${state.reportApproved ? 'ok' : 'warn'}"></span>${state.reportApproved ? '1 approved' : '1 in review'}</span><span class="d">due 17 Oct 2026</span></a>
    </section>

    <section class="card" aria-labelledby="att-h">
      <div class="card-head"><h2 id="att-h">Needs a person</h2><p>Worst first</p></div>
      <div class="attention">${items.map(([sev, what, org, since, why, href, act]) => `
        <div class="att-row"><span class="sev ${sev}" aria-hidden="true"></span>
          <div><div class="what">${esc(what)}</div><div class="meta"><span>${esc(org)}</span><span class="mono">${esc(since)}</span><span>${esc(why)}</span></div></div>
          <a class="btn small" href="${href}">${act}</a></div>`).join('')}</div>
    </section>

    <section class="grid g4" aria-label="Portfolio figures">
      <div class="card fig"><span class="label">Organisations</span><span class="value">${M.orgs.length}</span><span class="hint">3 live · 1 pilot · 1 planning</span></div>
      <div class="card fig"><span class="label">Solutions collecting on time</span><span class="value">3<small>of 6</small></span><span class="hint">1 stale · 1 failing · 1 not connected</span></div>
      <div class="card fig"><span class="label">KPIs approved</span><span class="value">${kApproved}<small>of ${kTotal}</small></span><span class="hint">${waiting} waiting · ${blocked} blocked by a missing baseline</span></div>
      <div class="card fig"><span class="label">Hours saved ${q('estimated')}</span><span class="value">${nf(imp.mid)}<small>h</small></span><span class="hint">Range <span class="mono">${nf(imp.low)} to ${nf(imp.high)}</span> · 3 of 6 solutions rolled up</span></div>
    </section>

    <section class="grid g-main">
      <div class="card">
        <div class="card-head"><h2>Hours saved across the portfolio</h2><p>${state.range > 30 ? 'Weekly' : 'Daily'} · estimated, the band is the range</p></div>
        <div class="chart" id="ch-portfolio"></div>
        <div class="legend"><span><i style="background:var(--s1)"></i>Hours saved (mid)</span><span><i style="background:repeating-linear-gradient(135deg,var(--s1) 0 2px,var(--s1-soft) 2px 5px)"></i>Range, from baselines and samples</span><span><i style="border:1px dashed var(--warn);background:none"></i>Missing data, not zero</span></div>
      </div>
      <div class="card reka-only">
        <div class="card-head"><h2>Commercial</h2><span class="pill accent">REKA only</span></div>
        ${commercial ? `
        <div class="grid" style="gap:14px">
          <div class="fig"><span class="label">Contract value, a month</span><span class="value" style="font-size:1.25rem">${byCur('contract')}</span><span class="hint">Grouped by currency, never converted</span></div>
          <div class="fig"><span class="label">Run cost, September</span><span class="value" style="font-size:1.25rem">${byCur('runCost')}</span><span class="hint">From AX Frame, with the client’s agreement</span></div>
          <div class="fig"><span class="label">Renewals in the next 90 days</span><span class="hint"><b class="ink">Sampel Medik</b>, pilot ends <span class="mono">1 Dec 2026</span>. Impact KPI still has no baseline.</span></div>
        </div>` : `<div class="empty"><b>– Needs the Commercial right</b><p class="muted">Contract value, run cost, margin and renewal risk. An Admin can add the right in Staff → your name.</p><p class="muted">Try switching to Aisyah Rahman in the staff menu.</p></div>`}
      </div>
    </section>

    <section class="card">
      <div class="card-head"><h2>Organisations at a glance</h2><p>Problems first · ${rangeLabel()}</p></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Organisation</th><th>Stage</th><th class="num">Solutions</th><th>KPIs</th><th>Collection</th><th>Trend</th><th>Hours saved</th><th>Contract</th><th>Renewal</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
    </section>

    <section class="card">
      <div class="card-head"><h2>Recent actions</h2><a href="#audit">Audit</a></div>
      <div class="audit">${state.audit.slice(0, 5).map(([t, who, what]) => `<div><span class="mono muted">${esc(t)}</span><span><b class="ink">${esc(who)}</b> ${esc(what)}</span></div>`).join('')}</div>
    </section>`;
  };
  pages.portfolio.after = () => {
    const days = windowDays(state.range);
    const daily = days.map((d) => {
      const parts = ROLLED.map((s) => impactDaily(s, [d])[0]);
      const ok = parts.filter((p) => !p.gap && !p.before);
      if (!ok.length) return { d, gap: parts.some((p) => p.gap), before: parts.every((p) => p.before) };
      return { d, mid: ok.reduce((a, p) => a + p.mid, 0), low: ok.reduce((a, p) => a + p.low, 0), high: ok.reduce((a, p) => a + p.high, 0), partial: ok.length < 3 };
    });
    drawChart($('#ch-portfolio'), bucket(daily, state.range > 30), { id: 'pf', kind: 'band', label: 'Estimated hours saved across the portfolio', height: 230,
      tip: (p) => p.before ? '<div>Before collection started</div>' : p.gap ? '<div>No data for this period. Not counted as zero.</div>' : `<div>Hours saved <span class="mono">${nf(p.mid)}</span></div><div>Range <span class="mono">${nf(p.low)} to ${nf(p.high)}</span></div>${p.partial || p.gaps ? '<div class="muted">Some sources missing in this period</div>' : ''}` });
  };

  // ---------- Organisation
  function monthWindow(ym) { const [y, m] = ym.split('-').map(Number); const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); return M.dayRange(`${ym}-01`, `${ym}-${String(last).padStart(2, '0')}`); }
  function contohMonth(ym) {
    const days = monthWindow(ym);
    const imp = impactSum('doc-workflow', days);
    const g = sumMetric('doc-workflow', 'documents.generated', days), rc = sumMetric('doc-workflow', 'documents.returned_for_correction', days);
    const ct = seriesOf('invoice-triage', 'invoices.cycle_time_median').filter((p) => p.d <= days[days.length - 1]).slice(-1)[0];
    const inv = sumMetric('invoice-triage', 'invoices.triaged', days);
    return { imp, docs: g.sum, missing: g.missing, rate: 100 * rc.sum / g.sum, ct: ct.v, ctWeek: ct.d, invoices: inv.sum };
  }

  pages.organisation = (id) => {
    const o = orgById(id || 'contoh-logistik');
    const days = windowDays(state.range);
    const sols = o.projects.flatMap((p) => p.solutions);
    const isContoh = o.id === 'contoh-logistik';
    const rolled = sols.filter((s) => ROLLED.includes(s));
    const tot = rolled.length ? rolled.map((s) => impactSum(s, days)).reduce((a, b) => ({ mid: a.mid + b.mid, low: a.low + b.low, high: a.high + b.high }), { mid: 0, low: 0, high: 0 }) : null;
    const sep = isContoh ? contohMonth('2026-09') : null, aug = isContoh ? contohMonth('2026-08') : null;
    const canApprove = has('Approve');
    const cards = sols.flatMap((s) => kpiCards(s, days).map((c) => Object.assign({ sol: M.solutions[s].name }, c))).filter((c) => !(clientView() && c.quality === 'unavailable'));

    const narrative = (isContoh && clientView() && !state.narrativeApproved) ? `<section class="card"><div class="empty"><b>Narrative not shown</b><p class="muted">The September narrative is still a draft. The client sees it only after a person approves it.</p></div></section>` : isContoh ? `
      <section class="ai-block" aria-labelledby="nar-h">
        <div class="card-head"><h2 id="nar-h">September 2026 in brief</h2>${state.narrativeApproved ? '<span class="pill ok"><span class="dot ok"></span>Approved</span>' : '<span class="pill warn"><span class="dot warn"></span>Draft · needs approval</span>'}</div>
        <div class="narrative">
          <p>The document workflow finished <b class="mono">${nf(sep.docs)}</b> documents in September <span class="cite">K2</span>, up from <span class="mono">${nf(aug.docs)}</span> in August. Against the sampled baseline, that is an estimated <b class="mono">${nf(sep.imp.mid)} hours</b> of preparation time freed, somewhere between <span class="mono">${nf(sep.imp.low)}</span> and <span class="mono">${nf(sep.imp.high)}</span> <span class="cite">K1</span>.</p>
          <p>Fewer documents came back for correction: <span class="mono">${nf(sep.rate, 1)}%</span>, against <span class="mono">${nf(aug.rate, 1)}%</span> in August and <span class="mono">7.4%</span> before go-live <span class="cite">K3</span>. Invoice cycle time was <span class="mono">${nf(sep.ct, 1)} days</span> in the last week of the month, from a <span class="mono">4.5</span> day baseline <span class="cite">Invoice triage K1</span>.</p>
          <p>Two days, 21 and 22 September, are missing and are not counted. These figures compare with the baseline; they don’t show what caused the change.</p>
        </div>
        <div class="card-head" style="margin:14px 0 0">${aiTag('Drafted by AI from computed values, 14 Oct 2026, 09:12. Every number checked.')}
          ${state.narrativeApproved || clientView() ? '' : gate(canApprove && state.role !== 'nurul', 'Approve narrative', state.role === 'nurul' ? 'You edited this. Someone else approves.' : 'Needs the Approve right', 'data-act="approve-narrative"')}</div>
      </section>` : `<section class="card"><div class="empty"><b>No narrative yet</b><p class="muted">AI drafts one at the end of each reporting period, from approved KPIs only. A person approves it before the client sees it.</p></div></section>`;

    const commercialCard = clientView() ? '' : `
      <section class="card reka-only"><div class="card-head"><h2>Commercial</h2><span class="pill accent">REKA only · never in client output</span></div>
        ${has('Commercial') ? `<div class="grid g4">
          <div class="fig"><span class="label">Contract</span><span class="value" style="font-size:1.2rem">${money(o.contract.amount, o.contract.currency)}</span><span class="hint">a ${o.contract.per}</span></div>
          <div class="fig"><span class="label">Run cost, September</span><span class="value" style="font-size:1.2rem">${o.runCost ? money(o.runCost.amount, o.runCost.currency) : '–'}</span><span class="hint">from AX Frame</span></div>
          <div class="fig"><span class="label">Renewal</span><span class="value" style="font-size:1.2rem">${o.renewal}</span><span class="hint">Risk: ${o.renewalRisk}</span></div>
          <div class="fig"><span class="label">Data agreement</span><span class="value" style="font-size:1.2rem">✓</span><span class="hint">${o.agreement}</span></div></div>`
        : `<div class="empty"><b>– Needs the Commercial right</b><p class="muted">Switch to Aisyah Rahman in the staff menu to see it.</p></div>`}
      </section>`;

    return `
    ${pageHead({ crumbs: `<a href="#portfolio">Portfolio</a><span>/</span><span>Organisations</span>`, title: esc(o.name),
      lead: `${o.projects.length} project · ${sols.length} solution${sols.length > 1 ? 's' : ''} · ${stagePill(o.stage)}`,
      state: `<span>Example data · ${rangeLabel()}</span><span>Times in ${o.tz} (MYT)</span>`,
      how: `<p>Totals here are deduplicated. Each KPI rolls up by its own rule: sums for additive counts, ratios recomputed from their parts, distinct counts never added.</p><p>"As the client sees it" hides commercial figures, internal notes and anything not approved for the client.</p>`,
      actions: `${audienceSeg()} ${rangeSeg()}` })}

    ${clientView() ? `<div class="audience-note">${'<b>As the client sees it.</b>'} Commercial figures, internal notes and unapproved KPIs are hidden. This is what goes into the report and, later, the embed.</div>` : ''}

    <section class="grid g-main">
      <div class="card">
        <div class="card-head"><h2>Outcome</h2><p>${esc(o.projects[0].objective)}</p></div>
        ${tot ? `<div class="fig"><span class="label">Hours saved, ${rangeLabel()} ${q('estimated')}</span><span class="value">${nf(tot.mid)}<small>h</small></span><span class="hint">Range <span class="mono">${nf(tot.low)} to ${nf(tot.high)}</span></span></div>` : `<div class="fig"><span class="label">Hours saved</span><span class="value">${dash()}</span><span class="hint">${o.id === 'teladan-properties' ? 'Not connected yet. Connect the solution to start.' : 'No baseline yet, so impact can’t be shown.'}</span></div>`}
        ${isContoh ? `<div class="chart" id="ch-org" style="margin-top:14px"></div>` : ''}
      </div>
      <div class="card">
        <div class="card-head"><h2>How the total is counted</h2></div>
        <div class="audit">
          ${isContoh ? `
          <div><span class="muted">Hours saved</span><span>Document workflow only. Invoice triage is in the same <span class="code">contoh-ap-workflow</span> overlap group, so its hours are not added again.</span></div>
          <div><span class="muted">Documents</span><span>Sum across solutions: additive, no overlap.</span></div>
          <div><span class="muted">Active operators</span><span>Distinct by pseudonymous id, never added across weeks.</span></div>
          <div><span class="muted">Rates</span><span>Recomputed from summed parts, never an average of averages.</span></div>` :
          `<div><span class="muted">Rollup</span><span>${rolled.length ? 'One solution, additive.' : 'Nothing rolled up yet: no approved impact KPI.'}</span></div>`}
        </div>
      </div>
    </section>

    ${narrative}

    <section aria-labelledby="kpi-h" class="grid" style="gap:12px">
      <div class="card-head" style="margin:0"><h2 id="kpi-h">KPIs</h2><p>Approved KPIs only · ${rangeLabel()}</p></div>
      ${cards.length ? sols.map((sid) => { const cs = cards.filter((c) => c.sol === M.solutions[sid].name); return cs.length ? `<h3 class="muted" style="font-weight:500">${esc(M.solutions[sid].name)}</h3><div class="grid ${cs.length >= 4 ? 'g4' : cs.length === 3 ? 'g3' : 'g2'}">${cs.map(kpiCardHtml).join('')}</div>` : ''; }).join('') : `<div class="card empty"><b>No KPIs yet</b><p class="muted">Connect the solution, then approve the KPIs AI proposes from its manifest.</p><a class="btn small" href="#connect">Connect a solution</a></div>`}
    </section>

    <section class="card">
      <div class="card-head"><h2>Solutions</h2></div>
      <div class="table-wrap"><table><thead><tr><th>Solution</th><th>Kind</th><th>Collection</th><th>KPIs</th><th>Last pull</th></tr></thead><tbody>
      ${sols.map((s) => { const x = M.solutions[s]; return `<tr class="link" data-go="solution-${s}" tabindex="0"><td><span class="name">${x.name}</span><span class="sub">${o.projects[0].name}</span></td><td>${x.kind}</td><td>${statusPill(solStatus(s))}</td><td class="mono">${x.kpis.approved} of ${x.kpis.total}</td><td class="mono">${x.lastPull || '–'}</td></tr>`; }).join('')}
      </tbody></table></div>
    </section>

    ${commercialCard}
    ${clientView() ? '' : `<section class="card"><div class="card-head"><h2>Internal notes</h2><span class="pill accent">REKA only</span></div><p>${isContoh ? 'Finance director asked for a split by document type from October. The reason dimension in the new manifest makes that possible.' : 'No notes yet.'}</p></section>`}`;
  };
  pages.organisation.after = (id) => {
    if ((id || 'contoh-logistik') !== 'contoh-logistik') return;
    const daily = impactDaily('doc-workflow', windowDays(state.range));
    drawChart($('#ch-org'), bucket(daily, state.range > 30), { id: 'org', kind: 'band', label: 'Hours saved, Contoh Logistik', height: 200,
      tip: (p) => p.before ? '<div>Before go-live</div>' : p.gap ? '<div>No data. Not counted as zero.</div>' : `<div>Hours saved <span class="mono">${nf(p.mid)}</span></div><div>Range <span class="mono">${nf(p.low)} to ${nf(p.high)}</span></div>` });
  };

  // ---------- Solution
  pages.solution = (id) => {
    const sid = id || 'doc-workflow';
    const s = M.solutions[sid];
    const o = orgById(s.org);
    const st = solStatus(sid);
    const days = windowDays(state.range);
    const tabs = [['outcomes', 'Outcomes'], ['usage', 'Usage'], ['health', 'Technical health'], ['catalog', 'Metric catalog'], ['collection', 'Collection']];
    const demo = sid === 'doc-workflow' ? `<div class="seg" role="group" aria-label="Try a collection state">${[['live', 'Live'], ['stale', 'Stale'], ['failing', 'Failing'], ['not_connected', 'Not connected']].map(([v, l]) => `<button type="button" data-demo="${v}" aria-pressed="${state.demoState === v}">${l}</button>`).join('')}</div>` : '';
    const banner = st === 'stale' ? `<div class="blocker"><b>Stale since ${s.since || '14 Oct 2026, 06:00'}.</b> ${s.missed || 2} pulls missed. Figures show the last good period, greyed. Nothing is filled in as zero. <a href="#collection">Open diagnostics</a></div>`
      : st === 'failing' ? `<div class="blocker" style="background:var(--fault-bg);color:var(--fault-ink)"><b>Couldn’t reach the source since ${s.since || '14 Oct 2026, 06:00'}.</b> ${esc(s.error || '503 from /internal/measure/v1/health')}. The collector retries every 15 minutes. ${gate(atLeast('Operator'), 'Retry now', 'Needs Operator', 'data-act="retry"', 'btn small')}</div>`
      : st === 'not_connected' ? '' : '';
    let body = '';
    if (st === 'not_connected') {
      body = `<section class="card empty"><b>Not connected</b><p class="muted">This solution has no Measurement Link yet. Once it does, its manifest, metrics and health appear here.</p><a class="btn primary small" href="#connect">Connect a solution</a></section>`;
    } else if (state.solTab === 'outcomes') {
      const cards = kpiCards(sid, days);
      const imp = M.impact[sid];
      let breakdown = '';
      if (imp && sid === 'doc-workflow' && st !== 'failing') {
        const r = impactSum(sid, days);
        const B = imp.baseline, R = imp.review, mch = r.machineMean;
        const saved = B.mid - mch - R.mid;
        const pct = (v) => (100 * v / (B.high)).toFixed(2) + '%';
        breakdown = `
        <section class="card">
          <div class="card-head"><h2>Where the saving comes from, per document</h2><p>Minutes · ${rangeLabel()}</p></div>
          <div class="impact">
            <div class="ib-row"><span class="lab">Before (baseline)</span><div class="ib-bar"><div class="ib-seg base" style="width:${pct(B.mid)}" title="Baseline ${B.mid} min"></div></div></div>
            <div class="ib-row"><span class="lab">Now</span><div class="ib-bar">
              <div class="ib-seg measured" style="width:${pct(mch)}" title="Machine time ${nf(mch, 1)} min, measured"></div>
              <div class="ib-seg estimated" style="width:${pct(R.mid)}" title="Human review ${R.mid} min, sampled"></div>
              <div class="ib-seg saved" style="width:${pct(saved)}">${nf(saved, 1)} min saved</div></div></div>
            <div class="ib-scale"><span>0</span><span>${B.high / 2}</span><span>${B.high} min</span></div>
          </div>
          <div class="table-wrap" style="margin-top:14px"><table>
            <thead><tr><th>Part</th><th>Source</th><th>Quality</th><th class="num">Value</th></tr></thead><tbody>
            <tr><td><span class="name">Documents completed</span></td><td class="mono">documents.generated</td><td>${q('measured')}</td><td class="num">${nf(r.vol)}</td></tr>
            <tr><td><span class="name">Manual minutes per document</span><span class="sub">${esc(B.method)}</span></td><td>Baseline v${B.version}</td><td>${q('estimated')}</td><td class="num">${B.mid} (${B.low} to ${B.high})</td></tr>
            <tr><td><span class="name">Machine minutes per document</span><span class="sub">Never counted as human time saved</span></td><td class="mono">documents.generation_duration</td><td>${q('measured')}</td><td class="num">${nf(mch, 2)}</td></tr>
            <tr><td><span class="name">Human review minutes per document</span><span class="sub">${esc(R.method)}</span></td><td>Sample</td><td>${q('estimated')}</td><td class="num">${R.mid} (${R.low} to ${R.high})</td></tr>
            <tr><td><span class="name">Gross hours saved</span><span class="sub">documents × (baseline − machine − review) ÷ 60, formula v3</span></td><td>K1</td><td>${q('estimated')}</td><td class="num">${nf(r.mid)} (${nf(r.low)} to ${nf(r.high)})</td></tr>
            </tbody></table></div>
        </section>`;
      } else if (sid === 'enquiry-triage') {
        breakdown = `<section class="card"><div class="empty"><b>No baseline yet</b><p class="muted">Front-desk hours saved can’t be computed until a baseline for manual minutes per enquiry is approved, or "not available" is recorded.</p><a class="btn small" href="#approvals">Add baseline</a></div></section>`;
      }
      body = `
        ${breakdown}
        <div class="grid ${cards.length >= 4 ? 'g4' : cards.length === 3 ? 'g3' : 'g2'}">${cards.map(kpiCardHtml).join('')}</div>
        <section class="card"><div class="card-head"><h2>${{ 'doc-workflow': 'Documents processed', 'invoice-triage': 'Invoices triaged', 'shift-planner': 'Shift plans generated', 'enquiry-triage': 'Enquiries received', 'quote-drafter': 'Quotations drafted' }[sid]}</h2><p>${state.range > 30 ? 'Weekly' : 'Daily'} · measured</p></div>
          <div class="chart" id="ch-vol"></div>
          <div class="legend"><span><i style="background:var(--s1)"></i>Measured</span><span><i style="border:1px dashed var(--warn);background:none"></i>No data, not zero</span></div>
          <details class="chart-table"><summary>Show as a table</summary><div class="table-wrap" id="tb-vol"></div></details>
        </section>`;
    } else if (state.solTab === 'usage') {
      const ops = seriesOf(sid, 'operators.active');
      const types = ['invoice', 'statement', 'credit_note'].map((t) => [t, sumMetric(sid, 'documents.generated.' + t, days).sum]);
      const tmax = Math.max(...types.map((t) => t[1]), 1);
      body = sid !== 'doc-workflow' ? `<section class="card empty"><b>Usage detail is mocked for Document workflow only</b><p class="muted">Open Contoh Logistik → Document workflow.</p></section>` : `
        <div class="grid g2">
          <section class="card"><div class="card-head"><h2>By document type</h2><p>${rangeLabel()} · measured</p></div>
            <div class="impact">${types.map(([t, v], i) => `<div class="ib-row"><span class="lab mono">${t}</span><div class="ib-bar"><div class="ib-seg" style="width:${(100 * v / tmax).toFixed(1)}%;background:${['var(--s1)', 'var(--s2)', 'var(--s3)'][i]}"></div><span class="mono" style="margin-left:8px;align-self:center;color:var(--ink)">${nf(v)}</span></div></div>`).join('')}</div>
            <p class="muted" style="margin-top:12px;font-size:.8125rem">Segmented because the mix changes: statements take longer to prepare by hand than credit notes.</p></section>
          <section class="card"><div class="card-head"><h2>Active operators</h2><p>Weekly distinct · measured</p></div>
            <div class="fig"><span class="value">${ops[ops.length - 1].v}</span><span class="hint">week of ${day(ops[ops.length - 1].d)} · ${sparkline(ops.slice(-14).map((p) => p.v), 160, 34)}</span></div>
            <p class="muted" style="margin-top:12px;font-size:.8125rem">Usage shows adoption, not value. It never rolls into hours saved.</p></section>
        </div>`;
    } else if (state.solTab === 'health') {
      const hs = seriesOf(sid, 'health');
      const byDay = {};
      hs.forEach((p) => { const d = p.d.slice(0, 10); (byDay[d] = byDay[d] || []).push(p.v); });
      body = sid !== 'doc-workflow' ? `<section class="card"><div class="card-head"><h2>Health</h2>${statusPill(st)}</div><p>Hourly history is mocked for Document workflow only.</p></section>` : `
        <section class="card"><div class="card-head"><h2>Health checks, last 7 days</h2><p>From the solution’s own /health, every 15 minutes; shown hourly</p></div>
          <div class="table-wrap"><div style="display:grid;gap:4px;min-width:560px">
          ${Object.entries(byDay).map(([d, hrs]) => `<div style="display:grid;grid-template-columns:96px repeat(24,1fr);gap:2px;align-items:center"><span class="mono muted" style="font-size:.75rem">${dayShort(d)}</span>${hrs.map((v, h) => `<span title="${dayShort(d)} ${String(h).padStart(2, '0')}:00 ${v}" style="height:18px;border-radius:3px;background:${v === 'ok' ? 'var(--ok-bg)' : 'var(--warn)'};${v === 'ok' ? 'box-shadow:inset 0 0 0 1px rgba(18,183,106,.35)' : ''}"></span>`).join('')}</div>`).join('')}
          </div></div>
          <div class="legend"><span><span class="dot ok"></span>ok</span><span><span class="dot warn"></span>degraded: 11 Oct 03:00 to 05:00, aggregation_late</span></div>
          <p class="muted" style="margin-top:10px;font-size:.8125rem">This is the measurement interface’s health and data freshness, not full application monitoring.</p></section>`;
    } else if (state.solTab === 'catalog') {
      body = `<section class="card"><div class="card-head"><h2>Metric catalog</h2><p>Manifest 2026-10-15 · schema 1.0.0 · ${sid === 'doc-workflow' ? '6' : '–'} metrics</p></div>
        ${sid !== 'doc-workflow' ? '<p>Mocked for Document workflow only.</p>' : `<div class="table-wrap"><table><thead><tr><th>Key</th><th>Type</th><th>Unit</th><th>Aggregation</th><th>Dimensions</th><th>Privacy</th><th>Feeds</th></tr></thead><tbody>
        ${M.catalog.map((c) => `<tr><td class="mono" style="color:var(--ink)">${c.key}${c.changed ? ' <span class="pill info">changed</span>' : ''}</td><td>${c.type}</td><td class="mono">${c.unit}</td><td>${c.agg}</td><td class="mono">${c.dims}</td><td>${c.privacy}</td><td class="mono">${c.feeds}</td></tr>`).join('')}
        </tbody></table></div>`}</section>`;
    } else if (state.solTab === 'collection') {
      body = `<div class="grid g2">
        <section class="card"><div class="card-head"><h2>Integration</h2>${statusPill(st)}</div>
          <dl class="kv"><dt>Base URL</dt><dd class="mono" style="word-break:break-all">${s.base}</dd><dt>Authentication</dt><dd>${s.auth}</dd><dt>Credential</dt><dd class="mono">vault://outcomes/${s.org}/${sid}/prod</dd><dt>Schedule</dt><dd>Observations daily 06:00 · health every 15 min</dd><dt>Last pull</dt><dd class="mono">${s.lastPull || '–'}</dd><dt>Checkpoint</dt><dd class="mono">${M.LAST_DAY}</dd></dl>
          <div class="head-actions" style="margin-top:12px">${gate(atLeast('Operator'), 'Pause collection', 'Needs Operator', '', 'btn small')} ${gate(atLeast('Operator'), 'Request backfill', 'Needs Operator', '', 'btn small')}</div></section>
        <section class="card"><div class="card-head"><h2>Freshness</h2></div>
          <div class="audit"><div><span class="muted">On time</span><span>Last success within the expected window</span></div><div><span class="muted">Late</span><span>One window missed</span></div><div><span class="muted">Stale</span><span>Two or more missed: last good value, greyed</span></div><div><span class="muted">Failing</span><span>Last attempt errored: a dash and the error</span></div><div><span class="muted">Paused</span><span>By staff, with a reason</span></div></div></section>
      </div>
      <section class="card"><div class="card-head"><h2>Recent pulls</h2></div><div class="table-wrap"><table><thead><tr><th>Started</th><th>Endpoint</th><th>Result</th><th class="num">Read</th><th class="num">Rejected</th><th class="num">ms</th><th>Request id</th></tr></thead><tbody>
        ${M.pulls.map((p) => `<tr><td class="mono">${p.at}</td><td class="mono">${p.ep}</td><td>${p.status === 'ok' ? '<span class="pill ok"><span class="dot ok"></span>ok</span>' : p.status === 'changed' ? '<span class="pill info">manifest changed</span>' : '<span class="pill warn"><span class="dot warn"></span>late</span>'}${p.note ? `<div class="sub">${esc(p.note)}</div>` : ''}</td><td class="num">${p.read}</td><td class="num">${p.rejected}</td><td class="num">${nf(p.ms)}</td><td class="mono">${p.req}</td></tr>`).join('')}
      </tbody></table></div></section>`;
    }
    return `
    ${pageHead({ crumbs: `<a href="#portfolio">Portfolio</a><span>/</span><a href="#organisation-${o.id}">${esc(o.short)}</a><span>/</span><span>${esc(o.projects[0].name)}</span>`,
      title: esc(s.name), lead: `${s.kind} · ${s.env} · version <span class="mono">${s.version}</span>${s.live ? ` · live since <span class="mono">${day(s.live)}</span>` : ''}`,
      state: `${statusPill(st)}<span>Last pull <span class="mono">${s.lastPull || '–'}</span> MYT</span>${s.nextPull && st === 'fresh' ? `<span>Next <span class="mono">${s.nextPull}</span></span>` : ''}`,
      how: `<p>Outcomes show approved KPIs with their quality. Impact is split into its parts: what was measured, what was sampled, and the range that follows.</p><p>Use the state switch to see how the page behaves when this source goes stale, fails or was never connected.</p>`,
      actions: `${demo} ${rangeSeg()}` })}
    ${banner}
    ${st === 'not_connected' ? '' : `<div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${state.solTab === k}">${l}</button>`).join('')}</div>`}
    ${body}`;
  };
  pages.solution.after = (id) => {
    const sid = id || 'doc-workflow';
    const el = $('#ch-vol');
    if (!el) return;
    const metric = { 'doc-workflow': 'documents.generated', 'invoice-triage': 'invoices.triaged', 'shift-planner': 'plans.generated', 'enquiry-triage': 'enquiries.received', 'quote-drafter': 'quotes.drafted' }[sid];
    const map = new Map(seriesOf(sid, metric).map((p) => [p.d, p.v]));
    const start = firstDay(sid, metric);
    const st = solStatus(sid);
    const days = windowDays(state.range);
    const daily = days.map((d) => d < start ? { d, before: true } : (map.has(d) && map.get(d) !== null && !(st === 'stale' && sid === 'doc-workflow' && d > '2026-10-12')) ? { d, v: map.get(d) } : { d, gap: true, v: null });
    const pts = bucket(daily, state.range > 30);
    drawChart(el, pts, { id: 'vol', kind: 'columns', label: 'Volume', height: 210,
      tip: (p) => p.before ? '<div>Before go-live</div>' : p.gap ? '<div>No data for this period. Not counted as zero.</div>' : `<div>Count <span class="mono">${nf(p.v)}</span></div>${p.gaps ? `<div class="muted">${p.gaps} day(s) missing</div>` : ''}` });
    $('#tb-vol').innerHTML = `<table><thead><tr><th>Period</th><th class="num">Count</th></tr></thead><tbody>${pts.filter((p) => !p.before).map((p) => `<tr><td>${p.label}</td><td class="num">${p.gap ? '– no data' : nf(p.v)}</td></tr>`).join('')}</tbody></table>`;
  };

  // ---------- Connect a solution
  const CONNECT_METRICS = [
    ['leases.processed', 'counter', 'document', 'pass', 'Ready'],
    ['leases.processing_duration', 'duration', 'second', 'pass', 'Ready · mean, ships sum and count'],
    ['leases.flagged_for_review', 'counter', 'document', 'pass', 'Ready'],
    ['reviewers.active', 'distinct', 'operator', 'pass', 'Ready · identity is a pseudonymous reviewer id'],
    ['clauses.extracted', 'counter', 'clause', 'warn', 'Unit “clause” isn’t on the list. Namespace it as x.clause, or ask to add it'],
    ['leases.by_tenant_name', 'counter', 'document', 'fault', 'Dimension tenant_name looks like personal or client-identifying data. Quarantined: not collected without an Admin’s authorisation'],
  ];
  const PROPOSALS = [
    { id: 'p1', name: 'Leases abstracted per month', domain: 'Usage', quality: 'measured', formula: 'sum(leases.processed) by month', why: 'The basic volume. Needed before any impact figure means anything.' },
    { id: 'p2', name: 'Share of leases sent back for review', domain: 'Operational performance', quality: 'derived', formula: 'sum(leases.flagged_for_review) / sum(leases.processed) × 100', why: 'Shows whether extraction is good enough to trust. Recomputed from parts when rolled up.' },
    { id: 'p3', name: 'Hours saved on lease abstraction', domain: 'Business impact', quality: 'estimated', formula: 'sum(leases.processed) × (baseline.manual_minutes − mean(leases.processing_duration)/60 − sample.review_minutes) / 60', why: 'The outcome the project was bought for.', gap: 'No baseline in the manifest. Suggest a time-and-motion sample of 20 leases before go-live.' },
    { id: 'p4', name: 'Clause extraction accuracy', domain: 'Gap', quality: 'unavailable', formula: '–', why: 'Can’t be measured from these metrics. The solution would need to count reviewer corrections (clauses.corrected).', gapOnly: true },
  ];

  pages.connect = () => {
    const c = state.connect;
    const steps = ['Details', 'Test connection', 'Validate metrics', 'Proposed plan', 'Sent for approval'];
    const stepper = `<ol class="steps" aria-label="Steps">${steps.map((l, i) => `<li class="${i + 1 < c.step ? 'done' : i + 1 === c.step ? 'now' : ''}" ${i + 1 === c.step ? 'aria-current="step"' : ''}><b>${i + 1 < c.step ? '✓' : i + 1}</b>${l}</li>`).join('')}</ol>`;
    const canAdd = atLeast('Support');
    let body = '';
    if (c.step === 1) {
      body = `<section class="card"><form id="f-connect" class="grid g2" style="gap:16px">
        <div class="field"><label for="c-org">Organisation</label><select id="c-org"><option>Teladan Properties</option></select><span class="help">Data agreement signed 2 Oct 2026 ✓</span></div>
        <div class="field"><label for="c-sol">Solution</label><select id="c-sol"><option>Lease abstraction · Lease reader</option></select></div>
        <div class="field"><label for="c-env">Environment</label><select id="c-env"><option>production</option><option>staging</option></select></div>
        <div class="field"><label for="c-url">Base URL</label><input id="c-url" class="mono" value="https://lease.teladan.example/internal/measure/v1"><span class="help">The solution’s Measurement Link. TLS only.</span></div>
        <div class="field"><label>Authentication</label><div class="seg" role="group" aria-label="Authentication">${[['signed', 'Signed service key'], ['bearer', 'Bearer token'], ['oauth', 'OAuth2 (exception)']].map(([v, l]) => `<button type="button" data-auth="${v}" aria-pressed="${c.auth === v}">${l}</button>`).join('')}</div>
          <span class="help">${c.auth === 'signed' ? 'Recommended for REKA-built solutions: HMAC-signed requests, as AXLE Link.' : c.auth === 'bearer' ? 'For third-party hosts that can’t sign. Marked on the integration.' : 'Only when the client’s IT requires it. Recorded as an exception.'}</span></div>
        <div class="field"><label for="c-cred">Credential reference</label><input id="c-cred" class="mono" value="vault://outcomes/teladan-properties/lease-reader/prod"><span class="help">A pointer to the secret manager. The secret itself never enters this console.</span></div>
        <div style="grid-column:1/-1" class="head-actions">${gate(canAdd, 'Test connection', 'Needs Support', 'type="submit"')}</div>
      </form></section>`;
    } else if (c.step === 2) {
      body = `<section class="card"><div class="card-head"><h2>Testing the connection</h2><p>Nothing is stored until every step passes</p></div>
        <div class="checklist" id="test-log">${c.log.map(([ok, t]) => `<div><span class="${ok ? 'mark-ok' : 'mark-fault'}">${ok ? '✓' : '✕'}</span><span>${esc(t)}</span></div>`).join('')}</div>
        ${c.log.length >= 5 ? `<div class="head-actions" style="margin-top:16px"><button type="button" class="btn primary" data-act="to-validate">Validate metrics</button></div>` : '<p class="muted" style="margin-top:10px">Checking…</p>'}</section>`;
    } else if (c.step === 3) {
      body = `<section class="card"><div class="card-head"><h2>Manifest and metrics</h2><p>Schema 1.0.0 · catalog 2026-10-14 · 6 metrics · daily · time zone Asia/Kuala_Lumpur</p></div>
        <div class="table-wrap"><table><thead><tr><th>Metric</th><th>Type</th><th>Unit</th><th>Result</th></tr></thead><tbody>
        ${CONNECT_METRICS.map(([k, t, u, r, note]) => `<tr><td class="mono" style="color:var(--ink)">${k}</td><td>${t}</td><td class="mono">${u}</td><td><span class="pill ${r === 'pass' ? 'ok' : r}"><span class="dot ${r === 'pass' ? 'ok' : r}"></span>${r === 'pass' ? 'Pass' : r === 'warn' ? 'Warn' : 'Fail'}</span><div class="sub">${esc(note)}</div></td></tr>`).join('')}
        </tbody></table></div>
        <div class="head-actions" style="margin-top:16px"><button type="button" class="btn primary" data-act="to-propose">Propose a measurement plan</button><span class="needs">4 metrics ready · 1 warning · 1 quarantined</span></div></section>`;
    } else if (c.step === 4) {
      if (!c.proposals) {
        body = `<section class="card ai-block"><div class="thinking"><img src="${SPARK}" alt=""><span>Proposing KPIs from 4 ready metrics…</span></div></section>`;
      } else {
        const chosen = PROPOSALS.filter((p) => !p.gapOnly && c.decided[p.id] !== false);
        body = `<section class="ai-block"><div class="card-head"><h2>Proposed measurement plan</h2>${aiTag()}</div>
          <div class="grid" style="gap:10px">${PROPOSALS.map((p) => `
            <article class="proposal ${c.decided[p.id] === false ? 'rejected' : ''}">
              <div class="card-head" style="margin:0"><h3>${esc(p.name)}</h3><span class="head-actions"><span class="pill idle">${p.domain}</span>${q(p.quality)}</span></div>
              ${p.formula !== '–' ? `<div class="formula">${esc(p.formula)}</div>` : ''}
              <p style="font-size:.8125rem">${esc(p.why)}</p>
              ${p.gap ? `<div class="blocker"><b>Baseline gap.</b> ${esc(p.gap)}</div>` : ''}
              ${p.gapOnly ? `<div><button type="button" class="btn small" data-act="add-gap">Add to the instrumentation backlog</button></div>` : `<div class="seg" role="group" aria-label="Decision for ${esc(p.name)}"><button type="button" data-prop="${p.id}" data-v="1" aria-pressed="${c.decided[p.id] !== false}">Keep</button><button type="button" data-prop="${p.id}" data-v="0" aria-pressed="${c.decided[p.id] === false}">Reject</button></div>`}
            </article>`).join('')}</div>
          <div class="head-actions" style="margin-top:16px">${gate(has('Measurement') || atLeast('Operator'), `Send ${chosen.length} KPI${chosen.length === 1 ? '' : 's'} for approval`, 'Needs the Measurement right', 'data-act="submit-plan"')}<span class="needs">Proposals are drafts. Nothing computes until a person approves.</span></div></section>`;
      }
    } else {
      body = `<section class="card"><div class="empty"><b>Sent for approval</b><p>The KPIs are in the approval queue. Collection starts once the first one is approved: observations daily at 06:00 MYT, health every 15 minutes.</p><p class="muted">The baseline sample for hours saved is on the project’s readiness checklist. The solution can’t go live without it, or without a recorded "baseline not available".</p><div class="head-actions"><a class="btn primary" href="#approvals">Open approvals</a><button type="button" class="btn" data-act="restart">Start again</button></div></div></section>`;
    }
    return `${pageHead({ title: 'Connect a solution', lead: 'Add a client solution’s Measurement Link, check it, and let AI propose what to measure. A person approves every KPI.',
      state: '<span>Example data · Teladan Properties is in planning</span>',
      how: '<p>1. Details and a credential reference. 2. A live test of /manifest and /health. 3. Every metric is checked for type, unit, aggregation, privacy and a sample. 4. AI proposes KPIs, baselines needed and gaps. 5. The plan goes to the approval queue.</p><p>The solution keeps its own stack and data model. It only serves the small read-only interface in the integration pack.</p>' })}
      ${stepper}${body}`;
  };
  pages.connect.after = () => {
    const c = state.connect;
    const f = $('#f-connect');
    if (f) f.addEventListener('submit', (e) => {
      e.preventDefault();
      c.step = 2; c.log = []; render();
      const lines = [[1, 'Resolved lease.teladan.example · TLS 1.3'], [1, 'Signature accepted · clock skew 0.4 s'], [1, 'GET /manifest 200 · schema 1.0.0 · 6 metrics'], [1, 'GET /health 200 · ok · freshness to 14 Oct 2026'], [1, 'GET /observations sample 200 · 6 metrics, 1 day, 41 rows']];
      lines.forEach((l, i) => setTimeout(() => { c.log.push(l); if (location.hash === '#connect') render(); }, reduceMotion ? 0 : 450 * (i + 1)));
    });
  };

  // ---------- Approvals
  pages.approvals = () => {
    const list = state.approvals;
    const sel = list.find((a) => a.id === state.approvalSel) || list[0];
    const org = orgById(sel.org);
    const who = (id) => id === 'ai' ? `<span class="ai"><img src="${SPARK}" alt="">AI proposals</span>` : id === 'collector' ? 'Collector' : M.staff[id].name;
    const mine = sel.proposer === state.role || sel.editedBy === state.role;
    const can = has('Approve') && !mine && sel.status === 'waiting';
    const why = sel.status === 'blocked' ? 'Blocked by a missing baseline' : mine ? 'You proposed or edited this. Someone else approves.' : !has('Approve') ? 'Needs the Approve right' : '';
    const statusP = (a) => a.status === 'waiting' ? '<span class="pill warn"><span class="dot warn"></span>Waiting</span>' : a.status === 'blocked' ? '<span class="pill fault"><span class="dot fault"></span>Blocked</span>' : a.status === 'approved' ? '<span class="pill ok"><span class="dot ok"></span>Approved</span>' : a.status === 'changes' ? '<span class="pill info">Changes asked</span>' : '<span class="pill idle">Declined</span>';
    return `${pageHead({ title: 'Approvals', lead: 'Every KPI, baseline, mapping, client visibility change and report waits here for a person. The proposer never approves their own.',
      state: `<span>Example data</span><span>${list.filter((a) => a.status === 'waiting').length} waiting · ${list.filter((a) => a.status === 'blocked').length} blocked</span>`,
      how: '<p>Each item shows what changes, who proposed it, the evidence and what it affects. Decisions need a reason and go into Audit with before and after.</p><p>Switch staff in the top right to see how rights change what you can do.</p>' })}
    <div class="split">
      <div class="queue" role="list">${list.map((a) => `<button type="button" class="q-item" role="listitem" data-sel="${a.id}" aria-current="${a.id === sel.id}">
        <span class="m"><span class="pill idle">${a.type}</span>${statusP(a)}</span>
        <span class="t">${esc(a.title)}</span>
        <span class="m"><span>${esc(orgById(a.org).short)}</span><span>by ${a.proposer === 'ai' ? 'AI' : a.proposer === 'collector' ? 'Collector' : M.staff[a.proposer].name}${a.editedBy ? `, edited by ${M.staff[a.editedBy].name}` : ''}</span><span class="mono">${a.since}</span></span></button>`).join('')}</div>
      <section class="card" aria-labelledby="ap-h">
        <div class="card-head"><div><span class="pill idle">${sel.type}</span> ${statusP(sel)}<h2 id="ap-h" style="margin-top:8px">${esc(sel.title)}</h2></div><span class="mono muted">${sel.id}</span></div>
        <p style="color:var(--ink);margin-bottom:12px">${esc(sel.summary)}</p>
        <dl class="kv"><dt>Organisation</dt><dd>${esc(org.name)}</dd>${sel.solution ? `<dt>Solution</dt><dd>${M.solutions[sel.solution].name}</dd>` : ''}<dt>Proposed by</dt><dd>${who(sel.proposer)}${sel.editedBy ? `, edited by ${M.staff[sel.editedBy].name}` : ''} · <span class="mono">${sel.since}</span></dd>
          ${(sel.fields || []).map(([k, v, cls]) => `<dt>${k}</dt><dd class="${cls || ''}">${esc(v)}</dd>`).join('')}</dl>
        ${sel.diff ? `<div class="table-wrap" style="margin-top:12px"><table class="diff"><thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>${sel.diff.map(([k, b, a]) => `<tr><td>${k}</td><td class="before">${esc(b)}</td><td class="after">${esc(a)}</td></tr>`).join('')}</tbody></table></div>` : ''}
        <dl class="kv" style="margin-top:12px"><dt>Evidence</dt><dd>${esc(sel.evidence)}</dd><dt>Affects</dt><dd>${esc(sel.affects)}</dd></dl>
        ${sel.report ? `<p style="margin-top:12px"><a class="btn small" href="#report">Open the draft report</a></p>` : ''}
        ${sel.blocker ? `<div class="blocker" style="margin-top:12px"><b>Can’t approve yet.</b> ${esc(sel.blocker)}</div>` : ''}
        ${sel.status === 'waiting' || sel.status === 'blocked' ? `
        <form id="f-decide" class="grid" style="gap:10px;margin-top:16px">
          <div class="field"><label for="d-reason">Reason</label><textarea id="d-reason" placeholder="Why you are approving, asking for changes or declining. Recorded in Audit." ${can ? '' : 'disabled'}></textarea></div>
          <div class="head-actions">
            ${can ? `<button type="submit" class="btn primary" data-dec="approved">Approve</button><button type="submit" class="btn" data-dec="changes">Ask for changes</button><button type="submit" class="btn ghost" data-dec="declined">Decline</button>` : `<button type="button" class="btn primary" disabled>Approve</button><span class="needs">${why}</span>`}
          </div>
        </form>` : `<p class="muted" style="margin-top:14px">Decided. See the trail below.</p>`}
      </section>
    </div>
    <section class="card"><div class="card-head"><h2>Trail</h2><a href="#audit">Full audit</a></div>
      <div class="audit">${state.audit.slice(0, 8).map(([t, w, what]) => `<div><span class="mono muted">${esc(t)}</span><span><b class="ink">${esc(w)}</b> ${esc(what)}</span></div>`).join('')}</div></section>`;
  };
  pages.approvals.after = () => {
    const f = $('#f-decide');
    if (!f) return;
    let dec = 'approved';
    $$('button[data-dec]', f).forEach((b) => b.addEventListener('click', () => { dec = b.dataset.dec; }));
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const reason = $('#d-reason').value.trim();
      if (!reason) { $('#d-reason').focus(); $('#d-reason').setAttribute('aria-invalid', 'true'); $('#d-reason').placeholder = 'Add a reason first: it goes into Audit.'; return; }
      const a = state.approvals.find((x) => x.id === state.approvalSel);
      const prev = a.status;
      a.status = dec;
      const word = { approved: 'Approved', changes: 'Asked for changes on', declined: 'Declined' }[dec];
      log(`${word} ${a.type === "KPI" ? "KPI" : a.type.toLowerCase()} “${a.title}” for ${orgById(a.org).short}: ${reason}`);
      if (a.report && dec === 'approved') state.reportApproved = true;
      render();
      toast(`${word.replace(' on', '')}: ${a.title}.`, () => { a.status = prev; if (a.report) state.reportApproved = false; state.audit.shift(); render(); });
    });
  };

  // ---------- Client report
  pages.report = () => {
    const sep = contohMonth('2026-09'), aug = contohMonth('2026-08');
    const canApprove = has('Approve') && state.role !== 'nurul';
    const delta = (a, b, dp = 0) => { const d = a - b; return (d >= 0 ? '+' : '−') + nf(Math.abs(d), dp); };
    return `
    <div class="report-bar">
      <div><nav class="crumbs"><a href="#organisation-contoh-logistik">Contoh Logistik</a><span>/</span><span>Reports</span></nav><h1>September 2026 report</h1>
        <p class="state-line">${state.reportApproved ? '<span class="pill ok"><span class="dot ok"></span>Approved · ready to send</span>' : '<span class="pill warn"><span class="dot warn"></span>Draft · in review</span>'}<span>Drafted by AI, edited by Nurul Aina</span><span>Numbers checked against computed values ✓</span><span>Commercial data: none ✓</span></p></div>
      <div class="head-actions">${state.reportApproved ? '<button type="button" class="btn" disabled>Sent with the PDF in Phase 2</button>' : gate(canApprove, 'Approve for delivery', state.role === 'nurul' ? 'You edited this. Someone else approves.' : 'Needs the Approve right', 'data-act="approve-report"')}</div>
    </div>
    <article class="paper" aria-label="Client report preview">
      <header class="paper-head">
        <div class="top"><span class="eyebrow"><img src="${SPARK}" alt="">Performance report</span><img class="reka" src="assets/reka-lockup.svg" alt="REKA"></div>
        <h1>Accounts payable automation: September 2026</h1>
        <div class="meta"><span>Prepared for Contoh Logistik Sdn Bhd</span><span>Period <span class="mono">1 to 30 Sep 2026</span></span><span>Generated <span class="mono">15 Oct 2026, 06:12 MYT</span></span><span class="example">Example data</span></div>
      </header>

      <section><h2>Summary</h2>
        <div class="headline">
          <div><span class="l">Documents completed</span><span class="v">${nf(sep.docs)}</span><span class="s">${delta(sep.docs, aug.docs)} on August · measured<sup>1</sup></span></div>
          <div><span class="l">Preparation hours freed</span><span class="v">${nf(sep.imp.mid)}</span><span class="s">range ${nf(sep.imp.low)} to ${nf(sep.imp.high)} · estimated<sup>2</sup></span></div>
          <div><span class="l">Sent back for correction</span><span class="v">${nf(sep.rate, 1)}%</span><span class="s">7.4% before go-live · derived<sup>3</sup></span></div>
        </div>
      </section>

      <section><h2>Outcomes</h2>
        <div class="table-wrap"><table><thead><tr><th>Measure</th><th class="num">September</th><th class="num">August</th><th class="num">Baseline</th><th>Quality</th></tr></thead><tbody>
          <tr><td><span class="name">Documents completed</span></td><td class="num">${nf(sep.docs)}</td><td class="num">${nf(aug.docs)}</td><td class="num">–</td><td>${q('measured')}</td></tr>
          <tr><td><span class="name">Preparation hours freed</span></td><td class="num">${nf(sep.imp.mid)}</td><td class="num">${nf(aug.imp.mid)}</td><td class="num">18 min per document</td><td>${q('estimated')}</td></tr>
          <tr><td><span class="name">Sent back for correction</span></td><td class="num">${nf(sep.rate, 1)}%</td><td class="num">${nf(aug.rate, 1)}%</td><td class="num">7.4%</td><td>${q('derived')}</td></tr>
          <tr><td><span class="name">Invoice cycle time, median</span></td><td class="num">${nf(sep.ct, 1)} days</td><td class="num">${nf(aug.ct, 1)} days</td><td class="num">4.5 days</td><td>${q('derived')}</td></tr>
          <tr><td><span class="name">Invoices triaged</span></td><td class="num">${nf(sep.invoices)}</td><td class="num">${nf(aug.invoices)}</td><td class="num">–</td><td>${q('measured')}</td></tr>
        </tbody></table></div>
      </section>

      <section><h2>What changed</h2>
        <ul>
          <li>More documents went through the workflow than in August, mostly invoices.</li>
          <li>Fewer documents needed correction, which also shortens the review step.</li>
          <li>Invoices moved from receipt to approval faster through the month.</li>
        </ul>
        <p class="ai" style="margin-top:8px"><img src="${SPARK}" alt="">Drafted with AI from the measured figures above, and reviewed by REKA.</p>
      </section>

      <section><h2>How we measured</h2>
        <div class="fn">
          <span><sup>1</sup> Counted by the workflow and collected daily. 21 and 22 Sep are missing and not counted, so the true figure is a little higher.</span>
          <span><sup>2</sup> Documents × (18 manual minutes − ${nf(sep.imp.machineMean, 1)} machine minutes − 4 review minutes) ÷ 60. Manual minutes come from a sample of 40 documents timed on 2 to 6 Jun 2026, before go-live; review minutes from 30 documents on 1 to 3 Oct 2026. The range uses the low and high ends of both samples. Machine time is not counted as time saved.</span>
          <span><sup>3</sup> Documents sent back ÷ documents completed. Before go-live: system records, Mar to May 2026.</span>
        </div>
      </section>

      <section><h2>Caveats</h2>
        <div class="note">These figures compare September with the baseline. They don’t show what caused every change: invoice volumes and supplier mix also moved. Hours freed are an estimate, not hours removed from anyone’s week.</div>
      </section>

      <section><h2>Recommended next steps</h2>
        <ol>
          <li>Split hours freed by document type from October, now that the workflow reports why documents are sent back.</li>
          <li>Re-time a fresh sample of 20 statements: they take longest by hand and are growing as a share.</li>
          <li>Agree how to count Invoice triage’s hours alongside the document workflow, so its time savings can be reported without double counting.</li>
        </ol>
      </section>

      <footer class="paper-foot"><span>Run by REKA as part of Managed AI.</span><span class="mono">Page 1 of 1</span><span>REKA Inisiatif Sdn Bhd</span></footer>
    </article>`;
  };

  // ---------- Not in this mock
  const SOON = {
    collection: ['Collection health', 'Every integration’s schedule, last pull, freshness and errors, plus the collector, compute and AI run logs.'],
    alerts: ['Alerts', 'Open alerts with what, where, since when and the fix: stale or failing sources, manifest changes, KPI thresholds, missing baselines.'],
    organisations: ['Organisations', 'The organisations list, as AXLE §8.1, with stage, solutions, KPI coverage and readiness.'],
    projects: ['Projects', 'Objectives, contributing solutions, baseline comparison, exceptions and the improvement backlog.'],
    solutions: ['Solutions', 'Every solution across organisations, with collection state and KPI coverage.'],
    plans: ['Measurement plans', 'Each project’s KPIs in draft, review, approved or superseded, with versions.'],
    kpis: ['KPIs', 'The KPI builder: closed set of operations, preview over the last window, every field the brief requires.'],
    baselines: ['Baselines', 'Every baseline with value, method, sample, evidence and approver, versioned.'],
    catalog: ['Metric catalog', 'Every metric across solutions. One solution’s catalog is on its Metric catalog tab.'],
    reports: ['Reports', 'Templates, drafts, approvals and delivered PDFs per organisation.'],
    integrations: ['Integrations', 'Every Measurement Link, its credential reference, schedule and status.'],
    audit: ['Audit', 'Every staff, collector and AI action, with before and after. Never editable.'],
    staff: ['Staff', 'REKA staff, their rung and their rights: Measurement, Approve, Commercial.'],
    guide: ['Guide', 'The staff guide.'],
  };
  const soon = (key) => `${pageHead({ title: SOON[key][0], lead: SOON[key][1] })}
    <section class="card empty"><b>Not in this first mock</b><p class="muted">See the PRD, section 12, for what this screen holds. The mocked screens are Portfolio, an organisation, a solution, Connect a solution, Approvals and the client report.</p><div class="head-actions"><a class="btn small" href="#portfolio">Portfolio</a><a class="btn small" href="#approvals">Approvals</a></div></section>`;

  // ------------------------------------------------------------------ shell
  const NAV = [
    ['Watch', [['portfolio', 'Portfolio'], ['collection', 'Collection health'], ['alerts', 'Alerts', () => 2, true]]],
    ['Organisations', [['organisations', 'Organisations'], ['organisation-contoh-logistik', 'Contoh Logistik'], ['solution-doc-workflow', 'Document workflow']]],
    ['Outcomes', [['plans', 'Measurement plans'], ['kpis', 'KPIs'], ['baselines', 'Baselines'], ['catalog', 'Metric catalog'], ['report', 'Reports', () => state.reportApproved ? 0 : 1, true]]],
    ['Connect', [['integrations', 'Integrations'], ['connect', 'Connect a solution']]],
    ['Trail', [['approvals', 'Approvals', () => state.approvals.filter((a) => a.status === 'waiting').length, () => has('Approve')], ['audit', 'Audit'], ['staff', 'Staff'], ['guide', 'Guide']]],
  ];

  function renderShell(route) {
    $('#nav').innerHTML = NAV.map(([g, items]) => `<div class="nav-group"><span>${g}</span>${items.map(([k, l, cnt, loud]) => {
      const c = cnt ? cnt() : 0;
      const isLoud = typeof loud === 'function' ? loud() : loud;
      const cur = route === k || (k === 'organisations' && false);
      return `<a href="#${k}" ${cur ? 'aria-current="page"' : ''} class="${SOON[k] ? 'soon' : ''}"><span class="intan"></span><span>${l}</span>${c ? `<span class="count ${isLoud ? 'loud' : ''}" aria-label="${c} open">${c}</span>` : ''}</a>`;
    }).join('')}</div>`).join('');
    const u = me();
    $('#who').innerHTML = `<div class="avatar">${u.initials}</div><div><div class="ink" style="font-weight:600">${u.name}</div><span class="role-chip">${u.rung.toUpperCase()}</span> <span class="muted" style="font-size:.75rem">${u.rights.join(' · ')}</span></div>`;
    $('#staff-btn').innerHTML = `<span class="avatar" style="width:30px;height:30px">${u.initials}</span><span class="nm" style="font-size:.8125rem">${u.name}</span><span aria-hidden="true">▾</span>`;
    $('#staff-pop').innerHTML = `<h4>Switch staff to see rights at work</h4>${Object.values(M.staff).map((s) => `<button type="button" data-role="${s.id}" aria-pressed="${s.id === state.role}"><span class="avatar">${s.initials}</span><span><b class="ink">${s.name}</b><small>${s.rung} · ${s.rights.join(', ')} · ${s.note}</small></span></button>`).join('')}
      <h4 style="border-top:1px solid var(--line);margin-top:6px;padding-top:10px">Your account</h4><button type="button" disabled><span>Two-step sign-in · on</span></button><button type="button" disabled><span>Sign out</span></button>`;
  }

  function parseRoute() {
    const h = (location.hash || '#portfolio').slice(1) || 'portfolio';
    if (h.startsWith('organisation-')) return ['organisation', h.slice(13), h];
    if (h.startsWith('solution-')) return ['solution', h.slice(9), h];
    return [h, null, h];
  }

  let lastRoute = '';
  function render() {
    const [page, arg, raw] = parseRoute();
    renderShell(raw);
    const view = $('#view');
    const titleBits = { portfolio: 'Portfolio', organisation: arg ? (orgById(arg) || {}).short : '', solution: arg ? (M.solutions[arg] || {}).name : '', connect: 'Connect a solution', approvals: 'Approvals', report: 'September 2026 report' };
    if (pages[page] && (page !== 'organisation' || orgById(arg)) && (page !== 'solution' || M.solutions[arg])) {
      view.innerHTML = pages[page](arg);
      document.title = `${titleBits[page] || page} · AXLE · Outcomes`;
      if (pages[page].after) pages[page].after(arg);
    } else if (SOON[page]) {
      view.innerHTML = soon(page);
      document.title = `${SOON[page][0]} · AXLE · Outcomes`;
    } else {
      view.innerHTML = soon('guide').replace('Guide', 'Not found');
    }
    if (lastRoute !== raw) { window.scrollTo(0, 0); lastRoute = raw; closeDrawer(); }
  }

  // ------------------------------------------------------------------ events
  function closeDrawer() { $('#sidebar').classList.remove('open'); const s = $('#scrim'); if (s) s.hidden = true; $('#menu-btn').setAttribute('aria-expanded', 'false'); }
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.staff-menu')) $('#staff-pop').hidden = true;
    const t = e.target.closest('button, tr[data-go], [data-go]');
    if (!t) return;
    const d = t.dataset;
    if (d.range) { state.range = +d.range; render(); return; }
    if (d.aud) { state.audience = d.aud; render(); return; }
    if (d.tab) { state.solTab = d.tab; render(); return; }
    if (d.demo) { state.demoState = d.demo; render(); return; }
    if (d.go) { location.hash = '#' + d.go; return; }
    if (d.sel) { state.approvalSel = d.sel; render(); $('#ap-h') && $('#ap-h').focus && window.innerWidth < 1024 && $('#ap-h').scrollIntoView(); return; }
    if (d.auth) { state.connect.auth = d.auth; render(); return; }
    if (d.prop) { state.connect.decided[d.prop] = d.v === '1'; render(); return; }
    if (d.role) {
      state.role = d.role; try { localStorage.setItem('outcomes-mock-role', d.role); } catch (err) { /* storage blocked */ }
      $('#staff-pop').hidden = true; render(); toast(`Now viewing as ${me().name}.`); return;
    }
    if (t.id === 'staff-btn') { const p = $('#staff-pop'); p.hidden = !p.hidden; t.setAttribute('aria-expanded', String(!p.hidden)); return; }
    if (t.id === 'menu-btn') { $('#sidebar').classList.add('open'); $('#scrim').hidden = false; t.setAttribute('aria-expanded', 'true'); const a = $('#nav a'); if (a) a.focus(); return; }
    const act = d.act;
    if (!act) return;
    if (act === 'to-validate') { state.connect.step = 3; render(); }
    if (act === 'to-propose') {
      state.connect.step = 4; state.connect.proposals = null; render();
      setTimeout(() => { state.connect.proposals = PROPOSALS; if (location.hash === '#connect') render(); }, reduceMotion ? 0 : 1400);
    }
    if (act === 'add-gap') { toast('Added to the instrumentation backlog.'); log('Added “clauses.corrected” to the Lease reader instrumentation backlog'); }
    if (act === 'submit-plan') {
      const chosen = PROPOSALS.filter((p) => !p.gapOnly && state.connect.decided[p.id] !== false);
      chosen.forEach((p, i) => state.approvals.unshift({ id: 'apr_5' + i, type: 'KPI', title: p.name, org: 'teladan-properties', solution: 'lease-reader', proposer: 'ai', editedBy: state.role === 'daniel' || state.role === 'aisyah' ? null : state.role, since: now(), status: p.gap ? 'blocked' : 'waiting', summary: p.why, blocker: p.gap ? 'No baseline yet. ' + p.gap : null, fields: [['Formula', p.formula, 'mono'], ['Domain', p.domain], ['Quality', p.quality]], evidence: 'Manifest 2026-10-14, validated 15 Oct 2026', affects: 'Teladan Properties outcomes' }));
      log(`Sent ${chosen.length} AI-proposed KPIs for Lease reader for approval`);
      state.connect.step = 5; render(); toast(`${chosen.length} KPIs sent for approval.`);
    }
    if (act === 'restart') { state.connect = { step: 1, auth: 'signed', log: [], proposals: null, decided: {} }; render(); }
    if (act === 'approve-report') {
      state.reportApproved = true;
      const a = state.approvals.find((x) => x.report); if (a) a.status = 'approved';
      log('Approved the September 2026 report for Contoh Logistik for delivery'); render();
      toast('Report approved.', () => { state.reportApproved = false; if (a) a.status = 'waiting'; state.audit.shift(); render(); });
    }
    if (act === 'approve-narrative') { state.narrativeApproved = true; log('Approved the September narrative for Contoh Logistik'); render(); toast('Narrative approved.', () => { state.narrativeApproved = false; state.audit.shift(); render(); }); }
    if (act === 'retry') { toast('Retry queued. Next attempt in under a minute.'); log('Queued a retry for Quote drafter'); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeDrawer(); $('#staff-pop').hidden = true; }
    if (e.key === 'Enter' && e.target.matches('tr[data-go]')) location.hash = '#' + e.target.dataset.go;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); toast('Find comes in Phase 2.'); }
  });
  $('#scrim').addEventListener('click', closeDrawer);
  window.addEventListener('hashchange', render);
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { const [page, arg] = parseRoute(); if (['portfolio', 'organisation', 'solution'].includes(page) && pages[page].after) pages[page].after(arg); }, 150); });
  render();
})();
