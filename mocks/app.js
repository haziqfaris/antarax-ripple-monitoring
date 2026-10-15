/* Outcomes product mock. Two journeys share one app:
   - first use: sign in, set up the workspace, add an organisation, create a project, connect a solution, choose KPIs, set baselines, send for approval, see the first data;
   - an established workspace with example data: home, organisations, solutions, approvals and the client report.
   Plain JavaScript, no libraries. Every figure is computed from data.js or from what you type in the wizard. */
(function () {
  'use strict';
  const M = window.MOCK;
  const IC = window.ICONS;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const icon = (n, cls) => `<svg class="i ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ''}</svg>`;
  const SPARK = 'assets/sparkle.svg';

  // ------------------------------------------------------------------ state
  const freshWizard = () => ({ step: 1, method: 'link', devReady: false, solName: '', url: 'https://lease.teladan.example/internal/measure/v1', tests: [], tested: false, proposals: null, keep: { p1: true, p2: true, p3: true }, baseline: { method: 'sample', mid: 35, low: 25, high: 45, n: 20, period: '20 to 24 Oct 2026', note: '' } });
  const state = {
    signedIn: false,
    mode: null, // 'new' | 'demo'
    role: 'daniel',
    setup: { step: 1, workspace: 'REKA Inisiatif', invites: [{ email: 'nurul@reka.re', role: 'Analyst' }, { email: 'aisyah@reka.re', role: 'Admin' }] },
    my: { org: null, project: null, sol: null, reportScheduled: false },
    wiz: freshWizard(),
    range: 30, audience: 'staff', solTab: 'outcomes', demoState: 'live', approvalSel: null,
    approvals: M.approvals.map((a) => Object.assign({}, a)),
    myApprovals: [],
    audit: M.audit.slice(),
    myAudit: [],
    reportApproved: false, narrativeApproved: false,
    newTemplate: 'documents',
  };
  try { const t = localStorage.getItem('outcomes-theme'); if (t) document.documentElement.setAttribute('data-theme', t); } catch (e) { /* storage blocked */ }

  const me = () => M.staff[state.role];
  const has = (right) => me().rights.includes(right);
  const RUNGS = ['Viewer', 'Support', 'Operator', 'Admin', 'Owner'];
  const atLeast = (rung) => RUNGS.indexOf(me().rung) >= RUNGS.indexOf(rung);
  const demo = () => state.mode === 'demo';

  // ------------------------------------------------------------------ formats (brand kit 13)
  const nf = (n, dp = 0) => Number(n).toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const SYM = { MYR: 'RM', USD: 'US$' };
  const money = (a, c) => (SYM[c] || c + ' ') + nf(a);
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = (s) => { const d = M.toDate(s.slice(0, 10)); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); };
  const dayShort = (s) => { const d = M.toDate(s.slice(0, 10)); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const q = (k) => `<span class="q ${k}">${k[0].toUpperCase() + k.slice(1)}</span>`;
  const dash = (why) => `<span class="dash">–</span>${why ? ` <span class="needs">${esc(why)}</span>` : ''}`;
  const aiMark = (t) => `<span class="ai-mark"><img src="${SPARK}" alt="">${esc(t || 'Suggested by AI. You decide.')}</span>`;
  const initials = (s) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  const clock = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const now = () => '15 Oct 2026, ' + clock();

  // ------------------------------------------------------------------ computation (PRD §8.5, §10)
  const windowDays = (n, end) => { const last = end || M.LAST_DAY; return M.dayRange(M.addDays(last, -(n - 1)), last); };
  const seriesOf = (sol, metric) => (M.series[sol] && M.series[sol][metric]) || [];
  const firstDay = (sol, metric) => { const s = seriesOf(sol, metric); return s.length ? s[0].d : null; };
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
      if (dur) { const m = dur.get(d) / 60, R = def.review; return { d, vol: v, mid: v * (B.mid - m - R.mid) / 60, low: v * (B.low - m - R.high) / 60, high: v * (B.high - m - R.low) / 60, machine: m }; }
      if (rev) { const r = rev.get(d); return { d, vol: v, mid: v * (B.mid - r) / 60, low: v * (B.low - r) / 60, high: v * (B.high - r) / 60 }; }
      const R = def.review;
      return { d, vol: v, mid: v * (B.mid - R.mid) / 60, low: v * (B.low - R.high) / 60, high: v * (B.high - R.low) / 60 };
    });
  }
  function impactSum(sol, days) {
    const rows = impactDaily(sol, days);
    if (!rows) return null;
    const o = { mid: 0, low: 0, high: 0, vol: 0, missing: 0, n: 0, machine: 0 };
    rows.forEach((r) => { if (r.before) return; if (r.gap) { o.missing++; return; } o.mid += r.mid; o.low += r.low; o.high += r.high; o.vol += r.vol; o.n++; if (r.machine !== undefined) o.machine += r.machine * r.vol; });
    o.machineMean = o.vol ? o.machine / o.vol : 0;
    return o;
  }
  const ROLLED = ['doc-workflow', 'shift-planner', 'quote-drafter'];
  function portfolioImpact(days) {
    const t = { mid: 0, low: 0, high: 0 };
    ROLLED.forEach((s) => { const r = impactSum(s, days); t.mid += r.mid; t.low += r.low; t.high += r.high; });
    return t;
  }
  function bucket(points, weekly) {
    if (!weekly) return points.map((p) => Object.assign({ label: dayShort(p.d), from: p.d, to: p.d }, p));
    const out = [];
    points.forEach((p) => {
      const wk = M.addDays(p.d, -((M.weekday(p.d) + 6) % 7));
      let b = out[out.length - 1];
      if (!b || b.wk !== wk) { b = { wk, from: p.d, to: p.d, label: dayShort(wk), mid: 0, low: 0, high: 0, v: 0, has: 0, gaps: 0 }; out.push(b); }
      b.to = p.d;
      if (p.before) return;
      if (p.gap || p.v === null) { b.gaps++; return; }
      b.has++;
      ['mid', 'low', 'high'].forEach((k) => { if (p[k] !== undefined) b[k] += p[k]; });
      if (p.v !== undefined) b.v += p.v;
    });
    out.forEach((b) => { if (!b.has) { b.gap = b.gaps > 0; b.before = b.gaps === 0; } });
    return out;
  }
  const monthWindow = (ym) => { const [y, m] = ym.split('-').map(Number); const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); return M.dayRange(`${ym}-01`, `${ym}-${String(last).padStart(2, '0')}`); };
  function contohMonth(ym) {
    const days = monthWindow(ym);
    const g = sumMetric('doc-workflow', 'documents.generated', days), rc = sumMetric('doc-workflow', 'documents.returned_for_correction', days);
    const ct = seriesOf('invoice-triage', 'invoices.cycle_time_median').filter((p) => p.d <= days[days.length - 1]).slice(-1)[0];
    return { imp: impactSum('doc-workflow', days), docs: g.sum, rate: 100 * rc.sum / g.sum, ct: ct.v, invoices: sumMetric('invoice-triage', 'invoices.triaged', days).sum };
  }

  // the newly connected solution: 14 days of sample figures, made when "the first collection" runs
  function myObservations() {
    let a = 99;
    const r = () => { a = (a * 9301 + 49297) % 233280; return a / 233280; };
    return M.dayRange('2026-10-01', M.LAST_DAY).map((d) => {
      const wd = M.weekday(d), weekend = wd === 0 || wd === 6;
      const n = weekend ? Math.round(3 + r() * 3) : Math.round(32 + r() * 14);
      return { d, v: n, flagged: Math.round(n * (0.09 + r() * 0.05)), secs: 70 + r() * 30 };
    });
  }
  function myImpact() {
    const b = state.wiz.baseline, R = { mid: 8, low: 6, high: 12 };
    const t = { mid: 0, low: 0, high: 0, vol: 0, flagged: 0 };
    state.my.sol.obs.forEach((o) => { const m = o.secs / 60; t.vol += o.v; t.flagged += o.flagged; t.mid += o.v * (b.mid - m - R.mid) / 60; t.low += o.v * (b.low - m - R.high) / 60; t.high += o.v * (b.high - m - R.low) / 60; });
    return t;
  }

  // ------------------------------------------------------------------ charts
  function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
  function drawChart(el, points, opt) {
    if (!el) return;
    const W = Math.max(280, el.clientWidth || 640), H = opt.height || 220;
    const m = { l: 44, r: 12, t: 12, b: 26 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const val = (p) => opt.kind === 'band' ? p.high : p.v;
    const ymax = niceMax(Math.max(...points.filter((p) => !p.gap && !p.before).map(val), 0) * 1.08);
    const y = (v) => m.t + ih - (v / ymax) * ih;
    const n = points.length, bw = iw / n, xc = (i) => m.l + bw * i + bw / 2;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.label)}"><defs><pattern id="h-${opt.id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--s1-soft)"/><line x1="0" y1="0" x2="0" y2="6" stroke="var(--s1)" stroke-width="1.6" opacity=".55"/></pattern></defs>`;
    [0, ymax / 2, ymax].forEach((t) => {
      s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)" stroke-dasharray="${t ? '2 4' : ''}" fill="none"/><text x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end">${nf(t, t % 1 ? 1 : 0)}</text>`;
    });
    [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i).forEach((i, k, arr) => {
      const anchor = k === 0 ? 'start' : k === arr.length - 1 ? 'end' : 'middle';
      s += `<text x="${k === 0 ? m.l : k === arr.length - 1 ? W - m.r : xc(i)}" y="${H - 6}" text-anchor="${anchor}">${esc(points[i].label)}</text>`;
    });
    if (opt.kind === 'band') {
      const segs = []; let cur = [];
      points.forEach((p, i) => { if (p.gap || p.before) { if (cur.length) segs.push(cur); cur = []; } else cur.push([i, p]); });
      if (cur.length) segs.push(cur);
      segs.forEach((sg) => {
        s += `<polygon points="${sg.map(([i, p]) => `${xc(i)},${y(p.high)}`).join(' ')} ${sg.slice().reverse().map(([i, p]) => `${xc(i)},${y(p.low)}`).join(' ')}" fill="url(#h-${opt.id})"/>`;
        s += `<polyline points="${sg.map(([i, p]) => `${xc(i)},${y(p.mid)}`).join(' ')}" fill="none" stroke="var(--s1)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
      });
      points.forEach((p, i) => { if (p.gap) s += `<rect x="${xc(i) - 3}" y="${m.t + ih - 10}" width="6" height="10" rx="2" fill="none" stroke="var(--warn)" stroke-dasharray="2 2"/>`; });
      const li = points.map((p, i) => [i, p]).filter(([, p]) => !p.gap && !p.before).pop();
      if (li) s += `<circle cx="${xc(li[0])}" cy="${y(li[1].mid)}" r="5" fill="var(--s1)" stroke="var(--surface)" stroke-width="2.5"/>`;
    } else {
      points.forEach((p, i) => {
        const w = Math.max(2, bw - (n > 60 ? 1 : n > 20 ? 3 : 8)), x = m.l + bw * i + (bw - w) / 2;
        if (p.before) return;
        if (p.gap) { s += `<rect x="${x}" y="${m.t + ih - 18}" width="${w}" height="18" rx="3" fill="none" stroke="var(--warn)" stroke-dasharray="2 2"/>`; return; }
        s += `<rect x="${x}" y="${y(p.v)}" width="${w}" height="${Math.max(p.v ? 1.5 : 0, m.t + ih - y(p.v))}" rx="${Math.min(4, w / 3)}" fill="var(--s1)"/>`;
      });
    }
    s += `<line class="xh" x1="0" x2="0" y1="${m.t}" y2="${m.t + ih}" stroke="var(--line-strong)" visibility="hidden"/><rect x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="transparent"/></svg>`;
    el.innerHTML = s + '<div class="tip" hidden></div>';
    const svg = $('svg', el), tip = $('.tip', el), xh = $('.xh', el);
    svg.addEventListener('pointermove', (ev) => {
      const r = svg.getBoundingClientRect();
      const i = Math.max(0, Math.min(n - 1, Math.floor(((ev.clientX - r.left) * (W / r.width) - m.l) / bw)));
      const p = points[i];
      xh.setAttribute('x1', xc(i)); xh.setAttribute('x2', xc(i)); xh.setAttribute('visibility', 'visible');
      tip.hidden = false;
      tip.innerHTML = `<b>${esc(p.from === p.to ? day(p.from) : 'Week of ' + day(p.from))}</b>` + opt.tip(p);
      tip.style.left = Math.min(r.width - 180, Math.max(0, (xc(i) / W) * r.width + 12)) + 'px'; tip.style.top = '6px';
    });
    svg.addEventListener('pointerleave', () => { tip.hidden = true; xh.setAttribute('visibility', 'hidden'); });
  }
  function sparkline(values, w = 110, h = 32) {
    const vals = values.filter((v) => v !== null);
    if (!vals.length) return '';
    const max = Math.max(...vals) || 1;
    const x = (i) => 2 + (i / Math.max(1, values.length - 1)) * (w - 6), y = (v) => h - 3 - (v / max) * (h - 6);
    let d = '', pen = false, last = null;
    values.forEach((v, i) => { if (v === null) { pen = false; return; } d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1); pen = true; last = [x(i), y(v)]; });
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true" style="flex:none"><path d="${d}" fill="none" stroke="var(--s1)" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>${last ? `<circle cx="${last[0]}" cy="${last[1]}" r="3" fill="var(--s1)" stroke="var(--surface)" stroke-width="1.5"/>` : ''}</svg>`;
  }

  // ------------------------------------------------------------------ shared UI bits
  const orgById = (id) => M.orgs.find((o) => o.id === id);
  const STATUS = { fresh: ['ok', 'On time'], stale: ['warn', 'Late'], failing: ['fault', 'Not answering'], not_connected: ['idle', 'Not connected'], review: ['info', 'Waiting for approval'], approved: ['info', 'Waiting for first data'], collecting: ['ok', 'Collecting'] };
  const statusPill = (st) => { const [c, w] = STATUS[st]; return `<span class="pill ${c}"><span class="dot"></span>${w}</span>`; };
  const solStatus = (id) => (id === 'doc-workflow' && state.demoState !== 'live') ? state.demoState : M.solutions[id].status;
  const RANGES = { 7: 'Last 7 days', 30: 'Last 30 days', 90: 'Last 90 days', 365: 'Last 12 months' };
  const rangeLabel = () => RANGES[state.range];
  const rangeSeg = () => `<div class="seg" role="group" aria-label="Date range">${[[7, '7D'], [30, '30D'], [90, '90D'], [365, '12M']].map(([v, l]) => `<button type="button" data-range="${v}" aria-pressed="${state.range === v}" aria-label="${RANGES[v]}">${l}</button>`).join('')}</div>`;
  const gate = (ok, label, need, attrs = '', cls = 'btn primary') => ok
    ? `<button ${/type=/.test(attrs) ? '' : 'type="button"'} class="${cls}" ${attrs}>${label}</button>`
    : `<span class="head-actions"><button type="button" class="${cls}" disabled>${label}</button><span class="needs">${need}</span></span>`;
  const head = (o) => `<header class="page-head"><div style="min-width:0">${o.crumbs ? `<nav class="crumbs" aria-label="Breadcrumbs">${o.crumbs}</nav>` : ''}<h1>${o.title}</h1>${o.lead ? `<p class="lead">${o.lead}</p>` : ''}${o.meta ? `<div class="meta-line">${o.meta}</div>` : ''}</div><div class="head-actions">${o.actions || ''}</div></header>`;
  const crumbs = (...parts) => parts.map((p, i) => i < parts.length - 1 ? `<a href="${p[1]}">${esc(p[0])}</a>${icon('chev', 'sm')}` : `<span>${esc(p[0])}</span>`).join('');
  const kv = (rows, w = 130) => `<div class="list">${rows.map(([k, v]) => `<div class="row" style="grid-template-columns:${w}px minmax(0,1fr)"><span class="small muted">${k}</span><span class="small ink">${v}</span></div>`).join('')}</div>`;
  const emptyArt = '<div class="art" style="background-image:url(assets/spot-quiet.svg)"></div>';

  function toast(text, undo) {
    const t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status');
    t.innerHTML = `${icon('check', 'sm')}<span>${esc(text)}</span>${undo ? '<button type="button">Undo</button>' : ''}`;
    if (undo) $('button', t).addEventListener('click', () => { undo(); t.remove(); });
    const box = $('#toasts'); box.appendChild(t); while (box.children.length > 2) box.firstChild.remove();
    setTimeout(() => t.remove(), 5000);
  }
  const auditList = () => demo() ? state.audit : state.myAudit;
  const log = (what, who) => auditList().unshift([now(), who || me().name, what]);
  const go = (h) => { if (location.hash === '#' + h) render(); else location.hash = '#' + h; };

  // ------------------------------------------------------------------ AUTH: sign in and first-run setup
  function authShell(inner) {
    return `<div class="auth">
      <div class="auth-main">
        <div class="logo"><img src="assets/antarax-mark.svg" alt="">Outcomes</div>
        <div class="auth-body"><div class="auth-card">${inner}</div></div>
        <div class="auth-foot"><span>REKA Inisiatif Sdn Bhd · for REKA staff</span><span>Need help? support@go.antarax.ai</span></div>
      </div>
      <aside class="auth-side" aria-hidden="true"><div class="art" style="background-image:url(assets/panel-white.svg)"></div>
        <span class="eyebrow" style="color:var(--hero-ink)"><img src="${SPARK}" alt="">Managed AI, measured</span>
        <h2>Show every client what their AI solution changed.</h2>
        <p>Connect a solution once. Outcomes collects its figures, compares them with the baseline you agreed, and drafts the monthly report for you to check.</p>
        <div class="quote-card"><div class="row" style="border:0;padding:0;display:flex"><span>Hours saved, September</span><span class="mono">Example</span></div><div class="big">1,035 h</div><div class="row" style="border:0;padding:0;display:flex"><span>Estimated · range 572 to 1,421</span><span>vs baseline</span></div></div>
      </aside>
    </div>`;
  }

  const pages = {};
  pages.signin = () => authShell(`
    <div><h1>Sign in to Outcomes</h1><p class="muted" style="margin-top:6px">See what REKA’s client solutions are delivering.</p></div>
    <div class="sso">
      <button type="button" class="btn lg block primary" data-act="signin">${icon('lock')}Continue with REKA account</button>
      <div class="divider">or</div>
      <div class="field"><label for="si-email">Work email</label><input id="si-email" type="email" value="daniel@reka.re" autocomplete="email"></div>
      <button type="button" class="btn lg block" data-act="signin">Email me a sign-in link</button>
    </div>
    <p class="xs muted">Two-step sign-in is on for every account. Everything you do is recorded.</p>`);

  pages.welcome = () => {
    const s = state.setup;
    const dots = `<div class="progress-dots" aria-label="Step ${s.step} of 3">${[1, 2, 3].map((i) => `<span class="${i <= s.step ? 'on' : ''}"></span>`).join('')}</div>`;
    if (s.step === 1) return authShell(`${dots}<div><p class="xs muted">Step 1 of 3</p><h1>Welcome, Daniel</h1><p class="muted" style="margin-top:6px">Let’s set up your workspace. It takes about a minute.</p></div>
        <form id="f-ws" class="grid" style="gap:16px">
          <div class="field"><label for="ws-name">Workspace name</label><input id="ws-name" value="${esc(s.workspace)}" required><span class="help">Usually your company. Clients never see it.</span></div>
          <div class="field"><label for="ws-tz">Reporting time zone</label><select id="ws-tz"><option>Asia/Kuala_Lumpur (MYT)</option><option>Asia/Singapore (SGT)</option><option>Asia/Jakarta (WIB)</option></select><span class="help">Each organisation can use its own.</span></div>
          <div class="callout info">${icon('shield')}<span>Data is kept in Singapore. Outcomes only collects totals, never client documents or personal data.</span></div>
          <button type="submit" class="btn lg primary block">Continue</button>
        </form>`);
    if (s.step === 2) return authShell(`${dots}<div><p class="xs muted">Step 2 of 3</p><h1>Invite your team</h1><p class="muted" style="margin-top:6px">Analysts suggest KPIs. Project managers approve them. You can do this later.</p></div>
        <div class="grid" style="gap:10px">${s.invites.map((v, i) => `<div style="display:grid;grid-template-columns:minmax(0,1fr) 150px;gap:8px" class="field"><input aria-label="Email ${i + 1}" value="${esc(v.email)}" placeholder="name@reka.re"><select aria-label="Role ${i + 1}">${['Analyst', 'Project manager', 'Admin', 'Viewer'].map((r) => `<option ${r === v.role ? 'selected' : ''}>${r}</option>`).join('')}</select></div>`).join('')}
          <button type="button" class="btn ghost" data-act="add-invite" style="justify-self:start">${icon('plus', 'sm')}Add another</button></div>
        <div class="head-actions"><button type="button" class="btn lg primary" data-act="ws-next">Send invites</button><button type="button" class="btn lg ghost" data-act="ws-skip">Skip for now</button></div>`);
    return authShell(`${dots}<div><p class="xs muted">Step 3 of 3</p><h1>How do you want to start?</h1></div>
        <div class="choice-grid">
          <button type="button" class="choice" data-start="new" aria-pressed="false"><span class="ic">${icon('connect-ai')}</span><span><b>Connect my first project</b><span class="d">Add a client, create their project and connect its solution. We’ll guide you.</span></span><span class="pill info tag">Recommended</span></button>
          <button type="button" class="choice" data-start="demo" aria-pressed="false"><span class="ic">${icon('overview')}</span><span><b>Explore with example data</b><span class="d">A workspace with five clients already running. Every figure is invented.</span></span><span class="radio"></span></button>
        </div>`);
  };

  // ------------------------------------------------------------------ APP SHELL
  function navHtml(route) {
    const waiting = (demo() ? state.approvals : state.myApprovals).filter((a) => a.status === 'waiting').length;
    const items = [['home', 'Home', 'home'], ['organisations', 'Organisations', 'organisation'], ['approvals', 'Approvals', 'shield', waiting, has('Approve')], ['reports', 'Reports', 'reports', demo() && !state.reportApproved ? 1 : 0]];
    const isCur = (k) => route === k || (k === 'organisations' && /^(new-organisation|new-project|connect)$/.test(route)) || (k === 'reports' && route === 'report');
    const sub = (href, label) => `<a class="sub" href="#${href}" ${route === href ? 'aria-current="page"' : ''}>${esc(label)}</a>`;
    let subs = '';
    if (demo()) subs = sub('organisation-contoh-logistik', 'Contoh Logistik') + sub('solution-doc-workflow', 'Document workflow');
    else if (state.my.org) subs = sub('organisation-mine', state.my.org.name) + (state.my.sol ? sub('solution-mine', state.my.sol.name) : '');
    return items.map(([k, l, ic, c, loud], i) => `<a href="#${k}" ${isCur(k) ? 'aria-current="page"' : ''}>${icon(ic)}<span>${l}</span>${c ? `<span class="count ${loud ? 'loud' : ''}" aria-label="${c} waiting">${c}</span>` : ''}</a>${i === 1 ? subs : ''}`).join('')
      + `<span class="grp">Workspace</span><a href="#settings" ${route === 'settings' ? 'aria-current="page"' : ''}>${icon('settings')}<span>Settings</span></a><a href="#guide" ${route === 'guide' ? 'aria-current="page"' : ''}>${icon('ask')}<span>Help</span></a>`;
  }
  function bellHtml() {
    const item = (cls, ic, t, s, h) => `<a href="${h}"><span class="ico ${cls}" style="display:grid;place-items:center;width:32px;height:32px;border-radius:10px;flex:none">${icon(ic, 'sm')}</span><span><b class="ink">${t}</b><small>${s}</small></span></a>`;
    if (demo()) return '<h4>Notifications</h4>' + item('fault', 'alerts', 'Quote drafter stopped answering', 'Bina Jaya · 14 Oct, 22:00', '#solution-quote-drafter') + item('warn', 'shield', 'Baseline change waiting for you', 'Contoh Logistik · 13 Oct', '#approvals') + item('info', 'reports', 'September report drafted', 'Contoh Logistik · ready to review', '#report');
    if (state.myApprovals.length) return '<h4>Notifications</h4>' + item('info', 'shield', 'KPIs sent for approval', `${esc(state.my.sol.name)} · Aisyah Rahman`, '#approvals');
    return '<div class="empty" style="padding:20px"><p>No notifications yet. Alerts about your solutions appear here.</p></div>';
  }
  function appShell(route, inner) {
    const u = me(), theme = document.documentElement.getAttribute('data-theme') || 'system';
    return `<a class="skip" href="#view">Skip to content</a>
    <div class="app">
      <aside class="sidebar" id="sidebar" aria-label="Navigation">
        <div class="brand"><img src="assets/antarax-mark.svg" alt=""><div><b>Outcomes</b><small>REKA Managed AI</small></div></div>
        <div class="rel"><button type="button" class="btn primary new-btn" data-act="new-menu" aria-haspopup="true">${icon('plus', 'sm')}New</button>
          <div class="pop" id="new-pop" hidden style="left:0;right:auto;top:48px;width:100%"><a href="#new-organisation">${icon('organisation', 'sm')}<span>Organisation</span></a><a href="#new-project">${icon('projects', 'sm')}<span>Project</span></a><a href="#connect">${icon('connect-ai', 'sm')}<span>Connect a solution</span></a></div></div>
        <nav class="nav" aria-label="Main">${navHtml(route)}</nav>
        <div class="workspace"><span class="ws">${initials(state.setup.workspace)}</span><div style="min-width:0"><b>${esc(state.setup.workspace)}</b><span>${demo() ? 'Example data' : 'Your workspace'}</span></div></div>
      </aside>
      <div class="scrim" id="scrim" hidden></div>
      <div class="main">
        <header class="topbar">
          <button type="button" class="icon-btn menu-btn" id="menu-btn" aria-label="Open navigation" aria-controls="sidebar">${icon('menu')}</button>
          <button type="button" class="search" data-act="palette">${icon('search', 'sm')}<span class="t">Search organisations, solutions, pages</span><kbd>⌘K</kbd></button>
          <div class="top-right">
            ${demo() ? '<span class="pill warn" title="Every figure is invented">Example data</span>' : ''}
            <div class="rel"><button type="button" class="icon-btn" data-act="bell" aria-label="Notifications">${icon('bell')}${demo() || state.myApprovals.length ? '<span class="badge"></span>' : ''}</button><div class="pop" id="bell-pop" hidden>${bellHtml()}</div></div>
            <div class="rel"><button type="button" class="user-btn" data-act="user" aria-haspopup="true"><span class="avatar">${u.initials}</span><span class="nm">${u.name}</span>${icon('chev-down', 'sm')}</button>
              <div class="pop" id="user-pop" hidden>
                <h4>Signed in as</h4>${Object.values(M.staff).map((s) => `<button type="button" data-role="${s.id}" aria-pressed="${s.id === state.role}"><span class="avatar">${s.initials}</span><span><b class="ink">${s.name}</b><small>${s.note}</small></span></button>`).join('')}
                <p class="xs muted" style="padding:2px 10px 6px">Mock only: switch person to see how permissions change.</p>
                <hr><h4>Appearance</h4><div style="padding:4px 10px 8px"><div class="seg">${[['light', 'Light'], ['dark', 'Dark'], ['system', 'System']].map(([v, l]) => `<button type="button" data-theme-set="${v}" aria-pressed="${theme === v}">${l}</button>`).join('')}</div></div>
                <hr><button type="button" data-act="switch-mode">${icon('overview', 'sm')}<span>${demo() ? 'Back to my workspace' : 'Open the example workspace'}</span></button>
                <button type="button" data-act="signout">${icon('logout', 'sm')}<span>Sign out</span></button>
              </div></div>
          </div>
        </header>
        <main class="content" id="view" tabindex="-1">${inner}</main>
      </div>
    </div>
    <div id="palette" hidden></div>`;
  }

  // ------------------------------------------------------------------ HOME
  pages.home = () => demo() ? homeDemo() : homeNew();
  function setupSteps() {
    const my = state.my, st = my.sol ? my.sol.stage : null;
    return [
      { t: 'Set up your workspace', d: 'Name, time zone and team.', done: true },
      { t: 'Add your first organisation', d: 'The client, and their data agreement.', done: !!my.org, href: '#new-organisation', cta: 'Add organisation' },
      { t: 'Create a project', d: 'What the solution is for, in the client’s words.', done: !!my.project, href: '#new-project', cta: 'Create project' },
      { t: 'Connect the solution', d: 'Check its data, choose KPIs and record the baseline.', done: !!my.sol, href: '#connect', cta: 'Connect' },
      { t: 'Get the KPIs approved', d: 'Someone else checks every KPI and baseline.', done: st === 'approved' || st === 'collecting', href: my.sol ? '#solution-mine' : '#approvals', cta: 'Check status' },
      { t: 'See your first results', d: 'Figures arrive after the first nightly collection.', done: st === 'collecting', href: '#solution-mine', cta: 'Open solution' },
      { t: 'Schedule the client report', d: 'Drafted for you. Nothing goes out until you check it.', done: my.reportScheduled, href: '#reports', cta: 'Schedule' },
    ];
  }
  function homeNew() {
    const steps = setupSteps(), done = steps.filter((s) => s.done).length, next = steps.find((s) => !s.done);
    return `
    ${head({ title: `Good morning, ${me().name.split(' ')[0]}`, lead: `Thursday 15 October 2026 · ${esc(state.setup.workspace)}` })}
    <section class="grid g-side">
      <div class="card">
        <div class="card-head"><div style="display:flex;gap:16px;align-items:center"><div class="ring" style="--p:${Math.round(100 * done / steps.length)}"><span>${done}/${steps.length}</span></div><div><h2>${next ? 'Get your first project measured' : 'Your first project is being measured'}</h2><p class="small muted">${next ? `Next: ${esc(next.t.toLowerCase())}.` : 'Every step is done. Nice work.'}</p></div></div></div>
        <div class="setup">${steps.map((s, i) => `<div class="step ${s.done ? 'done' : s === next ? 'now' : ''}"><span class="n">${s.done ? icon('check', 'sm') : i + 1}</span><div><div class="t">${s.t}</div><div class="d">${s.d}</div></div>${s.done ? '<span class="pill ok">Done</span>' : `<a class="btn ${s === next ? 'primary' : ''} sm" href="${s.href}">${s.cta}</a>`}</div>`).join('')}</div>
      </div>
      <div class="grid" style="gap:16px;align-content:start">
        <div class="card"><h3>How it works</h3><div class="list" style="margin-top:10px">
          ${[['connect-ai', 'Connect', 'The solution shares a few daily totals through a small read-only link. Its own code and data stay as they are.'], ['target', 'Agree', 'Choose KPIs and baselines with the client. Someone else approves them.'], ['savings', 'Measure', 'Each KPI is worked out every night. You can always see what is measured and what is estimated.'], ['reports', 'Report', 'A report is drafted for you. You check it before the client sees it.']].map(([ic, t, d]) => `<div class="row" style="grid-template-columns:36px minmax(0,1fr)"><span class="ico info">${icon(ic, 'sm')}</span><div><div class="what">${t}</div><div class="meta">${d}</div></div></div>`).join('')}</div></div>
        <div class="card"><h3>Want to look around first?</h3><p class="small muted" style="margin:6px 0 12px">Open a workspace with five example clients already running.</p><button type="button" class="btn sm" data-act="switch-mode">Open example workspace</button></div>
      </div>
    </section>
    ${state.my.org ? `<section class="card"><div class="card-head"><h2>Your organisations</h2></div>${myOrgTable()}</section>` : ''}`;
  }
  function myOrgTable() {
    const my = state.my;
    return `<div class="table-wrap"><table><thead><tr><th>Organisation</th><th>Project</th><th>Solution</th><th>Status</th></tr></thead><tbody>
      <tr class="link" data-go="organisation-mine" tabindex="0"><td><span class="name">${esc(my.org.name)}</span><span class="sub">${esc(my.org.industry)}</span></td><td>${my.project ? esc(my.project.name) : '<span class="muted">None yet</span>'}</td><td>${my.sol ? esc(my.sol.name) : '<span class="muted">Not connected</span>'}</td><td>${statusPill(my.sol ? my.sol.stage : 'not_connected')}</td></tr></tbody></table></div>`;
  }
  function homeDemo() {
    const days = windowDays(state.range);
    const imp = portfolioImpact(days), prev = portfolioImpact(windowDays(state.range, M.addDays(M.LAST_DAY, -state.range)));
    const items = [['doc-workflow', 'documents.generated'], ['invoice-triage', 'invoices.triaged'], ['quote-drafter', 'quotes.drafted'], ['shift-planner', 'plans.generated'], ['enquiry-triage', 'enquiries.received']].reduce((a, [s, k]) => a + sumMetric(s, k, days).sum, 0);
    const waiting = state.approvals.filter((a) => a.status === 'waiting').length;
    const change = prev.mid > 0 && state.range < 90 ? Math.round(100 * (imp.mid - prev.mid) / prev.mid) : null;
    const att = [
      ['fault', 'alerts', 'Quote drafter stopped answering', 'Bina Jaya · since 14 Oct, 22:00', '#solution-quote-drafter', 'Check'],
      ['warn', 'clock', 'Shift planner hasn’t sent data for 2 days', 'Acme Plastics · showing the last good figures', '#solution-shift-planner', 'Open'],
      ['warn', 'shield', `${waiting} item${waiting === 1 ? '' : 's'} waiting for approval`, has('Approve') ? 'Some are yours to decide' : 'A project manager decides', '#approvals', 'Review'],
      ['info', 'target', 'Front-desk hours saved needs a baseline', 'Sampel Medik · impact can’t be shown yet', '#approvals', 'Add'],
      ['info', 'reports', state.reportApproved ? 'September report approved' : 'September report is ready to review', 'Contoh Logistik · due 17 Oct', '#report', 'Open'],
    ];
    const projects = [['contoh-logistik', 'doc-workflow'], ['acme-plastics', 'shift-planner'], ['bina-jaya', 'quote-drafter'], ['sampel-medik', 'enquiry-triage'], ['teladan-properties', 'lease-reader']];
    return `
    ${head({ title: `Good morning, ${me().name.split(' ')[0]}`, lead: 'Here’s what your clients’ solutions delivered, and what needs you.', actions: rangeSeg() })}
    <section class="grid g4 stats">
      <div class="card stat"><span class="label">Hours saved ${q('estimated')}</span><span class="value">${nf(imp.mid)}<small>h</small></span><span class="hint">${change !== null ? `<span class="delta">${change >= 0 ? '▲' : '▼'} ${Math.abs(change)}%</span> vs previous · ` : ''}range ${nf(imp.low)} to ${nf(imp.high)}</span></div>
      <div class="card stat"><span class="label">Work handled ${q('measured')}</span><span class="value">${nf(items)}</span><span class="hint">Documents, invoices, plans, enquiries, quotes</span></div>
      <div class="card stat"><span class="label">Solutions sending data</span><span class="value">3<small>of 6</small></span><span class="hint">1 late · 1 not answering · 1 not connected</span></div>
      <div class="card stat"><span class="label">KPIs live</span><span class="value">12<small>of 16</small></span><span class="hint">${waiting} waiting for approval</span></div>
    </section>
    <section class="grid g-main">
      <div class="card"><div class="card-head"><div><h2>Hours saved</h2><p class="sub">${rangeLabel()} · every client with an approved baseline</p></div></div>
        <div class="chart" id="ch-home"></div>
        <div class="legend"><span><i style="background:var(--s1)"></i>Hours saved</span><span><i style="background:repeating-linear-gradient(135deg,var(--s1) 0 2px,var(--s1-soft) 2px 5px)"></i>Likely range</span><span><i style="box-shadow:inset 0 0 0 1.5px var(--warn)"></i>No data that day, not zero</span></div></div>
      <div class="card"><div class="card-head"><h2>Needs you</h2><span class="pill idle">${att.length}</span></div>
        <div class="list">${att.map(([sev, ic, t, m, h, a]) => `<div class="row"><span class="ico ${sev}">${icon(ic, 'sm')}</span><div><div class="what">${esc(t)}</div><div class="meta">${esc(m)}</div></div><a class="btn sm" href="${h}">${a}</a></div>`).join('')}</div></div>
    </section>
    <section class="grid" style="gap:12px">
      <div class="card-head" style="margin:0"><h2>Projects</h2><a class="btn sm ghost" href="#organisations">All organisations${icon('chev', 'sm')}</a></div>
      <div class="grid g3">${projects.map(([o, s]) => projCard(o, s, days)).join('')}
        <a class="card proj" href="#connect" style="border-style:dashed;place-content:center;justify-items:center;text-align:center;min-height:200px;box-shadow:none"><span class="ico info" style="width:44px;height:44px;border-radius:12px;display:grid;place-items:center">${icon('plus')}</span><b class="ink">Connect another solution</b><span class="small muted">About a day of developer time</span></a>
      </div>
    </section>
    <section class="card"><div class="card-head"><h2>Recent activity</h2><a class="btn sm ghost" href="#settings">Audit trail${icon('chev', 'sm')}</a></div>
      <div class="list">${auditList().slice(0, 5).map(([t, w, what]) => `<div class="row"><span class="avatar">${w === 'Collector' ? icon('live', 'sm') : w === 'AI proposals' ? `<img src="${SPARK}" alt="" style="width:16px">` : initials(w.split(' · ')[0])}</span><div class="small"><b class="ink">${esc(w.split(' · ')[0])}</b> ${esc(what)}</div><span class="xs muted mono">${esc(t.replace(' 2026,', ''))}</span></div>`).join('')}</div></section>`;
  }
  function projCard(oid, sid, days) {
    const o = orgById(oid), s = M.solutions[sid], st = solStatus(sid);
    let fig, spark = '';
    if (M.impact[sid]) {
      const r = impactSum(sid, days);
      fig = `<div class="stat"><span class="label">Hours saved ${q('estimated')}</span><span class="value ${st !== 'fresh' ? 'stale-val' : ''}" style="font-size:1.5rem">${nf(r.mid)}<small>h</small></span></div>`;
      spark = sparkline(bucket(impactDaily(sid, windowDays(Math.min(state.range, 90))), state.range > 30).map((p) => (p.gap || p.before) ? null : p.mid));
    } else fig = `<div class="stat"><span class="label">Hours saved</span><span class="value" style="font-size:1.5rem">${dash()}</span><span class="hint">${sid === 'enquiry-triage' ? 'Needs a baseline' : 'Not connected yet'}</span></div>`;
    const k = s.kpis;
    return `<a class="card proj" href="#${sid === 'lease-reader' ? 'organisation-teladan-properties' : 'solution-' + sid}">
      <div class="top"><div><div class="org">${esc(o.short)}</div><h3>${esc(o.projects[0].name)}</h3></div>${statusPill(st)}</div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:10px">${fig}${spark}</div>
      <div><div class="xs muted" style="display:flex;justify-content:space-between;margin-bottom:6px"><span>KPIs live</span><span class="mono">${k.approved} of ${k.total || '–'}</span></div><div class="bar-track"><div class="bar-fill" style="width:${k.total ? 100 * k.approved / k.total : 0}%"></div></div></div>
    </a>`;
  }
  pages.home.after = () => {
    if (!demo()) return;
    const daily = windowDays(state.range).map((d) => {
      const parts = ROLLED.map((s) => impactDaily(s, [d])[0]), ok = parts.filter((p) => !p.gap && !p.before);
      if (!ok.length) return { d, gap: parts.some((p) => p.gap), before: parts.every((p) => p.before) };
      return { d, mid: ok.reduce((a, p) => a + p.mid, 0), low: ok.reduce((a, p) => a + p.low, 0), high: ok.reduce((a, p) => a + p.high, 0) };
    });
    drawChart($('#ch-home'), bucket(daily, state.range > 30), { id: 'home', kind: 'band', label: 'Hours saved across clients', height: 240,
      tip: (p) => p.before ? '<div>Before collection started</div>' : p.gap ? '<div>No data. Not counted as zero.</div>' : `<div>Hours saved <span class="mono">${nf(p.mid)}</span></div><div class="muted">Likely ${nf(p.low)} to ${nf(p.high)}</div>` });
  };

  // ------------------------------------------------------------------ ORGANISATIONS
  pages.organisations = () => {
    if (!demo()) return `${head({ title: 'Organisations', lead: 'The clients whose solutions you measure.', actions: `<a class="btn primary" href="#new-organisation">${icon('plus', 'sm')}Add organisation</a>` })}
      ${state.my.org ? `<section class="card">${myOrgTable()}</section>` : `<section class="card"><div class="empty">${emptyArt}<h3>No organisations yet</h3><p>Start with the client. You record their data agreement here, because nothing is collected until it is signed.</p><a class="btn primary" href="#new-organisation">${icon('plus', 'sm')}Add organisation</a></div></section>`}`;
    const days = windowDays(state.range);
    return `${head({ title: 'Organisations', lead: 'Every client, their projects and how their solutions are doing.', actions: `${rangeSeg()}<a class="btn primary" href="#new-organisation">${icon('plus', 'sm')}Add organisation</a>` })}
    <section class="card"><div class="table-wrap"><table><thead><tr><th>Organisation</th><th>Stage</th><th>Data</th><th>KPIs live</th><th>Hours saved, ${rangeLabel().toLowerCase()}</th>${has('Commercial') ? '<th>Monthly fee</th>' : ''}<th>Renewal</th></tr></thead><tbody>
    ${M.orgs.map((o) => { const sols = o.projects.flatMap((p) => p.solutions), worst = ['failing', 'stale', 'not_connected', 'fresh'].find((st) => sols.some((s) => solStatus(s) === st)), k = sols.reduce((a, s) => [a[0] + M.solutions[s].kpis.approved, a[1] + M.solutions[s].kpis.total], [0, 0]), rolled = sols.filter((s) => ROLLED.includes(s)), hs = rolled.length ? rolled.reduce((a, s) => a + impactSum(s, days).mid, 0) : null;
      return `<tr class="link" data-go="organisation-${o.id}" tabindex="0"><td><div style="display:flex;gap:10px;align-items:center"><span class="avatar" style="border-radius:10px">${initials(o.short)}</span><div><span class="name">${esc(o.name)}</span><span class="sub">${esc(o.projects[0].name)}</span></div></div></td><td><span class="pill ${o.stage === 'live' ? 'info' : 'idle'}">${o.stage[0].toUpperCase() + o.stage.slice(1)}</span></td><td>${statusPill(worst)}</td><td class="mono">${k[0]} of ${k[1] || '–'}</td><td>${hs !== null ? `<span class="mono ink">${nf(hs)} h</span> ${q('estimated')}` : dash(o.stage === 'planning' ? 'Not connected' : 'Needs a baseline')}</td>${has('Commercial') ? `<td class="mono">${money(o.contract.amount, o.contract.currency)}</td>` : ''}<td class="mono">${o.renewal}</td></tr>`; }).join('')}
    </tbody></table></div></section>`;
  };

  pages['new-organisation'] = () => `
    ${head({ crumbs: crumbs(['Organisations', '#organisations'], ['Add organisation']), title: 'Add an organisation', lead: 'The client whose solution you’ll measure.' })}
    <form id="f-org" class="card narrow grid" style="gap:24px" novalidate>
      <div class="form-grid">
        <div class="field full"><label for="o-name">Organisation name</label><input id="o-name" placeholder="e.g. Teladan Properties" value="Teladan Properties" required><span class="help" id="o-name-help">As it appears on their contract.</span></div>
        <div class="field"><label for="o-ind">Industry</label><select id="o-ind"><option>Property and real estate</option><option>Logistics</option><option>Manufacturing</option><option>Healthcare</option><option>Engineering and construction</option><option>Other</option></select></div>
        <div class="field"><label for="o-tz">Time zone</label><select id="o-tz"><option>Asia/Kuala_Lumpur (MYT)</option><option>Asia/Singapore (SGT)</option></select><span class="help">Their reports use this.</span></div>
        <div class="field"><label for="o-contact">Main contact</label><input id="o-contact" value="Farah Idris"></div>
        <div class="field"><label for="o-email">Contact email</label><input id="o-email" type="email" value="farah@teladan.example"></div>
      </div>
      <div class="grid" style="gap:10px;border-top:1px solid var(--line);padding-top:20px"><h3>Data agreement</h3>
        <p class="small muted">Outcomes only collects totals, and only after the client agrees in writing.</p>
        <label class="check"><input type="checkbox" id="o-signed" checked><span><b class="ink">The client has signed the data agreement</b><br><span class="small muted">Signed 2 Oct 2026 · totals only · kept in Singapore · for the contract plus 24 months</span></span></label>
      </div>
      <div class="wfoot"><a class="btn ghost" href="#organisations">Cancel</a><button type="submit" class="btn primary lg">Add organisation</button></div>
    </form>`;
  pages['new-organisation'].after = () => {
    $('#f-org').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#o-name').value.trim();
      if (!name) { $('#o-name').setAttribute('aria-invalid', 'true'); const h = $('#o-name-help'); h.textContent = 'Add the organisation’s name to continue.'; h.style.color = 'var(--fault-ink)'; $('#o-name').focus(); return; }
      state.mode = 'new';
      state.my.org = { name, industry: $('#o-ind').value, signed: $('#o-signed').checked };
      log(`Added organisation ${name}`);
      go('organisation-mine'); toast(`${name} added.`);
    });
  };

  const TEMPLATES = {
    documents: ['documents', 'Document processing', 'Reading, writing or checking documents.', 'Pull the key terms out of every lease without reading it end to end.'],
    triage: ['ask', 'Enquiry or ticket triage', 'Sorting and answering incoming requests.', 'Answer routine enquiries faster, and route the rest to the right desk.'],
    planning: ['plan', 'Planning and forecasting', 'Building plans, schedules or forecasts.', 'Cut the time spent building weekly plans.'],
    other: ['flask', 'Something else', 'You’ll choose the measures yourself.', ''],
  };
  pages['new-project'] = () => {
    if (!state.my.org) return `${head({ title: 'Create a project' })}<section class="card"><div class="empty">${emptyArt}<h3>Add an organisation first</h3><p>A project belongs to a client.</p><a class="btn primary" href="#new-organisation">Add organisation</a></div></section>`;
    const t = TEMPLATES[state.newTemplate];
    return `
    ${head({ crumbs: crumbs([state.my.org.name, '#organisation-mine'], ['New project']), title: 'Create a project', lead: 'What you agreed to deliver for the client. Its solutions are measured against it.' })}
    <form id="f-proj" class="card narrow grid" style="gap:24px" novalidate>
      <div class="field"><label for="p-name">Project name</label><input id="p-name" value="${esc(state.draftProj || 'Lease abstraction')}" required><span class="help" id="p-name-help">Use the name the client uses.</span></div>
      <div class="grid" style="gap:10px"><span class="lab ink" style="font-weight:500">What kind of work does it take on?</span><p class="small muted" style="margin-top:-6px">We use this to suggest KPIs that fit. You can change any of them.</p>
        <div class="grid g2" style="gap:10px">${Object.entries(TEMPLATES).map(([k, [ic, n, d]]) => `<button type="button" class="choice" style="grid-template-columns:44px minmax(0,1fr)" data-tpl="${k}" aria-pressed="${state.newTemplate === k}"><span class="ic">${icon(ic)}</span><span><b>${n}</b><span class="d">${d}</span></span></button>`).join('')}</div></div>
      <div class="form-grid">
        <div class="field full"><label for="p-obj">The outcome the client wants, in their words</label><textarea id="p-obj">${esc(t[3])}</textarea><span class="help">This goes at the top of every report.</span></div>
        <div class="field"><label for="p-live">Planned go-live</label><input id="p-live" value="3 Nov 2026"></div>
        <div class="field"><label for="p-owner">Project owner</label><select id="p-owner"><option>Daniel Lim</option><option>Aisyah Rahman</option></select></div>
        <div class="field"><label for="p-cad">Client report</label><select id="p-cad"><option>Monthly</option><option>Quarterly</option></select></div>
      </div>
      <div class="wfoot"><a class="btn ghost" href="#organisation-mine">Cancel</a><button type="submit" class="btn primary lg">Create project</button></div>
    </form>`;
  };
  pages['new-project'].after = () => {
    const f = $('#f-proj'); if (!f) return;
    $('#p-name').addEventListener('input', (e) => { state.draftProj = e.target.value; });
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#p-name').value.trim();
      if (!name) { $('#p-name').setAttribute('aria-invalid', 'true'); const h = $('#p-name-help'); h.textContent = 'Give the project a name to continue.'; h.style.color = 'var(--fault-ink)'; return; }
      state.my.project = { name, template: state.newTemplate, objective: $('#p-obj').value.trim(), live: $('#p-live').value, cadence: $('#p-cad').value };
      log(`Created project ${name} for ${state.my.org.name}`);
      go('organisation-mine'); toast('Project created.');
    });
  };

  function myOrgPage() {
    const my = state.my;
    if (!my.org) return pages.organisations();
    const p = my.project, s = my.sol;
    return `
    ${head({ crumbs: crumbs(['Organisations', '#organisations'], [my.org.name]), title: `<span style="display:inline-flex;gap:12px;align-items:center"><span class="avatar lg" style="border-radius:12px">${initials(my.org.name)}</span>${esc(my.org.name)}</span>`,
      meta: `<span>${esc(my.org.industry)}</span>${my.org.signed ? `<span class="pill ok">${icon('check', 'sm')}Data agreement signed</span>` : '<span class="pill warn">Data agreement not signed</span>'}`,
      actions: p ? '' : `<a class="btn primary" href="#new-project">${icon('plus', 'sm')}Create project</a>` })}
    ${!my.org.signed ? `<div class="callout warn">${icon('alerts')}<span><b>Nothing will be collected yet.</b> Record the signed data agreement first.</span></div>` : ''}
    ${!p ? `<section class="card"><div class="empty">${emptyArt}<h3>No projects yet</h3><p>Create the project you agreed with ${esc(my.org.name)}. You’ll connect its solution next.</p><a class="btn primary" href="#new-project">${icon('plus', 'sm')}Create project</a></div></section>` : `
    <section class="card">
      <div class="card-head"><div><p class="xs muted">Project</p><h2>${esc(p.name)}</h2></div><span class="pill idle">${TEMPLATES[p.template][1]}</span></div>
      ${p.objective ? `<p class="ink" style="max-width:70ch;font-size:1rem">“${esc(p.objective)}”</p>` : ''}
      <div class="meta-line"><span>Go-live ${esc(p.live)}</span><span>${esc(p.cadence)} report</span><span>Owner: Daniel Lim</span></div>
      <div style="margin-top:18px;border-top:1px solid var(--line);padding-top:18px">
      ${s ? `<div class="row" style="border:0;padding:0"><span class="ico info">${icon('box', 'sm')}</span><div><div class="what">${esc(s.name)}</div><div class="meta">${statusPill(s.stage)}<span>${s.kpis.length} KPIs</span></div></div><a class="btn sm" href="#solution-mine">Open</a></div>`
      : `<div class="empty" style="padding:12px"><h3>Next: connect the solution</h3><p>Check its data, pick the KPIs that matter and record the baseline. About 10 minutes once the developer has added the link.</p><a class="btn primary" href="#connect">${icon('connect-ai', 'sm')}Connect solution</a></div>`}
      </div>
    </section>`}`;
  }

  pages.organisation = (id) => {
    if (id === 'mine') return myOrgPage();
    const o = orgById(id), days = windowDays(state.range), sols = o.projects.flatMap((p) => p.solutions), isContoh = o.id === 'contoh-logistik';
    const rolled = sols.filter((s) => ROLLED.includes(s));
    const tot = rolled.length ? rolled.map((s) => impactSum(s, days)).reduce((a, b) => ({ mid: a.mid + b.mid, low: a.low + b.low, high: a.high + b.high }), { mid: 0, low: 0, high: 0 }) : null;
    const client = state.audience === 'client';
    const sep = isContoh ? contohMonth('2026-09') : null, aug = isContoh ? contohMonth('2026-08') : null;
    const cards = sols.flatMap((s) => kpiCards(s, days).map((c) => Object.assign({ sol: s }, c))).filter((c) => !(client && c.quality === 'unavailable'));
    const canNarr = has('Approve') && state.role !== 'nurul';
    const narrative = !isContoh ? '' : (client && !state.narrativeApproved) ? `<section class="card"><div class="empty" style="padding:20px"><h3>Summary not shared yet</h3><p>The September summary is still a draft. The client sees it once it’s approved.</p></div></section>` : `
      <section class="card ai-card"><div class="card-head"><span class="eyebrow"><img src="${SPARK}" alt="">September 2026 in brief</span>${state.narrativeApproved ? '<span class="pill ok"><span class="dot"></span>Approved</span>' : '<span class="pill warn"><span class="dot"></span>Draft</span>'}</div>
        <div class="narrative">
          <p>The document workflow finished <b class="mono">${nf(sep.docs)}</b> documents in September, up from <span class="mono">${nf(aug.docs)}</span> in August <span class="cite">Documents processed</span>. Against the timed baseline, that freed an estimated <b class="mono">${nf(sep.imp.mid)} hours</b> of preparation time, likely between <span class="mono">${nf(sep.imp.low)}</span> and <span class="mono">${nf(sep.imp.high)}</span> <span class="cite">Hours saved</span>.</p>
          <p>Fewer documents came back for correction: <span class="mono">${nf(sep.rate, 1)}%</span>, from <span class="mono">${nf(aug.rate, 1)}%</span> in August and <span class="mono">7.4%</span> before go-live. Invoices took <span class="mono">${nf(sep.ct, 1)} days</span> by month end, from <span class="mono">4.5</span> before.</p>
          <p class="small muted">21 and 22 September are missing and aren’t counted. These figures compare with the baseline. They don’t prove what caused the change.</p>
        </div>
        <div class="wfoot" style="margin-top:14px">${aiMark('Drafted by AI from the calculated figures. Every number checked.')}${state.narrativeApproved || client ? '' : gate(canNarr, 'Approve summary', state.role === 'nurul' ? 'You edited this, so someone else approves.' : 'Needs approval rights', 'data-act="approve-narrative"', 'btn primary sm')}</div>
      </section>`;
    return `
    ${head({ crumbs: crumbs(['Organisations', '#organisations'], [o.short]), title: `<span style="display:inline-flex;gap:12px;align-items:center"><span class="avatar lg" style="border-radius:12px">${initials(o.short)}</span>${esc(o.name)}</span>`,
      meta: `<span>${esc(o.projects[0].name)}</span><span class="pill ${o.stage === 'live' ? 'info' : 'idle'}">${o.stage[0].toUpperCase() + o.stage.slice(1)}</span>${o.renewal !== '–' ? `<span>Renews ${o.renewal}</span>` : ''}`,
      actions: o.stage === 'planning' ? '' : `<div class="seg" role="group" aria-label="View as"><button type="button" data-aud="staff" aria-pressed="${!client}">Team view</button><button type="button" data-aud="client" aria-pressed="${client}">Client view</button></div>${rangeSeg()}` })}
    ${client ? `<div class="callout info">${icon('client-view')}<span><b>You’re seeing what ${esc(o.short)} sees.</b> Fees, internal notes and anything not yet approved are hidden.</span></div>` : ''}
    ${o.stage === 'planning' ? `<section class="card"><div class="empty">${emptyArt}<h3>Lease reader isn’t connected yet</h3><p>Connect it to start measuring. You’ll check its data, choose KPIs and record the baseline.</p><a class="btn primary" href="#connect">${icon('connect-ai', 'sm')}Connect solution</a></div></section>` : `
    <section class="grid g-main">
      <div class="card"><p class="xs muted">The outcome they want</p><h2 style="max-width:56ch;margin:4px 0 16px">${esc(o.projects[0].objective)}</h2>
        ${tot ? `<div class="stat"><span class="label">Hours saved, ${rangeLabel().toLowerCase()} ${q('estimated')}</span><span class="value">${nf(tot.mid)}<small>h</small></span><span class="hint">Likely ${nf(tot.low)} to ${nf(tot.high)}</span></div>${isContoh ? '<div class="chart" id="ch-org" style="margin-top:12px"></div>' : ''}` : `<div class="stat"><span class="label">Hours saved</span><span class="value">${dash()}</span><span class="hint">Needs a baseline before it can be shown.</span></div>`}
      </div>
      <div class="card"><h3>How the totals are counted</h3><div style="margin-top:8px">${kv(isContoh ? [['Hours saved', 'Only Document workflow. Invoice triage touches the same work, so adding it would count hours twice.'], ['Documents', 'Added across solutions.'], ['People using it', 'Each person counted once.'], ['Rates', 'Worked out from the totals, never an average of averages.']] : [['Hours saved', rolled.length ? 'One solution, added up by day.' : 'Nothing yet: no approved baseline.']], 110)}</div></div>
    </section>
    ${narrative}
    ${sols.map((sid) => { const cs = cards.filter((c) => c.sol === sid); return cs.length ? `<section class="grid" style="gap:12px"><div class="card-head" style="margin:0"><h2>${esc(M.solutions[sid].name)}</h2><span class="head-actions">${statusPill(solStatus(sid))}<a class="btn sm" href="#solution-${sid}">Open${icon('chev', 'sm')}</a></span></div><div class="grid ${cs.length >= 4 ? 'g4' : cs.length === 3 ? 'g3' : 'g2'}">${cs.map(kpiCardHtml).join('')}</div></section>` : ''; }).join('')}`}
    ${client ? '' : `<section class="grid g2">
      <div class="card"><div class="card-head"><h2>Contract</h2><span class="pill idle">${icon('lock', 'sm')}REKA only</span></div>
        ${has('Commercial') ? `<div class="grid g2"><div class="stat"><span class="label">Monthly fee</span><span class="value" style="font-size:1.375rem">${money(o.contract.amount, o.contract.currency)}</span></div><div class="stat"><span class="label">Running cost, September</span><span class="value" style="font-size:1.375rem">${o.runCost ? money(o.runCost.amount, o.runCost.currency) : '–'}</span><span class="hint">From AX Frame</span></div><div class="stat"><span class="label">Renewal</span><span class="value" style="font-size:1.125rem">${o.renewal}</span><span class="hint">Risk: ${o.renewalRisk}</span></div></div>` : `<div class="callout info">${icon('lock')}<span>Only people with the commercial right see fees. Switch to Aisyah Rahman from your profile menu to try it.</span></div>`}</div>
      <div class="card"><div class="card-head"><h2>Notes</h2><span class="pill idle">${icon('lock', 'sm')}REKA only</span></div><p class="small">${isContoh ? 'Finance director asked for a split by document type from October. The new “reason” detail in the data makes that possible.' : 'No notes yet.'}</p></div>
    </section>`}`;
  };
  pages.organisation.after = (id) => {
    if (id !== 'contoh-logistik' || !$('#ch-org')) return;
    drawChart($('#ch-org'), bucket(impactDaily('doc-workflow', windowDays(state.range)), state.range > 30), { id: 'org', kind: 'band', label: 'Hours saved, Contoh Logistik', height: 200,
      tip: (p) => p.before ? '<div>Before go-live</div>' : p.gap ? '<div>No data. Not counted as zero.</div>' : `<div>Hours saved <span class="mono">${nf(p.mid)}</span></div><div class="muted">Likely ${nf(p.low)} to ${nf(p.high)}</div>` });
  };

  // ------------------------------------------------------------------ KPI cards (example data)
  function kpiCards(sol, days) {
    const s = M.solutions[sol], st = solStatus(sol);
    if (st === 'not_connected') return [];
    const staleNote = st === 'stale' ? `No new data since ${(s.since || '14 Oct 2026, 06:00').replace(' 2026,', '')}` : st === 'failing' ? `Not answering since ${(s.since || '14 Oct 2026, 06:00').replace(' 2026,', '')}` : null;
    const upd = `Updated ${(s.lastPull || '–').replace(' 2026,', '')}`;
    const cards = [], imp = M.impact[sol];
    if (imp) { const r = impactSum(sol, days); cards.push({ name: imp.name, quality: 'estimated', value: nf(r.mid), unit: 'h', cmp: [['Likely', `${nf(r.low)} to ${nf(r.high)} h`], ['Baseline', `${imp.baseline.mid} min per ${imp.unitWord}`]], src: `${r.missing ? `${r.missing} day${r.missing > 1 ? 's' : ''} missing, not filled in · ` : ''}${upd}`, staleNote }); }
    if (sol === 'doc-workflow') {
      const g = sumMetric(sol, 'documents.generated', days), rc = sumMetric(sol, 'documents.returned_for_correction', days), i2 = impactSum(sol, days);
      cards.push({ name: 'Documents processed', quality: 'measured', value: nf(g.sum), unit: '', cmp: [['Days with data', `${g.n} of ${g.expected}`]], src: upd, staleNote });
      cards.push({ name: 'Sent back for correction', quality: 'derived', value: nf(100 * rc.sum / g.sum, 1), unit: '%', cmp: [['Before go-live', '7.4%'], ['Target', '4.0%']], src: upd, staleNote });
      cards.push({ name: 'Machine time per document', quality: 'measured', value: nf(i2.machineMean * 60, 0), unit: 's', cmp: [['Averaged', 'by volume']], src: upd, staleNote });
    }
    if (sol === 'invoice-triage') {
      const t = sumMetric(sol, 'invoices.triaged', days), ct = seriesOf(sol, 'invoices.cycle_time_median').filter((p) => p.d <= days[days.length - 1]).slice(-1)[0];
      cards.push({ name: 'Days to approve an invoice', quality: 'derived', value: nf(ct.v, 1), unit: 'days', cmp: [['Before go-live', '4.5 days'], ['Week of', dayShort(ct.d)]], src: upd });
      cards.push({ name: 'Invoices triaged', quality: 'measured', value: nf(t.sum), unit: '', cmp: [['Days with data', `${t.n} of ${t.expected}`]], src: upd });
      cards.push({ name: 'Hours saved on triage', quality: 'unavailable', value: null, why: 'Not added: it overlaps Document workflow, which already counts these hours.', cmp: [], src: 'Waiting for an agreed split' });
    }
    if (sol === 'shift-planner') { const p = sumMetric(sol, 'plans.generated', days); cards.push({ name: 'Shift plans made', quality: 'measured', value: nf(p.sum), unit: '', cmp: [['Days with data', `${p.n} of ${p.expected}`]], src: upd, staleNote }); }
    if (sol === 'enquiry-triage') { const e = sumMetric(sol, 'enquiries.received', days); cards.push({ name: 'Enquiries handled', quality: 'measured', value: nf(e.sum), unit: '', cmp: [['Days with data', `${e.n} of ${e.expected}`]], src: upd }); cards.push({ name: 'Front-desk hours saved', quality: 'unavailable', value: null, why: 'Needs a baseline before it can be shown.', cmp: [], src: 'Suggested by AI · waiting for a baseline', action: '<a href="#approvals">Add baseline</a>' }); }
    if (sol === 'quote-drafter') { const qd = sumMetric(sol, 'quotes.drafted', days); cards.push({ name: 'Quotations drafted', quality: 'measured', value: nf(qd.sum), unit: '', cmp: [['Days with data', `${qd.n} of ${qd.expected}`], ['Weekends', 'closed, a real 0']], src: upd, staleNote }); }
    if (st === 'failing' && sol === 'doc-workflow') cards.forEach((c) => { c.value = null; c.why = 'Can’t reach the solution. The last good figures are under Data and connection.'; c.staleNote = null; });
    return cards;
  }
  const kpiCardHtml = (c) => `
    <article class="card kpi">
      <div class="top"><h3>${esc(c.name)}</h3>${q(c.quality)}</div>
      <div class="stat"><span class="value ${c.staleNote ? 'stale-val' : ''}">${c.value === null ? dash() : `${c.value}<small>${c.unit}</small>`}</span>
        ${c.value === null ? `<span class="hint">${esc(c.why || '')} ${c.action || ''}</span>` : ''}
        ${c.staleNote ? `<span class="hint"><span class="pill warn" style="white-space:normal">${icon('clock', 'sm')}${esc(c.staleNote)}</span></span>` : ''}</div>
      ${c.cmp.length ? `<dl class="cmp">${c.cmp.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''}
      <p class="src">${esc(c.src)}</p>
    </article>`;

  // ------------------------------------------------------------------ SOLUTION (example data)
  const VOLUME = { 'doc-workflow': ['documents.generated', 'Documents processed'], 'invoice-triage': ['invoices.triaged', 'Invoices triaged'], 'shift-planner': ['plans.generated', 'Shift plans made'], 'enquiry-triage': ['enquiries.received', 'Enquiries received'], 'quote-drafter': ['quotes.drafted', 'Quotations drafted'] };
  pages.solution = (id) => {
    if (id === 'mine') return mySolutionPage();
    const s = M.solutions[id], o = orgById(s.org), st = solStatus(id), days = windowDays(state.range);
    const tabs = [['outcomes', 'Outcomes'], ['usage', 'Usage'], ['health', 'Health'], ['data', 'Data and connection']];
    let banner = '';
    if (st === 'stale') banner = `<div class="callout warn">${icon('clock')}<span><b>No new data since ${(s.since || '14 Oct 2026, 06:00').replace(' 2026,', '')}.</b> ${s.missed || 2} nightly collections were missed. You’re seeing the last good figures, faded. Nothing is filled in as zero.</span></div>`;
    if (st === 'failing') banner = `<div class="callout fault">${icon('alerts')}<span style="flex:1"><b>The solution isn’t answering since ${(s.since || '14 Oct 2026, 06:00').replace(' 2026,', '')}.</b> Its health check returned an error. We retry every 15 minutes and have told the project owner.</span>${gate(atLeast('Operator'), 'Retry now', 'Needs operator rights', 'data-act="retry"', 'btn sm')}</div>`;
    let body = '';
    if (state.solTab === 'outcomes') {
      const cards = kpiCards(id, days);
      let breakdown = '';
      if (id === 'doc-workflow' && st !== 'failing') {
        const r = impactSum(id, days), B = M.impact[id].baseline, R = M.impact[id].review, mch = r.machineMean, saved = B.mid - mch - R.mid;
        const pct = (v) => (100 * v / B.high).toFixed(2) + '%';
        breakdown = `<section class="card"><div class="card-head"><div><h2>Where the time goes, per document</h2><p class="sub">Minutes · ${rangeLabel().toLowerCase()}</p></div></div>
          <div class="impact">
            <div class="ib-row"><span class="lab">Before, by hand</span><div class="ib-bar"><div class="ib-seg base" style="width:${pct(B.mid)}" title="${B.mid} minutes"></div></div></div>
            <div class="ib-row"><span class="lab">Now</span><div class="ib-bar"><div class="ib-seg measured" style="width:${pct(mch)}" title="Machine ${nf(mch, 1)} min"></div><div class="ib-seg estimated" style="width:${pct(R.mid)}" title="Review ${R.mid} min"></div><div class="ib-seg saved" style="width:${pct(saved)}">${nf(saved, 1)} min saved</div></div></div>
            <div class="ib-scale"><span>0</span><span>${B.high / 2}</span><span>${B.high} min</span></div>
          </div>
          <div class="legend"><span><i style="background:repeating-linear-gradient(135deg,var(--baseline) 0 2px,transparent 2px 5px);box-shadow:inset 0 0 0 1px var(--baseline)"></i>By hand: ${B.mid} min, timed on 40 documents in June</span><span><i style="background:var(--s1)"></i>Machine: ${nf(mch, 1)} min, measured</span><span><i style="background:repeating-linear-gradient(135deg,var(--s1) 0 2px,var(--s1-soft) 2px 5px)"></i>Review: ${R.mid} min, sampled</span></div>
          <details class="more" style="margin-top:12px"><summary>How hours saved is worked out</summary><div class="table-wrap"><table><thead><tr><th>Part</th><th>Where it comes from</th><th>Kind</th><th class="num">Value</th></tr></thead><tbody>
            <tr><td><span class="name">Documents completed</span></td><td>Counted by the workflow</td><td>${q('measured')}</td><td class="num">${nf(r.vol)}</td></tr>
            <tr><td><span class="name">Minutes per document by hand</span></td><td>${esc(B.method)}</td><td>${q('estimated')}</td><td class="num">${B.mid} (${B.low}–${B.high})</td></tr>
            <tr><td><span class="name">Machine minutes</span></td><td>Measured. Never counted as a person’s time</td><td>${q('measured')}</td><td class="num">${nf(mch, 2)}</td></tr>
            <tr><td><span class="name">Review minutes</span></td><td>${esc(R.method)}</td><td>${q('estimated')}</td><td class="num">${R.mid} (${R.low}–${R.high})</td></tr>
            <tr><td><span class="name">Hours saved</span><span class="sub">documents × (by hand − machine − review) ÷ 60</span></td><td>Approved 10 Oct 2026 by Daniel Lim</td><td>${q('estimated')}</td><td class="num">${nf(r.mid)} (${nf(r.low)}–${nf(r.high)})</td></tr>
          </tbody></table></div></details></section>`;
      }
      body = `${breakdown}<div class="grid ${cards.length >= 4 ? 'g4' : cards.length === 3 ? 'g3' : 'g2'}">${cards.map(kpiCardHtml).join('')}</div>
        <section class="card"><div class="card-head"><div><h2>${VOLUME[id][1]}</h2><p class="sub">${state.range > 30 ? 'By week' : 'By day'} · measured</p></div></div><div class="chart" id="ch-vol"></div>
        <div class="legend"><span><i style="background:var(--s1)"></i>Measured</span><span><i style="box-shadow:inset 0 0 0 1.5px var(--warn)"></i>No data, not zero</span></div></section>`;
    } else if (state.solTab === 'usage') {
      if (id !== 'doc-workflow') body = `<section class="card"><div class="empty"><h3>Usage detail</h3><p>This mock shows usage for Contoh Logistik’s Document workflow.</p><a class="btn sm" href="#solution-doc-workflow">Open Document workflow</a></div></section>`;
      else {
        const ops = seriesOf(id, 'operators.active');
        const types = [['Invoices', 'invoice'], ['Statements', 'statement'], ['Credit notes', 'credit_note']].map(([l, t]) => [l, sumMetric(id, 'documents.generated.' + t, days).sum]);
        const tmax = Math.max(...types.map((t) => t[1]));
        body = `<div class="grid g2"><section class="card"><div class="card-head"><div><h2>By document type</h2><p class="sub">${rangeLabel()} · measured</p></div></div>
          <div class="impact">${types.map(([l, v], i) => `<div class="ib-row"><span class="lab">${l}</span><div class="ib-bar" style="align-items:center;gap:10px"><div class="ib-seg" style="width:${(80 * v / tmax).toFixed(1)}%;background:${['var(--s1)', 'var(--s2)', 'var(--s3)'][i]}"></div><span class="mono small ink">${nf(v)}</span></div></div>`).join('')}</div>
          <p class="small muted" style="margin-top:14px">Split by type because statements take longer by hand than credit notes.</p></section>
          <section class="card"><div class="card-head"><div><h2>People using it</h2><p class="sub">Each week · measured</p></div></div><div style="display:flex;align-items:flex-end;gap:16px;justify-content:space-between;flex-wrap:wrap"><div class="stat"><span class="value">${ops[ops.length - 1].v}</span><span class="hint">Week of ${day(ops[ops.length - 1].d)}</span></div>${sparkline(ops.slice(-14).map((p) => p.v), 200, 54)}</div>
          <p class="small muted" style="margin-top:14px">Usage shows the solution is adopted. It never counts as value on its own.</p></section></div>`;
      }
    } else if (state.solTab === 'health') {
      const byDay = {};
      seriesOf('doc-workflow', 'health').forEach((p) => { (byDay[p.d.slice(0, 10)] = byDay[p.d.slice(0, 10)] || []).push(p.v); });
      body = `<section class="card"><div class="card-head"><div><h2>Health checks, last 7 days</h2><p class="sub">Checked every 15 minutes · shown by hour</p></div>${statusPill(st)}</div>
        <div class="table-wrap"><div style="display:grid;gap:4px;min-width:560px">${Object.entries(byDay).map(([d, hrs]) => `<div style="display:grid;grid-template-columns:70px repeat(24,1fr);gap:3px;align-items:center"><span class="xs muted mono">${dayShort(d)}</span>${hrs.map((v, h) => `<span title="${dayShort(d)} ${String(h).padStart(2, '0')}:00 · ${v === 'ok' ? 'healthy' : 'slow'}" style="height:20px;border-radius:4px;background:${v === 'ok' ? 'var(--ok-tint)' : 'var(--warn)'}"></span>`).join('')}</div>`).join('')}</div></div>
        <div class="legend"><span><i style="background:var(--ok-tint);box-shadow:inset 0 0 0 1px var(--ok)"></i>Healthy</span><span><i style="background:var(--warn)"></i>Slow: 11 Oct, 03:00 to 05:00, figures arrived late</span></div>
        <p class="small muted" style="margin-top:12px">This checks the solution’s measurement link and how fresh its figures are. Full system monitoring stays with the solution’s own tools.</p></section>`;
    } else {
      body = `<div class="grid g2">
        <section class="card"><div class="card-head"><h2>Connection</h2>${statusPill(st)}</div>
          ${kv([['Address', `<span class="mono xs" style="overflow-wrap:anywhere">${s.base}</span>`], ['Signs in with', s.auth], ['Collects', 'Figures every night at 06:00 · health every 15 minutes'], ['Last collection', s.lastPull], ['Key kept in', 'REKA vault']])}
          <div class="head-actions" style="margin-top:12px">${gate(atLeast('Operator'), 'Pause collection', 'Needs operator rights', '', 'btn sm')}${gate(atLeast('Operator'), 'Fill in past days', 'Needs operator rights', '', 'btn sm')}</div></section>
        <section class="card"><div class="card-head"><h2>Recent collections</h2></div><div class="list">${M.pulls.map((p) => `<div class="row"><span class="ico ${p.status === 'ok' ? 'ok' : p.status === 'changed' ? 'info' : 'warn'}">${icon(p.status === 'ok' ? 'check' : p.status === 'changed' ? 'documents' : 'clock', 'sm')}</span><div><div class="what">${p.status === 'ok' ? `${nf(p.read)} figures collected` : p.status === 'changed' ? 'The solution added a new detail' : 'Figures arrived late'}</div><div class="meta">${p.note ? esc(p.note) : esc(p.ep.replace('/', '') + ' · ' + nf(p.ms) + ' ms')}</div></div><span class="xs muted mono">${p.at.replace(' 2026,', '')}</span></div>`).join('')}</div></section>
      </div>
      <section class="card"><div class="card-head"><div><h2>What this solution shares</h2><p class="sub">6 figures · daily totals · no personal data</p></div></div><div class="table-wrap"><table><thead><tr><th>Figure</th><th>Kind</th><th>Split by</th><th>Used in</th></tr></thead><tbody>
        ${M.catalog.map((c) => `<tr><td><span class="name">${esc(c.key.replace(/[._]/g, ' ').replace(/^\w/, (m) => m.toUpperCase()))}</span><span class="sub mono">${c.key}</span></td><td>${({ counter: 'Count', duration: 'Time', gauge: 'Level', distinct: 'People' })[c.type]} · ${c.unit}</td><td>${c.dims === '–' ? '<span class="muted">–</span>' : esc(c.dims.replace(/_/g, ' '))}${c.changed ? ' <span class="pill info">New</span>' : ''}</td><td class="small">${c.feeds === '–' ? '<span class="muted">Not used yet</span>' : c.feeds.replace(/K1/g, 'Hours saved').replace(/K2/g, 'Documents').replace(/K3/g, 'Sent back').replace(/K4/g, 'Machine time').replace(' (weighting)', '')}</td></tr>`).join('')}
      </tbody></table></div></section>`;
    }
    return `
    ${head({ crumbs: crumbs(['Organisations', '#organisations'], [o.short, '#organisation-' + o.id], [s.name]), title: esc(s.name),
      meta: `${statusPill(st)}<span>${esc(o.projects[0].name)}</span><span>Live since ${day(s.live)}</span>`, actions: rangeSeg() })}
    ${banner}
    <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${state.solTab === k}">${l}</button>`).join('')}</div>
    ${body}
    ${id === 'doc-workflow' ? `<div class="demo-bar"><span class="tag">MOCK CONTROLS</span><span>See what happens when data stops:</span><div class="seg">${[['live', 'Normal'], ['stale', 'Late'], ['failing', 'Not answering']].map(([v, l]) => `<button type="button" data-demo="${v}" aria-pressed="${state.demoState === v}">${l}</button>`).join('')}</div></div>` : ''}`;
  };
  pages.solution.after = (id) => {
    if (id === 'mine') return mySolutionAfter();
    const el = $('#ch-vol'); if (!el) return;
    const metric = VOLUME[id][0], map = new Map(seriesOf(id, metric).map((p) => [p.d, p.v])), start = firstDay(id, metric), st = solStatus(id);
    const daily = windowDays(state.range).map((d) => d < start ? { d, before: true } : (map.has(d) && map.get(d) !== null && !(id === 'doc-workflow' && st === 'stale' && d > '2026-10-12')) ? { d, v: map.get(d) } : { d, gap: true, v: null });
    drawChart(el, bucket(daily, state.range > 30), { id: 'vol', kind: 'columns', label: VOLUME[id][1], height: 220, tip: (p) => p.before ? '<div>Before go-live</div>' : p.gap ? '<div>No data. Not counted as zero.</div>' : `<div><span class="mono">${nf(p.v)}</span></div>${p.gaps ? `<div class="muted">${p.gaps} day(s) missing</div>` : ''}` });
  };

  // ------------------------------------------------------------------ CONNECT WIZARD (first use)
  const WSTEPS = ['Solution', 'How it shares data', 'Developer setup', 'Connect and test', 'Check the data', 'Choose KPIs', 'Baseline', 'Review and send'];
  const FOUND = [
    ['Leases processed', 'leases.processed', 'Count, every day', 'ok'],
    ['Time to process a lease', 'leases.processing_duration', 'Average seconds, every day', 'ok'],
    ['Leases sent for review', 'leases.flagged_for_review', 'Count, every day', 'ok'],
    ['People reviewing', 'reviewers.active', 'Distinct people, every week · a code, never a name', 'ok'],
    ['Clauses found', 'clauses.extracted', 'Count, every day', 'warn', 'The unit “clause” isn’t standard. Fine to use; ask the developer to rename it x.clause when convenient.'],
    ['Leases by tenant name', 'leases.by_tenant_name', 'Count, split by tenant', 'fault', 'Split by tenant name, which could identify people. Held back unless an admin approves it.'],
  ];
  const PROPOSALS = [
    { id: 'p1', name: 'Leases processed each month', kind: 'Usage', quality: 'measured', why: 'The basic volume. Every other figure depends on it.', formula: 'Total of leases processed, by month' },
    { id: 'p2', name: 'Share of leases sent for review', kind: 'Quality', quality: 'derived', why: 'Shows whether the extraction can be trusted. It should fall as the solution improves.', formula: 'Leases sent for review ÷ leases processed' },
    { id: 'p3', name: 'Hours saved on lease abstraction', kind: 'Business impact', quality: 'estimated', why: 'The outcome the client is paying for. Needs a baseline: how long a lease takes by hand.', formula: 'Leases × (minutes by hand − machine minutes − review minutes) ÷ 60', needsBaseline: true },
  ];
  const solNameOf = () => state.wiz.solName || 'Lease reader';
  const devPrompt = () => `Add the REKA measurement link to ${solNameOf()}, following the integration pack (integrations/measure in antarax-ripple-monitoring).

- Add read-only endpoints under /internal/measure/v1: manifest, metrics, observations, health.
- Don't change the app's own data model or API.
- Share daily totals only: leases processed, processing time (sum and count), leases flagged for review, active reviewers (pseudonymous).
- No lease text, tenant names or personal data.
- Sign requests with the service key in REKA_MEASURE_KEY.
- Run the contract test before you finish: npx @reka/measure-test <url>
- If there's no baseline, say so. Don't guess one.`;

  pages.connect = () => {
    if (!state.my.org || !state.my.project) {
      return `${head({ title: 'Connect a solution' })}<section class="card"><div class="empty">${emptyArt}<h3>${state.my.org ? 'Create the project first' : 'Add the organisation and project first'}</h3><p>A solution is measured against a project’s outcome, so we need both before connecting.</p><a class="btn primary" href="${state.my.org ? '#new-project' : '#new-organisation'}">${state.my.org ? 'Create project' : 'Add organisation'}</a></div></section>`;
    }
    if (state.my.sol) return `${head({ title: 'Connect a solution' })}<section class="card"><div class="empty">${emptyArt}<h3>${esc(state.my.sol.name)} is already connected</h3><p>This mock connects one solution per project.</p><a class="btn primary" href="#solution-mine">Open ${esc(state.my.sol.name)}</a></div></section>`;
    const w = state.wiz, orgName = state.my.org.name, projName = state.my.project.name, solName = solNameOf();
    const nav = `<ol class="wsteps">${WSTEPS.map((l, i) => `<li class="${i + 1 < w.step ? 'done' : i + 1 === w.step ? 'now' : ''}" ${i + 1 === w.step ? 'aria-current="step"' : ''}><b>${i + 1 < w.step ? '✓' : i + 1}</b><span>${l}</span></li>`).join('')}</ol>`;
    const foot = (label, disabled) => `<div class="wfoot">${w.step > 1 ? `<button type="button" class="btn ghost" data-act="w-back">${icon('back', 'sm')}Back</button>` : '<a class="btn ghost" href="#organisation-mine">Cancel</a>'}<button type="button" class="btn primary lg" data-act="w-next" ${disabled ? 'disabled' : ''}>${label}</button></div>`;
    let panel = '';
    if (w.step === 1) panel = `<div><h2>Which solution are you connecting?</h2><p class="small muted" style="margin-top:4px">For ${esc(orgName)} · ${esc(projName)}</p></div>
        <div class="form-grid"><div class="field full"><label for="w-sol">Solution name</label><input id="w-sol" value="${esc(solName)}"><span class="help">What your team calls it.</span></div>
        <div class="field"><label for="w-env">Environment</label><select id="w-env"><option>Production</option><option>Staging, for testing</option></select><span class="help">Only production feeds client reports.</span></div>
        <div class="field"><label for="w-ver">Version</label><input id="w-ver" value="1.0.0"></div></div>${foot('Continue')}`;
    if (w.step === 2) panel = `<div><h2>How will it share its figures?</h2><p class="small muted" style="margin-top:4px">Outcomes only reads daily totals. It never changes anything in the solution.</p></div>
        <div class="choice-grid">${[['link', 'link', 'Measurement link', 'The solution serves a small read-only link that we call each night. Best for anything REKA builds.', 'Recommended'], ['axle', 'box', 'An AntaraX product', 'Yara, Janka and others already share totals with AXLE. Nothing to build.', ''], ['sheet', 'sheet', 'Spreadsheet upload', 'For systems that can’t serve a link. Someone uploads a CSV each week.', '']].map(([k, ic, t, d, tag]) => `<button type="button" class="choice" data-method="${k}" aria-pressed="${w.method === k}"><span class="ic">${icon(ic)}</span><span><b>${t}</b><span class="d">${d}</span></span>${tag ? `<span class="pill info tag">${tag}</span>` : '<span class="radio"></span>'}</button>`).join('')}</div>
        ${w.method !== 'link' ? `<div class="callout info">${icon('insight')}<span>This mock follows the measurement link path. The other two work the same way from step 4.</span></div>` : ''}${foot('Continue')}`;
    if (w.step === 3) panel = `<div><h2>Ask the developer to add the link</h2><p class="small muted" style="margin-top:4px">About a day of work. Send them this brief. It works with Claude Code or Codex too.</p></div>
        <div class="grid" style="gap:8px"><div class="card-head" style="margin:0"><span class="small muted">Brief for the developer</span><button type="button" class="btn sm" data-act="copy-prompt">${icon('copy', 'sm')}Copy brief</button></div><div class="code-block" id="dev-prompt">${esc(devPrompt())}</div></div>
        <div class="grid g2"><div class="callout info">${icon('documents')}<span><b>Integration pack</b><br>The contract, examples and a test the developer runs before handing over.</span></div><div class="callout info">${icon('lock')}<span><b>Read-only key</b><br>We’ll make one for ${esc(solName)} in the next step.</span></div></div>
        <label class="check"><input type="checkbox" id="w-ready" ${w.devReady ? 'checked' : ''}><span><b class="ink">The developer has added the link and the test passes</b><br><span class="small muted">You can leave and come back. Your progress is saved.</span></span></label>
        ${foot('Continue', !w.devReady)}`;
    if (w.step === 4) panel = `<div><h2>Connect and test</h2><p class="small muted" style="margin-top:4px">We check the link answers, then read one day of figures. Nothing is saved until every check passes.</p></div>
        <div class="field"><label for="w-url">Link address</label><input id="w-url" class="mono" value="${esc(w.url)}"><span class="help">From the developer. Must start with https.</span></div>
        <div class="callout ok" style="align-items:center">${icon('lock')}<span>A read-only key for ${esc(solName)} is ready in the REKA vault. Tell the developer its name: <span class="inline-code">REKA_MEASURE_KEY</span>. You never see the secret.</span></div>
        ${w.tests.length ? `<div class="checks" aria-live="polite">${w.tests.map(([t, ok]) => `<div><span class="tick ${ok}">${ok === 'ok' ? '✓' : '…'}</span><span>${esc(t)}</span></div>`).join('')}</div>` : ''}
        ${w.tested ? `<div class="callout ok">${icon('check')}<span><b>Connected.</b> The link answered and shares 6 figures.</span></div>` : ''}
        ${foot(w.tested ? 'Check the data' : 'Test connection', w.tests.length && !w.tested)}`;
    if (w.step === 5) panel = `<div><h2>What ${esc(solName)} shares</h2><p class="small muted" style="margin-top:4px">We checked every figure: 4 ready, 1 with a note, 1 held back.</p></div>
        <div class="list">${FOUND.map(([n, k, kind, st, note]) => `<div class="row"><span class="ico ${st}">${icon(st === 'ok' ? 'check' : st === 'warn' ? 'alerts' : 'lock', 'sm')}</span><div><div class="what">${n}</div><div class="meta"><span>${kind}</span><span class="mono">${k}</span></div>${note ? `<div class="small" style="margin-top:4px;color:var(--${st}-ink)">${esc(note)}</div>` : ''}</div><span class="pill ${st}">${st === 'ok' ? 'Ready' : st === 'warn' ? 'Note' : 'Held back'}</span></div>`).join('')}</div>
        ${foot('Suggest KPIs')}`;
    if (w.step === 6) panel = !w.proposals ? `<div class="thinking" style="padding:8px 0"><img src="${SPARK}" alt=""><span>Reading 4 figures and suggesting KPIs for ${esc(projName)}…</span></div><div class="grid" style="gap:10px"><div class="skel" style="height:72px"></div><div class="skel" style="height:72px"></div><div class="skel" style="height:72px"></div></div>` : `
        <div class="card-head" style="margin:0"><div><h2>Choose what to measure</h2><p class="small muted" style="margin-top:4px">Suggested from what ${esc(solName)} shares and what the project is for.</p></div>${aiMark()}</div>
        ${PROPOSALS.map((p) => `<div class="pick ${w.keep[p.id] ? 'on' : 'off'}"><div class="top"><div><h3>${p.name}</h3><div class="meta-line" style="margin-top:6px"><span class="pill idle">${p.kind}</span>${q(p.quality)}</div></div><button type="button" class="switch" role="switch" aria-checked="${!!w.keep[p.id]}" aria-label="Measure ${p.name}" data-keep="${p.id}"></button></div><p class="why">${p.why}</p><details class="more"><summary>How it’s worked out</summary><div class="small">${p.formula}</div></details>${p.needsBaseline && w.keep[p.id] ? `<div class="callout warn" style="padding:10px 12px">${icon('target', 'sm')}<span>Needs a baseline. You’ll set it next.</span></div>` : ''}</div>`).join('')}
        <div class="callout ai">${icon('insight')}<span style="flex:1"><b>Clause accuracy</b> would be worth measuring, but the solution doesn’t count reviewer corrections yet.</span><button type="button" class="btn sm" data-act="add-gap">Ask the developer</button></div>
        ${foot(`Continue with ${Object.values(w.keep).filter(Boolean).length} KPIs`, !Object.values(w.keep).some(Boolean))}`;
    if (w.step === 7) {
      const b = w.baseline;
      panel = `<div><h2>How long does a lease take by hand?</h2><p class="small muted" style="margin-top:4px">Hours saved compares today with before. Agree this with ${esc(orgName)}: it appears in every report.</p></div>
        ${w.keep.p3 ? `<div class="grid g2" style="gap:10px">${[['sample', 'clock', 'Time a sample', 'Someone times 20 or more leases by hand. Most trusted.'], ['history', 'documents', 'Use past records', 'From the client’s own system, if it logged the time.'], ['estimate', 'people', 'The client’s estimate', 'Quickest. Reports label it as an estimate.'], ['none', 'target', 'Not available yet', 'Hours saved shows “needs a baseline” until you add one.']].map(([k, ic, t, d]) => `<button type="button" class="choice" style="grid-template-columns:44px minmax(0,1fr)" data-bmethod="${k}" aria-pressed="${b.method === k}"><span class="ic">${icon(ic)}</span><span><b>${t}</b><span class="d">${d}</span></span></button>`).join('')}</div>
        ${b.method !== 'none' ? `<div class="form-grid">
          <div class="field"><label for="b-mid">Typical minutes per lease</label><input id="b-mid" type="number" inputmode="decimal" value="${b.mid}"></div>
          <div class="field"><label for="b-low">Fastest and slowest</label><div class="with-btn"><input id="b-low" type="number" aria-label="Fastest, minutes" value="${b.low}"><input id="b-high" type="number" aria-label="Slowest, minutes" value="${b.high}"></div><span class="help">Reports show hours saved as a range from these.</span></div>
          ${b.method === 'sample' ? `<div class="field"><label for="b-n">Leases timed</label><input id="b-n" type="number" value="${b.n}"></div><div class="field"><label for="b-period">When</label><input id="b-period" value="${esc(b.period)}"><span class="help">Before go-live, so it reflects the old way.</span></div>` : ''}
          <div class="field full"><label for="b-note">Evidence</label><input id="b-note" placeholder="e.g. Timing sheet signed by Farah Idris" value="${esc(b.note)}"></div></div>` : ''}` : `<div class="callout info">${icon('check')}<span>None of the KPIs you chose need a baseline.</span></div>`}
        ${foot('Review')}`;
    }
    if (w.step === 8) {
      const kept = PROPOSALS.filter((p) => w.keep[p.id]), b = w.baseline;
      panel = `<div><h2>Review and send for approval</h2><p class="small muted" style="margin-top:4px">Someone other than you approves the KPIs and baseline. Collection starts once they do.</p></div>
        ${kv([['Solution', `${esc(solName)} · ${esc(orgName)}`], ['Shares by', 'Measurement link, read-only key'], ['Collects', 'Every night at 06:00 MYT · health every 15 minutes'], ['KPIs', kept.map((p) => esc(p.name)).join('<br>')], ['Baseline', w.keep.p3 ? (b.method === 'none' ? 'Not available yet' : `${b.mid} min per lease, ${b.low} to ${b.high} · ${({ sample: `timed sample of ${b.n} leases`, history: 'past records', estimate: 'client estimate' })[b.method]}`) : '–'], ['Held back', 'Leases by tenant name']], 120)}
        <div class="field"><label for="w-appr">Who approves</label><select id="w-appr"><option>Aisyah Rahman · Admin</option></select><span class="help">You can’t approve what you set up yourself.</span></div>
        ${foot('Send for approval')}`;
    }
    return `${head({ crumbs: crumbs([orgName, '#organisation-mine'], ['Connect a solution']), title: 'Connect a solution', lead: `Step ${w.step} of ${WSTEPS.length}` })}
      <div class="wizard">${nav}<div class="card wpanel">${panel}</div></div>`;
  };
  pages.connect.after = () => {
    const w = state.wiz;
    const r = $('#w-ready'); if (r) r.addEventListener('change', () => { w.devReady = r.checked; render(); });
    const map = { 'b-mid': 'mid', 'b-low': 'low', 'b-high': 'high', 'b-n': 'n', 'b-period': 'period', 'b-note': 'note' };
    Object.keys(map).forEach((id) => { const el = $('#' + id); if (el) el.addEventListener('input', () => { w.baseline[map[id]] = el.type === 'number' ? +el.value : el.value; }); });
    const sol = $('#w-sol'); if (sol) sol.addEventListener('input', () => { w.solName = sol.value; });
    const url = $('#w-url'); if (url) url.addEventListener('input', () => { w.url = url.value; });
    if (w.step === 6 && !w.proposals) setTimeout(() => { w.proposals = true; if (location.hash === '#connect') render(); }, reduceMotion ? 0 : 1600);
  };
  function wizardNext() {
    const w = state.wiz;
    if (w.step === 4 && !w.tested) {
      if (!/^https:\/\//.test(w.url)) { toast('The address must start with https.'); return; }
      const lines = ['Found the link', 'Secure connection', 'Signed request accepted', 'Read what it shares: 6 figures, daily', 'Health check: healthy', 'Read one day of figures'];
      w.tests = lines.map((t) => [t, 'wait']); render();
      lines.forEach((t, i) => setTimeout(() => { w.tests[i] = [t, 'ok']; if (i === lines.length - 1) w.tested = true; if (location.hash === '#connect') render(); }, reduceMotion ? 0 : 380 * (i + 1)));
      return;
    }
    if (w.step === 7 && w.keep.p3 && w.baseline.method !== 'none' && !(w.baseline.low <= w.baseline.mid && w.baseline.mid <= w.baseline.high && w.baseline.mid > 0)) { toast('Check the minutes: fastest ≤ typical ≤ slowest.'); return; }
    if (w.step === 8) { sendForApproval(); return; }
    w.step++; render(); window.scrollTo(0, 0);
  }
  function sendForApproval() {
    const w = state.wiz, kept = PROPOSALS.filter((p) => w.keep[p.id]), noBase = w.baseline.method === 'none';
    state.my.sol = { name: solNameOf(), stage: 'review', kpis: kept, obs: null };
    state.myApprovals = kept.map((p, i) => ({ id: 'apr_m' + i, type: 'KPI', title: p.name, org: 'mine', proposer: 'ai', editedBy: 'daniel', since: now(), status: p.needsBaseline && noBase ? 'blocked' : 'waiting', summary: p.why,
      fields: [['Worked out as', p.formula], ['Kind', p.kind]].concat(p.needsBaseline && !noBase ? [['Baseline', `${w.baseline.mid} min per lease (${w.baseline.low} to ${w.baseline.high})`]] : []),
      evidence: p.needsBaseline ? (w.baseline.note || 'Baseline: ' + w.baseline.method) : 'Figures checked on 15 Oct 2026', affects: `${state.my.sol.name} outcomes and the ${state.my.project.cadence.toLowerCase()} report`, blocker: p.needsBaseline && noBase ? 'No baseline yet.' : null }));
    state.approvalSel = state.myApprovals[0].id;
    log(`Connected ${state.my.sol.name} and sent ${kept.length} KPIs to Aisyah Rahman`);
    go('solution-mine'); toast(`Sent ${kept.length} KPIs for approval.`);
  }

  function mySolutionPage() {
    const my = state.my, s = my.sol;
    if (!s) return `${head({ title: 'Nothing connected yet' })}<section class="card"><div class="empty">${emptyArt}<h3>No solution connected</h3><a class="btn primary" href="#connect">Connect a solution</a></div></section>`;
    const stages = [['Connected', true], ['KPIs approved', s.stage !== 'review'], ['First data', s.stage === 'collecting'], ['Report scheduled', my.reportScheduled]];
    let body = '';
    if (s.stage === 'review') {
      body = `<section class="card"><div class="empty">${emptyArt}<h3>Waiting for Aisyah Rahman to approve</h3><p>She’ll check each KPI and the baseline. We’ve let her know. Collection starts as soon as she approves.</p><a class="btn" href="#approvals">See what you sent</a></div></section>
        <div class="demo-bar"><span class="tag">MOCK CONTROLS</span><span>Skip ahead:</span><button type="button" class="btn sm" data-act="sim-approve">Aisyah approves</button><span>or switch to Aisyah from your profile and approve them yourself.</span></div>`;
    } else if (s.stage === 'approved') {
      body = `<div class="grid ${s.kpis.length === 3 ? 'g3' : 'g2'}">${s.kpis.map((p) => `<article class="card kpi"><div class="top"><h3>${p.name}</h3>${q(p.quality)}</div><div class="stat"><span class="value">${dash()}</span><span class="hint">Waiting for the first collection</span></div><div class="skel" style="height:34px"></div><p class="src">First figures tonight at 06:00</p></article>`).join('')}</div>
        <section class="card"><div class="empty">${emptyArt}<h3>First collection tonight at 06:00</h3><p>We’ll collect the last 14 days, so you’ll see a trend straight away. You don’t need to do anything.</p>${gate(atLeast('Operator'), 'Collect now', 'Needs operator rights', 'data-act="sim-pull"', 'btn')}</div></section>`;
    } else {
      const t = myImpact(), b = state.wiz.baseline;
      const cards = s.kpis.map((p) => {
        if (p.id === 'p1') return { name: p.name, quality: 'measured', value: nf(t.vol), unit: '', cmp: [['Days collected', '14 of 14']], src: 'Updated 15 Oct, 06:00' };
        if (p.id === 'p2') return { name: p.name, quality: 'derived', value: nf(100 * t.flagged / t.vol, 1), unit: '%', cmp: [['Sent for review', nf(t.flagged)]], src: 'Updated 15 Oct, 06:00' };
        return b.method === 'none' ? { name: p.name, quality: 'unavailable', value: null, why: 'Needs a baseline before it can be shown.', cmp: [], src: 'Add one in Approvals' } : { name: p.name, quality: 'estimated', value: nf(t.mid), unit: 'h', cmp: [['Likely', `${nf(t.low)} to ${nf(t.high)} h`], ['Baseline', `${b.mid} min per lease`]], src: 'Review time is an estimate until it’s sampled' };
      });
      body = `<div class="callout ok">${icon('check')}<span><b>First figures are in.</b> 14 days collected. KPIs now update every night.</span></div>
        <div class="grid ${cards.length === 3 ? 'g3' : 'g2'}">${cards.map(kpiCardHtml).join('')}</div>
        <section class="card"><div class="card-head"><div><h2>Leases processed</h2><p class="sub">By day · measured · example figures</p></div></div><div class="chart" id="ch-mine"></div></section>
        ${!my.reportScheduled ? `<section class="card"><div class="row" style="border:0;padding:0"><span class="ico info">${icon('reports', 'sm')}</span><div><div class="what">Last step: schedule the client report</div><div class="meta">${esc(my.project.cadence)} · drafted for you, sent only after you check it</div></div><button type="button" class="btn primary sm" data-act="schedule-report">Schedule report</button></div></section>` : `<div class="callout ok">${icon('calendar')}<span><b>${esc(my.project.cadence)} report scheduled.</b> The first draft arrives on 1 Dec 2026 for you to check.</span></div>`}`;
    }
    return `${head({ crumbs: crumbs([my.org.name, '#organisation-mine'], [s.name]), title: esc(s.name), meta: `${statusPill(s.stage)}<span>${esc(my.project.name)}</span><span>Measurement link</span>` })}
      <section class="card flat" style="padding:14px 18px"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${stages.map(([l, d], i) => `<span class="pill ${d ? 'ok' : 'idle'}">${d ? icon('check', 'sm') : `<span class="mono">${i + 1}</span>`}${l}</span>${i < stages.length - 1 ? `<span class="muted">${icon('chev', 'sm')}</span>` : ''}`).join('')}</div></section>
      ${body}`;
  }
  function mySolutionAfter() {
    const el = $('#ch-mine'); if (!el) return;
    drawChart(el, state.my.sol.obs.map((o) => ({ d: o.d, v: o.v, label: dayShort(o.d), from: o.d, to: o.d })), { id: 'mine', kind: 'columns', label: 'Leases processed', height: 200, tip: (p) => `<div><span class="mono">${nf(p.v)}</span> leases</div>` });
  }

  // ------------------------------------------------------------------ APPROVALS
  pages.approvals = () => {
    const list = demo() ? state.approvals : state.myApprovals;
    if (!list.length) return `${head({ title: 'Approvals', lead: 'KPIs, baselines and reports wait here until someone other than the proposer approves them.' })}<section class="card"><div class="empty">${emptyArt}<h3>Nothing to approve</h3><p>When you connect a solution, its KPIs come here for a second person to check.</p></div></section>`;
    const sel = list.find((a) => a.id === state.approvalSel) || list[0];
    state.approvalSel = sel.id;
    const orgName = sel.org === 'mine' ? state.my.org.name : orgById(sel.org).short;
    const mine = sel.proposer === state.role || sel.editedBy === state.role;
    const can = has('Approve') && !mine && sel.status === 'waiting';
    const why = sel.status === 'blocked' ? 'Needs a baseline first' : mine ? 'You set this up, so someone else approves it.' : !has('Approve') ? 'You can comment, but not approve.' : '';
    const sp = (a) => ({ waiting: '<span class="pill warn"><span class="dot"></span>Waiting</span>', blocked: '<span class="pill fault"><span class="dot"></span>Blocked</span>', approved: '<span class="pill ok"><span class="dot"></span>Approved</span>', changes: '<span class="pill info">Changes asked</span>', declined: '<span class="pill idle">Declined</span>' })[a.status];
    const who = (id) => id === 'ai' ? `<span class="ai-mark"><img src="${SPARK}" alt="">Suggested by AI</span>` : id === 'collector' ? 'Spotted automatically' : M.staff[id].name;
    return `${head({ title: 'Approvals', lead: 'Nothing is measured or shown to a client until someone other than the proposer approves it.', meta: `<span>${list.filter((a) => a.status === 'waiting').length} waiting</span><span>${list.filter((a) => a.status === 'blocked').length} blocked</span>` })}
    ${!demo() && state.role === 'daniel' && list.some((a) => a.status === 'waiting') ? `<div class="callout info">${icon('people')}<span>You set these up, so Aisyah Rahman approves them. To try it, switch to Aisyah from your profile menu.</span></div>` : ''}
    <div class="grid ap-split" id="ap-split">
      <div class="grid" style="gap:8px;align-content:start">${list.map((a) => `<button type="button" class="choice" style="grid-template-columns:minmax(0,1fr);gap:6px" data-sel="${a.id}" aria-pressed="${a.id === sel.id}"><span class="meta-line" style="margin:0">${sp(a)}<span class="pill idle">${a.type}</span></span><b>${esc(a.title)}</b><span class="d">${esc(a.org === 'mine' ? state.my.org.name : orgById(a.org).short)} · ${esc(a.since.replace(' 2026,', ''))}</span></button>`).join('')}</div>
      <section class="card" aria-labelledby="ap-h">
        <div class="meta-line" style="margin:0 0 8px">${sp(sel)}<span class="pill idle">${sel.type}</span></div><h2 id="ap-h">${esc(sel.title)}</h2>
        <p class="ink" style="margin-top:6px">${esc(sel.summary)}</p>
        <div style="margin-top:12px">${kv([['Organisation', esc(orgName)], ['Proposed by', who(sel.proposer) + (sel.editedBy ? `, edited by ${M.staff[sel.editedBy].name}` : '')]].concat((sel.fields || []).map(([k, v]) => [k, esc(v)])).concat([['Evidence', esc(sel.evidence)], ['Changes', esc(sel.affects)]]), 140)}</div>
        ${sel.diff ? `<div class="table-wrap" style="margin-top:12px"><table><thead><tr><th></th><th>Before</th><th>After</th></tr></thead><tbody>${sel.diff.map(([k, b, a]) => `<tr><td class="muted">${k}</td><td><s class="muted">${esc(b)}</s></td><td class="ink" style="font-weight:500">${esc(a)}</td></tr>`).join('')}</tbody></table></div>` : ''}
        ${sel.report ? `<a class="btn sm" href="#report" style="margin-top:12px">${icon('reports', 'sm')}Open the draft report</a>` : ''}
        ${sel.blocker ? `<div class="callout warn" style="margin-top:12px">${icon('target')}<span>${esc(sel.blocker)}</span></div>` : ''}
        ${sel.status === 'waiting' || sel.status === 'blocked' ? `<form id="f-decide" class="grid" style="gap:10px;margin-top:18px;border-top:1px solid var(--line);padding-top:18px">
          <div class="field"><label for="d-reason">Your reason</label><textarea id="d-reason" placeholder="Why you’re approving or asking for changes. It’s kept in the audit trail." ${can ? '' : 'disabled'}></textarea></div>
          <div class="head-actions">${can ? '<button type="submit" class="btn primary" data-dec="approved">Approve</button><button type="submit" class="btn" data-dec="changes">Ask for changes</button><button type="submit" class="btn ghost" data-dec="declined">Decline</button>' : `<button type="button" class="btn primary" disabled>Approve</button><span class="needs">${why}</span>`}</div></form>` : ''}
      </section>
    </div>`;
  };
  pages.approvals.after = () => {
    const f = $('#f-decide'); if (!f) return;
    let dec = 'approved';
    $$('button[data-dec]', f).forEach((b) => b.addEventListener('click', () => { dec = b.dataset.dec; }));
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const reason = $('#d-reason').value.trim();
      if (!reason) { const t = $('#d-reason'); t.setAttribute('aria-invalid', 'true'); t.placeholder = 'Add a short reason first. It’s kept in the audit trail.'; t.focus(); return; }
      const list = demo() ? state.approvals : state.myApprovals, a = list.find((x) => x.id === state.approvalSel), prev = a.status;
      a.status = dec;
      if (a.report && dec === 'approved') state.reportApproved = true;
      if (!demo() && state.my.sol.stage === 'review' && !list.some((x) => x.status === 'waiting') && list.some((x) => x.status === 'approved')) state.my.sol.stage = 'approved';
      log(`${({ approved: 'Approved', changes: 'Asked for changes to', declined: 'Declined' })[dec]} “${a.title}”: ${reason}`);
      const nxt = list.find((x) => x.status === 'waiting'); if (nxt) state.approvalSel = nxt.id;
      render();
      toast(({ approved: 'Approved', changes: 'Changes requested', declined: 'Declined' })[dec] + '.', () => { a.status = prev; auditList().shift(); render(); });
    });
  };

  // ------------------------------------------------------------------ REPORTS
  pages.reports = () => {
    const lead = 'Each client gets a report on their schedule. It’s drafted for you and goes out only after you check it.';
    if (!demo()) {
      const ok = state.my.sol && state.my.sol.stage === 'collecting';
      return `${head({ title: 'Reports', lead })}<section class="card">${state.my.reportScheduled ? `<div class="row" style="border:0;padding:0"><span class="ico ok">${icon('calendar', 'sm')}</span><div><div class="what">${esc(state.my.org.name)} · ${esc(state.my.project.cadence)} report</div><div class="meta">First draft on 1 Dec 2026, for November · you check it before it’s sent</div></div><span class="pill ok">Scheduled</span></div>` : `<div class="empty">${emptyArt}<h3>No reports scheduled</h3><p>${ok ? 'Your first solution is collecting data. Schedule its report now.' : 'Once a solution is collecting data, you can schedule its report here.'}</p>${gate(ok, 'Schedule report', 'Available once data arrives', 'data-act="schedule-report"')}</div>`}</section>`;
    }
    return `${head({ title: 'Reports', lead })}
    <section class="card"><div class="table-wrap"><table><thead><tr><th>Report</th><th>Organisation</th><th>Period</th><th>Status</th><th></th></tr></thead><tbody>
      <tr class="link" data-go="report" tabindex="0"><td><span class="name">Accounts payable automation</span><span class="sub">Monthly</span></td><td>Contoh Logistik</td><td class="mono">Sep 2026</td><td>${state.reportApproved ? '<span class="pill ok"><span class="dot"></span>Approved</span>' : '<span class="pill warn"><span class="dot"></span>Ready to review</span>'}</td><td><a class="btn sm" href="#report">Open</a></td></tr>
      <tr><td><span class="name">Production planning assistant</span><span class="sub">Monthly</span></td><td>Acme Plastics</td><td class="mono">Sep 2026</td><td><span class="pill ok"><span class="dot"></span>Sent 3 Oct</span></td><td></td></tr>
      <tr><td><span class="name">Quotation drafting</span><span class="sub">Quarterly</span></td><td>Bina Jaya</td><td class="mono">Q3 2026</td><td><span class="pill ok"><span class="dot"></span>Sent 7 Oct</span></td><td></td></tr>
      <tr><td><span class="name">Patient enquiry triage</span><span class="sub">Monthly</span></td><td>Sampel Medik</td><td class="mono">Oct 2026</td><td><span class="pill idle">Drafts 1 Nov</span></td><td></td></tr>
    </tbody></table></div></section>`;
  };
  pages.report = () => {
    if (!demo()) return pages.reports();
    const sep = contohMonth('2026-09'), aug = contohMonth('2026-08'), canApprove = has('Approve') && state.role !== 'nurul';
    const delta = (a, b) => (a - b >= 0 ? '+' : '−') + nf(Math.abs(a - b));
    return `${head({ crumbs: crumbs(['Reports', '#reports'], ['Contoh Logistik, September 2026']), title: 'September 2026 report',
      meta: `${state.reportApproved ? '<span class="pill ok"><span class="dot"></span>Approved, ready to send</span>' : '<span class="pill warn"><span class="dot"></span>Ready to review</span>'}${aiMark('Drafted by AI, edited by Nurul Aina')}<span>Every figure checked</span><span>No fees shown</span>`,
      actions: state.reportApproved ? '<button type="button" class="btn primary" data-act="send-report">Send to Contoh Logistik</button>' : gate(canApprove, 'Approve report', state.role === 'nurul' ? 'You edited this, so someone else approves.' : 'Needs approval rights', 'data-act="approve-report"') })}
    <article class="paper" aria-label="Report preview">
      <header class="paper-head"><div class="top"><span class="eyebrow"><img src="${SPARK}" alt="">Performance report</span><img class="reka" src="assets/reka-lockup.svg" alt="REKA"></div>
        <h1>Accounts payable automation: September 2026</h1>
        <div class="meta"><span>Prepared for Contoh Logistik Sdn Bhd</span><span>Period <span class="mono">1 to 30 Sep 2026</span></span><span>Generated <span class="mono">15 Oct 2026, 06:12 MYT</span></span><span class="example">Example data</span></div></header>
      <section><h2>Summary</h2><div class="headline">
        <div><span class="l">Documents completed</span><span class="v">${nf(sep.docs)}</span><span class="s">${delta(sep.docs, aug.docs)} on August · measured<sup>1</sup></span></div>
        <div><span class="l">Preparation hours freed</span><span class="v">${nf(sep.imp.mid)}</span><span class="s">likely ${nf(sep.imp.low)} to ${nf(sep.imp.high)} · estimated<sup>2</sup></span></div>
        <div><span class="l">Sent back for correction</span><span class="v">${nf(sep.rate, 1)}%</span><span class="s">7.4% before go-live · derived<sup>3</sup></span></div></div></section>
      <section><h2>Outcomes</h2><div class="table-wrap"><table><thead><tr><th>Measure</th><th class="num">September</th><th class="num">August</th><th class="num">Before</th><th>Kind</th></tr></thead><tbody>
        <tr><td><span class="name">Documents completed</span></td><td class="num">${nf(sep.docs)}</td><td class="num">${nf(aug.docs)}</td><td class="num">–</td><td>${q('measured')}</td></tr>
        <tr><td><span class="name">Preparation hours freed</span></td><td class="num">${nf(sep.imp.mid)}</td><td class="num">${nf(aug.imp.mid)}</td><td class="num">18 min/doc</td><td>${q('estimated')}</td></tr>
        <tr><td><span class="name">Sent back for correction</span></td><td class="num">${nf(sep.rate, 1)}%</td><td class="num">${nf(aug.rate, 1)}%</td><td class="num">7.4%</td><td>${q('derived')}</td></tr>
        <tr><td><span class="name">Days to approve an invoice</span></td><td class="num">${nf(sep.ct, 1)}</td><td class="num">${nf(aug.ct, 1)}</td><td class="num">4.5</td><td>${q('derived')}</td></tr>
        <tr><td><span class="name">Invoices triaged</span></td><td class="num">${nf(sep.invoices)}</td><td class="num">${nf(aug.invoices)}</td><td class="num">–</td><td>${q('measured')}</td></tr></tbody></table></div></section>
      <section><h2>What changed</h2><ul><li>More documents went through the workflow than in August, mostly invoices.</li><li>Fewer needed correction, which also shortens the review step.</li><li>Invoices moved from receipt to approval faster through the month.</li></ul></section>
      <section><h2>How we measured</h2><div class="fn"><span><sup>1</sup> Counted by the workflow, collected daily. 21 and 22 Sep are missing and not counted.</span><span><sup>2</sup> Documents × (18 minutes by hand − ${nf(sep.imp.machineMean, 1)} machine minutes − 4 review minutes) ÷ 60. By-hand time from 40 documents timed on 2 to 6 Jun 2026, before go-live; review time from 30 documents on 1 to 3 Oct 2026. The range uses both samples’ low and high ends. Machine time is never counted as time saved.</span><span><sup>3</sup> Documents sent back ÷ documents completed. Before go-live: system records, Mar to May 2026.</span></div></section>
      <section><h2>Caveats</h2><div class="note">These figures compare September with the baseline. They don’t show what caused every change: invoice volumes and supplier mix also moved. Hours freed are an estimate, not hours removed from anyone’s week.</div></section>
      <section><h2>Recommended next steps</h2><ol><li>Split hours freed by document type from October, now that the workflow reports why documents are sent back.</li><li>Re-time a fresh sample of 20 statements: they take longest by hand and are a growing share.</li><li>Agree how to count Invoice triage’s hours alongside the document workflow, so its savings can be reported without double counting.</li></ol></section>
      <footer class="paper-foot"><span>Run by REKA as part of Managed AI.</span><span class="mono">Page 1 of 1</span><span>REKA Inisiatif Sdn Bhd</span></footer>
    </article>`;
  };

  // ------------------------------------------------------------------ SETTINGS and HELP
  pages.settings = () => `${head({ title: 'Settings', lead: `${esc(state.setup.workspace)} workspace` })}
    <div class="grid g2">
      <section class="card"><div class="card-head"><h2>Team</h2><button type="button" class="btn sm" data-act="invite">${icon('user-plus', 'sm')}Invite</button></div>
        <div class="list">${Object.values(M.staff).map((s) => `<div class="row"><span class="avatar">${s.initials}</span><div><div class="what">${s.name}</div><div class="meta">${s.note}</div></div><span class="pill idle">${s.rights.includes('Approve') ? 'Can approve' : 'Can suggest'}${s.rights.includes('Commercial') ? ' · sees fees' : ''}</span></div>`).join('')}</div>
        <p class="small muted" style="margin-top:12px">Analysts suggest KPIs. Project managers approve them. Only people with the commercial right see fees.</p></section>
      <section class="card"><div class="card-head"><h2>Collection</h2></div>${kv([['Nightly figures', '06:00 MYT'], ['Health checks', 'Every 15 minutes'], ['Data kept in', 'Singapore'], ['Kept for', 'The contract plus 24 months, then monthly totals']], 140)}</section>
      <section class="card"><div class="card-head"><h2>Audit trail</h2><span class="pill idle">${icon('lock', 'sm')}Can’t be edited</span></div>
        <div class="list">${auditList().slice(0, 8).map(([t, w, what]) => `<div class="row" style="grid-template-columns:minmax(0,1fr) auto"><div class="small"><b class="ink">${esc(w.split(' · ')[0])}</b> ${esc(what)}</div><span class="xs muted mono">${esc(t.replace(' 2026,', ''))}</span></div>`).join('')}</div></section>
      <section class="card"><div class="card-head"><h2>Integration pack</h2></div><p class="small">Everything a developer needs to add a measurement link: the contract, examples and a test to run before handing over.</p><div class="code-block" style="margin-top:12px">npx @reka/measure-test https://your-solution/internal/measure/v1</div></section>
    </div>`;
  pages.guide = () => `${head({ title: 'Help', lead: 'How Outcomes measures, and what each label means.' })}
    <div class="grid g3">${[['measured', 'Measured', 'Counted or timed by the solution itself.'], ['derived', 'Derived', 'Worked out only from measured figures, like a rate.'], ['estimated', 'Estimated', 'Uses a sample or an agreed baseline. Always shown with a likely range.']].map(([k, t, d]) => `<div class="card"><div style="margin-bottom:8px">${q(k)}</div><h3>${t}</h3><p class="small" style="margin-top:6px">${d}</p></div>`).join('')}</div>
    <section class="card"><h2>Never a false zero</h2><p class="small" style="margin-top:6px;max-width:70ch">If a solution stops sending data, its figures fade and say why. A missing day is a gap, never a zero. A real zero, like a factory closed on Sunday, shows as 0.</p></section>
    <section class="card"><h2>Need help?</h2><p class="small" style="margin-top:6px">Email support@go.antarax.ai and the team will reply.</p></section>`;

  // ------------------------------------------------------------------ search palette
  function openPalette() {
    const el = $('#palette'); if (!el) return;
    const items = [['Home', '#home'], ['Organisations', '#organisations'], ['Approvals', '#approvals'], ['Reports', '#reports'], ['Settings', '#settings'], ['Connect a solution', '#connect'], ['Add organisation', '#new-organisation']]
      .concat(demo() ? M.orgs.map((o) => [o.name, '#organisation-' + o.id]).concat(Object.values(M.solutions).filter((s) => s.status !== 'not_connected').map((s) => [`${s.name} · ${orgById(s.org).short}`, '#solution-' + s.id])) : (state.my.org ? [[state.my.org.name, '#organisation-mine']] : []));
    el.hidden = false;
    el.innerHTML = `<div class="scrim" data-act="close-palette"></div><div class="card" role="dialog" aria-label="Search" style="position:fixed;z-index:60;top:12vh;left:50%;transform:translateX(-50%);width:min(560px,calc(100vw - 32px));padding:10px;box-shadow:var(--shadow-lg)"><div class="field"><input id="pal-q" placeholder="Search organisations, solutions, pages" aria-label="Search" autocomplete="off"></div><div id="pal-list" style="max-height:50vh;overflow:auto;margin-top:6px;display:grid;gap:2px"></div></div>`;
    const draw = (qv) => { $('#pal-list').innerHTML = items.filter(([l]) => l.toLowerCase().includes(qv.toLowerCase())).slice(0, 10).map(([l, h]) => `<a href="${h}" style="padding:10px 12px;border-radius:10px;color:var(--ink);text-decoration:none;display:block" onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background=''">${esc(l)}</a>`).join('') || '<p class="small muted" style="padding:10px">Nothing matches.</p>'; };
    draw(''); const inp = $('#pal-q'); inp.focus();
    inp.addEventListener('input', () => draw(inp.value));
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const a = $('#pal-list a'); if (a) { closePalette(); location.hash = a.getAttribute('href'); } } });
  }
  function closePalette() { const el = $('#palette'); if (el) { el.hidden = true; el.innerHTML = ''; } }

  // ------------------------------------------------------------------ router
  function parse() {
    const h = (location.hash || '').slice(1) || (state.signedIn ? 'home' : 'signin');
    if (h.startsWith('organisation-')) return ['organisation', h.slice(13), h];
    if (h.startsWith('solution-')) return ['solution', h.slice(9), h];
    return [h, null, h];
  }
  let last = '';
  const TITLES = { signin: 'Sign in', welcome: 'Welcome', home: 'Home', organisations: 'Organisations', 'new-organisation': 'Add organisation', 'new-project': 'New project', connect: 'Connect a solution', approvals: 'Approvals', reports: 'Reports', report: 'September 2026 report', settings: 'Settings', guide: 'Help' };
  function render() {
    let [page, arg, raw] = parse();
    if (!state.signedIn) { page = 'signin'; raw = 'signin'; }
    else if (!state.mode) { page = 'welcome'; raw = 'welcome'; }
    else if (page === 'signin' || page === 'welcome') { page = 'home'; raw = 'home'; }
    if (page === 'organisation' && arg !== 'mine' && (!demo() || !orgById(arg))) { page = 'organisations'; raw = 'organisations'; }
    if (page === 'solution' && arg !== 'mine' && (!demo() || !M.solutions[arg] || M.solutions[arg].status === 'not_connected')) { page = 'home'; raw = 'home'; }
    if (!pages[page]) { page = 'home'; raw = 'home'; }
    const root = $('#root');
    root.innerHTML = (page === 'signin' || page === 'welcome') ? pages[page]() : appShell(raw, pages[page](arg));
    const name = TITLES[page] || (arg === 'mine' ? (page === 'solution' ? state.my.sol && state.my.sol.name : state.my.org && state.my.org.name) : page === 'organisation' ? orgById(arg).short : M.solutions[arg].name);
    document.title = `${name || 'Outcomes'} · Outcomes`;
    if (pages[page].after) pages[page].after(arg);
    if (last !== raw) { window.scrollTo(0, 0); last = raw; }
  }

  // ------------------------------------------------------------------ events
  const closePops = (except) => ['#new-pop', '#bell-pop', '#user-pop'].forEach((s) => { const p = $(s); if (p && s !== except) p.hidden = true; });
  const toggle = (sel) => { const p = $(sel); closePops(sel); p.hidden = !p.hidden; };
  const acts = {
    signin: () => { state.signedIn = true; location.hash = '#welcome'; render(); },
    'ws-next': () => { state.setup.step = 3; render(); toast('Invites sent.'); },
    'ws-skip': () => { state.setup.step = 3; render(); },
    'add-invite': () => { state.setup.invites.push({ email: '', role: 'Analyst' }); render(); },
    'new-menu': () => toggle('#new-pop'), bell: () => toggle('#bell-pop'), user: () => toggle('#user-pop'),
    palette: openPalette, 'close-palette': closePalette,
    signout: () => { state.signedIn = false; state.mode = null; state.setup.step = 1; location.hash = '#signin'; render(); },
    'switch-mode': () => { state.mode = demo() ? 'new' : 'demo'; location.hash = '#home'; render(); toast(demo() ? 'Example workspace opened.' : 'Back to your workspace.'); },
    'w-next': wizardNext,
    'w-back': () => { state.wiz.step--; render(); },
    'copy-prompt': () => {
      const fallback = () => { const r = document.createRange(); r.selectNodeContents($('#dev-prompt')); getSelection().removeAllRanges(); getSelection().addRange(r); toast('Selected. Press Ctrl C to copy.'); };
      try { navigator.clipboard.writeText(devPrompt()).then(() => toast('Copied. Send it to the developer.'), fallback); } catch (err) { fallback(); }
    },
    'add-gap': () => toast('Added to the developer’s list.'),
    'sim-approve': () => { state.myApprovals.forEach((a) => { if (a.status === 'waiting') a.status = 'approved'; }); state.my.sol.stage = 'approved'; log(`Approved the KPIs for ${state.my.sol.name}`, 'Aisyah Rahman'); render(); toast('Aisyah approved the KPIs.'); },
    'sim-pull': () => { state.my.sol.obs = myObservations(); state.my.sol.stage = 'collecting'; log(`Collected 14 days of figures from ${state.my.sol.name}`, 'Collector'); render(); toast('First figures collected.'); },
    'schedule-report': () => { state.my.reportScheduled = true; log(`Scheduled the ${state.my.project.cadence.toLowerCase()} report for ${state.my.org.name}`); render(); toast('Report scheduled. Setup complete.'); },
    'approve-report': () => { state.reportApproved = true; const a = state.approvals.find((x) => x.report); if (a) a.status = 'approved'; log('Approved the September report for Contoh Logistik'); render(); toast('Report approved.', () => { state.reportApproved = false; if (a) a.status = 'waiting'; auditList().shift(); render(); }); },
    'send-report': () => toast('Email delivery comes in phase 2. The PDF is ready.'),
    'approve-narrative': () => { state.narrativeApproved = true; log('Approved the September summary for Contoh Logistik'); render(); toast('Summary approved.', () => { state.narrativeApproved = false; auditList().shift(); render(); }); },
    retry: () => toast('Retrying now.'),
    invite: () => toast('Invites come from your REKA account directory.'),
  };
  document.addEventListener('click', (e) => {
    if (e.target.id === 'scrim') { $('#sidebar').classList.remove('open'); e.target.hidden = true; return; }
    if (!e.target.closest('.rel')) closePops();
    if (e.target.closest('#pal-list a')) { closePalette(); return; }
    const t = e.target.closest('button, [data-go], [data-act]');
    if (!t) return;
    const d = t.dataset;
    if (d.range) { state.range = +d.range; render(); return; }
    if (d.aud) { state.audience = d.aud; render(); return; }
    if (d.tab) { state.solTab = d.tab; render(); return; }
    if (d.demo) { state.demoState = d.demo; render(); return; }
    if (d.go) { location.hash = '#' + d.go; return; }
    if (d.sel) { state.approvalSel = d.sel; render(); if (window.innerWidth < 1024) $('#ap-h').scrollIntoView(); return; }
    if (d.tpl) { state.newTemplate = d.tpl; render(); return; }
    if (d.method) { state.wiz.method = d.method; render(); return; }
    if (d.keep) { state.wiz.keep[d.keep] = !state.wiz.keep[d.keep]; render(); return; }
    if (d.bmethod) { state.wiz.baseline.method = d.bmethod; render(); return; }
    if (d.start) { state.mode = d.start; location.hash = '#home'; render(); toast(d.start === 'demo' ? 'Example workspace opened.' : 'Your workspace is ready.'); return; }
    if (d.role) { state.role = d.role; closePops(); render(); toast(`Now signed in as ${me().name}.`); return; }
    if (d.themeSet) {
      const v = d.themeSet;
      if (v === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', v);
      try { if (v === 'system') localStorage.removeItem('outcomes-theme'); else localStorage.setItem('outcomes-theme', v); } catch (err) { /* storage blocked */ }
      render(); $('#user-pop').hidden = false; return;
    }
    if (t.id === 'menu-btn') { $('#sidebar').classList.add('open'); $('#scrim').hidden = false; return; }
    if (d.act && acts[d.act]) { e.preventDefault(); acts[d.act](); }
  });
  document.addEventListener('submit', (e) => {
    if (e.target.id === 'f-ws') { e.preventDefault(); state.setup.workspace = $('#ws-name').value.trim() || 'REKA Inisiatif'; state.setup.step = 2; render(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closePops(); closePalette(); const sb = $('#sidebar'); if (sb) { sb.classList.remove('open'); $('#scrim').hidden = true; } }
    if (e.key === 'Enter' && e.target.matches('tr[data-go]')) location.hash = '#' + e.target.dataset.go;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && state.mode) { e.preventDefault(); openPalette(); }
  });
  window.addEventListener('hashchange', () => { closePalette(); render(); });
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { const [p, a] = parse(); if (['home', 'organisation', 'solution'].includes(p) && pages[p].after && state.mode) pages[p].after(a); }, 150); });
  render();
})();
