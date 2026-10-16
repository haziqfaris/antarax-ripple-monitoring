/* Outcomes product mock.
   - Your workspace: sign in, set up, add organisations, create projects, connect solutions, approve, collect, report.
     Any number of projects; their daily figures are simulated from each project's kind, volume and baseline.
   - Demo studio (mock only): create simulated projects, move the date forward, cause problems, and a guided tour.
   - The example workspace: five fixed organisations from data.js.
   Plain JavaScript, no libraries. Every figure on screen is worked out from the underlying daily figures. */
(function () {
  'use strict';
  const M = window.MOCK;
  const IC = window.ICONS;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const icon = (n, cls) => `<svg class="i ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ''}</svg>`;
  const SPARK = 'assets/sparkle.svg';

  // ------------------------------------------------------------------ kinds of work (steer KPI suggestions and the simulation)
  const KINDS = {
    documents: { icon: 'documents', label: 'Document processing', d: 'Reading, writing or checking documents.', noun: 'document', nouns: 'documents', vol: 200, weekend: 0.12, base: { mid: 18, low: 14, high: 22 }, review: { mid: 4, low: 3, high: 6 }, machine: 0.6, qual: { label: 'sent back for correction', from: 6.5, to: 3.2 }, objective: 'Free the team from typing and checking documents by hand.', sol: 'Document workflow' },
    triage: { icon: 'ask', label: 'Enquiry or ticket triage', d: 'Sorting and answering incoming requests.', noun: 'enquiry', nouns: 'enquiries', vol: 280, weekend: 0.4, base: { mid: 7, low: 5, high: 9 }, review: { mid: 1.5, low: 1, high: 2 }, machine: 0.1, qual: { label: 'handed to a person', from: 38, to: 22 }, objective: 'Answer routine enquiries faster, and route the rest to the right desk.', sol: 'Enquiry assistant' },
    planning: { icon: 'plan', label: 'Planning and forecasting', d: 'Building plans, schedules or forecasts.', noun: 'plan', nouns: 'plans', vol: 4, weekend: 1, base: { mid: 95, low: 80, high: 110 }, review: { mid: 20, low: 15, high: 25 }, machine: 2, qual: { label: 'changed heavily by a supervisor', from: 30, to: 12 }, objective: 'Cut the time supervisors spend building plans.', sol: 'Shift planner' },
    quotes: { icon: 'reports', label: 'Quotations and proposals', d: 'Drafting quotes, bids or proposals.', noun: 'quotation', nouns: 'quotations', vol: 12, weekend: 0, base: { mid: 45, low: 35, high: 55 }, review: { mid: 12, low: 10, high: 15 }, machine: 1, qual: { label: 'revised by an estimator', from: 28, to: 15 }, objective: 'Send customers a first quotation the same day.', sol: 'Quote drafter' },
  };
  Object.assign(KINDS.documents, { people: 9, tat: { from: 30, to: 8 }, sla: { from: 72, to: 95 }, runCost: 2400 });
  Object.assign(KINDS.triage, { people: 14, tat: { from: 6, to: 1.2 }, sla: { from: 60, to: 92 }, runCost: 1800 });
  Object.assign(KINDS.planning, { people: 4, tat: { from: 20, to: 6 }, sla: { from: 80, to: 97 }, runCost: 900 });
  Object.assign(KINDS.quotes, { people: 5, tat: { from: 48, to: 10 }, sla: { from: 55, to: 90 }, runCost: 1200 });
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const SAMPLE_CLIENTS = [['Harapan Foods', 'Food and beverage', 'documents', 'Supplier invoices', 'Invoice reader'], ['Sinar Clinics', 'Healthcare', 'triage', 'Patient enquiries', 'Enquiry assistant'], ['Teguh Builders', 'Engineering and construction', 'quotes', 'Same-day quotations', 'Quote drafter'], ['Mutiara Freight', 'Logistics', 'planning', 'Driver rostering', 'Roster planner'], ['Cahaya Retail', 'Retail', 'triage', 'Customer service inbox', 'Inbox triage'], ['Delima Insurance', 'Insurance', 'documents', 'Claims intake', 'Claims reader'], ['Seri Hotels', 'Hospitality', 'planning', 'Housekeeping schedules', 'Shift planner'], ['Bistari Learning', 'Education', 'quotes', 'Training proposals', 'Proposal drafter']];

  // ------------------------------------------------------------------ state
  const freshWizard = () => ({ step: 1, method: 'link', product: 'Yara', sheetFile: null, devReady: false, solName: '', url: 'https://lease.teladan.example/internal/measure/v1', tests: [], tested: false, proposals: null, keep: { volume: true, quality: true, impact: true }, baseline: null });
  const START_DAY = '2026-10-14'; // last whole day collected; "today" is the day after
  const state = {
    signedIn: false, mode: null, role: 'daniel',
    setup: { step: 1, workspace: 'REKA Inisiatif', invites: [{ email: 'nurul@reka.re', role: 'Analyst' }, { email: 'aisyah@reka.re', role: 'Admin' }] },
    orgs: [], sims: [], focusSim: null, simDay: START_DAY, simReports: {}, playing: null, seq: 1,
    wiz: freshWizard(), newKind: 'documents', draftProj: null, draftOrg: null,
    range: 30, audience: 'staff', solTab: 'outcomes', demoState: 'live', approvalSel: null,
    approvals: M.approvals.map((a) => Object.assign({}, a)), myApprovals: [],
    audit: M.audit.slice(), myAudit: [],
    reportApproved: false, narrativeApproved: false,
    studio: false, sf: null, eventSim: null,
    tour: null, tourCtx: {}, ws: 'real', stash: {}, sandboxName: 'Demo workspace',
  };
  try { const t = localStorage.getItem('outcomes-theme'); if (t) document.documentElement.setAttribute('data-theme', t); } catch (e) { /* storage blocked */ }

  const me = () => M.staff[state.role];
  const has = (right) => me().rights.includes(right);
  const RUNGS = ['Viewer', 'Support', 'Operator', 'Admin', 'Owner'];
  const atLeast = (rung) => RUNGS.indexOf(me().rung) >= RUNGS.indexOf(rung);
  const demo = () => state.mode === 'demo';
  // Workspaces: your real one, a demo workspace (Demo studio and the guided demo live only here), and the example organisations.
  const WS_FIELDS = ['orgs', 'sims', 'myApprovals', 'myAudit', 'simReports', 'focusSim', 'simDay', 'wiz', 'sf', 'eventSim', 'an', 'bld', 'chat'];
  const freshWs = () => ({ orgs: [], sims: [], myApprovals: [], myAudit: [], simReports: {}, focusSim: null, simDay: START_DAY, wiz: freshWizard(), sf: null, eventSim: null, an: null, bld: null, chat: [] });
  const sandbox = () => state.mode === 'new' && state.ws === 'sandbox';
  function setWs(kind) {
    if (state.playing) { clearInterval(state.playing); state.playing = null; }
    state.studio = false;
    if (kind === 'example') { if (state.mode === 'new') { state.stash[state.ws] = {}; WS_FIELDS.forEach((f) => { state.stash[state.ws][f] = state[f]; }); state.wsLoaded = false; } state.mode = 'demo'; state.chat = []; state.an = null; state.bld = null; return; }
    if (state.mode === 'new' && state.ws === kind) return;
    if (state.mode === 'new') { state.stash[state.ws] = {}; WS_FIELDS.forEach((f) => { state.stash[state.ws][f] = state[f]; }); }
    Object.assign(state, state.stash[kind] || freshWs());
    state.ws = kind; state.mode = 'new';
  }
  const wsName = () => demo() ? 'Example data' : sandbox() ? state.sandboxName : state.setup.workspace;

  // ------------------------------------------------------------------ formats (brand kit 13)
  const nf = (n, dp = 0) => Number(n).toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const SYM = { MYR: 'RM', USD: 'US$' };
  const money = (a, c) => (SYM[c] || c + ' ') + nf(a);
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const day = (s) => { const d = M.toDate(s.slice(0, 10)); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); };
  const dayShort = (s) => { const d = M.toDate(s.slice(0, 10)); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; };
  const dayLong = (s) => { const d = M.toDate(s); return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const q = (k) => `<span class="q ${k}">${cap(k)}</span>`;
  const dash = (why) => `<span class="dash">–</span>${why ? ` <span class="needs">${esc(why)}</span>` : ''}`;
  const aiMark = (t) => `<span class="ai-mark"><img src="${SPARK}" alt="">${esc(t || 'Suggested by AI. You decide.')}</span>`;
  const initials = (s) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  const clock = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const today = () => M.addDays(state.simDay, 1);
  const now = () => (demo() ? '15 Oct 2026' : day(today())) + ', ' + clock();

  // ------------------------------------------------------------------ example workspace computation (data.js)
  const windowDays = (n, end) => { const last = end || M.LAST_DAY; return M.dayRange(M.addDays(last, -(n - 1)), last); };
  const seriesOf = (sol, metric) => (M.series[sol] && M.series[sol][metric]) || [];
  const firstDay = (sol, metric) => { const s = seriesOf(sol, metric); return s.length ? s[0].d : null; };
  function sumMetric(sol, metric, days) {
    const map = new Map(seriesOf(sol, metric).map((p) => [p.d, p.v]));
    const start = firstDay(sol, metric);
    let sum = 0, n = 0, missing = 0;
    days.forEach((d) => { if (!start || d < start) return; const v = map.has(d) ? map.get(d) : null; if (v === null || v === undefined) { missing++; return; } sum += v; n++; });
    return { sum, n, missing, expected: n + missing };
  }
  function impactDaily(sol, days) {
    const def = M.impact[sol];
    if (!def) return null;
    const vol = new Map(seriesOf(sol, def.volume).map((p) => [p.d, p.v])), start = firstDay(sol, def.volume);
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
  function portfolioImpact(days) { const t = { mid: 0, low: 0, high: 0 }; ROLLED.forEach((s) => { const r = impactSum(s, days); t.mid += r.mid; t.low += r.low; t.high += r.high; }); return t; }
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

  // ------------------------------------------------------------------ your workspace: projects and their simulated figures
  const orgOf = (sim) => state.orgs.find((o) => o.id === sim.orgId);
  const simById = (id) => state.sims.find((s) => s.id === id);
  const kindOf = (sim) => KINDS[sim.kind];
  const simsOf = (org) => state.sims.filter((s) => s.orgId === org.id);
  const firstSim = () => state.sims[0] || null;
  const hasBase = (sim) => sim.base && sim.base.method !== 'none';
  function simStatus(sim) {
    if (sim.stage === 'draft') return 'not_connected';
    if (sim.stage !== 'collecting') return sim.stage;
    return sim.ev.down ? 'failing' : sim.ev.stale ? 'stale' : 'fresh';
  }
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
  function simPoint(sim, d) {
    if (sim.stage !== 'collecting' || !sim.start || d < sim.start || d > state.simDay) return { d, before: true };
    const stop = sim.ev.down || sim.ev.stale;
    if ((stop && d >= stop) || sim.gaps.some(([a, b]) => d >= a && d <= b)) return { d, gap: true };
    const K = kindOf(sim), r = (k) => hash(sim.id + d + k);
    const wd = M.weekday(d), weekend = wd === 0 || wd === 6;
    const p = Math.min(1, (M.toDate(d) - M.toDate(sim.start)) / 864e5 / 120);
    let v = sim.vol * (weekend ? K.weekend : 1) * (1 + 0.15 * p) * (0.88 + 0.24 * r('v'));
    if (sim.ev.spike && d >= sim.ev.spike) v *= 1.6;
    v = Math.round(v);
    let rate = K.qual.from + (K.qual.to - K.qual.from) * p + (r('q') - 0.5) * K.qual.from * 0.15;
    if (sim.ev.quality && d >= sim.ev.quality) rate += K.qual.from * 0.7;
    const out = { d, v, flagged: Math.round(v * Math.max(0, rate) / 100), m: K.machine * (0.85 + 0.3 * r('m')) };
    out.people = Math.max(v ? 1 : 0, Math.round(K.people * (0.55 + 0.45 * p) * (weekend ? (K.weekend ? 0.35 : 0) : 1) * (0.85 + 0.3 * r('p'))));
    let tat = (K.tat.from + (K.tat.to - K.tat.from) * p) * (0.85 + 0.3 * r('t')); if (sim.ev.spike && d >= sim.ev.spike) tat *= 1.35; out.tat = tat;
    let sla = K.sla.from + (K.sla.to - K.sla.from) * p + (r('s') - 0.5) * 4; if (sim.ev.quality && d >= sim.ev.quality) sla -= 9; if (sim.ev.spike && d >= sim.ev.spike) sla -= 6; out.sla = Math.min(100, sla);
    out.fails = Math.round(v * 0.004 * (0.5 + r('f')));
    if (hasBase(sim)) { const B = sim.base, R = K.review; out.mid = v * (B.mid - out.m - R.mid) / 60; out.low = v * Math.max(0, B.low - out.m - R.high) / 60; out.high = v * (B.high - out.m - R.low) / 60; }
    return out;
  }
  const simDaily = (sim, days) => days.map((d) => simPoint(sim, d));
  function simSum(sim, days) {
    const o = { vol: 0, flagged: 0, mid: 0, low: 0, high: 0, n: 0, missing: 0, mw: 0 };
    simDaily(sim, days).forEach((p) => { if (p.before) return; if (p.gap) { o.missing++; return; } o.n++; o.vol += p.v; o.flagged += p.flagged; o.mw += p.m * p.v; if (p.mid !== undefined) { o.mid += p.mid; o.low += p.low; o.high += p.high; } });
    o.rate = o.vol ? 100 * o.flagged / o.vol : null; o.machine = o.vol ? o.mw / o.vol : 0;
    return o;
  }
  const simWindow = (n) => windowDays(n, state.simDay);
  const endDay = () => demo() ? M.LAST_DAY : state.simDay;
  const aWindow = (n) => windowDays(n, endDay());
  const lastFullMonth = () => { const t = M.toDate(M.addDays(endDay(), 1)); const d = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1)); return d.toISOString().slice(0, 7); };
  const prevMonth = (ym) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 2, 1)); return d.toISOString().slice(0, 7); };
  const monthName = (ym) => { const [y, m] = ym.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
  const nextMonthStart = () => { const t = M.toDate(today()); return day(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 1)).toISOString()); };
  function simReportState(sim) {
    const ym = lastFullMonth(), s = simSum(sim, monthWindow(ym));
    if (!sim.reportScheduled) return { st: 'none', ym };
    if (state.simReports[sim.id + ym]) return { st: 'approved', ym };
    return s.n ? { st: 'ready', ym } : { st: 'waiting', ym };
  }

  // ------------------------------------------------------------------ measures: one library for every project (PRD §10.6), plus your own
  // A project, for analytics and Ask, is anything with point(d): your simulated projects, or adapters over the example data.
  const projOfSim = (s) => ({ id: s.id, name: s.project.name, sol: s.name, org: orgOf(s).name, href: '#sim-' + s.id, nouns: kindOf(s).nouns, runCost: kindOf(s).runCost, tatBefore: kindOf(s).tat.from, stat: () => simStatus(s), point: (d) => simPoint(s, d), custom: () => (s.custom = s.custom || []), approvals: () => state.myApprovals });
  let DEMO_PROJ = null;
  function demoProjects() {
    if (DEMO_PROJ) return DEMO_PROJ;
    state.demoCustom = state.demoCustom || {};
    DEMO_PROJ = ['doc-workflow', 'invoice-triage', 'shift-planner', 'quote-drafter', 'enquiry-triage'].map((sid) => {
      const s = M.solutions[sid], o = orgById(s.org), vm = VOLUME[sid][0], start = firstDay(sid, vm);
      const vmap = new Map(seriesOf(sid, vm).map((p) => [p.d, p.v]));
      const imp = M.impact[sid] ? new Map(impactDaily(sid, M.dayRange(start, M.LAST_DAY)).map((p) => [p.d, p])) : null;
      const fl = sid === 'doc-workflow' ? new Map(seriesOf(sid, 'documents.returned_for_correction').map((p) => [p.d, p.v])) : null;
      const dur = sid === 'doc-workflow' ? new Map(seriesOf(sid, 'documents.generation_duration').map((p) => [p.d, p.v])) : null;
      return { id: sid, name: o.projects[0].name, sol: s.name, org: o.short, href: '#solution-' + sid, nouns: VOLUME[sid][1].split(' ').slice(-1)[0].toLowerCase(), runCost: o.runCost && o.runCost.currency === 'MYR' ? o.runCost.amount : null, tatBefore: null, stat: () => solStatus(sid),
        custom: () => (state.demoCustom[sid] = state.demoCustom[sid] || []), approvals: () => state.approvals,
        point(d) {
          if (!start || d < start || d > M.LAST_DAY) return { d, before: true };
          if (sid === 'doc-workflow' && state.demoState === 'stale' && d > '2026-10-12') return { d, gap: true };
          const v = vmap.get(d); if (v === null || v === undefined) return { d, gap: true };
          const p = { d, v };
          if (fl) p.flagged = fl.get(d);
          if (dur) p.m = dur.get(d) / 60;
          if (imp) { const x = imp.get(d); if (x && !x.gap && !x.before) Object.assign(p, { mid: x.mid, low: x.low, high: x.high }); }
          return p;
        } };
    });
    return DEMO_PROJ;
  }
  const projects = () => demo() ? demoProjects() : state.sims.filter((s) => s.stage === 'collecting').map(projOfSim);
  const projById = (id) => projects().find((p) => p.id === id) || (simById(id) ? projOfSim(simById(id)) : null);
  function totals(proj, days) {
    const t = { vol: 0, flagged: 0, mid: 0, low: 0, high: 0, n: 0, missing: 0, expected: 0, peopleSum: 0, workdays: 0, tatW: 0, slaW: 0, fails: 0, mw: 0, has: {}, days: days.length, runCost: proj.runCost || 0, tatBeforeW: 0 };
    days.forEach((d) => {
      const p = proj.point(d); if (p.before) return; t.expected++; if (p.gap) { t.missing++; return; } t.n++; t.vol += p.v;
      if (p.flagged !== undefined) { t.flagged += p.flagged; t.has.flagged = true; }
      if (p.mid !== undefined) { t.mid += p.mid; t.low += p.low; t.high += p.high; t.has.mid = true; }
      if (p.people !== undefined) { t.has.people = true; if (p.people) { t.peopleSum += p.people; t.workdays++; } }
      if (p.tat !== undefined) { t.has.tat = true; t.tatW += p.tat * p.v; }
      if (p.sla !== undefined) { t.has.sla = true; t.slaW += p.sla * p.v; }
      if (p.fails !== undefined) { t.has.fails = true; t.fails += p.fails; }
      if (p.m !== undefined) t.mw += p.m * p.v;
    });
    if (proj.tatBefore) t.tatBeforeW = proj.tatBefore * t.vol;
    if (!t.n) t.runCost = 0;
    return t;
  }
  function mergeTotals(list) {
    const o = { vol: 0, flagged: 0, mid: 0, low: 0, high: 0, n: 0, missing: 0, expected: 0, peopleSum: 0, workdays: 0, tatW: 0, slaW: 0, fails: 0, mw: 0, has: {}, days: 0, runCost: 0, tatBeforeW: 0 };
    list.forEach((t) => { Object.keys(o).forEach((k) => { if (k === 'has') Object.assign(o.has, t.has); else if (k === 'days' || k === 'workdays') o[k] = Math.max(o[k], t[k]); else o[k] += t[k]; }); });
    return o;
  }
  const MEASURES = [
    { key: 'freshness', domain: 'Technical health', name: 'Days with data', unit: '%', quality: 'measured', dp: 0, better: 'up', how: 'Days with figures ÷ days expected in the period.', calc: (t) => t.expected ? 100 * t.n / t.expected : null },
    { key: 'fails', domain: 'Technical health', name: 'Failed runs', unit: '', quality: 'measured', dp: 0, better: 'down', how: 'Runs the solution reported as failed.', calc: (t) => t.has.fails ? t.fails : null },
    { key: 'volume', domain: 'Usage', name: 'Work handled', unit: '', quality: 'measured', dp: 0, better: 'up', sum: true, how: 'Items the solution finished.', calc: (t) => t.n ? t.vol : null },
    { key: 'people', domain: 'Usage', name: 'People using it, a day', unit: '', quality: 'measured', dp: 1, better: 'up', how: 'Average distinct people on a working day. Never added across days.', calc: (t) => t.has.people && t.workdays ? t.peopleSum / t.workdays : null },
    { key: 'perPerson', domain: 'Usage', name: 'Handled per person, a day', unit: '', quality: 'derived', dp: 1, better: 'up', how: 'Work handled ÷ person-days.', calc: (t) => t.has.people && t.peopleSum ? t.vol / t.peopleSum : null },
    { key: 'tat', domain: 'Operations', name: 'Turnaround time', unit: 'h', quality: 'measured', dp: 1, better: 'down', how: 'Median hours from arrival to done, weighted by volume.', calc: (t) => t.has.tat && t.vol ? t.tatW / t.vol : null },
    { key: 'sla', domain: 'Operations', name: 'Within agreed time', unit: '%', quality: 'measured', dp: 1, better: 'up', how: 'Share done inside the time agreed with the organisation, weighted by volume.', calc: (t) => t.has.sla && t.vol ? t.slaW / t.vol : null },
    { key: 'quality', domain: 'Operations', name: 'Needed a person to fix', unit: '%', quality: 'derived', dp: 1, better: 'down', how: 'Items sent back or corrected ÷ items handled, from the totals.', calc: (t) => t.has.flagged && t.vol ? 100 * t.flagged / t.vol : null },
    { key: 'straight', domain: 'Operations', name: 'Straight-through rate', unit: '%', quality: 'derived', dp: 1, better: 'up', how: 'Items done with no correction ÷ items handled.', calc: (t) => t.has.flagged && t.vol ? 100 * (t.vol - t.flagged) / t.vol : null },
    { key: 'hours', domain: 'Business impact', name: 'Hours saved', unit: 'h', quality: 'estimated', dp: 0, better: 'up', sum: true, how: 'Items × (minutes by hand − machine − review) ÷ 60, with a likely range.', calc: (t) => t.has.mid ? t.mid : null, range: (t) => t.has.mid ? [t.low, t.high] : null },
    { key: 'value', domain: 'Business impact', name: 'Value of time freed', unit: 'RM', quality: 'estimated', dp: 0, better: 'up', sum: true, how: 'Hours saved × RM45, the hourly staff cost agreed with the organisation. An estimate, not cash saved.', calc: (t) => t.has.mid ? t.mid * 45 : null, range: (t) => t.has.mid ? [t.low * 45, t.high * 45] : null },
    { key: 'tatChange', domain: 'Business impact', name: 'Faster than before', unit: '%', quality: 'derived', dp: 0, better: 'up', how: 'Turnaround now against turnaround before go-live.', calc: (t) => t.has.tat && t.vol && t.tatBeforeW ? 100 * (t.tatBeforeW - t.tatW) / t.tatBeforeW : null },
    { key: 'costPer', domain: 'Commercial', name: 'Running cost per item', unit: 'RM', quality: 'derived', dp: 2, better: 'down', reka: true, how: 'Running cost from AX Frame ÷ work handled. REKA only, never in organisation output.', calc: (t) => t.runCost && t.vol ? t.runCost * t.days / 30 / t.vol : null },
  ];
  const comparable = (a, b) => a.expected > 0 && b.expected >= 0.8 * a.expected;
  const DOMAINS = ['Technical health', 'Usage', 'Operations', 'Business impact', 'Commercial'];
  const mByKey = (k) => MEASURES.find((m) => m.key === k);
  const fmtM = (m, v) => (v === null || v === undefined || !isFinite(v)) ? null : m.unit === 'RM' ? 'RM' + nf(v, m.dp) : m.unit === '%' ? nf(v, m.dp) + '%' : m.unit === 'h' ? nf(v, m.dp) + ' h' : nf(v, m.dp);
  const FIELDS = {
    handled: { label: 'Work handled', get: (p) => p.v },
    corrected: { label: 'Items a person fixed', get: (p) => p.flagged },
    straight: { label: 'Items done with no fix', get: (p) => p.flagged === undefined ? undefined : p.v - p.flagged },
    hours: { label: 'Hours saved', get: (p) => p.mid, est: true },
    machine: { label: 'Machine minutes', get: (p) => p.m === undefined ? undefined : p.m * p.v },
    tat: { label: 'Turnaround hours', get: (p) => p.tat, weighted: true },
    sla: { label: 'Within agreed time (%)', get: (p) => p.sla, weighted: true },
    people: { label: 'People using it', get: (p) => p.people },
    fails: { label: 'Failed runs', get: (p) => p.fails },
  };
  const OPS = { sum: 'Total of', avg: 'Average a day of', ratio: 'Share of', per: 'Per', value: 'Value of' };
  function evalCustom(proj, cm, days) {
    const fa = FIELDS[cm.a], fb = cm.b ? FIELDS[cm.b] : null;
    let A = 0, B = 0, n = 0, vol = 0, ok = false;
    days.forEach((d) => {
      const p = proj.point(d); if (p.before || p.gap) return;
      const va = fa.get(p); if (va === undefined || va === null || isNaN(va)) return;
      ok = true; n++; vol += p.v; A += fa.weighted ? va * p.v : va;
      if (fb) { const vb = fb.get(p); if (vb !== undefined && vb !== null) B += fb.weighted ? vb * p.v : vb; }
    });
    if (!ok) return null;
    const a = fa.weighted ? (vol ? A / vol : null) : A, b = fb ? (fb.weighted ? B / vol : B) : null;
    return { sum: a, avg: fa.weighted ? a : A / n, ratio: b ? 100 * a / b : null, per: b ? a / b : null, value: a * (+cm.rate || 0) }[cm.op];
  }
  const customMeta = (cm) => ({ unit: cm.op === 'ratio' ? '%' : cm.op === 'value' ? 'RM' : '', dp: cm.op === 'per' ? 2 : cm.op === 'ratio' ? 1 : 0, quality: (FIELDS[cm.a].est || (cm.b && FIELDS[cm.b].est) || cm.op === 'value') ? 'estimated' : (cm.op === 'ratio' || cm.op === 'per') ? 'derived' : 'measured' });
  const customFormula = (cm) => cm.op === 'ratio' ? `${FIELDS[cm.a].label} ÷ ${FIELDS[cm.b].label} × 100` : cm.op === 'per' ? `${FIELDS[cm.a].label} ÷ ${FIELDS[cm.b].label}` : cm.op === 'value' ? `${FIELDS[cm.a].label} × RM${cm.rate}` : `${OPS[cm.op]} ${FIELDS[cm.a].label.toLowerCase()}`;
  const weeksOf = (days) => { const out = []; for (let i = 0; i < days.length; i += 7) out.push(days.slice(i, i + 7)); return out; };

  function newOrg(name, industry, signed = true) {
    const o = { id: 'o' + state.seq++, name, industry, signed };
    state.orgs.push(o); return o;
  }
  function newSim(org, o) {
    const K = KINDS[o.kind];
    const sim = { id: 's' + state.seq++, orgId: org.id, kind: o.kind, project: { name: o.project, objective: o.objective || K.objective, live: o.live || day(M.addDays(today(), 19)), cadence: o.cadence || 'Monthly' }, name: o.sol || K.sol, vol: o.vol || K.vol, base: o.base || null, stage: 'draft', kpis: [], start: null, history: o.history || 14, ev: { stale: null, down: null, spike: null, quality: null }, gaps: [], reportScheduled: false };
    state.sims.push(sim); return sim;
  }
  function kpiProposals(sim) {
    const K = kindOf(sim);
    return [
      { id: 'volume', name: `${cap(K.nouns)} handled each month`, kind: 'Usage', quality: 'measured', why: 'The basic volume. Every other figure depends on it.', formula: `Total ${K.nouns} handled, by month` },
      { id: 'quality', name: `Share of ${K.nouns} ${K.qual.label}`, kind: 'Quality', quality: 'derived', why: 'Shows whether the AI’s work can be trusted. It should fall as the solution improves.', formula: `${cap(K.nouns)} ${K.qual.label} ÷ ${K.nouns} handled` },
      { id: 'impact', name: `Hours saved on ${sim.project.name.toLowerCase()}`, kind: 'Business impact', quality: 'estimated', why: `The outcome the organisation is paying for. Needs a baseline: how long a ${K.noun} takes by hand.`, formula: `${cap(K.nouns)} × (minutes by hand − machine minutes − review minutes) ÷ 60`, needsBaseline: true },
    ];
  }
  function sendSimForApproval(sim, keep, auto) {
    const props = kpiProposals(sim).filter((p) => keep[p.id]);
    sim.kpis = props.map((p) => p.id);
    sim.stage = auto ? 'approved' : 'review';
    props.forEach((p) => {
      const blocked = p.needsBaseline && !hasBase(sim);
      state.myApprovals.unshift({ id: 'a' + state.seq++, simId: sim.id, type: 'KPI', title: p.name, proposer: 'ai', editedBy: 'daniel', since: now(), status: auto ? (blocked ? 'blocked' : 'approved') : (blocked ? 'blocked' : 'waiting'), summary: p.why,
        fields: [['Worked out as', p.formula], ['Kind', p.kind]].concat(p.needsBaseline && hasBase(sim) ? [['Baseline', `${sim.base.mid} min per ${kindOf(sim).noun} (${sim.base.low} to ${sim.base.high})`]] : []),
        evidence: p.needsBaseline ? (hasBase(sim) ? (sim.base.note || ({ sample: `Timed sample of ${sim.base.n} ${kindOf(sim).nouns}`, history: 'Past records', estimate: 'Organisation estimate' })[sim.base.method]) : 'No baseline yet') : `Figures checked on ${day(today())}`,
        affects: `${sim.name} outcomes and the ${sim.project.cadence.toLowerCase()} report`, blocker: blocked ? 'No baseline yet.' : null });
    });
    return props.length;
  }
  function approveSim(sim, who) {
    state.myApprovals.forEach((a) => { if (a.simId === sim.id && a.status === 'waiting') a.status = 'approved'; });
    if (sim.stage === 'review') sim.stage = 'approved';
    log(`Approved the KPIs for ${sim.name}`, who || 'Aisyah Rahman');
  }
  function collectNow(sim) { sim.stage = 'collecting'; sim.start = sim.start || M.addDays(state.simDay, -(sim.history - 1)); log(`Collected ${sim.history} days of figures from ${sim.name}`, 'Collector'); }
  function advance(n) {
    for (let i = 0; i < n; i++) {
      state.simDay = M.addDays(state.simDay, 1);
      state.sims.forEach((s) => { if (s.stage === 'approved') collectNow(s); });
    }
  }

  // ------------------------------------------------------------------ charts
  function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
  function drawChart(el, points, opt) {
    if (!el) return;
    const W = Math.max(280, el.clientWidth || 640), H = opt.height || 220;
    const m = { l: 44, r: 12, t: 12, b: 26 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
    const val = (p) => opt.kind === 'band' ? p.high : p.v;
    const ymax = niceMax(Math.max(...points.filter((p) => !p.gap && !p.before).map(val), 0) * 1.08);
    const y = (v) => m.t + ih - (v / ymax) * ih;
    const n = points.length, bw = iw / n, xc = (i) => m.l + bw * i + bw / 2;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.label)}"><defs><pattern id="h-${opt.id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--s1-soft)"/><line x1="0" y1="0" x2="0" y2="6" stroke="var(--s1)" stroke-width="1.6" opacity=".55"/></pattern></defs>`;
    [0, ymax / 2, ymax].forEach((t) => { s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)" stroke-dasharray="${t ? '2 4' : ''}" fill="none"/><text x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end">${nf(t, t % 1 ? 1 : 0)}</text>`; });
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
    const vals = values.filter((v) => v !== null && v !== undefined);
    if (vals.length < 2) return '';
    const max = Math.max(...vals) || 1;
    const x = (i) => 2 + (i / Math.max(1, values.length - 1)) * (w - 6), y = (v) => h - 3 - (v / max) * (h - 6);
    let d = '', pen = false, last = null;
    values.forEach((v, i) => { if (v === null || v === undefined) { pen = false; return; } d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1); pen = true; last = [x(i), y(v)]; });
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true" style="flex:none"><path d="${d}" fill="none" stroke="var(--s1)" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>${last ? `<circle cx="${last[0]}" cy="${last[1]}" r="3" fill="var(--s1)" stroke="var(--surface)" stroke-width="1.5"/>` : ''}</svg>`;
  }
  function drawLines(el, labels, series, opt) {
    if (!el) return;
    const W = Math.max(280, el.clientWidth || 640), H = opt.height || 240, m = { l: 52, r: 12, t: 12, b: 26 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
    const all = series.flatMap((x) => x.vals).filter((v) => v !== null && v !== undefined && isFinite(v));
    const ymax = niceMax(Math.max(...all, 0) * 1.08), n = labels.length, step = n > 1 ? iw / (n - 1) : iw;
    const x = (i) => m.l + (n > 1 ? step * i : iw / 2), y = (v) => m.t + ih - (v / ymax) * ih;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.label)}">`;
    [0, ymax / 2, ymax].forEach((t) => { s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)" stroke-dasharray="${t ? '2 4' : ''}"/><text x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end">${esc(opt.fmtAxis ? opt.fmtAxis(t) : nf(t, t % 1 ? 1 : 0))}</text>`; });
    [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i).forEach((i, k, arr) => { s += `<text x="${x(i)}" y="${H - 6}" text-anchor="${k === 0 ? 'start' : k === arr.length - 1 ? 'end' : 'middle'}">${esc(labels[i])}</text>`; });
    series.slice().reverse().forEach((se) => {
      let d = '', pen = false;
      se.vals.forEach((v, i) => { if (v === null || v === undefined || !isFinite(v)) { pen = false; return; } d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1); pen = true; });
      s += `<path d="${d}" fill="none" stroke="${se.color}" stroke-width="${se.dashed ? 1.8 : 2.4}" ${se.dashed ? 'stroke-dasharray="5 4"' : ''} stroke-linejoin="round" stroke-linecap="round"/>`;
    });
    const lastI = series[0].vals.map((v, i) => [v, i]).filter(([v]) => v !== null && v !== undefined && isFinite(v)).pop();
    if (lastI) s += `<circle cx="${x(lastI[1])}" cy="${y(lastI[0])}" r="5" fill="${series[0].color}" stroke="var(--surface)" stroke-width="2.5"/>`;
    s += `<line class="xh" x1="0" x2="0" y1="${m.t}" y2="${m.t + ih}" stroke="var(--line-strong)" visibility="hidden"/><rect x="${m.l - 6}" y="${m.t}" width="${iw + 12}" height="${ih}" fill="transparent"/></svg>`;
    el.innerHTML = s + '<div class="tip" hidden></div>';
    const svg = $('svg', el), tip = $('.tip', el), xh = $('.xh', el);
    svg.addEventListener('pointermove', (ev) => {
      const r = svg.getBoundingClientRect(), i = Math.max(0, Math.min(n - 1, Math.round(((ev.clientX - r.left) * (W / r.width) - m.l) / (step || 1))));
      xh.setAttribute('x1', x(i)); xh.setAttribute('x2', x(i)); xh.setAttribute('visibility', 'visible'); tip.hidden = false;
      tip.innerHTML = `<b>${esc(opt.tipLabel ? opt.tipLabel(i) : labels[i])}</b>` + series.map((se) => `<div>${esc(se.name)} <span class="mono">${se.vals[i] === null || se.vals[i] === undefined ? '–' : esc(opt.fmt(se.vals[i]))}</span></div>`).join('');
      tip.style.left = Math.min(r.width - 190, Math.max(0, (x(i) / W) * r.width + 12)) + 'px'; tip.style.top = '6px';
    });
    svg.addEventListener('pointerleave', () => { tip.hidden = true; xh.setAttribute('visibility', 'hidden'); });
  }
  const bandTip = (p) => p.before ? '<div>Before collection started</div>' : p.gap ? '<div>No data. Not counted as zero.</div>' : `<div>Hours saved <span class="mono">${nf(p.mid)}</span></div><div class="muted">Likely ${nf(p.low)} to ${nf(p.high)}</div>`;

  // ------------------------------------------------------------------ shared UI bits
  const orgById = (id) => M.orgs.find((o) => o.id === id);
  const STATUS = { fresh: ['ok', 'On time'], stale: ['warn', 'Late'], failing: ['fault', 'Not answering'], not_connected: ['idle', 'Not connected'], review: ['info', 'Waiting for approval'], approved: ['info', 'Waiting for first data'], collecting: ['ok', 'Collecting'] };
  const statusPill = (st) => { const [c, w] = STATUS[st]; return `<span class="pill ${c}"><span class="dot"></span>${w}</span>`; };
  const solStatus = (id) => (id === 'doc-workflow' && state.demoState !== 'live') ? state.demoState : M.solutions[id].status;
  const RANGES = { 7: 'Last 7 days', 30: 'Last 30 days', 90: 'Last 90 days', 365: 'Last 12 months' };
  const rangeLabel = () => RANGES[state.range];
  const rangeSeg = () => `<div class="seg range" role="group" aria-label="Date range">${[[7, '7D'], [30, '30D'], [90, '90D'], [365, '12M']].map(([v, l]) => `<button type="button" data-range="${v}" aria-pressed="${state.range === v}" aria-label="${RANGES[v]}">${l}</button>`).join('')}</div>`;
  const gate = (ok, label, need, attrs = '', cls = 'btn primary') => ok ? `<button ${/type=/.test(attrs) ? '' : 'type="button"'} class="${cls}" ${attrs}>${label}</button>` : `<span class="head-actions"><button type="button" class="${cls}" disabled>${label}</button><span class="needs">${need}</span></span>`;
  // AXLE page header (SPEC §6): the title lives in the top bar; the page says what it is for, its state line,
  // "How this page works", and its range picker or main action. Entity pages also show who they are about.
  let curTitle = '', curPage = '';
  // Pages that show an organisation's own figures; everything else in the Dashboard is managing Outcomes.
  const DATA_PAGES = /^(results|reports|report|approvals|context|analytics|ask|solution|sim)$/;
  const stateWord = () => demo() ? 'Example data' : sandbox() ? 'Demo workspace, simulated' : 'Live database';
  function head(o) {
    curTitle = o.topTitle || String(o.title).replace(/<span class="avatar[^>]*>[^<]*<\/span>/g, '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
    const ranged = /data-range=/.test(o.actions || '');
    const stateLine = o.state !== undefined ? o.state : `${stateWord()}${ranged ? ' · ' + rangeLabel().toLowerCase() : ''} · updated ${day(today())}, 14:30 MYT`;
    const how = o.how || HOW[curPage];
    const kind = o.kind || (DATA_PAGES.test(curPage) ? 'data' : R8_ROUTES.test(curPage) ? null : 'manage');
    const chip = kind === 'data' ? `<span class="kind-chip data">${icon('analytics', 'sm')}Client data</span>` : kind === 'manage' ? `<span class="kind-chip manage">${icon('settings', 'sm')}Managing Outcomes</span>` : '';
    return `<header class="page-head${o.crumbs ? ' entity' : ''}"><div style="min-width:0;display:grid;gap:4px">${chip ? `<div>${chip}</div>` : ''}
      ${o.crumbs ? `<nav class="crumbs" aria-label="Breadcrumbs">${o.crumbs}</nav><h2 class="entity-title">${o.title}</h2>` : ''}
      ${o.lead ? `<p class="lead">${o.lead}</p>` : ''}${o.meta ? `<div class="meta-line">${o.meta}</div>` : ''}
      ${stateLine ? `<p class="state-line mono">${stateLine}</p>` : ''}
      ${how ? `<details class="how"><summary>How this page works</summary><div>${how}</div></details>` : ''}
    </div><div class="head-actions">${o.actions || ''}</div></header>`;
  }
  const crumbs = (...parts) => parts.map((p, i) => i < parts.length - 1 ? `${p[1] ? `<a href="${p[1]}">${esc(p[0])}</a>` : `<span>${esc(p[0])}</span>`}${icon('chev', 'sm')}` : `<span>${esc(p[0])}</span>`).join('');
  const kv = (rows, w = 130) => `<div class="list">${rows.map(([k, v]) => `<div class="row" style="grid-template-columns:${w}px minmax(0,1fr)"><span class="small muted">${k}</span><span class="small ink">${v}</span></div>`).join('')}</div>`;
  const emptyArt = '<div class="art" style="background-image:url(assets/spot-quiet.svg)"></div>';
  const gridFor = (n) => n >= 4 ? 'g4' : n === 3 ? 'g3' : 'g2';
  const orgTitle = (name) => `<span style="display:inline-flex;gap:12px;align-items:center"><span class="avatar lg" style="border-radius:12px">${initials(name)}</span>${esc(name)}</span>`;

  function toast(text, undo) {
    const t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status');
    t.innerHTML = `${icon('check', 'sm')}<span>${esc(text)}</span>${undo ? '<button type="button">Undo</button>' : ''}`;
    if (undo) $('button', t).addEventListener('click', () => { undo(); t.remove(); });
    const box = $('#toasts'); box.appendChild(t); while (box.children.length > 2) box.firstChild.remove();
    setTimeout(() => t.remove(), 4500);
  }
  const auditList = () => demo() ? state.audit : state.myAudit;
  const log = (what, who) => auditList().unshift([now(), who || me().name, what]);
  const go = (h) => { if (location.hash === '#' + h) render(); else location.hash = '#' + h; };

  // ------------------------------------------------------------------ AUTH and WELCOME
  function authShell(inner) {
    return `<div class="auth">
      <div class="auth-main">
        <div class="logo"><img src="assets/antarax-mark.svg" alt="">AXLE · Outcomes</div>
        <div class="auth-body"><div class="auth-card">${inner}</div></div>
        <div class="auth-foot"><span>REKA Inisiatif Sdn Bhd · for REKA staff</span><span>Need help? support@go.antarax.ai</span></div>
      </div>
      <aside class="auth-side" aria-hidden="true"><div class="art" style="background-image:url(assets/panel-white.svg)"></div>
        <span class="eyebrow" style="color:var(--hero-ink)"><img src="${SPARK}" alt="">Managed AI, measured</span>
        <h2>Show every organisation what their AI solution changed.</h2>
        <p>Connect a solution once. Outcomes collects its figures, compares them with the baseline you agreed, and drafts the monthly report for you to check.</p>
        <div class="quote-card"><div style="display:flex;justify-content:space-between;font-size:.8125rem"><span>Hours saved, September</span><span class="mono">Example</span></div><div class="big">1,035 h</div><div style="display:flex;justify-content:space-between;font-size:.8125rem"><span>Estimated · likely 572 to 1,421</span><span>vs baseline</span></div></div>
      </aside>
    </div>`;
  }
  const pages = {};
  pages.signin = () => authShell(`
    <div><span class="axle-tag">AXLE</span><h1 style="margin-top:12px">Sign in to AXLE · Outcomes</h1><p class="muted" style="margin-top:6px">REKA’s staff console for what each organisation’s AI solutions deliver.</p></div>
    <div class="sso">
      <button type="button" class="btn lg block primary" data-act="signin">${icon('lock')}Continue with REKA account</button>
      <div class="divider">or</div>
      <div class="field"><label for="si-email">Work email</label><input id="si-email" type="email" value="daniel@reka.re" autocomplete="email"></div>
      <button type="button" class="btn lg block" data-act="signin">Email me a sign-in link</button>
    </div>
    <p class="xs muted">Authorised REKA staff only. Two-step sign-in is on for every account, and every action is recorded. An account that isn’t on the REKA staff list can’t open AXLE.</p>`);
  pages.welcome = () => {
    const s = state.setup;
    const dots = `<div class="progress-dots" aria-label="Step ${s.step} of 3">${[1, 2, 3].map((i) => `<span class="${i <= s.step ? 'on' : ''}"></span>`).join('')}</div>`;
    if (s.step === 1) return authShell(`${dots}<div><p class="xs muted">Step 1 of 3</p><h1>Welcome, Daniel</h1><p class="muted" style="margin-top:6px">Let’s set up your workspace. It takes about a minute.</p></div>
        <form id="f-ws" class="grid" style="gap:16px">
          <div class="field"><label for="ws-name">Workspace name</label><input id="ws-name" value="${esc(s.workspace)}" required><span class="help">Usually your company. Organisations never see it.</span></div>
          <div class="field"><label for="ws-tz">Reporting time zone</label><select id="ws-tz"><option>Asia/Kuala_Lumpur (MYT)</option><option>Asia/Singapore (SGT)</option><option>Asia/Jakarta (WIB)</option></select><span class="help">Each organisation can use its own.</span></div>
          <div class="callout info">${icon('shield')}<span>Data is kept in Singapore. Outcomes only collects totals, never organisation documents or personal data.</span></div>
          <button type="submit" class="btn lg primary block">Continue</button>
        </form>`);
    if (s.step === 2) return authShell(`${dots}<div><p class="xs muted">Step 2 of 3</p><h1>Invite your team</h1><p class="muted" style="margin-top:6px">Analysts suggest KPIs. Project managers approve them. You can do this later.</p></div>
        <div class="grid" style="gap:10px">${s.invites.map((v, i) => `<div style="display:grid;grid-template-columns:minmax(0,1fr) 150px;gap:8px" class="field"><input aria-label="Email ${i + 1}" value="${esc(v.email)}" placeholder="name@reka.re"><select aria-label="Role ${i + 1}">${['Analyst', 'Project manager', 'Admin', 'Viewer'].map((r) => `<option ${r === v.role ? 'selected' : ''}>${r}</option>`).join('')}</select></div>`).join('')}
          <button type="button" class="btn ghost" data-act="add-invite" style="justify-self:start">${icon('plus', 'sm')}Add another</button></div>
        <div class="head-actions"><button type="button" class="btn lg primary" data-act="ws-next">Send invites</button><button type="button" class="btn lg ghost" data-act="ws-skip">Skip for now</button></div>`);
    return authShell(`${dots}<div><p class="xs muted">Step 3 of 3</p><h1>How do you want to start?</h1></div>
        <div class="choice-grid">
          <button type="button" class="choice" data-start="new" aria-pressed="false"><span class="ic">${icon('connect-ai')}</span><span><b>Connect my first project</b><span class="d">Add an organisation, create their project and connect its solution. We’ll guide you.</span></span><span class="pill info tag">Recommended</span></button>
          <button type="button" class="choice" data-start="tour" aria-pressed="false"><span class="ic">${icon('live')}</span><span><b>Watch the guided demo</b><span class="d">See a new project go from nothing to its first report, in ${TOUR.length} short steps.</span></span><span class="radio"></span></button>
          <button type="button" class="choice" data-start="demo" aria-pressed="false"><span class="ic">${icon('overview')}</span><span><b>Explore with example data</b><span class="d">A workspace with five organisations already running. Every figure is invented.</span></span><span class="radio"></span></button>
        </div>`);
  };

  // ------------------------------------------------------------------ APP SHELL
  // ---------- AXLE sidebar (SPEC §7): Dashboard · R8 switch, the AXLE standard groups as folding cards, then the Outcomes-only box.
  // Items with no page in this mock are listed (the standard never drops or renames one) but are not links.
  const AX_ICON = {
    watch: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z',
    organisations: 'M4 21V5l8-3 8 3v16M9 21v-4h6v4M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01',
    ai: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
    money: 'M12 2a10 10 0 100 20 10 10 0 000-20zM15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2',
    platform: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M16 4v4M10 10v4M18 16v4',
    operations: 'M3 12h4l3-7 4 14 3-7h4',
    trail: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    command: 'M5 21V4M5 4h11l-2 4 2 4H5',
    system: 'M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01',
    control: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M16 4v4M10 10v4M18 16v4',
  };
  const R8_ROUTES = /^(r8|incidents|troubleshoot|jobs|providers|services|configuration|ops-audit|links)(-.+)?$/;
  const rungOf = (u) => u.rung || 'Viewer';
  const axMode = (route) => R8_ROUTES.test(route) ? 'r8' : 'dash';
  function navModel() {
    const waiting = (demo() ? state.approvals : state.myApprovals).filter((a) => a.status === 'waiting').length;
    const reportsDue = demo() ? (state.reportApproved ? 0 : 1) : state.sims.filter((s) => simReportState(s).st === 'ready').length;
    const att = demo() ? demoAtt() : needsYou(), orgs = companies().length, R = r8Model();
    return {
      dash: [
        ['Watch', 'watch', [['Overview', 'home', att.length, 'loud'], ['Adoption', 'adoption']]],
        ['Organisations', 'organisations', [['Organisations', 'organisations', orgs, 'quiet'], ['Members'], ['Invitations'], ['Requests'], ['Support']]],
        ['AI', 'ai', [['Models & keys'], ['AI usage'], ['Live trace'], ['Prompts & quality']]],
        ['Money', 'money', [['Plans & features']]],
        ['Platform', 'platform', [['Demo', 'demo'], ['Settings', 'settings']]],
        ['Operations', 'operations', [['Errors'], ['Alerts'], ['Backups'], ['Access']]],
        ['Trail', 'trail', [['Audit', 'audit'], ['Staff', 'staff']]],
      ],
      dashOnly: [['Results', 'results'], ['Reports', 'reports', reportsDue, 'loud'], ['Approvals', 'approvals', waiting, has('Approve') ? 'loud' : 'quiet'], ['Client context', 'context', ctxAll().filter((e) => !e.archived).length, 'quiet'], ['Analytics', 'analytics'], ['Ask', 'ask']],
      r8: [
        ['Command', 'command', [['Overview', 'r8'], ['Incidents', 'incidents', R.incidents.filter((i) => i.state === 'open').length, 'loud'], ['Troubleshoot', 'troubleshoot']]],
        ['System', 'system', [['Jobs', 'jobs', R.jobs.filter((j) => j.st === 'fault').length, 'loud'], ['Providers', 'providers', R.providers.filter((x) => x.st === 'fault').length, 'loud'], ['Services', 'services']]],
        ['Control and diagnostics', 'control', [['Configuration', 'configuration', R.config.filter((c) => !c.set).length, 'loud'], ['Operations audit', 'ops-audit']]],
      ],
      r8Only: [['Measurement links', 'links', R.links.filter((l) => l.st !== 'ok').length, 'loud']],
    };
  }
  const NAV_CUR = { 'new-organisation': 'organisations', 'new-project': 'organisations', connect: 'organisations', track: 'organisations', screens: 'demo', organisation: 'organisations', results: 'results', solution: 'results', sim: 'results', report: 'reports', guide: 'home' };
  function navHtml(route) {
    const mode = axMode(route), N = navModel();
    const curKey = R8_ROUTES.test(route) ? route.replace(/-.+$/, '') : (NAV_CUR[route] || NAV_CUR[parse()[0]] || route);
    state.navClosed = state.navClosed || { dash: { AI: true, Money: true, Operations: true }, r8: {} };
    const closedMap = state.navClosed[mode];
    const item = ([label, key, n, kind]) => {
      const on = key && key === curKey;
      const cnt = n ? `<span class="ax-count ${kind === 'loud' ? 'loud' : ''}" aria-label="${n} ${kind === 'loud' ? 'need a person' : 'in total'}">${n}</span>` : '';
      return key ? `<a class="ax-item" href="#${key}" ${on ? 'aria-current="page"' : ''}><span class="intan"></span><span class="lbl">${esc(label)}</span>${cnt}</a>`
        : `<span class="ax-item off" aria-disabled="true" title="Part of the AXLE standard; not drawn in this mock"><span class="intan"></span><span class="lbl">${esc(label)}</span></span>`;
    };
    const groups = N[mode].map(([label, k, items]) => {
      const hasCur = items.some((it) => it[1] && it[1] === curKey);
      const closed = !hasCur && !!closedMap[label];
      const roll = items.reduce((a, it) => a + (it[3] === 'loud' && it[2] ? it[2] : 0), 0);
      const hue = `var(--axle-group-${k})`;
      return `<div class="ax-group"><button type="button" class="ax-gbtn" data-navgroup="${esc(label)}" aria-expanded="${!closed}">
          <span class="ax-tile" style="background:color-mix(in srgb, ${hue} 16%, transparent)"><svg viewBox="0 0 24 24" style="stroke:${hue}"><path d="${AX_ICON[k]}"/></svg></span>
          <span class="ax-gtitle"><b style="color:${hue}">${esc(label)}</b>${closed ? `<small>${items.map((it) => esc(it[0])).join(' · ')}</small>` : ''}</span>
          ${closed && roll ? `<span class="ax-count loud" aria-label="${roll} need a person">${roll}</span>` : ''}
          <svg class="ax-chev" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>
        ${closed ? '' : `<div class="ax-items">${items.map(item).join('')}</div>`}</div>`;
    }).join('');
    const allOpen = N[mode].every(([label]) => !closedMap[label]);
    const only = mode === 'r8' ? N.r8Only : N.dashOnly;
    const u = me();
    return `<a class="ax-brand" href="#home"><img src="assets/antarax-mark.svg" alt="AntaraX"><span><b>AXLE</b><small>REKA STAFF CONSOLE</small></span></a>
      <div class="ax-mode" role="tablist" aria-label="AXLE mode"><a href="#home" role="tab" aria-selected="${mode === 'dash'}">Dashboard</a><a href="#r8" role="tab" aria-selected="${mode === 'r8'}">R8</a></div>
      <div class="ax-modeline">${mode === 'r8' ? 'R8 Full · is the platform okay, and why did this fail?' : 'How is Outcomes doing, and who needs us?'}</div>
      <section class="ax-only" aria-label="Outcomes only"><div class="ax-only-head"><span>${icon('analytics', 'sm').replace('<svg', '<svg style="color:#0459F7;width:15px;height:15px"')}</span><b>Outcomes only</b></div><p class="ax-sub">${mode === 'r8' ? 'The machinery only Outcomes runs' : 'Client data: what each organisation’s solutions delivered'}</p>${only.map(item).join('')}</section>
      <div class="ax-std"><span>AXLE STANDARD</span><i></i><button type="button" data-act="nav-all">${allOpen ? 'Collapse all' : 'Expand all'}</button></div>
      <p class="ax-sub" style="padding:0 8px">${mode === 'r8' ? 'The same groups in every product' : 'Managing Outcomes: organisations, people, settings, the trail'}</p>
      ${groups}
      <div class="ax-spacer"></div>
      <div class="ax-foot"><div class="ax-staff"><span class="av">${u.initials}</span><span><b>${esc(u.name)}</b><small>${esc(rungOf(u).toUpperCase())}</small></span></div><div class="ax-footline">Authorised REKA staff · every action is recorded</div></div>`;
  }
  // ---------- R8 model: one reading of the machinery for every R8 page, the health button and the counters.
  // Outcomes is R8 Full: it runs machinery of its own (nightly collectors, health checks, report drafting).
  const slug = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  function r8Model() {
    const links = [], incidents = [];
    const t = today(), stAt = (x) => x === 'failing' ? 'fault' : x === 'stale' ? 'warn' : x === 'fresh' ? 'ok' : 'idle';
    if (demo()) {
      Object.values(M.solutions).filter((x) => x.status !== 'not_connected').forEach((x) => {
        const o = orgById(x.org), st = stAt(solStatus(x.id));
        const since = st === 'fault' ? '2026-10-14' : st === 'warn' ? '2026-10-13' : null;
        links.push({ id: x.id, name: x.name, org: o.short, orgId: o.id, st, href: '#solution-' + x.id, url: `https://${slug(o.short)}.example/internal/measure/v1`, since, lastOk: st === 'ok' ? t : since ? M.addDays(since, -1) : t,
          tests: st === 'fault' ? [3, 17] : [17, 17], keyDays: 40 + Math.round(hash(x.id) * 120), catalog: '2026-09-' + String(10 + Math.round(hash(x.id + 'c') * 18)).padStart(2, '0'), metrics: 4 + Math.round(hash(x.id + 'm') * 6), ms: 180 + Math.round(hash(x.id + 't') * 400) });
      });
      incidents.push({ id: 'INC-0213', title: 'Quote drafter not answering', sev: 'High', state: 'open', org: 'Bina Jaya', since: '14 Oct 2026, 22:00', link: 'quote-drafter' });
      incidents.push({ id: 'INC-0212', title: 'Shift planner sent no figures for 2 nights', sev: 'Medium', state: 'acknowledged', org: 'Acme Plastics', since: '13 Oct 2026, 02:00', link: 'shift-planner' });
      incidents.push({ id: 'INC-0207', title: 'Document workflow late, then filled in', sev: 'Low', state: 'recovered', org: 'Contoh Logistik', since: '21 Sep 2026, 02:00', link: 'doc-workflow' });
    } else {
      state.sims.filter((s) => s.stage !== 'draft').forEach((s, i) => {
        const o = orgOf(s), st = stAt(simStatus(s)), since = s.ev.down || s.ev.stale || null;
        links.push({ id: s.id, name: s.name, org: o.name, orgId: o.id, st, href: '#sim-' + s.id, url: `https://${slug(o.name)}.example/internal/measure/v1`, since, lastOk: since ? M.addDays(since, -1) : s.stage === 'collecting' ? M.addDays(t, -1) : null,
          tests: st === 'fault' ? [3, 17] : [17, 17], keyDays: 3 + Math.round(hash(s.id) * 40), catalog: day(s.start || t).replace(/ /g, ' '), metrics: (s.kpis || []).length + 3, ms: 160 + Math.round(hash(s.id + 't') * 380), waiting: s.stage !== 'collecting' });
        const n = 300 + i;
        if (s.ev.down) incidents.push({ id: 'INC-0' + n, title: `${s.name} not answering`, sev: 'High', state: state.ack && state.ack[s.id] ? 'acknowledged' : 'open', org: o.name, since: day(s.ev.down) + ', 02:00', link: s.id });
        else if (s.ev.stale) incidents.push({ id: 'INC-0' + n, title: `${s.name} sent no figures for 2 nights`, sev: 'Medium', state: state.ack && state.ack[s.id] ? 'acknowledged' : 'open', org: o.name, since: day(s.ev.stale) + ', 02:00', link: s.id });
        (s.gaps || []).forEach(([a, b], j) => incidents.push({ id: 'INC-0' + (n - 50 - j), title: `${s.name} missed ${M.dayRange(a, b).length - 1} night${M.dayRange(a, b).length === 2 ? '' : 's'}`, sev: 'Low', state: 'recovered', org: o.name, since: day(a) + ', 02:00', link: s.id }));
      });
    }
    const bad = links.filter((l) => l.st === 'fault').length, late = links.filter((l) => l.st === 'warn').length, live = links.filter((l) => l.st !== 'idle').length;
    const runAt = `${dayShort(t)}, 02:00`;
    const jobs = [
      { id: 'collect', name: 'Nightly collection', plain: 'Every night at 02:00, each organisation’s time', st: bad ? 'fault' : late ? 'warn' : 'ok', last: runAt, took: `${2 + live} min`, next: `${dayShort(M.addDays(t, 1))}, 02:00`, eligible: live, processed: live - bad - late, failed: bad + late, skipped: links.length - live, why: links.filter((l) => l.st === 'fault' || l.st === 'warn').map((l) => `${l.name} (${l.org}): ${l.st === 'fault' ? 'the link answered 503' : 'no figures for the day yet'}`) },
      { id: 'health', name: 'Health checks', plain: 'Every 15 minutes', st: bad ? 'fault' : 'ok', last: `${dayShort(t)}, 14:30`, took: '4 s', next: `${dayShort(t)}, 14:45`, eligible: live, processed: live - bad, failed: bad, skipped: 0, why: links.filter((l) => l.st === 'fault').map((l) => `${l.name}: /health did not answer in 10 s`) },
      { id: 'compute', name: 'Work out KPIs and measures', plain: 'Every night at 02:30, after collection', st: 'ok', last: `${dayShort(t)}, 02:30`, took: '1 min', next: `${dayShort(M.addDays(t, 1))}, 02:30`, eligible: live, processed: live, failed: 0, skipped: 0, why: [] },
      { id: 'reports', name: 'Draft monthly reports', plain: 'The 1st of each month at 06:00', st: 'ok', last: `${day(t.slice(0, 7) + '-01')}, 06:00`, took: '3 min', next: nextMonthStart() + ', 06:00', eligible: live, processed: live, failed: 0, skipped: 0, why: [] },
      { id: 'contract', name: 'Contract test, every link', plain: 'Every night at 03:00', st: bad ? 'fault' : 'ok', last: `${dayShort(t)}, 03:00`, took: '40 s', next: `${dayShort(M.addDays(t, 1))}, 03:00`, eligible: live, processed: live - bad, failed: bad, skipped: 0, why: links.filter((l) => l.st === 'fault').map((l) => `${l.name}: 3 of 17 checks ran before the link stopped answering`) },
    ];
    const providers = [
      { id: 'anthropic', name: 'Anthropic API', what: 'Ask, report drafts, KPI and measure suggestions', st: 'ok', calls: 412, ok: 99.8, ms: 1840, quota: '18% of the monthly budget', lastErr: '12 Oct, 09:14 · 529 overloaded, retried', lastOk: `${dayShort(t)}, 14:29` },
      { id: 'resend', name: 'Resend', what: 'Report and alert emails', st: 'ok', calls: 37, ok: 100, ms: 210, quota: '1% of the plan', lastErr: 'None in 30 days', lastOk: `${dayShort(t)}, 08:02` },
      { id: 'r2', name: 'Cloudflare R2', what: 'Backups and report PDFs', st: 'ok', calls: 96, ok: 100, ms: 95, quota: '3 GB of 100 GB', lastErr: 'None in 30 days', lastOk: `${dayShort(t)}, 03:10` },
      { id: 'links', name: `Measurement links (${links.length})`, what: 'Each organisation’s solution, read every night', st: bad ? 'fault' : late ? 'warn' : 'ok', calls: links.length * 98, ok: links.length ? Math.round(1000 * (1 - (bad * 0.5 + late * 0.1) / Math.max(1, links.length))) / 10 : 100, ms: links.length ? Math.round(links.reduce((a, l) => a + l.ms, 0) / links.length) : 0, quota: 'No quota', lastErr: bad ? `${links.find((l) => l.st === 'fault').name}: 503` : 'None today', lastOk: `${dayShort(t)}, 14:30`, href: '#links' },
    ];
    const orgsNoAgreement = companies().filter((c) => !c.signed);
    const config = [
      { name: 'Anthropic API key', area: 'AI', set: true, note: 'In the vault · rotated 12 Sep 2026' },
      { name: 'Resend sender', area: 'Email', set: true, note: 'reports@reka.example · verified' },
      { name: 'Value of time freed', area: 'Measures', set: true, note: 'RM45 an hour, every organisation (D15)' },
      { name: 'Backups to R2', area: 'Platform', set: true, note: 'Nightly · last restore drill 1 Oct 2026, passed' },
      ...links.map((l) => ({ name: `Measurement key · ${l.name}`, area: l.org, set: true, note: `ax_msr_… · ${l.keyDays} days old${l.keyDays > 90 ? ' · due for rotation' : ''}` })),
      ...orgsNoAgreement.map((c) => ({ name: `Data agreement · ${c.short}`, area: c.short, set: false, note: 'Not recorded as signed: nothing is collected', href: c.href })),
    ];
    return { links, incidents, jobs, providers, config, bad, late, live };
  }

  // ---------- R8 pages (SPEC §7.4, §8.1, §10.11, §14.1). Level 1 actions ask for a reason and land in the operations audit.
  const stWord = { ok: 'Working', warn: 'Late', fault: 'Failing', idle: 'Waiting' };
  const stChip = (st, word) => `<span class="pill ${st === 'idle' ? 'idle' : st}"><span class="dot"></span>${esc(word || stWord[st])}</span>`;
  const opsLog = () => { state.ops = state.ops || {}; const k = demo() ? 'example' : state.ws; return (state.ops[k] = state.ops[k] || []); };
  const RUNG = ['Viewer', 'Support', 'Operator', 'Admin', 'Owner'];
  const lvlTag = (n) => `<span class="lvl-tag">Level ${n}</span>`;
  // An in-app dialog that asks for a reason (SPEC §14: never confirm() or prompt()).
  function askReason(o) {
    closeReason();
    const el = document.createElement('div'); el.id = 'reason';
    el.innerHTML = `<div class="scrim" data-act="reason-cancel"></div><form class="card reason" role="dialog" aria-modal="true" aria-labelledby="reason-h" id="reason-form">
      <h2 id="reason-h">${esc(o.title)}</h2><p class="small">${o.body || ''}</p>
      <div class="field"><label for="reason-t">Reason</label><textarea id="reason-t" required placeholder="${esc(o.placeholder || 'What happened, and why this action')}"></textarea><span class="help">Recorded in the operations audit with your name${o.level ? `, as a Level ${o.level} action` : ''}.</span></div>
      <div class="head-actions" style="justify-content:flex-end"><button type="button" class="btn" data-act="reason-cancel">Cancel</button><button type="submit" class="btn primary">${esc(o.confirm)}</button></div></form>`;
    document.body.appendChild(el); state.reasonFor = o; setTimeout(() => { const t = $('#reason-t'); if (t) t.focus(); }, 0);
  }
  function closeReason() { const el = $('#reason'); if (el) el.remove(); }
  function r8Do(o, reason) {
    opsLog().unshift({ at: now(), who: me().name, rung: rungOf(me()), what: o.what, target: o.target, reason, level: o.level || 1 });
    log(`${o.what} · ${o.target}: ${reason}`);
    if (o.run) o.run();
    closeReason(); render(); toast(o.done);
  }
  const r8Btn = (label, attrs, need = 'Operator', cls = 'btn sm') => atLeast(need) ? `<button type="button" class="${cls}" ${attrs}>${label} ${lvlTag(1)}</button>` : `<span class="head-actions"><button type="button" class="${cls}" disabled>${label} ${lvlTag(1)}</button><span class="needs">Needs ${need}</span></span>`;
  const r8Line = (label) => `R8 Full · ${label}`;

  pages.r8 = () => {
    const R = r8Model(), word = R.bad ? 'Degraded' : R.late ? 'Degraded' : 'Working', st = R.bad ? 'fault' : R.late ? 'warn' : 'ok';
    const ops = [...R.incidents.filter((x) => x.state === 'open').map((x) => ['fault', `${x.title}`, `${x.org} · ${x.id} · since ${x.since}`, '#troubleshoot-' + x.link, 'Troubleshoot']),
      ...R.jobs.filter((j) => j.st !== 'ok').map((j) => [j.st, `${j.name}: ${j.failed} of ${j.eligible} ${j.st === 'fault' ? 'failed' : 'late'}`, `Last run ${j.last} MYT`, '#jobs', 'Open job']),
      ...R.config.filter((c) => !c.set).map((c) => ['warn', `Missing setup: ${c.name}`, c.note, '#configuration', 'Open'])];
    const svc = SERVICES();
    return `${head({ title: 'Overview', lead: 'Is the platform okay, and why did this fail?', state: `${r8Line('collectors, health checks and report drafting')} · last check ${dayShort(today())}, 14:30 MYT` })}
    <section class="card state-card ${st}"><div class="sc-word"><span class="hd"></span><b>${word}</b></div>
      <p>${R.bad ? `${R.bad} measurement link${R.bad === 1 ? ' is' : 's are'} not answering` : R.late ? `${R.late} measurement link${R.late === 1 ? ' is' : 's are'} late` : 'Every service answered and every job ran'}${R.bad || R.late ? `, since ${esc((R.incidents.find((x) => x.state !== 'recovered') || {}).since || dayShort(today()))}` : ''}.</p>
      <dl class="mini build"><div><dt>Build</dt><dd class="mono">3e1f2a9</dd></div><div><dt>Deployed</dt><dd class="mono">14 Oct, 18:20</dd></div><div><dt>Matches main</dt><dd>${stChip('ok', 'Yes')}</dd></div><div><dt>Last check</dt><dd class="mono">14:30 MYT</dd></div></dl></section>
    <section class="card"><div class="card-head"><h2 class="diamond">Needs an operator</h2><span class="mono xs muted">${ops.length} · worst first</span></div>
      ${ops.length ? `<ul class="needs-list">${ops.map(([sv, t, m, h, a]) => `<li><span class="lvl" style="background:var(--${sv}-tint);color:var(--${sv}-ink)">${sv === 'fault' ? 'Failing' : 'Late'}</span><span class="w"><b>${esc(t)}</b><small>${esc(m)}</small></span><a class="btn sm" href="${h}">${a}</a></li>`).join('')}</ul>` : '<p class="small muted">Nothing. Every job ran and every service answered.</p>'}</section>
    <section class="grid g2">
      <div class="card"><div class="card-head"><h2>Platform services</h2><a class="small" href="#services">Services</a></div><div class="hstrip">${svc.map((x) => `<a class="htile ${x.st}" href="#services"><span class="n"><span class="hd"></span>${esc(x.name)}</span><span class="w">${stWord[x.st]}</span><span class="d mono">${esc(x.median)}</span></a>`).join('')}</div></div>
      <div class="card"><div class="card-head"><h2>Outcomes’ machinery</h2><span class="only-tag">OUTCOMES ONLY</span></div><div class="hstrip">${R.jobs.map((j) => `<a class="htile ${j.st}" href="#jobs"><span class="n"><span class="hd"></span>${esc(j.name)}</span><span class="w">${j.st === 'ok' ? 'Ran' : j.st === 'fault' ? 'Failed ' + j.failed : 'Late ' + j.failed}</span><span class="d mono">${esc(j.last)}</span></a>`).join('')}<a class="htile ${R.bad ? 'fault' : R.late ? 'warn' : 'ok'}" href="#links"><span class="n"><span class="hd"></span>Measurement links</span><span class="w">${R.live - R.bad - R.late} of ${R.live}</span><span class="d mono">answering</span></a></div></div>
    </section>
    <section class="card"><div class="card-head"><h2>Incidents</h2><a class="small" href="#incidents">All incidents</a></div>${incidentTable(R.incidents.slice(0, 5))}</section>
    <section class="card"><div class="card-head"><div><h2>Cost per organisation and subsystem</h2><p class="sub">An internal estimate for pricing and abuse decisions, this month</p></div></div>
      ${has('Commercial') ? `<div class="table-wrap"><table><thead><tr><th>Organisation</th><th class="num">Collection</th><th class="num">AI (Ask, drafts)</th><th class="num">Storage and email</th><th class="num">Total</th></tr></thead><tbody>${companies().map((c) => { const n = coSolutions(c).filter((x) => x.status !== 'not_connected').length, ai = Math.round(18 + 40 * hash(c.id)), col = n * 6, st = 2 + n; return `<tr><td><span class="name">${esc(c.short)}</span></td><td class="num">RM${col}</td><td class="num">RM${ai}</td><td class="num">RM${st}</td><td class="num ink">RM${col + ai + st}</td></tr>`; }).join('')}</tbody></table></div>`
        : `<div class="gate">${icon('lock')}<div><b class="ink">Needs the Commercial right</b><p class="small">Cost per organisation covers collection calls, AI usage and storage. Aisyah Rahman, an Admin, can grant it from Staff.</p></div></div><div class="figs" style="margin-top:12px">${['Collection', 'AI', 'Storage and email'].map((x) => `<div class="card fig"><span class="label">${x}</span><span class="value mono">–</span><span class="hint">Needs the Commercial right</span></div>`).join('')}</div>`}</section>
    <section class="card"><div class="card-head"><h2>Recent operations</h2><a class="small" href="#ops-audit">Operations audit</a></div>${opsTable(opsLog().slice(0, 5))}</section>`;
  };
  function SERVICES() {
    return [['API', 'ok', '42 ms'], ['Database', 'ok', '12 ms'], ['Workers', r8Model().bad ? 'warn' : 'ok', r8Model().bad ? '1 job retrying' : '0 queued'], ['Queue', 'ok', '0 waiting'], ['Storage', 'ok', '95 ms'], ['AI gateway', 'ok', '1.8 s'], ['Email', 'ok', '210 ms']].map(([name, st, median]) => ({ name, st, median }));
  }
  function incidentTable(list) {
    if (!list.length) return '<p class="small muted">No incidents. A failed check is a signal; an incident opens when one keeps failing.</p>';
    return `<div class="table-wrap"><table><thead><tr><th>Incident</th><th>Severity</th><th>Organisation</th><th>Since</th><th>State</th><th></th></tr></thead><tbody>${list.map((x) => `<tr><td><span class="name">${esc(x.title)}</span><span class="sub mono">${x.id}</span></td><td><span class="pill ${x.sev === 'High' ? 'fault' : x.sev === 'Medium' ? 'warn' : 'idle'}">${x.sev}</span></td><td>${esc(x.org)}</td><td class="mono">${esc(x.since)}</td><td>${stChip(x.state === 'open' ? 'fault' : x.state === 'acknowledged' ? 'warn' : 'ok', cap(x.state))}</td>
      <td style="text-align:right;white-space:nowrap">${x.state === 'open' ? (atLeast('Support') ? `<button type="button" class="btn sm" data-act="r8-ack" data-id="${x.id}" data-link="${x.link}">Acknowledge ${lvlTag(1)}</button>` : '') : ''} <a class="btn sm" href="#troubleshoot-${x.link}">Troubleshoot</a></td></tr>`).join('')}</tbody></table></div>`;
  }
  function opsTable(list) {
    if (!list.length) return '<p class="small muted">No operations yet. Run now, retry, test and suppress all appear here with who, what and why.</p>';
    return `<div class="table-wrap"><table><thead><tr><th>When</th><th>Who</th><th>What</th><th>Target</th><th>Reason</th></tr></thead><tbody>${list.map((o) => `<tr><td class="mono">${esc(o.at)}</td><td><span class="name">${esc(o.who)}</span><span class="sub">${esc(o.rung)}</span></td><td>${esc(o.what)} ${lvlTag(o.level)}</td><td>${esc(o.target)}</td><td>${esc(o.reason)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  pages.incidents = () => {
    const R = r8Model(), f = state.incF || 'all', counts = ['open', 'acknowledged', 'recovered'].map((k) => [k, R.incidents.filter((x) => x.state === k).length]);
    const list = R.incidents.filter((x) => f === 'all' || x.state === f);
    return `${head({ title: 'Incidents', lead: 'Signals that kept failing, with their state from open to closed.', state: r8Line('an incident opens when a link misses two nights or stops answering') })}
    <section class="strip">${[['all', 'All', R.incidents.length], ...counts.map(([k, n]) => [k, cap(k), n])].map(([k, l, n]) => `<button type="button" class="strip-b" data-incf="${k}" aria-pressed="${f === k}"><span>${l}</span><b class="mono">${n}</b></button>`).join('')}</section>
    <section class="card">${incidentTable(list)}</section>`;
  };
  pages.troubleshoot = (id) => {
    const R = r8Model(), L = id && R.links.find((l) => l.id === id);
    if (!L) {
      const bad = R.links.filter((l) => l.st !== 'ok' && l.st !== 'idle');
      return `${head({ title: 'Troubleshoot', lead: 'One problem, all its evidence. Pick a problem, or open one from Needs a person.', state: r8Line('application layer: links, jobs, providers') })}
      <section class="card">${bad.length ? `<ul class="needs-list">${bad.map((l) => `<li><span class="lvl" style="background:var(--${l.st}-tint);color:var(--${l.st}-ink)">${l.st === 'fault' ? 'Failing' : 'Late'}</span><span class="w"><b>${esc(l.name)} ${l.st === 'fault' ? 'not answering' : 'late'}</b><small>${esc(l.org)} · since ${l.since ? dayShort(l.since) : '–'}</small></span><a class="btn sm" href="#troubleshoot-${l.id}">Open</a></li>`).join('')}</ul>` : '<p class="small muted">Nothing to troubleshoot. Every link answered last night.</p>'}</section>`;
    }
    const fault = L.st === 'fault', since = L.since ? dayShort(L.since) : dayShort(today());
    const conc = (state.conclusions || {})[L.id] || '';
    const sup = (state.suppress || {})[L.id];
    const mine = opsLog().filter((o) => o.target === L.name);
    const tl = [[`${dayShort(L.lastOk || today())}, 02:04`, 'Collector', 'Last good collection: every figure passed its checks'],
      [`${since}, 02:00`, 'Collector', fault ? 'GET /health answered 503; observations not read' : 'Link answered; no figures for the day yet'],
      [`${since}, 02:15`, 'AXLE', fault ? 'Retried 3 times, 5 minutes apart; still 503' : 'Retried at 02:15 and 02:30; still no figures'],
      [`${since}, 06:00`, 'AXLE', `Alert sent to the project manager by email and in AXLE`],
      ...mine.slice().reverse().map((o) => [o.at, o.who, `${o.what}: ${o.reason}`])];
    return `${head({ title: `Troubleshoot · ${L.name}`, crumbs: crumbs(['Troubleshoot', '#troubleshoot'], [L.name]), lead: `${fault ? 'Not answering' : 'Late: no figures for the last night'} · ${esc(L.org)} · since ${since}`, state: r8Line(`opened from ${fault ? 'an open incident' : 'Needs a person'} · scope ${slug(L.org)}`) })}
    <div class="ts-head"><span class="pill ${fault ? 'fault' : 'warn'}">${fault ? 'High' : 'Medium'}</span>${stChip(L.st, fault ? 'Not answering' : 'Late')}${sup ? `<span class="pill idle">Alerts suppressed until ${esc(sup)}</span>` : ''}<a class="small" href="${L.href}">Open ${esc(L.name)}</a></div>
    <section class="card"><div class="card-head"><h2>Evidence</h2><span class="xs muted">Each fact says where it came from and when it was read. Layers with no backend are not shown.</span></div>
      <div class="layers">
        <div class="layer"><h3>Outside</h3><ul class="facts">
          <li>${stChip('ok', 'Resolves')} <span>DNS for <span class="mono">${esc(L.url.replace(/^https:\/\//, '').split('/')[0])}</span></span><small class="mono">health check · 14:30</small></li>
          <li>${stChip('ok', 'Valid')} <span>TLS certificate, 61 days left</span><small class="mono">health check · 14:30</small></li>
          <li>${stChip(fault ? 'fault' : 'ok', fault ? '503' : '200')} <span><span class="mono">GET /internal/measure/v1/health</span>${fault ? ' answered “Service unavailable” in 10.0 s' : ` answered ok in ${L.ms} ms`}</span><small class="mono">health check · 14:30</small></li></ul></div>
        <div class="layer"><h3>Application</h3><ul class="facts">
          <li>${stChip(fault ? 'fault' : 'warn', fault ? 'Not read' : 'Missing')} <span>Observations for ${since}${fault ? '' : ': the day ended, the link has none yet'}</span><small class="mono">collector · 02:30</small></li>
          <li>${stChip(L.tests[0] === L.tests[1] ? 'ok' : 'fault', `${L.tests[0]} of ${L.tests[1]}`)} <span>Contract test checks passed${L.tests[0] < L.tests[1] ? '; it stopped when the link stopped answering' : ''}</span><small class="mono">contract test · 03:00</small></li>
          <li>${stChip('ok', 'Valid')} <span>Signature accepted with the current key (${L.keyDays} days old)</span><small class="mono">collector · ${dayShort(L.lastOk || today())}</small></li>
          <li>${stChip('idle', 'Unchanged')} <span>Metric catalog version <span class="mono">${esc(String(L.catalog))}</span></span><small class="mono">manifest · ${dayShort(L.lastOk || today())}</small></li></ul></div>
      </div></section>
    <section class="grid g2">
      <div class="card"><h2>Timeline</h2><ol class="timeline">${tl.map(([t, w, x]) => `<li><span class="mono xs">${esc(t)}</span><span><b class="ink">${esc(w)}</b> ${esc(x)}</span></li>`).join('')}</ol></div>
      <div class="grid" style="gap:16px;align-content:start">
        <div class="card reading"><span class="eyebrow">AXLE’s reading · derived</span><p>${fault ? `The solution’s own service is down or overloaded: DNS and TLS are fine, but its health endpoint answers 503, and nothing reached the measurement code. This rests on the 14:30 health check and the 02:00 and 02:15 collection attempts. It does not show why the service is down.` : `The link answers and is signed correctly, but the day’s figures are not there yet. The solution’s own nightly job has probably not run. This rests on the 02:00 and 02:30 collection attempts and the last good collection on ${dayShort(L.lastOk || today())}.`}</p></div>
        <div class="card"><label class="eyebrow" for="conc" style="color:var(--ink)">Your conclusion</label><p class="xs muted">Stored apart from the evidence and the reading. An AI guess is never stored as a fact.</p><textarea id="conc" class="conc" placeholder="What you found, in your words">${esc(conc)}</textarea><div class="head-actions" style="margin-top:8px">${atLeast('Support') ? `<button type="button" class="btn sm" data-act="save-conc" data-id="${L.id}">Save conclusion</button>` : '<span class="needs">Needs Support</span>'}</div></div>
      </div>
    </section>
    <section class="card"><div class="card-head"><h2>Safe actions</h2><span class="xs muted">Only what applies to this problem. Changing the key lives in Configuration.</span></div>
      <div class="head-actions">${r8Btn('Retry collection now', `data-act="r8-retry" data-id="${L.id}"`)}${r8Btn('Run the contract test', `data-act="r8-test" data-id="${L.id}"`)}${r8Btn('Suppress alerts for 1 hour', `data-act="r8-suppress" data-id="${L.id}"`)}<a class="btn sm ghost" href="#configuration">Rotate the key</a></div></section>`;
  };
  pages.jobs = () => {
    const R = r8Model(), sel = R.jobs.find((j) => j.id === state.jobSel) || R.jobs.find((j) => j.st !== 'ok') || R.jobs[0];
    const paused = (state.paused || {});
    const durs = Array.from({ length: 14 }, (_, k) => 2 + Math.round(6 * hash(sel.id + k)));
    return `${head({ title: 'Jobs', lead: 'Every background job: when it runs, what it did, and what failed.', state: r8Line(`${R.jobs.length} jobs`) })}
    <section class="card"><div class="table-wrap"><table><thead><tr><th>Job</th><th>Runs</th><th>Last run</th><th>Result</th><th class="num">Took</th><th>Next run</th></tr></thead><tbody>
    ${R.jobs.map((j) => `<tr class="link ${j.id === sel.id ? 'sel' : ''}" data-jobsel="${j.id}" tabindex="0"><td><span class="name">${esc(j.name)}</span></td><td>${esc(j.plain)}</td><td class="mono">${esc(j.last)}</td><td>${paused[j.id] ? stChip('idle', 'Paused') : stChip(j.st, j.st === 'ok' ? 'Ran' : `${j.failed} ${j.st === 'fault' ? 'failed' : 'late'}`)}</td><td class="num">${esc(j.took)}</td><td class="mono">${paused[j.id] ? '–' : esc(j.next)}</td></tr>`).join('')}
    </tbody></table></div></section>
    <section class="card"><div class="card-head"><div><h2>${esc(sel.name)}</h2><p class="sub">${esc(sel.plain)}</p></div><div class="head-actions">${r8Btn('Run now', `data-act="r8-run" data-id="${sel.id}"`)}${sel.failed ? r8Btn('Retry failures', `data-act="r8-retryjob" data-id="${sel.id}"`) : ''}${r8Btn(paused[sel.id] ? 'Resume' : 'Pause', `data-act="r8-pause" data-id="${sel.id}"`)}</div></div>
      <dl class="mini four"><div><dt>Eligible</dt><dd class="mono">${sel.eligible}</dd></div><div><dt>Processed</dt><dd class="mono">${sel.processed}</dd></div><div><dt>Failed</dt><dd class="mono" style="color:var(--${sel.failed ? 'fault-ink' : 'ok-ink'})">${sel.failed}</dd></div><div><dt>Skipped</dt><dd class="mono">${sel.skipped}</dd></div></dl>
      ${sel.why.length ? `<h3 style="margin-top:16px">Why items failed</h3><ul class="plain">${sel.why.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : '<p class="small" style="margin-top:12px">Nothing failed on the last run.</p>'}
      <div style="margin-top:16px;display:flex;gap:16px;align-items:center;flex-wrap:wrap"><span class="small muted">Last 14 runs, minutes</span>${sparkline(durs, 160, 32)}</div>
      <details class="more" style="margin-top:12px"><summary>Advanced</summary><div class="mono small">${({ collect: '0 2 * * *', health: '*/15 * * * *', compute: '30 2 * * *', reports: '0 6 1 * *', contract: '0 3 * * *' })[sel.id]} · in each organisation’s time zone</div></details></section>`;
  };
  pages.providers = () => {
    const R = r8Model(), sel = R.providers.find((x) => x.id === state.provSel) || R.providers[0], res = (state.provTest || {})[sel.id];
    return `${head({ title: 'Providers', lead: 'Every outside service Outcomes depends on, worst first.', state: r8Line('calls and success in the last 24 hours') })}
    <section class="card"><div class="table-wrap"><table><thead><tr><th>Provider</th><th>Used for</th><th>State</th><th class="num">Calls</th><th class="num">Success</th><th class="num">Median</th><th>Quota</th></tr></thead><tbody>
    ${R.providers.slice().sort((a, b) => ['fault', 'warn', 'ok'].indexOf(a.st) - ['fault', 'warn', 'ok'].indexOf(b.st)).map((x) => `<tr class="link ${x.id === sel.id ? 'sel' : ''}" data-provsel="${x.id}" tabindex="0"><td><span class="name">${esc(x.name)}</span></td><td>${esc(x.what)}</td><td>${stChip(x.st)}</td><td class="num">${nf(x.calls)}</td><td class="num">${nf(x.ok, 1)}%</td><td class="num">${x.ms >= 1000 ? nf(x.ms / 1000, 1) + ' s' : x.ms + ' ms'}</td><td>${esc(x.quota)}</td></tr>`).join('')}
    </tbody></table></div></section>
    <section class="card"><div class="card-head"><div><h2>${esc(sel.name)}</h2><p class="sub">${esc(sel.what)}</p></div>${sel.href ? `<a class="btn sm" href="${sel.href}">Open measurement links</a>` : r8Btn('Test provider', `data-act="r8-ptest" data-id="${sel.id}"`)}</div>
      <dl class="mini four"><div><dt>Latest success</dt><dd class="mono" style="font-size:1rem">${esc(sel.lastOk)}</dd></div><div><dt>Latest error</dt><dd style="font-size:.875rem">${esc(sel.lastErr)}</dd></div><div><dt>Quota</dt><dd style="font-size:.875rem">${esc(sel.quota)}</dd></div><div><dt>Key</dt><dd style="font-size:.875rem">In the vault, never shown here</dd></div></dl>
      ${res ? `<div class="callout ${res.ok ? 'ok' : 'warn'}" style="margin-top:14px">${icon(res.ok ? 'check' : 'alerts')}<span>Test at ${esc(res.at)}: ${res.ok ? 'answered' : 'failed'} in <b class="mono">${res.ms} ms</b>.</span></div>` : ''}</section>`;
  };
  pages.services = () => {
    const svc = SERVICES();
    return `${head({ title: 'Services', lead: 'REKA’s own platform under Outcomes.', state: r8Line('uptime over the last 30 days') })}
    <section class="card"><div class="table-wrap"><table><thead><tr><th>Service</th><th>State</th><th class="num">Median</th><th class="num">Uptime, 30 days</th></tr></thead><tbody>${svc.map((x, i) => `<tr><td><span class="name">${esc(x.name)}</span></td><td>${stChip(x.st)}</td><td class="num">${esc(x.median)}</td><td class="num">${nf(99.9 + (i % 3) * 0.03, 2)}%</td></tr>`).join('')}
      <tr><td><span class="name">Deployed version</span></td><td>${stChip('ok', 'Matches main')}</td><td class="num">v0.5.0</td><td class="num mono">3e1f2a9</td></tr><tr><td><span class="name">Backups</span></td><td>${stChip('ok', 'Done')}</td><td class="num">03:10</td><td class="num">Restore drill 1 Oct, passed</td></tr></tbody></table></div></section>`;
  };
  pages.configuration = () => {
    const R = r8Model();
    return `${head({ title: 'Configuration', lead: 'Whether each setting Outcomes needs is set, never its value. Schedules and limits in plain words.', state: r8Line('changes need Admin') })}
    <section class="card"><div class="card-head"><h2>Setup</h2><span class="mono xs muted">${R.config.filter((c) => !c.set).length} missing</span></div><div class="table-wrap"><table><thead><tr><th>Setting</th><th>Area</th><th>State</th><th>Note</th><th></th></tr></thead><tbody>
      ${R.config.map((c) => `<tr><td><span class="name">${esc(c.name)}</span></td><td>${esc(c.area)}</td><td>${c.set ? stChip('ok', 'Set') : stChip('warn', 'Missing')}</td><td>${esc(c.note)}</td><td style="text-align:right">${c.href ? `<a class="btn sm" href="${c.href}">Open</a>` : /Measurement key/.test(c.name) ? (atLeast('Admin') ? `<button type="button" class="btn sm" data-act="r8-rotate" data-name="${esc(c.name)}">Rotate</button>` : '<span class="needs">Needs Admin</span>') : ''}</td></tr>`).join('')}
    </tbody></table></div></section>
    <section class="grid g2"><div class="card"><h2>Schedules</h2>${kv([['Collection', 'Every night at 02:00, each organisation’s time'], ['Health checks', 'Every 15 minutes'], ['KPIs and measures', 'Every night at 02:30'], ['Contract test', 'Every night at 03:00'], ['Report drafts', 'The 1st of each month at 06:00']], 150)}</div>
      <div class="card"><h2>Limits</h2>${kv([['Days per read', '92, as the Measurement Link contract says'], ['Page size', '100 observations'], ['Metrics per solution', '200'], ['Dimensions per metric', '5, with at most 20 values each'], ['Retries a night', '3, five minutes apart']], 150)}</div></section>`;
  };
  pages['ops-audit'] = () => `${head({ title: 'Operations audit', lead: 'Every R8 action with who, what, target and reason. The operations side of Audit, the same log.', state: r8Line(`${opsLog().length} actions`) })}<section class="card">${opsTable(opsLog())}</section>`;
  pages.links = () => {
    const R = r8Model();
    return `${head({ title: 'Measurement links', lead: 'Each organisation’s solution and its read-only Measurement Link: state, last good collection, the nightly contract test and the key.', state: r8Line(`${R.links.length} links · Outcomes only`) })}
    <section class="strip">${[['ok', 'Answering'], ['warn', 'Late'], ['fault', 'Not answering'], ['idle', 'Waiting for first data']].map(([k, l]) => `<div class="strip-b static"><span>${l}</span><b class="mono">${R.links.filter((x) => x.st === k).length}</b></div>`).join('')}</section>
    <section class="card"><div class="table-wrap"><table><thead><tr><th>Solution</th><th>State</th><th>Last good collection</th><th>Contract test</th><th>Key</th><th>Catalog</th><th class="num">Median</th><th></th></tr></thead><tbody>
    ${R.links.slice().sort((a, b) => ['fault', 'warn', 'idle', 'ok'].indexOf(a.st) - ['fault', 'warn', 'idle', 'ok'].indexOf(b.st)).map((l) => `<tr><td><span class="name">${esc(l.name)}</span><span class="sub">${esc(l.org)} · <span class="mono">${esc(l.url.replace('https://', ''))}</span></span></td><td>${stChip(l.st, l.st === 'fault' ? 'Not answering' : l.st === 'warn' ? 'Late' : l.st === 'idle' ? 'Waiting' : 'Answering')}</td><td class="mono">${l.lastOk ? dayShort(l.lastOk) : '–'}</td><td>${stChip(l.tests[0] === l.tests[1] ? 'ok' : 'fault', `${l.tests[0]} of ${l.tests[1]}`)}</td><td><span class="mono">${l.keyDays} days</span>${l.keyDays > 90 ? ' <span class="pill warn">Rotate</span>' : ''}</td><td class="mono">${esc(String(l.catalog))}</td><td class="num">${l.ms} ms</td>
      <td style="text-align:right;white-space:nowrap">${l.st === 'fault' || l.st === 'warn' ? `<a class="btn sm" href="#troubleshoot-${l.id}">Troubleshoot</a>` : `<a class="btn sm ghost" href="${l.href}">Open</a>`}</td></tr>`).join('')}
    </tbody></table></div></section>`;
  };

  function needsYou() {
    if (demo()) return [];
    const out = [];
    state.sims.forEach((s) => {
      const o = orgOf(s), st = simStatus(s);
      if (st === 'failing') out.push(['fault', 'alerts', `${s.name} stopped answering`, `${o.name} · since ${dayShort(s.ev.down)}`, '#troubleshoot-' + s.id, 'Troubleshoot']);
      if (st === 'stale') out.push(['warn', 'clock', `${s.name} hasn’t sent data since ${dayShort(M.addDays(s.ev.stale, -1))}`, `${o.name} · showing the last good figures`, '#troubleshoot-' + s.id, 'Troubleshoot']);
      if (s.stage === 'collecting' && st !== 'failing') {
        const a = simSum(s, simWindow(7)), b = simSum(s, windowDays(7, M.addDays(state.simDay, -7)));
        if (a.rate !== null && b.rate && a.rate > b.rate * 1.25) out.push(['warn', 'savings', `More ${kindOf(s).nouns} ${kindOf(s).qual.label}`, `${o.name} · ${nf(a.rate, 1)}% this week, ${nf(b.rate, 1)}% the week before`, '#sim-' + s.id, 'Look']);
        if (a.n && b.n && a.vol > b.vol * 1.4) out.push(['info', 'plan', `Volume up ${Math.round(100 * (a.vol - b.vol) / b.vol)}% this week`, `${o.name} · ${s.name}`, '#sim-' + s.id, 'Look']);
      }
      if (s.stage === 'draft') out.push(['info', 'connect-ai', `Connect ${s.name}`, `${o.name} · ${s.project.name}`, '#connect-' + s.id, 'Connect']);
      if (s.stage === 'collecting' && !hasBase(s) && s.kpis.includes('impact')) out.push(['info', 'target', `Hours saved for ${s.name} needs a baseline`, o.name, '#approvals', 'Add']);
      const r = simReportState(s);
      if (r.st === 'ready') out.push(['info', 'reports', `${monthName(r.ym)} report ready to review`, `${o.name} · ${s.project.name}`, '#report-' + s.id, 'Review']);
    });
    const waiting = state.myApprovals.filter((a) => a.status === 'waiting').length;
    if (waiting) out.push(['warn', 'shield', `${waiting} KPI${waiting === 1 ? '' : 's'} waiting for approval`, has('Approve') ? 'Approve the ones you didn’t set up' : 'A project manager decides', '#approvals', 'Review']);
    const order = { fault: 0, warn: 1, info: 2 };
    return out.sort((x, y) => order[x[0]] - order[y[0]]);
  }
  function bellHtml() {
    const item = (cls, ic, t, s, h) => `<a href="${h}"><span class="ico ${cls}" style="display:grid;place-items:center;width:32px;height:32px;border-radius:10px;flex:none">${icon(ic, 'sm')}</span><span><b class="ink">${esc(t)}</b><small>${esc(s)}</small></span></a>`;
    if (demo()) return '<h4>Notifications</h4>' + item('fault', 'alerts', 'Quote drafter stopped answering', 'Bina Jaya · 14 Oct, 22:00', '#solution-quote-drafter') + item('warn', 'shield', 'Baseline change waiting for you', 'Contoh Logistik · 13 Oct', '#approvals') + item('info', 'reports', 'September report drafted', 'Contoh Logistik · ready to review', '#report');
    const n = needsYou().slice(0, 5);
    return n.length ? '<h4>Notifications</h4>' + n.map(([c, ic, t, s, h]) => item(c, ic, t, s, h)).join('') : '<div class="empty" style="padding:20px"><p>No notifications yet. Alerts about your solutions appear here.</p></div>';
  }
  function appShell(route, inner) {
    const u = me(), R = r8Model(), bad = R.links.filter((l) => l.st === 'fault').length, late = R.links.filter((l) => l.st === 'warn').length;
    const hb = bad ? 'fault' : late ? 'warn' : '', hn = bad || late;
    const scope = state.scope && coById(state.scope);
    const banner = sandbox() ? `<div class="statebanner" role="status">${icon('flask', 'sm')}<span><b>${esc(state.sandboxName)}</b> is a demo workspace: every organisation and figure is simulated, nothing is sent and nothing counts in real totals.</span><button type="button" class="lnk" data-act="studio">Demo studio</button><span class="mono" style="flex:none">${dayShort(today())}</span></div>`
      : demo() ? `<div class="statebanner" role="status">${icon('alerts', 'sm')}<span><b>Example data.</b> Five invented organisations, for learning the console. Nothing here is real.</span><a href="#demo">Switch workspace</a></div>` : '';
    const offs = SWITCHES.filter(([k]) => !swOn(k)).map(([, l]) => l), paused = r8Model().jobs.filter((j) => (state.paused || {})[j.id]).map((j) => j.name);
    const banner2 = offs.length || paused.length ? `<div class="statebanner" role="status">${icon('alerts', 'sm')}<span><b>${[...offs.map((l) => `${l} is off`), ...paused.map((n) => `${n} is paused`)].join(' · ')}</b> since ${now()}. Figures may be out of date until it is back on.</span><a href="#${offs.length ? 'settings' : 'jobs'}">${offs.length ? 'Settings' : 'Jobs'}</a></div>` : '';
    return `<a class="skip" href="#view">Skip to content</a>
    <div class="app">
      <aside class="sidebar" id="sidebar" aria-label="AXLE">${navHtml(route)}</aside>
      <div class="scrim" id="scrim" hidden></div>
      <div class="main">
        <div class="topwrap"><header class="topbar">
          <button type="button" class="roundbtn menu-btn" id="menu-btn" aria-label="Open navigation" aria-controls="sidebar">${icon('menu')}</button>
          <div class="pillwell"><a class="a" href="https://antarax.ai" aria-label="AntaraX"><img src="assets/antarax-mark.svg" alt=""></a><a class="chip" href="#home" aria-label="Outcomes AXLE home"><span>${icon('analytics', 'sm').replace('<svg', '<svg style="color:#0459F7"')}</span>Outcomes</a></div>
          <span class="axle-tag">AXLE</span>
          <h1>${esc(curTitle || TITLES[parse()[0]] || 'Overview')}</h1>
          <div class="top-right">
            <div class="rel"><button type="button" class="barfield scope" data-act="scope" aria-haspopup="true"><span class="k">Organisation</span><span class="v">${scope ? esc(scope.short) : 'All organisations'}</span>${icon('chev-down', 'sm')}</button>
              <div class="pop" id="scope-pop" hidden><h4>Organisation</h4><button type="button" data-scope="" aria-pressed="${!scope}"><span><b class="ink">All organisations</b><small>Platform-level figures and every list</small></span></button>${companies().map((c) => `<button type="button" data-scope="${c.id}" aria-pressed="${!!scope && scope.id === c.id}"><span class="avatar" style="border-radius:8px;width:28px;height:28px">${initials(c.short)}</span><span><b class="ink">${esc(c.short)}</b><small>${esc(c.industry)} · ${cap(c.stage)}</small></span></button>`).join('')}</div></div>
            <button type="button" class="barfield search" data-act="palette">${icon('search', 'sm')}<span class="t">Find…</span><kbd>⌘K</kbd></button>
            <a class="roundbtn ${hb}" href="#r8" aria-label="R8: ${hn ? `${hn} measurement link${hn === 1 ? '' : 's'} ${bad ? 'failing' : 'late'}` : 'everything answering'}">${icon('monitoring', 'sm')}${hn ? `<span class="n">${hn}</span>` : ''}</a>
            <div class="rel"><button type="button" class="roundbtn" data-act="user" aria-haspopup="true" aria-label="Staff menu">${u.initials}</button>
              <div class="pop" id="user-pop" hidden>
                <h4>Your account</h4><div style="display:flex;gap:10px;align-items:center;padding:6px 10px 8px"><span class="avatar">${u.initials}</span><span style="flex:1;min-width:0"><b class="ink">${esc(u.name)}</b><small>${esc(u.note)} · two-step sign-in on</small></span><span class="rung">${esc(rungOf(u).toUpperCase())}</span></div>
                <hr><h4>Sign in as (mock only)</h4>${Object.values(M.staff).map((x) => `<button type="button" data-role="${x.id}" aria-pressed="${x.id === state.role}"><span class="avatar">${x.initials}</span><span style="flex:1"><b class="ink">${x.name}</b><small>${x.rung}${x.rights.length ? ' · ' + x.rights.join(', ') : ''}</small></span></button>`).join('')}
                <hr><h4>Workspace</h4>${[['real', state.setup.workspace, 'Live database'], ['sandbox', state.sandboxName, 'Demo workspace, simulated'], ['example', 'Example data', 'Five invented organisations']].map(([k, n, d2]) => `<button type="button" data-ws="${k}" aria-pressed="${(k === 'example' ? demo() : !demo() && state.ws === k)}">${icon(k === 'sandbox' ? 'flask' : k === 'example' ? 'overview' : 'home', 'sm')}<span><b class="ink">${esc(n)}</b><small>${d2}</small></span></button>`).join('')}
                <hr><a href="#screens">${icon('overview', 'sm')}<span>All screens (mock)</span></a><a href="#guide">${icon('insight', 'sm')}<span>AXLE guide</span></a>
                <button type="button" data-act="signout">${icon('logout', 'sm')}<span>Sign out</span></button>
              </div></div>
          </div>
        </header></div>
        ${banner}${banner2}
        <main class="content" id="view" tabindex="-1"><p class="mobile-title" aria-hidden="true">${esc(curTitle || TITLES[parse()[0]] || 'Overview')}</p>${inner}</main>
        <footer class="ax-footer">Authorised REKA staff · every action is recorded</footer>
      </div>
    </div>
    ${!demo() && state.studio ? studioHtml() : ''}
    ${state.tour !== null && !demo() ? tourHtml() : ''}
    <div id="palette" hidden></div>`;
  }


  // ------------------------------------------------------------------ HOME
  pages.home = () => demo() ? homeDemo() : homeMine();
  function setupSteps() {
    const s = firstSim(), st = s ? s.stage : null;
    return [
      { t: 'Set up your workspace', d: 'Name, time zone and team.', done: true },
      { t: 'Add your first organisation', d: 'The organisation, and their data agreement.', done: state.orgs.length > 0, href: '#track', cta: 'Start tracking' },
      { t: 'Create a project', d: 'What the solution is for, in the organisation’s words.', done: !!s, href: '#track', cta: 'Start tracking' },
      { t: 'Connect the solution', d: 'Copy the prompt for the developer and wait for the connection. Then choose KPIs and the baseline.', done: !!s && st !== 'draft', href: '#connect', cta: 'Connect' },
      { t: 'Get the KPIs approved', d: 'Someone else checks every KPI and baseline.', done: st === 'approved' || st === 'collecting', href: s ? '#sim-' + s.id : '#approvals', cta: 'Check status' },
      { t: 'See your first results', d: 'Figures arrive after the first nightly collection.', done: st === 'collecting', href: s ? '#sim-' + s.id : '#home', cta: 'Open solution' },
      { t: 'Schedule the organisation report', d: 'Drafted for you. Nothing goes out until you check it.', done: !!s && s.reportScheduled, href: '#reports', cta: 'Schedule' },
    ];
  }
  function checklistCard(compact) {
    const steps = setupSteps(), done = steps.filter((x) => x.done).length, next = steps.find((x) => !x.done);
    if (compact) return next ? `<section class="card"><div class="row" style="border:0;padding:0;grid-template-columns:64px minmax(0,1fr) auto"><div class="ring" style="--p:${Math.round(100 * done / steps.length)}"><span>${done}/${steps.length}</span></div><div><div class="what">Finish setting up your first project</div><div class="meta">Next: ${esc(next.t.toLowerCase())}</div></div><a class="btn primary sm" href="${next.href}">${next.cta}</a></div></section>` : '';
    return `<div class="card">
        <div class="card-head"><div style="display:flex;gap:16px;align-items:center"><div class="ring" style="--p:${Math.round(100 * done / steps.length)}"><span>${done}/${steps.length}</span></div><div><h2>${next ? 'Get your first project measured' : 'Your first project is being measured'}</h2><p class="small muted">${next ? `Next: ${esc(next.t.toLowerCase())}.` : 'Every step is done.'}</p></div></div></div>
        <div class="setup">${steps.map((x, i) => `<div class="step ${x.done ? 'done' : x === next ? 'now' : ''}"><span class="n">${x.done ? icon('check', 'sm') : i + 1}</span><div><div class="t">${x.t}</div><div class="d">${x.d}</div></div>${x.done ? '<span class="pill ok">Done</span>' : `<a class="btn ${x === next ? 'primary' : ''} sm" href="${x.href}">${x.cta}</a>`}</div>`).join('')}</div>
      </div>`;
  }
  function homeMine() {
    const collecting = state.sims.filter((s) => s.stage === 'collecting');
    const greet = head({ title: 'Overview', lead: collecting.length ? 'What needs a person, and how Outcomes is running. Each organisation’s figures are in Results.' : 'Outcomes is new here. Seven first steps take your first project from nothing to its first report.', actions: collecting.length ? rangeSeg() : '' });
    if (!collecting.length) {
      return `${greet}
      <section class="grid g-side">${checklistCard(false)}
        <div class="grid" style="gap:16px;align-content:start">
          <div class="card"><h3>How it works</h3><div class="list" style="margin-top:10px">
            ${[['connect-ai', 'Connect', 'The solution shares a few daily totals through a small read-only link. Its own code and data stay as they are.'], ['target', 'Agree', 'Choose KPIs and baselines with the organisation. Someone else approves them.'], ['savings', 'Measure', 'Each KPI is worked out every night. You can always see what is measured and what is estimated.'], ['reports', 'Report', 'A report is drafted for you. You check it before the organisation sees it.']].map(([ic, t, d]) => `<div class="row" style="grid-template-columns:36px minmax(0,1fr)"><span class="ico info">${icon(ic, 'sm')}</span><div><div class="what">${t}</div><div class="meta">${d}</div></div></div>`).join('')}</div></div>
          <div class="card"><h3>Want to see it working first?</h3><p class="small muted" style="margin:6px 0 12px">Watch a new project go from nothing to its first report, or open a workspace with five example organisations.</p><div class="head-actions"><button type="button" class="btn primary sm" data-act="tour-start">Watch the guided demo</button><button type="button" class="btn sm" data-act="switch-mode">Example workspace</button><a class="btn sm" href="#screens">See every screen</a></div></div>
        </div>
      </section>
      ${state.orgs.length ? clientGrid(aWindow(state.range)) : ''}`;
    }
    return overviewHtml(greet);
  }
  // ---------- Overview (AXLE SPEC §8): header, health strip, needs a person, platform figures, organisations at a glance, trend, recent actions, product block
  function readiness(c) {
    const sols = coSolutions(c);
    return [['Data agreement signed', c.signed], ['Project agreed', c.projects.length > 0], ['Solution connected', sols.some((x) => x.status !== 'not_connected')],
      ['KPIs approved', sols.some((x) => x.kpis[0] > 0)], ['Baseline recorded', mByKey('hours').calc(coTotals(c, aWindow(30))) !== null], ['First report sent', c.projects.some((p) => /sent|approved/i.test(p.report[1]))]];
  }
  function overviewHtml(header) {
    const days = aWindow(state.range), prevDays = windowDays(state.range, M.addDays(days[0], -1)), all = companies(), R = r8Model();
    const ps = all.flatMap(coProjs), T = mergeTotals(ps.map((p) => totals(p, days))), P = mergeTotals(ps.map((p) => totals(p, prevDays))), cmp = comparable(T, P);
    const hm = mByKey('hours'), vm = mByKey('value'), h = hm.calc(T), rg = hm.range(T);
    const att = demo() ? demoAtt() : needsYou();
    const sols = all.flatMap(coSolutions), sending = sols.filter((x) => x.status === 'fresh').length;
    const kp = sols.reduce((a, x) => [a[0] + x.kpis[0], a[1] + x.kpis[1]], [0, 0]);
    const waiting = (demo() ? state.approvals : state.myApprovals).filter((a) => a.status === 'waiting').length;
    const collect = R.jobs[0];
    const lvl = { fault: ['Urgent', 'var(--fault-tint)', 'var(--fault-ink)'], warn: ['Soon', 'var(--warn-tint)', 'var(--warn-ink)'], info: ['To do', 'var(--axle-info-chip)', 'var(--ink)'] };
    const tile = (name, st, word, detail, href) => `<a class="htile ${st}" href="${href}"><span class="n"><span class="hd"></span>${esc(name)}</span><span class="w">${esc(word)}</span><span class="d mono">${esc(detail)}</span></a>`;
    const fig = (label, value, hint, href, tag = '') => `<a class="card fig" href="${href}"><span class="label">${label} ${tag}</span><span class="value mono">${value}</span><span class="hint">${hint}</span></a>`;
    const stages = [['planning', 'Planning', 'var(--axle-text-disabled)'], ['onboarding', 'Onboarding', 'var(--s4)'], ['pilot', 'Pilot', 'var(--s2)'], ['live', 'Live', 'var(--s1)']].map(([k, l, c]) => [k, l, c, all.filter((x) => x.stage === k).length]).filter((x) => x[3]);
    const rows = all.map((c) => ({ c, r: readiness(c), needs: coNeeds(c), t: coTotals(c, days) })).sort((a, b) => (needSeverity(a.needs) - needSeverity(b.needs)) || (b.needs.length - a.needs.length));
    return `${header}
    <section class="hstrip" aria-label="Health">
      ${tile('App', 'ok', 'Working', 'v0.5.0 · 3e1f2a9', '#services')}${tile('Database', 'ok', 'Working', 'Singapore · 12 ms', '#services')}${tile('Sign-in', 'ok', 'Working', 'Two-step on for all staff', '#services')}
      ${tile('Email', 'ok', 'Working', 'Resend · 37 sent', '#providers')}${tile('AI provider', 'ok', 'Working', 'Anthropic · 99.8%', '#providers')}
      ${tile('Nightly collection', collect.st, collect.st === 'ok' ? 'Ran' : collect.st === 'fault' ? 'Failed for ' + collect.failed : 'Late for ' + collect.failed, collect.last + ' MYT', '#jobs')}
      ${tile('Measurement links', R.bad ? 'fault' : R.late ? 'warn' : 'ok', `${R.live - R.bad - R.late} of ${R.live} answering`, R.bad ? `${R.bad} not answering` : R.late ? `${R.late} late` : 'All on time', '#links')}
      ${tile('Last backup', 'ok', 'Done', dayShort(today()) + ', 03:10', '#services')}
    </section>
    <div class="ov-row">
      <section class="card ov-needs" aria-labelledby="needs-h"><div class="card-head"><h2 id="needs-h" class="diamond">Needs a person</h2><span class="mono xs muted">${att.length} open · worst first</span></div>
        ${att.length ? `<ul class="needs-list">${att.map(([sev, ic, t, m, href, a]) => `<li><span class="lvl" style="background:${(lvl[sev] || lvl.info)[1]};color:${(lvl[sev] || lvl.info)[2]}">${(lvl[sev] || lvl.info)[0]}</span><span class="w"><b>${esc(t)}</b><small>${esc(m)}</small></span><a class="btn sm" href="${href}">${a}</a></li>`).join('')}</ul>`
          : '<p class="small muted">Nothing needs a person. Every solution sent its figures and every job ran.</p>'}</section>
      <section class="card ov-block" aria-labelledby="col-h"><h2 id="col-h">Nightly collection</h2><p class="mono xs muted">${collect.last} MYT · took ${collect.took}</p>
        <dl class="mini"><div><dt>Links read</dt><dd class="mono">${collect.processed} of ${collect.eligible}</dd></div><div><dt>Days missing</dt><dd class="mono" style="color:var(--${collect.failed ? 'warn-ink' : 'ok-ink'})">${collect.failed}</dd></div><div><dt>Next run</dt><dd class="mono" style="font-size:1rem">${collect.next}</dd></div><div><dt>Contract tests</dt><dd class="mono">${R.links.filter((l) => l.tests[0] === l.tests[1]).length} of ${R.links.length}</dd></div></dl>
        ${collect.why.length ? `<p class="small">${esc(collect.why[0])}</p>` : '<p class="small">Every link answered and every figure passed its checks.</p>'}<a class="small" href="#jobs">Open the job</a></section>
    </div>
    <section class="figs" aria-label="Figures">
      ${fig(`Hours saved`, h === null ? '–' : nf(h) + '<small>h</small>', h === null ? 'No baseline approved yet' : `Likely ${nf(rg[0])} to ${nf(rg[1])} · open Results`, '#results', q('estimated'))}

      ${fig('Solutions sending data', `${sending}<small>of ${sols.length}</small>`, `${R.bad} not answering · ${R.late} late`, '#links')}
      ${fig('KPIs live', `${kp[0]}<small>of ${kp[1]}</small>`, `${waiting} waiting for approval`, '#approvals')}
      ${fig('Organisations', String(all.length), `${all.filter((x) => x.stage === 'live').length} live`, '#organisations')}
    </section>
    <section class="card" aria-labelledby="stage-h"><div class="card-head"><h2 id="stage-h">Organisations by stage</h2><span class="mono xs muted">${all.length} in total</span></div>
      <div class="stackbar" role="img" aria-label="${stages.map((x) => `${x[1]} ${x[3]}`).join(', ')}">${stages.map(([k, l, c, n]) => `<a href="#organisations" data-cfshow-go="${k === 'live' ? 'live' : 'early'}" title="${l}: ${n}" style="flex:${n} 1 0;background:${c}"></a>`).join('')}</div>
      <div class="legend">${stages.map(([, l, c, n]) => `<span><i style="background:${c}"></i>${l} <b class="mono ink">${n}</b></span>`).join('')}</div></section>
    <section class="card" aria-labelledby="glance-h"><div class="card-head"><h2 id="glance-h">Organisations at a glance</h2><a class="small" href="#organisations">All ${all.length} organisations</a></div>
      <div class="table-wrap"><table><thead><tr><th>Organisation</th><th>Stage</th><th>Solutions</th><th>Readiness</th><th>Problems</th><th class="num">Projects</th><th>Results</th></tr></thead><tbody>
      ${rows.map(({ c, r, needs, t }) => { const done = r.filter((x) => x[1]).length, hv = hm.calc(t); return `<tr class="link" data-go="${c.href.slice(1)}" tabindex="0"><td><span class="name">${esc(c.name)}</span><span class="sub mono">${slug(c.short)}</span></td><td><span class="pill idle">${cap(c.stage)}</span></td><td>${statusPill(coStatus(c))}</td>
        <td><span class="ready"><span class="bar-track"><span class="bar-fill" style="width:${100 * done / r.length}%"></span></span><span class="mono xs">${done} of ${r.length}</span></span></td>
        <td style="color:var(--${needs.length ? (needSeverity(needs) === 0 ? 'fault-ink' : 'warn-ink') : 'muted'})">${needs.length ? `${needs.length} open` : 'None'}</td><td class="num">${c.projects.length}</td><td>${coProjs(c).length ? `<a class="btn sm ghost" href="#results-${c.id}" data-stop>${icon('analytics', 'sm')}Results</a>` : '<span class="muted xs">Not yet</span>'}</td></tr>`; }).join('')}
      </tbody></table></div></section>
    <section class="card"><div class="card-head"><h2>Recent actions</h2><a class="small" href="#audit">Audit</a></div>${activityList(6)}</section>`;
  }
  function activityList(n) {
    const list = auditList().slice(0, n);
    if (!list.length) return '<p class="small muted">Nothing yet.</p>';
    return `<div class="list">${list.map(([t, w, what]) => `<div class="row"><span class="avatar">${w === 'Collector' ? icon('live', 'sm') : w === 'AI proposals' ? `<img src="${SPARK}" alt="" style="width:16px">` : initials(w.split(' · ')[0])}</span><div class="small"><b class="ink">${esc(w.split(' · ')[0])}</b> ${esc(what)}</div><span class="xs muted mono">${esc(t.replace(' 2026,', ''))}</span></div>`).join('')}</div>`;
  }
  pages.home.after = () => {
    if (demo()) {
      if (!$('#ch-home')) return;
      const daily = windowDays(state.range).map((d) => {
        const parts = ROLLED.map((s) => impactDaily(s, [d])[0]), ok = parts.filter((p) => !p.gap && !p.before);
        if (!ok.length) return { d, gap: parts.some((p) => p.gap), before: parts.every((p) => p.before) };
        return { d, mid: ok.reduce((a, p) => a + p.mid, 0), low: ok.reduce((a, p) => a + p.low, 0), high: ok.reduce((a, p) => a + p.high, 0) };
      });
      if ($('#ch-home')) drawChart($('#ch-home'), bucket(daily, state.range > 30), { id: 'home', kind: 'band', label: 'Hours saved across organisations', height: 240, tip: bandTip });
      return;
    }
    const el = $('#ch-mine-home'); if (!el) return;
    const sims = state.sims.filter((s) => s.stage === 'collecting' && hasBase(s));
    const daily = simWindow(state.range).map((d) => {
      const parts = sims.map((s) => simPoint(s, d)), ok = parts.filter((p) => !p.gap && !p.before && p.mid !== undefined);
      if (!ok.length) return { d, gap: parts.some((p) => p.gap), before: !parts.some((p) => p.gap) };
      return { d, mid: ok.reduce((a, p) => a + p.mid, 0), low: ok.reduce((a, p) => a + p.low, 0), high: ok.reduce((a, p) => a + p.high, 0) };
    });
    drawChart(el, bucket(daily, state.range > 30), { id: 'mh', kind: 'band', label: 'Hours saved across your projects', height: 240, tip: bandTip });
  };

  // example workspace home
  function homeDemo() {
    return overviewHtml(head({ title: 'Overview', lead: 'What needs a person, and how Outcomes is running. Each organisation’s figures are in Results.', actions: rangeSeg() }));
  }

  // ------------------------------------------------------------------ CLIENTS: one model for every workspace (organisation → project → solution)
  const EX_INDUSTRY = { 'contoh-logistik': 'Logistics', 'acme-plastics': 'Manufacturing', 'sampel-medik': 'Healthcare', 'bina-jaya': 'Engineering and construction', 'teladan-properties': 'Property and real estate' };
  const EX_REPORT = { 'contoh-logistik': () => state.reportApproved ? ['ok', 'September approved', '#report'] : ['warn', 'September ready to review', '#report'], 'acme-plastics': () => ['ok', 'September sent 3 Oct', null], 'bina-jaya': () => ['ok', 'Q3 sent 7 Oct', null], 'sampel-medik': () => ['idle', 'Drafts 1 Nov', null], 'teladan-properties': () => ['idle', 'Not scheduled', null] };
  const STATUS_ORDER = ['failing', 'stale', 'review', 'approved', 'not_connected', 'fresh', 'collecting'];
  const worstOf = (list) => STATUS_ORDER.find((st) => list.includes(st)) || 'not_connected';
  function companies() {
    if (demo()) {
      const dp = demoProjects();
      return M.orgs.map((o) => ({ id: o.id, name: o.name, short: o.short, industry: EX_INDUSTRY[o.id], stage: o.stage, href: '#organisation-' + o.id, signed: true, agreement: o.agreement, renewal: o.renewal, renewalRisk: o.renewalRisk, contract: o.contract, runCost: o.runCost, contact: 'Organisation contact on file', example: true,
        projects: o.projects.map((p) => ({ id: p.id, name: p.name, objective: p.objective, kind: M.solutions[p.solutions[0]].kind, cadence: o.id === 'bina-jaya' ? 'Quarterly' : 'Monthly', report: EX_REPORT[o.id](),
          solutions: p.solutions.map((sid) => { const s = M.solutions[sid]; return { id: sid, name: s.name, status: solStatus(sid), href: s.status === 'not_connected' ? null : '#solution-' + sid, proj: dp.find((x) => x.id === sid) || null, kpis: [s.kpis.approved, s.kpis.total] }; }) })) }));
    }
    return state.orgs.map((o) => {
      const sims = simsOf(o);
      const projects = sims.map((s) => { const r = simReportState(s); return { id: s.id, name: s.project.name, objective: s.project.objective, kind: kindOf(s).label, cadence: s.project.cadence, sim: s,
        report: r.st === 'ready' ? ['warn', `${monthName(r.ym)} ready to review`, '#report-' + s.id] : r.st === 'approved' ? ['ok', `${monthName(r.ym)} approved`, '#report-' + s.id] : r.st === 'waiting' ? ['info', `First draft ${nextMonthStart()}`, null] : ['idle', s.stage === 'collecting' ? 'Not scheduled' : 'Waiting for data', null],
        solutions: [{ id: s.id, name: s.name, status: simStatus(s), href: s.stage === 'draft' ? '#connect-' + s.id : '#sim-' + s.id, proj: s.stage === 'collecting' ? projOfSim(s) : null, kpis: [s.stage === 'collecting' ? s.kpis.filter((k) => k !== 'impact' || hasBase(s)).length : 0, s.kpis.length] }] }; });
      const stage = sims.some((s) => s.stage === 'collecting') ? 'live' : sims.some((s) => s.stage !== 'draft') ? 'onboarding' : 'planning';
      return { id: o.id, name: o.name, short: o.name, industry: o.industry, stage, href: '#organisation-' + o.id, signed: o.signed, agreement: o.signed ? 'Signed' : 'Not signed', renewal: '–', renewalRisk: '–', contract: null, runCost: null, contact: 'Farah Idris · farah@organisation.example', projects };
    });
  }
  const coById = (id) => companies().find((c) => c.id === id);
  const coSolutions = (c) => c.projects.flatMap((p) => p.solutions);
  const coProjs = (c) => coSolutions(c).filter((s) => s.proj).map((s) => s.proj);
  const coTotals = (c, days) => mergeTotals(coProjs(c).map((p) => totals(p, days)));
  const coStatus = (c) => worstOf(coSolutions(c).map((s) => s.status));
  function coNeeds(c) {
    const names = [c.name, c.short].concat(c.projects.map((p) => p.name), coSolutions(c).map((s) => s.name));
    const list = (demo() ? demoAtt() : needsYou()).filter((x) => names.some((n) => (x[2] + ' ' + x[3]).includes(n)));
    const ids = coSolutions(c).map((s) => s.id);
    const waiting = (demo() ? state.approvals.filter((a) => a.org === c.id) : state.myApprovals.filter((a) => ids.includes(a.simId) || ids.includes(a.projId))).filter((a) => a.status === 'waiting').length;
    if (waiting && !list.some((x) => /approval/.test(x[2]))) list.push(['warn', 'shield', `${waiting} item${waiting === 1 ? '' : 's'} waiting for approval`, c.short, '#approvals', 'Review']);
    return list;
  }
  // worst first: something broken, then something late or waiting, then a to-do; 3 when nothing needs you
  const needSeverity = (list) => Math.min(3, ...list.map((x) => ({ fault: 0, warn: 1, info: 2 })[x[0]] ?? 2));
  const chgPct = (v, pv) => v === null || pv === null || pv === undefined || !pv ? null : 100 * (v - pv) / Math.abs(pv);
  const chgHtml = (c, better = 'up') => c === null ? '<span class="muted">–</span>' : Math.abs(c) < 0.5 ? '<span class="mono muted">0%</span>' : `<span class="mono" style="color:var(--${Math.abs(c) < 1 ? 'muted' : (better === 'up' ? c >= 0 : c <= 0) ? 'ok-ink' : 'fault-ink'})">${c >= 0 ? '+' : '−'}${nf(Math.abs(c), 0)}%</span>`;
  function rememberClient(c) {
    const key = demo() ? 'example' : state.ws;
    state.recent = state.recent || {};
    const r = (state.recent[key] || []).filter((x) => x.id !== c.id);
    r.unshift({ id: c.id, name: c.short, href: c.href.slice(1) });
    state.recent[key] = r.slice(0, 3);
  }
  function routeClient(route) {
    const [pg, arg] = route.split(/-(.+)/);
    if (pg === 'sim' || pg === 'connect') { const s = simById(arg); return s ? s.orgId : null; }
    if (pg === 'solution') return M.solutions[arg] ? M.solutions[arg].org : null;
    return null;
  }
  const recentClients = () => { const key = demo() ? 'example' : state.ws; return ((state.recent || {})[key] || []).filter((x) => coById(x.id)); };

  function clientCard(c, days) {
    const t = coTotals(c, days), hm = mByKey('hours'), hv = hm.calc(t), st = coStatus(c), needs = coNeeds(c).length;
    const wk = weeksOf(aWindow(84)), ps = coProjs(c);
    const spark = ps.length ? sparkline(wk.map((w) => { const tt = mergeTotals(ps.map((p) => totals(p, w))); return hv !== null ? hm.calc(tt) : (tt.n ? tt.vol : null); })) : '';
    const fig = hv !== null ? `<div class="stat"><span class="label">Hours saved ${q('estimated')}</span><span class="value ${st === 'stale' || st === 'failing' ? 'stale-val' : ''}" style="font-size:1.5rem">${nf(hv)}<small>h</small></span></div>`
      : t.n ? `<div class="stat"><span class="label">Work handled</span><span class="value" style="font-size:1.5rem">${nf(t.vol)}</span><span class="hint">Hours saved needs a baseline</span></div>`
      : `<div class="stat"><span class="label">Hours saved</span><span class="value" style="font-size:1.5rem">${dash()}</span><span class="hint">${c.projects.length ? 'No figures yet' : 'No projects yet'}</span></div>`;
    return `<a class="card proj" href="${c.href}">
      <div class="top"><div style="display:flex;gap:10px;align-items:center;min-width:0"><span class="avatar" style="border-radius:10px">${initials(c.short)}</span><div style="min-width:0"><h3>${esc(c.short)}</h3><div class="org">${esc(c.industry)} · ${c.projects.length} project${c.projects.length === 1 ? '' : 's'}</div></div></div>${needs ? `<span class="pill warn"><span class="dot"></span>${needs} need${needs === 1 ? 's' : ''} you</span>` : statusPill(st)}</div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:10px">${fig}${spark}</div>
      <div class="list">${c.projects.slice(0, 3).map((p) => `<div class="row" style="grid-template-columns:minmax(0,1fr) auto;padding:7px 0"><span class="small ink" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}</span><span class="xs" style="display:flex;gap:4px">${p.solutions.map((s) => `<span class="dot" title="${esc(s.name)}: ${STATUS[s.status][1]}" style="color:var(--${STATUS[s.status][0] === 'idle' ? 'faint' : STATUS[s.status][0] === 'info' ? 'primary' : STATUS[s.status][0]})"></span>`).join('')}</span></div>`).join('')}${c.projects.length > 3 ? `<div class="xs muted" style="padding-top:6px">and ${c.projects.length - 3} more</div>` : ''}</div>
    </a>`;
  }

  function clientGrid(days) {
    const all = companies(), ex = demo();
    const list = all.map((c) => ({ c, sev: needSeverity(coNeeds(c)), st: STATUS_ORDER.indexOf(coStatus(c)) })).sort((a, b) => (a.sev - b.sev) || (a.st - b.st)).map((x) => x.c);
    const add = ex ? `<a class="card proj" href="#connect" style="border-style:dashed;place-content:center;justify-items:center;text-align:center;min-height:200px;box-shadow:none"><span class="ico info" style="width:44px;height:44px;border-radius:12px;display:grid;place-items:center">${icon('plus')}</span><b class="ink">Connect another solution</b><span class="small muted">About a day of developer time</span></a>`
      : `<a class="card proj" href="#new-organisation" style="border-style:dashed;place-content:center;justify-items:center;text-align:center;min-height:200px;box-shadow:none"><span class="ico info" style="width:44px;height:44px;border-radius:12px;display:grid;place-items:center">${icon('plus')}</span><b class="ink">Add an organisation</b><span class="small muted">Or simulate one in Demo studio</span></a>`;
    return `<section class="grid" style="gap:12px"><div class="card-head" style="margin:0"><div><h2>Organisations</h2><p class="sub">${all.length} organisation${all.length === 1 ? '' : 's'} · ${all.reduce((a, c) => a + c.projects.length, 0)} projects · those needing you first</p></div><a class="btn sm ghost" href="#organisations">All organisations${icon('chev', 'sm')}</a></div>
      <div class="grid g3">${list.map((c) => clientCard(c, days)).join('')}${add}</div></section>`;
  }

  // ---------- the organisation list
  pages.organisations = () => {
    const all = companies();
    const lead = 'Every organisation REKA measures for: its stage, setup and what it needs from a person. Its figures are in Results.';
    if (!all.length) return `${head({ title: 'Organisations', lead, actions: `<a class="btn" href="#new-organisation">${icon('plus', 'sm')}New organisation</a><a class="btn primary" href="#track">Start tracking</a>` })}<section class="card"><div class="empty">${emptyArt}<h3>No organisations yet</h3><p>Start with the organisation. You record their data agreement here, because nothing is collected until it is signed.</p><div class="head-actions" style="justify-content:center"><a class="btn primary" href="#new-organisation">${icon('plus', 'sm')}Add organisation</a><button type="button" class="btn" data-act="studio">Try a demo workspace</button></div></div></section>`;
    const f = state.cf = state.cf || { show: 'all', sort: 'needs', q: '' };
    const days = aWindow(state.range), prevDays = windowDays(state.range, M.addDays(days[0], -1)), hm = mByKey('hours'), vm = mByKey('value');
    let rows = all.map((c) => { const t = coTotals(c, days), tp = coTotals(c, prevDays); return { c, t, h: hm.calc(t), hc: comparable(t, tp) ? chgPct(hm.calc(t), hm.calc(tp)) : null, v: vm.calc(t), needs: coNeeds(c).length, sev: needSeverity(coNeeds(c)), st: coStatus(c) }; });
    const counts = { live: rows.filter((r) => r.c.stage === 'live').length, needs: rows.filter((r) => r.needs).length };
    const totH = mergeTotals(rows.map((r) => r.t));
    if (f.show === 'needs') rows = rows.filter((r) => r.needs);
    else if (f.show !== 'all') rows = rows.filter((r) => (f.show === 'early' ? ['pilot', 'onboarding', 'planning'] : [f.show]).includes(r.c.stage));
    if (f.q) rows = rows.filter((r) => (r.c.name + ' ' + r.c.industry + ' ' + r.c.projects.map((p) => p.name).join(' ')).toLowerCase().includes(f.q.toLowerCase()));
    const sorters = { needs: (a, b) => (a.sev - b.sev) || (b.needs - a.needs) || (STATUS_ORDER.indexOf(a.st) - STATUS_ORDER.indexOf(b.st)) || ((b.h || 0) - (a.h || 0)), hours: (a, b) => (b.h === null ? -1 : b.h) - (a.h === null ? -1 : a.h), change: (a, b) => (b.hc === null ? -1e9 : b.hc) - (a.hc === null ? -1e9 : a.hc), name: (a, b) => a.c.short.localeCompare(b.c.short) };
    rows.sort(sorters[f.sort]);
    if (f.group === 'stage' || f.group === 'industry') { const key = (r) => f.group === 'stage' ? ['live', 'pilot', 'onboarding', 'planning'].indexOf(r.c.stage) : r.c.industry; rows = rows.map((r, i) => [r, i]).sort((a, b) => (key(a[0]) < key(b[0]) ? -1 : key(a[0]) > key(b[0]) ? 1 : a[1] - b[1])).map((x) => x[0]); }
    const wk = weeksOf(aWindow(84));
    const strip = [['all', 'All', all.length], ['needs', 'Need a person', counts.needs], ['live', 'Live', counts.live], ['early', 'Getting started', all.length - counts.live]];
    return `${head({ title: 'Organisations', lead, actions: `<button type="button" class="btn" data-act="export">Export CSV</button>${demo() ? '' : `<a class="btn" href="#new-organisation">${icon('plus', 'sm')}New organisation</a><a class="btn primary" href="#track">Start tracking</a>`}` })}
    <section class="strip" aria-label="Organisations by state">${strip.map(([k, l, n]) => `<button type="button" class="strip-b" data-cfshow="${k}" aria-pressed="${f.show === k}"><span>${l}</span><b class="mono">${n}</b></button>`).join('')}
</section>
    <section class="card" style="padding:14px 18px"><div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">
      <div class="field" style="flex:1;min-width:180px"><input id="cf-q" placeholder="Search organisations or projects" aria-label="Search organisations" value="${esc(f.q)}" autocomplete="off"></div>
      <div class="field"><select id="cf-sort" aria-label="Sort">${[['needs', 'Needs a person first'], ['hours', 'Most hours saved'], ['change', 'Biggest improvement'], ['name', 'A to Z']].map(([k, l]) => `<option value="${k}" ${f.sort === k ? 'selected' : ''}>Sort: ${l}</option>`).join('')}</select></div>
      <div class="field"><select id="cf-group" aria-label="Group">${[['none', 'No grouping'], ['stage', 'Stage'], ['industry', 'Industry']].map(([k, l]) => `<option value="${k}" ${(f.group || 'none') === k ? 'selected' : ''}>Group: ${l}</option>`).join('')}</select></div>
    </div></section>
    <section class="card"><div class="table-wrap"><table class="client-table"><thead><tr><th>Organisation</th><th>Projects and solutions</th><th>Readiness</th><th>Data agreement</th><th>Results</th>${has('Commercial') ? '<th class="num">Fee</th>' : ''}<th>Renewal</th></tr></thead><tbody>
    ${rows.length ? rows.map((r, i) => { const c = r.c, ps = coProjs(c), gk = f.group === 'stage' ? cap(c.stage) : f.group === 'industry' ? c.industry : null, gh = gk && (i === 0 || (f.group === 'stage' ? cap(rows[i - 1].c.stage) : rows[i - 1].c.industry) !== gk) ? `<tr class="grp-row"><td colspan="8">${esc(gk)} <span class="mono">${rows.filter((x) => (f.group === 'stage' ? cap(x.c.stage) : x.c.industry) === gk).length}</span></td></tr>` : ''; return `${gh}<tr class="link" data-go="${c.href.slice(1)}" tabindex="0">
      <td><div style="display:flex;gap:10px;align-items:center"><span class="avatar" style="border-radius:10px">${initials(c.short)}</span><div><span class="name">${esc(c.name)}</span><span class="sub">${esc(c.industry)} · ${cap(c.stage)}</span></div></div>${r.needs ? `<span class="pill warn" style="margin-top:6px"><span class="dot"></span>${r.needs} need${r.needs === 1 ? 's' : ''} a person</span>` : ''}</td>
      <td>${c.projects.length ? c.projects.map((p) => `<div class="small" style="display:flex;gap:6px;align-items:center;white-space:nowrap">${p.solutions.map((s) => `<span class="dot" title="${esc(s.name)}: ${STATUS[s.status][1]}" style="color:var(--${STATUS[s.status][0] === 'idle' ? 'faint' : STATUS[s.status][0] === 'info' ? 'primary' : STATUS[s.status][0]})"></span>`).join('')}${esc(p.name)}</div>`).join('') : '<span class="muted">None yet</span>'}</td>
      <td>${(() => { const rd = readiness(c), done = rd.filter((x) => x[1]).length; return `<span class="ready"><span class="bar-track"><span class="bar-fill" style="width:${100 * done / rd.length}%"></span></span><span class="mono xs">${done} of ${rd.length}</span></span>`; })()}</td>
      <td>${c.signed ? `<span class="pill ok">${icon('check', 'sm')}Signed</span>` : '<span class="pill warn">Not signed</span>'}</td>
      <td>${ps.length ? `<a class="btn sm ghost" href="#results-${c.id}" data-stop>${icon('analytics', 'sm')}Results</a>` : '<span class="muted xs">Not collecting yet</span>'}</td>
      ${has('Commercial') ? `<td class="num">${c.contract ? money(c.contract.amount, c.contract.currency) : '–'}</td>` : ''}
      <td class="mono">${esc(c.renewal)}</td></tr>`; }).join('') : `<tr><td colspan="8"><div class="empty" style="padding:16px"><p>No organisations match. <button type="button" class="btn sm ghost" data-act="cf-reset">Show all</button></p></div></td></tr>`}
    </tbody></table></div></section>`;
  };
  pages.organisations.after = () => {
    const qi = $('#cf-q'); if (qi) qi.addEventListener('input', (e) => { state.cf.q = e.target.value; clearTimeout(state.cfT); state.cfT = setTimeout(() => { render(); const el = $('#cf-q'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 250); });
    const so = $('#cf-sort'); if (so) so.addEventListener('change', (e) => { state.cf.sort = e.target.value; render(); });
    const gr = $('#cf-group'); if (gr) gr.addEventListener('change', (e) => { state.cf.group = e.target.value; render(); });
  };

  // ---------- the organisation page: one template for every workspace
  function contohNarrative(organisation, canNarr) {
    const sep = contohMonth('2026-09'), aug = contohMonth('2026-08');
    if (organisation && !state.narrativeApproved) return `<section class="card"><div class="empty" style="padding:20px"><h3>Summary not shared yet</h3><p>The September summary is still a draft. The organisation sees it once it’s approved.</p></div></section>`;
    return `<section class="card ai-card"><div class="card-head"><span class="eyebrow"><img src="${SPARK}" alt="">September 2026 in brief</span>${state.narrativeApproved ? '<span class="pill ok"><span class="dot"></span>Approved</span>' : '<span class="pill warn"><span class="dot"></span>Draft</span>'}</div>
      <div class="narrative">
        <p>The document workflow finished <b class="mono">${nf(sep.docs)}</b> documents in September, up from <span class="mono">${nf(aug.docs)}</span> in August <span class="cite">Documents processed</span>. Against the timed baseline, that freed an estimated <b class="mono">${nf(sep.imp.mid)} hours</b> of preparation time, likely between <span class="mono">${nf(sep.imp.low)}</span> and <span class="mono">${nf(sep.imp.high)}</span> <span class="cite">Hours saved</span>.</p>
        <p>Fewer documents came back for correction: <span class="mono">${nf(sep.rate, 1)}%</span>, from <span class="mono">${nf(aug.rate, 1)}%</span> in August and <span class="mono">7.4%</span> before go-live. Invoices took <span class="mono">${nf(sep.ct, 1)} days</span> by month end, from <span class="mono">4.5</span> before.</p>
        <p class="small muted">21 and 22 September are missing and aren’t counted. These figures compare with the baseline. They don’t prove what caused the change.</p>
      </div>
      <div class="wfoot" style="margin-top:14px">${aiMark('Drafted by AI from the calculated figures. Every number checked.')}${state.narrativeApproved || organisation ? '' : gate(canNarr, 'Approve summary', state.role === 'nurul' ? 'You edited this, so someone else approves.' : 'Needs approval rights', 'data-act="approve-narrative"', 'btn primary sm')}</div>
    </section>`;
  }
  // Organisation 360 opens on what is missing (SPEC §10.3): a readiness checklist and the stage.
  function readinessBlock(c) {
    const r = readiness(c), left = r.filter((x) => !x[1]).length, st = ['planning', 'onboarding', 'pilot', 'live'], at = Math.max(0, st.indexOf(c.stage));
    return `<div class="ov-row">
      <section class="card" style="flex:2 1 460px;min-width:0"><h3>${left ? `Before ${esc(c.short)} is fully set up: ${left} thing${left === 1 ? '' : 's'} left` : `${esc(c.short)} is fully set up`}</h3>
        <ul class="ready-list">${r.map(([l, ok]) => `<li><span class="rk ${ok ? 'ok' : ''}" aria-hidden="true">${ok ? '✓' : ''}</span><span>${esc(l)}</span></li>`).join('')}</ul></section>
      <section class="card" style="flex:1 1 280px;min-width:0"><h3>Stage</h3><ol class="stepper">${st.map((x, i) => `<li class="${i < at ? 'done' : i === at ? 'now' : ''}"><span class="dotc"></span><span>${cap(x)}</span></li>`).join('')}</ol></section>
    </div>`;
  }
  // One organisation, two places (owner feedback, 15 Oct 2026): its account, which staff manage (Organisations),
  // and its results, the client data (Outcomes only → Results). Each links to the other.
  function companyPage(c, view = 'account') {
    rememberClient(c);
    const acct = view !== 'results', tk = acct ? 'coTab' : 'resTab';
    state.coView = view;
    if (state.coFor !== c.id + view) { state.coFor = c.id + view; state[tk] = 'overview'; }
    const organisation = !acct && state.audience === 'client';
    if (organisation && state[tk] === 'context') state[tk] = 'overview';
    const tab = state[tk] || 'overview';
    const days = aWindow(state.range), prevDays = windowDays(state.range, M.addDays(days[0], -1));
    const T = coTotals(c, days), P = coTotals(c, prevDays), cmp = comparable(T, P);
    const needs = organisation ? [] : coNeeds(c);
    const tabs = acct ? [['overview', 'Summary'], ['projects', `Projects and solutions (${c.projects.length})`], ['notes', 'Notes'], ['activity', 'Audit']] : [['overview', 'Results'], ['reports', 'Reports']].concat(organisation ? [] : [['context', `Client context (${ctxFor(c.id).length})`]]);
    const stat = (key, alt) => { let m = mByKey(key), v = m.calc(T); if (v === null && alt) { m = mByKey(alt); v = m.calc(T); } const pv = cmp ? m.calc(P) : null, rg = m.range ? m.range(T) : null; return `<div class="card stat"><span class="label">${esc(m.name)} ${q(m.quality)}</span><span class="value">${fmtM(m, v) || '–'}</span><span class="hint">${v === null ? 'Not shared by these solutions yet' : `${rg ? `Likely ${fmtM(m, rg[0])} to ${fmtM(m, rg[1])} · ` : ''}${cmp ? chgHtml(chgPct(v, pv), m.better) + ' vs before' : 'Too few days before to compare'}`}</span></div>`; };
    let body = '';
    if (tab === 'overview') {
      const canNarr = has('Approve') && state.role !== 'nurul';
      const wk = weeksOf(aWindow(84));
      const hTot = mByKey('hours').calc(T);
      const resultsCard = coProjs(c).length ? `<section class="card handoff"><div><span class="kind-chip data">${icon('analytics', 'sm')}Client data</span><h2 style="margin-top:8px">${esc(c.short)}’s results</h2><p class="small">${hTot !== null ? `<b class="mono ink">${nf(hTot)} h</b> saved ${rangeLabel().toLowerCase()}, an estimate. ` : ''}Figures, the monthly summary, reports and measures live in Results.</p></div><a class="btn" href="#results-${c.id}">Open results${icon('chev', 'sm')}</a></section>` : '';
      body = acct ? `
      ${needs.length ? `<section class="card"><div class="card-head"><h2>Needs you for ${esc(c.short)}</h2><span class="pill warn">${needs.length}</span></div><div class="list">${needs.map(([sev, ic, t, m, h, a]) => `<div class="row"><span class="ico ${sev}">${icon(ic, 'sm')}</span><div><div class="what">${esc(t)}</div><div class="meta">${esc(m)}</div></div><a class="btn sm" href="${h}">${a}</a></div>`).join('')}</div></section>` : ''}
      ${resultsCard}
      ${organisation ? '' : `<section class="grid g2">
        <div class="card"><div class="card-head"><h2>Contract</h2><span class="pill idle">${icon('lock', 'sm')}REKA only</span></div>
          ${!c.contract ? '<p class="small muted">No contract recorded yet.</p>' : has('Commercial') ? `<div class="grid g2"><div class="stat"><span class="label">Monthly fee</span><span class="value" style="font-size:1.375rem">${money(c.contract.amount, c.contract.currency)}</span></div><div class="stat"><span class="label">Running cost, September</span><span class="value" style="font-size:1.375rem">${c.runCost ? money(c.runCost.amount, c.runCost.currency) : '–'}</span><span class="hint">From AX Frame</span></div><div class="stat"><span class="label">Renewal</span><span class="value" style="font-size:1.125rem">${esc(c.renewal)}</span><span class="hint">Risk: ${esc(c.renewalRisk)}</span></div></div>` : `<div class="callout info">${icon('lock')}<span>Only people with the commercial right see fees. Switch to Aisyah Rahman from your profile menu to try it.</span></div>`}</div>
        <div class="card"><div class="card-head"><h2>People and agreement</h2><span class="pill idle">${icon('lock', 'sm')}REKA only</span></div>${kv([['Organisation contact', esc(c.contact)], ['REKA owner', 'Daniel Lim'], ['Data agreement', c.signed ? `<span class="pill ok">${icon('check', 'sm')}${esc(c.agreement)}</span>` : '<span class="pill warn">Not signed: nothing is collected</span>'], ['Notes', c.id === 'contoh-logistik' ? 'Finance director asked for a split by document type from October.' : 'None yet']], 120)}</div>
      </section>`}
      <section class="card"><div class="card-head"><h2>Recent activity</h2><button type="button" class="btn sm ghost" data-cotab="activity">Audit${icon('chev', 'sm')}</button></div>${(() => { const names = [c.name, c.short].concat(c.projects.map((p) => p.name), coSolutions(c).map((x) => x.name)); const list = auditList().filter(([, , w]) => names.some((n) => w.includes(n))).slice(0, 4); return list.length ? `<div class="list">${list.map(([t, w, x]) => `<div class="row" style="grid-template-columns:minmax(0,1fr) auto"><div class="small"><b class="ink">${esc(w.split(' · ')[0])}</b> ${esc(x)}</div><span class="xs muted mono">${esc(t.replace(' 2026,', ''))}</span></div>`).join('')}</div>` : '<p class="small muted">Nothing recorded yet.</p>'; })()}</section>` : `
      ${coProjs(c).length ? `<section class="grid g4 stats">${stat('hours', 'volume')}${stat('value', 'straight')}${stat('volume')}${stat('sla', 'quality')}</section>
      <section class="card"><div class="card-head"><div><h2>${mByKey('hours').calc(T) !== null ? 'Hours saved' : 'Work handled'} by project</h2><p class="sub">By week, last 12 weeks · each project on its own line</p></div><details class="more"><summary>How totals are counted</summary><div class="small" style="max-width:52ch">${c.id === 'contoh-logistik' ? 'Only Document workflow’s hours count: Invoice triage touches the same work, so adding it would count hours twice. ' : ''}Hours and work handled add up across projects. Rates are worked out from the combined totals, never averaged. People are never added across days.</div></details></div>
        <div class="chart" id="ch-co"></div><div class="legend" id="lg-co"></div></section>` : `<section class="card"><div class="empty">${emptyArt}<h3>${c.projects.length ? 'No figures yet' : 'No projects yet'}</h3><p>${c.projects.length ? 'Figures appear here once a solution is collecting.' : `Create the project you agreed with ${esc(c.short)}. You’ll connect its solution next.`}</p>${c.example ? '' : c.projects.length ? `<a class="btn primary" href="${c.projects[0].solutions[0].href}">Open ${esc(c.projects[0].name)}</a>` : `<button type="button" class="btn primary" data-act="proj-for" data-org="${c.id}">${icon('plus', 'sm')}Create project</button>`}</div></section>`}
      ${c.id === 'contoh-logistik' ? contohNarrative(organisation, canNarr) : ''}
      ${c.projects.length ? `<section class="card"><div class="card-head"><h2>Projects</h2>${c.example ? '' : `<button type="button" class="btn sm" data-act="proj-for" data-org="${c.id}">${icon('plus', 'sm')}New project</button>`}</div><div class="table-wrap"><table><thead><tr><th>Project</th><th>Solutions</th><th class="num">Hours saved</th><th class="num">Work handled</th><th class="num">Change</th><th>12 weeks</th><th>Report</th></tr></thead><tbody>
        ${c.projects.map((p) => { const ps = p.solutions.filter((s) => s.proj).map((s) => s.proj), t = mergeTotals(ps.map((x) => totals(x, days))), tp = mergeTotals(ps.map((x) => totals(x, prevDays))), h = mByKey('hours').calc(t), ch = comparable(t, tp) ? chgPct(h !== null ? h : t.vol, h !== null ? mByKey('hours').calc(tp) : tp.vol) : null, first = p.solutions.find((s) => s.href);
          return `<tr ${first ? `class="link" data-go="${first.href.slice(1)}" tabindex="0"` : ''}><td><span class="name">${esc(p.name)}</span><span class="sub">${esc(p.kind)}</span></td><td>${p.solutions.map((s) => `<div style="display:flex;gap:6px;align-items:center;white-space:nowrap" class="small">${statusPill(s.status)} ${esc(s.name)}</div>`).join('')}</td><td class="num">${h === null ? '<span class="dash">–</span>' : nf(h) + ' h'}</td><td class="num">${t.n ? nf(t.vol) : '<span class="dash">–</span>'}</td><td class="num">${chgHtml(ch)}</td><td>${ps.length ? sparkline(wk.map((w) => { const tt = mergeTotals(ps.map((x) => totals(x, w))); return h !== null ? mByKey('hours').calc(tt) : (tt.n ? tt.vol : null); }), 90, 26) : ''}</td><td><span class="pill ${p.report[0]}">${esc(p.report[1])}</span></td></tr>`; }).join('')}
      </tbody></table></div></section>` : ''}`;
    } else if (tab === 'projects') {
      body = `<div class="grid" style="gap:16px">${c.projects.map((p) => `<section class="card">
        <div class="card-head"><div><p class="xs muted">${esc(p.kind)} · ${esc(p.cadence)} report</p><h2>${esc(p.name)}</h2></div><span class="pill ${p.report[0]}">${esc(p.report[1])}</span></div>
        <p class="ink" style="max-width:70ch">“${esc(p.objective)}”</p>
        <div class="list" style="margin-top:12px">${p.solutions.map((s) => { const t = s.proj ? totals(s.proj, days) : null; const mini = (k) => { const m = mByKey(k), v = t ? m.calc(t) : null; return `<div class="stat"><span class="label">${esc(m.name)}</span><span class="value" style="font-size:1.125rem">${fmtM(m, v) || '–'}</span></div>`; };
          return `<div class="row" style="grid-template-columns:36px minmax(0,1fr) auto;align-items:start"><span class="ico info">${icon('box', 'sm')}</span><div style="display:grid;gap:10px"><div><div class="what">${esc(s.name)}</div><div class="meta">${statusPill(s.status)}<span>KPIs live ${s.kpis[0]} of ${s.kpis[1] || '–'}</span></div></div>${t ? `<div class="grid g3" style="gap:10px">${mini('hours')}${mini('volume')}${mini(mByKey('sla').calc(t) !== null ? 'sla' : 'quality')}</div>` : ''}</div>${s.href ? `<a class="btn sm" href="${s.href}">${s.status === 'not_connected' ? 'Connect' : 'Open'}</a>` : ''}</div>`; }).join('')}</div>
      </section>`).join('')}
      ${c.example ? '' : `<button type="button" class="card proj" data-act="proj-for" data-org="${c.id}" style="border-style:dashed;place-content:center;justify-items:center;text-align:center;min-height:120px;box-shadow:none;cursor:pointer"><span class="ico info" style="width:40px;height:40px;border-radius:12px;display:grid;place-items:center">${icon('plus')}</span><b class="ink">New project for ${esc(c.short)}</b></button>`}</div>`;
    } else if (tab === 'reports') {
      body = `<section class="card"><div class="card-head"><div><h2>Reports</h2><p class="sub">One per project, on its own schedule</p></div><button type="button" class="btn sm ghost" data-act="reports-for" data-org="${c.id}">All reports for ${esc(c.short)}${icon('chev', 'sm')}</button></div><div class="table-wrap"><table><thead><tr><th>Project</th><th>Cadence</th><th>Status</th><th></th></tr></thead><tbody>${c.projects.length ? c.projects.map((p) => `<tr><td><span class="name">${esc(p.name)}</span></td><td>${esc(p.cadence)}</td><td><span class="pill ${p.report[0]}">${esc(p.report[1])}</span></td><td>${p.report[2] ? `<a class="btn sm" href="${p.report[2]}">Open</a>` : ''}</td></tr>`).join('') : '<tr><td colspan="4" class="muted">No projects yet.</td></tr>'}</tbody></table></div></section>`;
    } else if (tab === 'context') {
      body = `<div class="callout info">${icon('shield')}<span><b>REKA only.</b> What ${esc(c.short)} told the account team, in their words. AI uses it to suggest measures for ${esc(c.short)}’s solutions; it is never in the organisation view, reports or exports.</span></div>${ctxForm(c.id)}${ctxList(c.id)}`;
    } else if (tab === 'notes') {
      state.notes = state.notes || {};
      const notes = state.notes[c.id] = state.notes[c.id] || (c.id === 'contoh-logistik' ? [['Daniel Lim', '2 Oct 2026, 10:12', 'Finance director asked for a split by document type from October. The new “reason” detail in the data makes that possible.']] : []);
      body = `<section class="card"><div class="card-head"><div><h2>Internal notes</h2><p class="sub">Never visible to ${esc(c.short)}. For what ${esc(c.short)} told you, use <a href="#results-${c.id}" data-act="to-ctx" data-org="${c.id}">client context</a>: AI can use it to suggest measures.</p></div><span class="pill idle">${icon('lock', 'sm')}REKA only</span></div>
        ${notes.length ? `<div class="list">${notes.map(([w, t, x]) => `<div class="row"><span class="avatar">${initials(w)}</span><div><div class="what" style="font-weight:400">${esc(x)}</div><div class="meta"><b class="ink">${esc(w)}</b><span class="mono">${esc(t)}</span></div></div><span></span></div>`).join('')}</div>` : '<p class="small muted">No notes yet.</p>'}
        ${atLeast('Support') ? `<form id="f-note" class="grid" style="gap:10px;margin-top:14px" data-org="${c.id}"><div class="field"><label for="note-t">Add a note</label><textarea id="note-t" placeholder="What the team should know about ${esc(c.short)}"></textarea></div><div><button type="submit" class="btn">Add note</button></div></form>` : '<p class="needs">Needs Support to add notes</p>'}</section>`;
    } else {
      const names = [c.name, c.short].concat(c.projects.map((p) => p.name), coSolutions(c).map((s) => s.name));
      const list = auditList().filter(([, , what]) => names.some((n) => what.includes(n)));
      body = `<section class="card">${list.length ? `<div class="list">${list.slice(0, 20).map(([t, w, what]) => `<div class="row"><span class="avatar">${w === 'Collector' ? icon('live', 'sm') : initials(w.split(' · ')[0])}</span><div class="small"><b class="ink">${esc(w.split(' · ')[0])}</b> ${esc(what)}</div><span class="xs muted mono">${esc(t.replace(' 2026,', ''))}</span></div>`).join('')}</div>` : '<p class="small muted">Nothing recorded for this organisation yet.</p>'}</section>`;
    }
    if (!acct) state.coView = 'results';
    return `${head({ crumbs: acct ? crumbs(['Organisations', '#organisations'], [c.short]) : crumbs(['Results', '#results'], [c.short]), title: orgTitle(c.name), topTitle: `${c.short} · ${acct ? 'Account' : 'Results'}`, kind: acct ? 'manage' : 'data',
      meta: `<span class="mono">${slug(c.short)}</span><span>${esc(c.industry)}</span><span class="pill ${c.stage === 'live' ? 'info' : 'idle'}">${cap(c.stage)}</span>${statusPill(coStatus(c))}${c.renewal !== '–' ? `<span>Renews ${esc(c.renewal)}</span>` : ''}`,
      actions: acct ? `${coProjs(c).length ? `<a class="btn" href="#results-${c.id}">${icon('analytics', 'sm')}Open results</a>` : ''}${c.example ? '' : `<button type="button" class="btn" data-act="proj-for" data-org="${c.id}">${icon('plus', 'sm')}New project</button>`}` : `<a class="btn sm ghost" href="#organisation-${c.id}">${icon('organisation', 'sm')}Account</a><button type="button" class="btn sm" data-act="ask-client" data-name="${esc(c.short)}"><img src="${SPARK}" alt="" style="width:16px">Ask about ${esc(c.short)}</button>${coProjs(c).length ? `<div class="seg" role="group" aria-label="View as"><button type="button" data-aud="staff" aria-pressed="${!organisation}">Staff view</button><button type="button" data-aud="client" aria-pressed="${organisation}">Organisation view</button></div>${rangeSeg()}` : ''}` })}
    ${organisation ? `<div class="callout info">${icon('client-view')}<span><b>You’re seeing what ${esc(c.short)} sees.</b> Fees, notes, activity and anything not yet approved are hidden.</span></div>` : ''}
    ${acct ? readinessBlock(c) : ''}
    <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" data-cotab="${k}" aria-selected="${tab === k}">${l}</button>`).join('')}</div>
    ${body}`;
  }
  function companyAfter(c) {
    const el = $('#ch-co'); if (!el || !c) return;
    const wk = weeksOf(aWindow(84)), hm = mByKey('hours'), useH = hm.calc(coTotals(c, aWindow(84))) !== null;
    const projs = c.projects.map((p) => ({ name: p.name, ps: p.solutions.filter((s) => s.proj).map((s) => s.proj) })).filter((x) => x.ps.length);
    const val = (ps, w) => { const t = mergeTotals(ps.map((x) => totals(x, w))); return useH ? hm.calc(t) : (t.n ? t.vol : null); };
    const colors = ['var(--s1)', 'var(--s2)', 'var(--s3)'];
    let series = projs.slice(0, 3).map((p, i) => ({ name: p.name, vals: wk.map((w) => val(p.ps, w)), color: colors[i] }));
    if (projs.length > 3) series.push({ name: 'Other projects', vals: wk.map((w) => val(projs.slice(3).flatMap((p) => p.ps), w)), color: 'var(--baseline)', dashed: true });
    drawLines(el, wk.map((w) => dayShort(w[0])), series, { label: 'By project', height: 220, fmt: (v) => useH ? nf(v) + ' h' : nf(v), tipLabel: (i) => 'Week of ' + day(wk[i][0]) });
    $('#lg-co').innerHTML = series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('');
  }
  // ---------- Results: the client data, across organisations and for one (Outcomes only)
  pages.results = (id) => {
    if (id) return coById(id) ? companyPage(coById(id), 'results') : pages.results();
    const all = companies().filter((c) => c.projects.length), days = aWindow(state.range), prevDays = windowDays(state.range, M.addDays(days[0], -1));
    const hm = mByKey('hours'), vm = mByKey('value'), wk = weeksOf(aWindow(84));
    const rows = all.map((c) => { const t = coTotals(c, days), tp = coTotals(c, prevDays), h = hm.calc(t); return { c, t, h, v: vm.calc(t), ch: comparable(t, tp) && h !== null ? chgPct(h, hm.calc(tp)) : null, ps: coProjs(c) }; }).sort((a, b) => (b.h === null ? -1 : b.h) - (a.h === null ? -1 : a.h));
    const T = mergeTotals(rows.map((r) => r.t)), P = mergeTotals(all.map((c) => coTotals(c, prevDays))), h = hm.calc(T), rg = hm.range(T);
    const fig = (label, value, hint, tag = '') => `<div class="card fig"><span class="label">${label} ${tag}</span><span class="value mono">${value}</span><span class="hint">${hint}</span></div>`;
    return `${head({ title: 'Results', kind: 'data', lead: 'What each organisation’s solutions delivered: the client data behind every report.', actions: rangeSeg() })}
    <section class="figs">
      ${fig('Hours saved', h === null ? '–' : nf(h) + '<small>h</small>', h === null ? 'No baseline approved yet' : `Likely ${nf(rg[0])} to ${nf(rg[1])}${comparable(T, P) ? ' · ' + chgHtml(chgPct(h, hm.calc(P))) : ''}`, q('estimated'))}
      ${fig('Value of time freed', fmtM(vm, vm.calc(T)) || '–', 'At RM45 an hour, an estimate', q('estimated'))}
      ${fig('Work handled', T.n ? nf(T.vol) : '–', `${rows.reduce((a, r) => a + r.ps.length, 0)} solutions collecting`, q('measured'))}
      ${fig('Organisations with results', String(rows.filter((r) => r.ps.length).length), `of ${companies().length}`)}
    </section>
    <section class="card"><div class="card-head"><div><h2>Hours saved</h2><p class="sub">${rangeLabel()} · every project with an approved baseline</p></div><a class="small" href="#analytics">Analytics</a></div><div class="chart" id="${demo() ? 'ch-home' : 'ch-mine-home'}"></div>
      <div class="legend"><span><i style="background:var(--s1)"></i>Hours saved</span><span><i style="background:repeating-linear-gradient(135deg,var(--s1) 0 2px,var(--s1-soft) 2px 5px)"></i>Likely range</span><span><i style="box-shadow:inset 0 0 0 1.5px var(--warn)"></i>No data that day, not zero</span></div></section>
    <section class="card"><div class="card-head"><h2>By organisation</h2><span class="xs muted">Most hours saved first</span></div><div class="table-wrap"><table class="client-table"><thead><tr><th>Organisation</th><th>Projects</th><th class="num">Hours saved</th><th class="num">Change</th><th>12 weeks</th><th class="num">Work handled</th><th>Next report</th></tr></thead><tbody>
      ${rows.map((r) => { const c = r.c, rep = c.projects.find((p) => p.report[0] === 'warn') || c.projects[0]; return `<tr class="link" data-go="results-${c.id}" tabindex="0"><td><span class="name">${esc(c.name)}</span><span class="sub">${esc(c.industry)}</span></td><td>${c.projects.map((p) => `<div class="small">${esc(p.name)}</div>`).join('')}</td>
        <td class="num">${r.h === null ? '<span class="dash">–</span>' : `<span class="ink">${nf(r.h)} h</span><div class="sub">${fmtM(vm, r.v)}</div>`}</td><td class="num">${chgHtml(r.ch)}</td><td>${r.ps.length ? sparkline(wk.map((w) => { const tt = mergeTotals(r.ps.map((x) => totals(x, w))); return r.h !== null ? hm.calc(tt) : (tt.n ? tt.vol : null); }), 90, 26) : '<span class="muted xs">Not collecting yet</span>'}</td>
        <td class="num">${r.t.n ? nf(r.t.vol) : '<span class="dash">–</span>'}</td><td><span class="pill ${rep.report[0]}">${esc(rep.report[1])}</span></td></tr>`; }).join('')}
    </tbody></table></div></section>`;
  };
  pages.results.after = (id) => { if (id && coById(id)) { ctxAfter(); return companyAfter(coById(id)); } pages.home.after(); };
  pages.organisation = (id) => companyPage(coById(id), 'account');
  pages.organisation.after = (id) => companyAfter(coById(id));

  pages['new-organisation'] = () => `
    ${head({ crumbs: crumbs(['Organisations', '#organisations'], ['New organisation']), title: 'Add an organisation', lead: 'The organisation whose solution you’ll measure.' })}
    <div class="wizard">${journey(0)}
    <form id="f-org" class="card narrow grid" style="gap:24px" novalidate>
      <div class="form-grid">
        <div class="field full"><label for="o-name">Organisation name</label><input id="o-name" placeholder="e.g. Teladan Properties" value="${esc(state.draftOrg || (state.orgs.length ? '' : 'Teladan Properties'))}" required><span class="help" id="o-name-help">As it appears on their contract.</span></div>
        <div class="field"><label for="o-ind">Industry</label><select id="o-ind">${['Property and real estate', 'Food and beverage', 'Logistics', 'Manufacturing', 'Healthcare', 'Engineering and construction', 'Retail', 'Other'].map((x) => `<option>${x}</option>`).join('')}</select></div>
        <div class="field"><label for="o-tz">Time zone</label><select id="o-tz"><option>Asia/Kuala_Lumpur (MYT)</option><option>Asia/Singapore (SGT)</option></select><span class="help">Their reports use this.</span></div>
        <div class="field"><label for="o-contact">Main contact</label><input id="o-contact" value="Farah Idris"></div>
        <div class="field"><label for="o-email">Contact email</label><input id="o-email" type="email" value="farah@organisation.example"></div>
      </div>
      <div class="grid" style="gap:10px;border-top:1px solid var(--line);padding-top:20px"><h3>Data agreement</h3>
        <p class="small muted">Outcomes only collects totals, and only after the organisation agrees in writing.</p>
        <label class="check"><input type="checkbox" id="o-signed" checked><span><b class="ink">The organisation has signed the data agreement</b><br><span class="small muted">Totals only · kept in Singapore · for the contract plus 24 months</span></span></label>
      </div>
      <div class="wfoot"><a class="btn ghost" href="#organisations">Cancel</a><button type="submit" class="btn primary lg">Add organisation and continue</button></div>
    </form></div>`;
  pages['new-organisation'].after = () => {
    $('#o-name').addEventListener('input', (e) => { state.draftOrg = e.target.value; });
    $('#f-org').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#o-name').value.trim();
      if (!name) { $('#o-name').setAttribute('aria-invalid', 'true'); const h = $('#o-name-help'); h.textContent = 'Add the organisation’s name to continue.'; h.style.color = 'var(--fault-ink)'; $('#o-name').focus(); return; }
      state.mode = 'new';
      const o = newOrg(name, $('#o-ind').value, $('#o-signed').checked);
      state.draftOrg = null;
      log(`Added organisation ${name}`);
      state.trk = Object.assign(trkFresh(), { step: 2, orgId: o.id }); go('track'); toast(`${name} added. Next, the project.`);
    });
  };

  pages['new-project'] = () => {
    if (!state.orgs.length) return `${head({ title: 'Create a project' })}<section class="card"><div class="empty">${emptyArt}<h3>Add an organisation first</h3><p>A project belongs to an organisation.</p><a class="btn primary" href="#new-organisation">Add organisation</a></div></section>`;
    const K = KINDS[state.newKind], orgId = state.newProjOrg || state.orgs[state.orgs.length - 1].id;
    return `
    ${head({ crumbs: crumbs(['Organisations', '#organisations'], ['New project']), title: 'Create a project', lead: 'What you agreed to deliver for the organisation. Its solution is measured against it.' })}
    <div class="wizard">${journey(1)}
    <form id="f-proj" class="card narrow grid" style="gap:24px" novalidate>
      <div class="form-grid">
        <div class="field"><label for="p-org">Organisation</label><select id="p-org">${state.orgs.map((o) => `<option value="${o.id}" ${o.id === orgId ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="p-name">Project name</label><input id="p-name" value="${esc(state.draftProj || (state.sims.length ? '' : 'Lease abstraction'))}" placeholder="e.g. Lease abstraction" required><span class="help" id="p-name-help">Use the name the organisation uses.</span></div>
      </div>
      <div class="grid" style="gap:10px"><span class="ink" style="font-weight:500">What kind of work does it take on?</span><p class="small muted" style="margin-top:-6px">We use this to suggest KPIs that fit. You can change any of them.</p>
        <div class="grid g2" style="gap:10px">${Object.entries(KINDS).map(([k, x]) => `<button type="button" class="choice" style="grid-template-columns:44px minmax(0,1fr)" data-kind="${k}" aria-pressed="${state.newKind === k}"><span class="ic">${icon(x.icon)}</span><span><b>${x.label}</b><span class="d">${x.d}</span></span></button>`).join('')}</div></div>
      <div class="form-grid">
        <div class="field full"><label for="p-obj">The outcome the organisation wants, in their words</label><textarea id="p-obj">${esc(K.objective)}</textarea><span class="help">This goes at the top of every report.</span></div>
        <div class="field"><label for="p-live">Planned go-live</label><input id="p-live" value="${day(M.addDays(today(), 19))}"></div>
        <div class="field"><label for="p-cad">Organisation report</label><select id="p-cad"><option>Monthly</option><option>Quarterly</option></select></div>
      </div>
      <div class="grid" style="gap:10px;border-top:1px solid var(--line);padding-top:20px"><h3>The solution</h3>
        <div class="field"><label for="p-sol">Its name</label><input id="p-sol" value="${esc(state.draftSol || (state.sims.length ? K.sol : 'Lease reader'))}"><span class="help">What your team calls the system being measured.</span></div>
        <span class="ink" style="font-weight:500;margin-top:6px">How will it share its figures?</span><p class="small muted" style="margin-top:-6px">Outcomes only reads daily totals. It never changes anything in the solution.</p>
        ${methodCards(state.newMethod || 'link', 'data-pmethod')}</div>
      <div class="wfoot"><a class="btn ghost" href="#organisations">Cancel</a><button type="submit" class="btn primary lg">Create project and continue</button></div>
    </form></div>`;
  };
  pages['new-project'].after = () => {
    const f = $('#f-proj'); if (!f) return;
    $('#p-name').addEventListener('input', (e) => { state.draftProj = e.target.value; });
    $('#p-sol').addEventListener('input', (e) => { state.draftSol = e.target.value; });
    $('#p-org').addEventListener('change', (e) => { state.newProjOrg = e.target.value; });
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#p-name').value.trim();
      if (!name) { $('#p-name').setAttribute('aria-invalid', 'true'); const h = $('#p-name-help'); h.textContent = 'Give the project a name to continue.'; h.style.color = 'var(--fault-ink)'; return; }
      const org = state.orgs.find((o) => o.id === $('#p-org').value);
      const sol = $('#p-sol').value.trim() || KINDS[state.newKind].sol;
      const sim = newSim(org, { kind: state.newKind, project: name, objective: $('#p-obj').value.trim(), live: $('#p-live').value, cadence: $('#p-cad').value, sol });
      state.focusSim = sim.id; state.draftProj = null; state.draftSol = null; state.wiz = Object.assign(freshWizard(), { method: state.newMethod || 'link', solName: sol }); state.newMethod = null;
      log(`Created project ${name} for ${org.name}`);
      go('connect-' + sim.id); toast(state.wiz.method === 'link' ? 'Project created. Next, the prompt for the developer.' : 'Project created. Next, connect it.');
    });
  };

  // ------------------------------------------------------------------ example KPI cards
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
  const breakdownHtml = (B, mch, R, noun, methodLine, table) => {
    const saved = B.mid - mch - R.mid, pct = (v) => (100 * Math.max(0, v) / B.high).toFixed(2) + '%';
    return `<section class="card"><div class="card-head"><div><h2>Where the time goes, per ${noun}</h2><p class="sub">Minutes · ${rangeLabel().toLowerCase()}</p></div></div>
      <div class="impact">
        <div class="ib-row"><span class="lab">Before, by hand</span><div class="ib-bar"><div class="ib-seg base" style="width:${pct(B.mid)}" title="${B.mid} minutes"></div></div></div>
        <div class="ib-row"><span class="lab">Now</span><div class="ib-bar"><div class="ib-seg measured" style="width:${pct(mch)}" title="Machine ${nf(mch, 1)} min"></div><div class="ib-seg estimated" style="width:${pct(R.mid)}" title="Review ${R.mid} min"></div><div class="ib-seg saved" style="width:${pct(saved)}">${nf(saved, 1)} min saved</div></div></div>
        <div class="ib-scale"><span>0</span><span>${B.high / 2}</span><span>${B.high} min</span></div>
      </div>
      <div class="legend"><span><i style="background:repeating-linear-gradient(135deg,var(--baseline) 0 2px,transparent 2px 5px);box-shadow:inset 0 0 0 1px var(--baseline)"></i>By hand: ${B.mid} min, ${esc(methodLine)}</span><span><i style="background:var(--s1)"></i>Machine: ${nf(mch, 1)} min, measured</span><span><i style="background:repeating-linear-gradient(135deg,var(--s1) 0 2px,var(--s1-soft) 2px 5px)"></i>Review: ${R.mid} min, sampled</span></div>
      ${table ? `<details class="more" style="margin-top:12px"><summary>How hours saved is worked out</summary>${table}</details>` : ''}</section>`;
  };

  // ------------------------------------------------------------------ example SOLUTION
  const VOLUME = { 'doc-workflow': ['documents.generated', 'Documents processed'], 'invoice-triage': ['invoices.triaged', 'Invoices triaged'], 'shift-planner': ['plans.generated', 'Shift plans made'], 'enquiry-triage': ['enquiries.received', 'Enquiries received'], 'quote-drafter': ['quotes.drafted', 'Quotations drafted'] };
  pages.solution = (id) => {
    const s = M.solutions[id], o = orgById(s.org), st = solStatus(id), days = windowDays(state.range);
    const tabs = [['outcomes', 'Outcomes'], ['measures', 'Measures'], ['explore', 'Explore'], ['usage', 'Usage'], ['health', 'Health'], ['data', 'Data and connection']];
    let banner = '';
    if (st === 'stale') banner = `<div class="callout warn">${icon('clock')}<span><b>No new data since ${(s.since || '14 Oct 2026, 06:00').replace(' 2026,', '')}.</b> ${s.missed || 2} nightly collections were missed. You’re seeing the last good figures, faded. Nothing is filled in as zero.</span></div>`;
    if (st === 'failing') banner = `<div class="callout fault">${icon('alerts')}<span style="flex:1"><b>The solution isn’t answering since ${(s.since || '14 Oct 2026, 06:00').replace(' 2026,', '')}.</b> Its health check returned an error. We retry every 15 minutes and have told the project owner.</span>${gate(atLeast('Operator'), 'Retry now', 'Needs operator rights', 'data-act="retry"', 'btn sm')}</div>`;
    let body = '';
    if (state.solTab === 'outcomes') {
      const cards = kpiCards(id, days);
      let breakdown = '';
      if (id === 'doc-workflow' && st !== 'failing') {
        const r = impactSum(id, days), B = M.impact[id].baseline, R = M.impact[id].review;
        breakdown = breakdownHtml(B, r.machineMean, R, 'document', 'timed on 40 documents in June', `<div class="table-wrap"><table><thead><tr><th>Part</th><th>Where it comes from</th><th>Kind</th><th class="num">Value</th></tr></thead><tbody>
            <tr><td><span class="name">Documents completed</span></td><td>Counted by the workflow</td><td>${q('measured')}</td><td class="num">${nf(r.vol)}</td></tr>
            <tr><td><span class="name">Minutes per document by hand</span></td><td>${esc(B.method)}</td><td>${q('estimated')}</td><td class="num">${B.mid} (${B.low}–${B.high})</td></tr>
            <tr><td><span class="name">Machine minutes</span></td><td>Measured. Never counted as a person’s time</td><td>${q('measured')}</td><td class="num">${nf(r.machineMean, 2)}</td></tr>
            <tr><td><span class="name">Review minutes</span></td><td>${esc(R.method)}</td><td>${q('estimated')}</td><td class="num">${R.mid} (${R.low}–${R.high})</td></tr>
            <tr><td><span class="name">Hours saved</span><span class="sub">documents × (by hand − machine − review) ÷ 60</span></td><td>Approved 10 Oct 2026 by Daniel Lim</td><td>${q('estimated')}</td><td class="num">${nf(r.mid)} (${nf(r.low)}–${nf(r.high)})</td></tr></tbody></table></div>`);
      }
      body = `${breakdown}<div class="grid ${gridFor(cards.length)}">${cards.map(kpiCardHtml).join('')}</div>
        <section class="card"><div class="card-head"><div><h2>${VOLUME[id][1]}</h2><p class="sub">${state.range > 30 ? 'By week' : 'By day'} · measured</p></div></div><div class="chart" id="ch-vol"></div>
        <div class="legend"><span><i style="background:var(--s1)"></i>Measured</span><span><i style="box-shadow:inset 0 0 0 1.5px var(--warn)"></i>No data, not zero</span></div></section>`;
    } else if (state.solTab === 'measures') {
      body = measuresTab(projById(id));
    } else if (state.solTab === 'explore') {
      body = exploreTab(projById(id));
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
        ${M.catalog.map((c) => `<tr><td><span class="name">${esc(cap(c.key.replace(/[._]/g, ' ')))}</span><span class="sub mono">${c.key}</span></td><td>${({ counter: 'Count', duration: 'Time', gauge: 'Level', distinct: 'People' })[c.type]} · ${c.unit}</td><td>${c.dims === '–' ? '<span class="muted">–</span>' : esc(c.dims.replace(/_/g, ' '))}${c.changed ? ' <span class="pill info">New</span>' : ''}</td><td class="small">${c.feeds === '–' ? '<span class="muted">Not used yet</span>' : c.feeds.replace(/K1/g, 'Hours saved').replace(/K2/g, 'Documents').replace(/K3/g, 'Sent back').replace(/K4/g, 'Machine time').replace(' (weighting)', '')}</td></tr>`).join('')}
      </tbody></table></div></section>`;
    }
    return `
    ${head({ crumbs: crumbs(['Results', '#results'], [o.short, '#results-' + o.id], [o.projects.find((x) => x.solutions.includes(s.id)).name], [s.name]), title: esc(s.name), meta: `${statusPill(st)}<span>${esc(o.projects[0].name)}</span><span>Live since ${day(s.live)}</span>`, actions: rangeSeg() })}
    ${banner}
    <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${state.solTab === k}">${l}</button>`).join('')}</div>
    ${body}
    ${id === 'doc-workflow' ? `<div class="demo-bar"><span class="tag">MOCK CONTROLS</span><span>See what happens when data stops:</span><div class="seg">${[['live', 'Normal'], ['stale', 'Late'], ['failing', 'Not answering']].map(([v, l]) => `<button type="button" data-demo="${v}" aria-pressed="${state.demoState === v}">${l}</button>`).join('')}</div></div>` : ''}`;
  };
  pages.solution.after = (id) => {
    builderAfter();
    const el = $('#ch-vol'); if (!el) return;
    const metric = VOLUME[id][0], map = new Map(seriesOf(id, metric).map((p) => [p.d, p.v])), start = firstDay(id, metric), st = solStatus(id);
    const daily = windowDays(state.range).map((d) => d < start ? { d, before: true } : (map.has(d) && map.get(d) !== null && !(id === 'doc-workflow' && st === 'stale' && d > '2026-10-12')) ? { d, v: map.get(d) } : { d, gap: true, v: null });
    drawChart(el, bucket(daily, state.range > 30), { id: 'vol', kind: 'columns', label: VOLUME[id][1], height: 220, tip: (p) => p.before ? '<div>Before go-live</div>' : p.gap ? '<div>No data. Not counted as zero.</div>' : `<div><span class="mono">${nf(p.v)}</span></div>${p.gaps ? `<div class="muted">${p.gaps} day(s) missing</div>` : ''}` });
  };

  // ------------------------------------------------------------------ YOUR SOLUTION page
  pages.sim = (id) => {
    const s = simById(id), o = orgOf(s), K = kindOf(s), st = simStatus(s);
    const stages = [['Connected', s.stage !== 'draft'], ['KPIs approved', s.stage === 'approved' || s.stage === 'collecting'], ['First data', s.stage === 'collecting'], ['Report scheduled', s.reportScheduled]];
    const strip = `<section class="card flat" style="padding:14px 18px"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${stages.map(([l, d], i) => `<span class="pill ${d ? 'ok' : 'idle'}">${d ? icon('check', 'sm') : `<span class="mono">${i + 1}</span>`}${l}</span>${i < stages.length - 1 ? `<span class="muted">${icon('chev', 'sm')}</span>` : ''}`).join('')}</div></section>`;
    let body = '';
    if (s.stage === 'draft') body = `<section class="card"><div class="empty">${emptyArt}<h3>Not connected yet</h3><p>Connect ${esc(s.name)} to start measuring.</p><a class="btn primary" href="#connect-${s.id}">Connect</a></div></section>`;
    else if (s.stage === 'review') body = `<section class="card"><div class="empty">${emptyArt}<h3>Waiting for Aisyah Rahman to approve</h3><p>She’ll check each KPI and the baseline. Collection starts as soon as she approves.</p><a class="btn" href="#approvals">See what you sent</a></div></section>
        <div class="demo-bar"><span class="tag">MOCK CONTROLS</span><span>Skip ahead:</span><button type="button" class="btn sm" data-act="sim-approve" data-sim="${s.id}">Aisyah approves</button><span>or switch to Aisyah from your profile and approve them in Approvals.</span></div>`;
    else if (s.stage === 'approved') body = `<div class="grid ${gridFor(s.kpis.length)}">${kpiProposals(s).filter((p) => s.kpis.includes(p.id)).map((p) => `<article class="card kpi"><div class="top"><h3>${p.name}</h3>${q(p.quality)}</div><div class="stat"><span class="value">${dash()}</span><span class="hint">Waiting for the first collection</span></div><div class="skel" style="height:34px"></div><p class="src">First figures tonight at 06:00</p></article>`).join('')}</div>
        <section class="card"><div class="empty">${emptyArt}<h3>First collection tonight at 06:00</h3><p>We’ll collect the last ${s.history} days, so you’ll see a trend straight away.</p>${gate(atLeast('Operator'), 'Collect now', 'Needs operator rights', `data-act="sim-pull" data-sim="${s.id}"`, 'btn')}</div></section>`;
    else {
      const days = simWindow(state.range), r = simSum(s, days), props = kpiProposals(s);
      const stopDay = s.ev.down || s.ev.stale;
      let banner = '';
      if (st === 'stale') banner = `<div class="callout warn">${icon('clock')}<span style="flex:1"><b>No new data since ${dayShort(M.addDays(stopDay, -1))}.</b> You’re seeing the last good figures, faded. Missing days are gaps, never zeros.</span></div>`;
      if (st === 'failing') banner = `<div class="callout fault">${icon('alerts')}<span style="flex:1"><b>${esc(s.name)} isn’t answering since ${dayShort(stopDay)}.</b> Its health check returned an error. We retry every 15 minutes and have told the project owner.</span>${gate(atLeast('Operator'), 'Retry now', 'Needs operator rights', 'data-act="retry"', 'btn sm')}</div>`;
      const fade = st !== 'fresh' ? `No new data since ${dayShort(M.addDays(stopDay, -1))}` : null;
      const cards = s.kpis.map((k) => {
        const p = props.find((x) => x.id === k);
        if (k === 'volume') return { name: p.name, quality: 'measured', value: nf(r.vol), unit: '', cmp: [['Days with data', `${r.n} of ${r.n + r.missing}`]], src: `${rangeLabel()} · updated ${dayShort(today())}, 06:00`, staleNote: fade };
        if (k === 'quality') return { name: p.name, quality: 'derived', value: r.rate === null ? '–' : nf(r.rate, 1), unit: '%', cmp: [[`${cap(K.nouns)} ${K.qual.label}`, nf(r.flagged)]], src: 'Worked out from the totals', staleNote: fade };
        return hasBase(s) ? { name: p.name, quality: 'estimated', value: nf(r.mid), unit: 'h', cmp: [['Likely', `${nf(r.low)} to ${nf(r.high)} h`], ['Baseline', `${s.base.mid} min per ${K.noun}`]], src: `${r.missing ? `${r.missing} day${r.missing > 1 ? 's' : ''} missing, not filled in · ` : ''}review time is an estimate`, staleNote: fade } : { name: p.name, quality: 'unavailable', value: null, why: 'Needs a baseline before it can be shown.', cmp: [], src: 'Add one in Approvals' };
      });
      const rs = simReportState(s);
      const simTabs = `<div class="tabs" role="tablist">${[['outcomes', 'Overview'], ['measures', 'Measures'], ['explore', 'Explore']].map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${(['measures', 'explore'].includes(state.solTab) ? state.solTab : 'outcomes') === k}">${l}</button>`).join('')}</div>`;
      if (state.solTab === 'measures') body = `${banner}${simTabs}${measuresTab(projOfSim(s))}`;
      else if (state.solTab === 'explore') body = `${banner}${simTabs}${exploreTab(projOfSim(s))}`;
      else body = `${banner}${simTabs}
        ${hasBase(s) && s.kpis.includes('impact') && r.vol ? breakdownHtml(s.base, r.machine, K.review, K.noun, ({ sample: `timed on ${s.base.n} ${K.nouns}`, history: 'from past records', estimate: 'the organisation’s estimate' })[s.base.method], '') : ''}
        <div class="grid ${gridFor(cards.length)}">${cards.map(kpiCardHtml).join('')}</div>
        <section class="card"><div class="card-head"><div><h2>${cap(K.nouns)} handled</h2><p class="sub">${state.range > 30 ? 'By week' : 'By day'} · measured · simulated</p></div></div><div class="chart" id="ch-sim"></div>
          <div class="legend"><span><i style="background:var(--s1)"></i>Measured</span><span><i style="box-shadow:inset 0 0 0 1.5px var(--warn)"></i>No data, not zero</span></div></section>
        ${!s.reportScheduled ? `<section class="card"><div class="row" style="border:0;padding:0"><span class="ico info">${icon('reports', 'sm')}</span><div><div class="what">Schedule the organisation report</div><div class="meta">${esc(s.project.cadence)} · drafted for you, sent only after you check it</div></div><button type="button" class="btn primary sm" data-act="schedule-report" data-sim="${s.id}">Schedule report</button></div></section>`
        : `<section class="card"><div class="row" style="border:0;padding:0"><span class="ico ${rs.st === 'ready' ? 'warn' : 'ok'}">${icon('reports', 'sm')}</span><div><div class="what">${rs.st === 'ready' ? `${monthName(rs.ym)} report is ready to review` : rs.st === 'approved' ? `${monthName(rs.ym)} report approved` : `${esc(s.project.cadence)} report scheduled`}</div><div class="meta">${rs.st === 'waiting' ? `First draft on ${nextMonthStart()}, once a full month of figures is in. Move the date forward in Demo studio to see it.` : 'Drafted from the figures above'}</div></div>${rs.st !== 'waiting' ? `<a class="btn sm ${rs.st === 'ready' ? 'primary' : ''}" href="#report-${s.id}">Open report</a>` : ''}</div></section>`}`;
    }
    return `${head({ crumbs: crumbs(['Results', '#results'], [o.name, '#results-' + o.id], [s.project.name], [s.name]), title: esc(s.name), meta: `${statusPill(st)}<span>${esc(s.project.name)}</span><span>${K.label}</span>`, actions: s.stage === 'collecting' ? rangeSeg() : '' })}
      ${strip}${body}`;
  };
  pages.sim.after = (id) => {
    builderAfter();
    const el = $('#ch-sim'); if (!el) return;
    const s = simById(id);
    drawChart(el, bucket(simDaily(s, simWindow(state.range)).map((p) => p.gap ? Object.assign(p, { v: null }) : p), state.range > 30), { id: 'sim', kind: 'columns', label: `${kindOf(s).nouns} handled`, height: 210, tip: (p) => p.before ? '<div>Before collection started</div>' : p.gap ? '<div>No data. Not counted as zero.</div>' : `<div><span class="mono">${nf(p.v)}</span> ${kindOf(s).nouns}</div>` });
  };

  // ------------------------------------------------------------------ CONNECT WIZARD
  const WMETHODS = {
    link: { ic: 'lock', door: 'Measurement link', sub: 'Read-only, signed', t: 'Measurement link', d: 'The solution serves a small read-only link that Outcomes calls each night. Best for anything REKA builds.', effort: 'About a day of developer work', tag: 'Recommended' },
    axle: { ic: 'box', door: 'AXLE Link', sub: 'Built into the product', t: 'An AntaraX product', d: 'Yara, Janka and the other products already share daily totals through AXLE.', effort: 'Minutes. Nothing to build', tag: '' },
    sheet: { ic: 'sheet', door: 'Weekly spreadsheet', sub: 'Uploaded by a person', t: 'Spreadsheet upload', d: 'For a system that can’t serve a link. Someone uploads a CSV of daily totals each week.', effort: 'Ten minutes a week', tag: '' },
  };
  const wizTests = (w, o) => w.method === 'axle' ? [`Found ${w.product} in AXLE`, `The ${w.product} workspace belongs to ${o.name}`, 'Read what it shares: 6 figures, daily', 'Read one day of figures']
    : w.method === 'sheet' ? [`Read ${w.sheetFile || 'the file'}`, 'Columns match the template', 'Seven days, none missing', 'No personal data in it']
    : ['Found the link', 'Secure connection', 'Signed request accepted', 'Read what it shares: 6 figures, daily', 'Health check: healthy', 'Read one day of figures'];
  const foundFor = (K) => [
    [`${cap(K.nouns)} handled`, `${K.nouns}.processed`, 'Count, every day', 'ok'],
    [`Time to process a ${K.noun}`, `${K.nouns}.processing_duration`, 'Average seconds, every day', 'ok'],
    [`${cap(K.nouns)} ${K.qual.label}`, `${K.nouns}.flagged`, 'Count, every day', 'ok'],
    ['People reviewing', 'reviewers.active', 'Distinct people, every day · each counted once, never named', 'ok'],
    ['Pages read', 'pages.read', 'Count, every day', 'warn', 'The unit “pages” isn’t on the standard list. Fine for now; ask the developer to use “page”.'],
    [`${cap(K.nouns)} by customer name`, `${K.nouns}.by_customer_name`, 'Count, split by customer', 'fault', 'Split by customer name, which could identify people. The contract test refuses it; ask the developer to split by customer type instead.'],
  ];
  const wizSim = () => simById(state.focusSim);
  const devPrompt = (s) => { const K = kindOf(s); return `Add a Measurement Link to ${state.wiz.solName || s.name}. Follow the integration pack: integrations/measure in antarax-ripple-monitoring, starting with CLAUDE_CODE_INTEGRATION.md.

- Read-only GET endpoints under /internal/measure/v1: manifest, metrics, observations, health, openapi.json.
- TypeScript: use the kit in the pack. Other languages: follow the pack's signature and test vectors.
- Don't change the app's own data model or API.
- Daily totals for finished days in the organisation's time zone: ${K.nouns} handled, processing time (with sum and count), ${K.nouns} ${K.qual.label}, people reviewing (each counted once). A missing day is left out, never sent as zero.
- No document text, names or personal data. Dimension values are short codes, like invoice.
- Check every call is signed with the key in AX_MEASURE_KEY (ax_msr_…). The developer link shows it once.
- Before you finish, run the contract test: AX_MEASURE_KEY=… node contract-test/cli.mjs --base <url>
- If there's no baseline, say so. Don't guess one.`; };
  const sheetTemplate = (K) => `date,${K.nouns.replace(/\s+/g, '_')}_handled,seconds_per_${K.noun.replace(/\s+/g, '_')},${K.nouns.replace(/\s+/g, '_')}_${K.qual.label.replace(/\s+/g, '_')},people_reviewing\n${M.addDays(today(), -1)},0,0,0,0`;
  // The connection, drawn: the solution, the door it shares through, and Outcomes. It moves as the connection does:
  // waiting (the door breathes), testing (requests travel to the solution), live (figures flow to Outcomes nightly).
  function connMap(w, s, o) {
    const m = WMETHODS[w.method], solName = w.solName || s.name, n = w.tests.length, done = w.tests.filter((t) => t[1] === 'ok').length;
    const st = w.tested ? 'live' : n ? 'test' : w.step >= 2 ? 'wait' : 'idle';
    const word = st === 'live' ? 'Connected' : st === 'test' ? `Checking, ${done} of ${n}` : st === 'wait' ? ({ link: 'Waiting for the developer', axle: 'Ready to test', sheet: 'Waiting for a file' })[w.method] : 'Not set up yet';
    const doorOk = st === 'live' || (st === 'test' && done >= Math.ceil(n / 2));
    const wire = (lab) => `<div class="cwire" aria-hidden="true"><span class="track"></span><i></i><i></i><i></i>${lab ? `<span class="clab">${lab}</span>` : ''}</div>`;
    return `<div class="cmap" data-st="${st}" role="img" aria-label="${esc(`${solName}, through ${m.door}, to Outcomes: ${word}`)}">
      <div class="cnode ${st === 'live' ? 'ok' : ''}"><span class="cic">${icon('box')}</span><b>${esc(solName)}</b><span>${esc(o.name)}’s system</span></div>
      ${wire(st === 'live' ? '6 figures, daily' : '')}
      <div class="cnode door ${doorOk ? 'ok' : ''}"><span class="cic">${icon(m.ic)}</span><b>${m.door}</b><span>${m.sub}</span><span class="cword">${word}</span></div>
      ${wire(st === 'live' ? (w.method === 'sheet' ? 'Each week' : 'Each night, 06:00') : '')}
      <div class="cnode ${st === 'live' ? 'ok' : ''}"><span class="cic"><img src="assets/antarax-mark.svg" alt=""></span><b>Outcomes</b><span>Reads totals, changes nothing</span></div>
    </div>`;
  }
  const foundChips = (K) => `<div class="found">${foundFor(K).map(([n, , , st], i) => `<span class="fchip ${st}" style="--i:${i}">${icon(st === 'ok' ? 'check' : st === 'warn' ? 'alerts' : 'lock', 'sm')}${esc(n)}</span>`).join('')}</div>`;
  const foundList = (K) => `<div class="list">${foundFor(K).map(([n, k, kind, st, note]) => `<div class="row"><span class="ico ${st}">${icon(st === 'ok' ? 'check' : st === 'warn' ? 'alerts' : 'lock', 'sm')}</span><div><div class="what">${esc(n)}</div><div class="meta"><span>${kind}</span><span class="mono">${k}</span></div>${note ? `<div class="small" style="margin-top:4px;color:var(--${st}-ink)">${esc(note)}</div>` : ''}</div><span class="pill ${st}">${st === 'ok' ? 'Ready' : st === 'warn' ? 'Note' : 'Held back'}</span></div>`).join('')}</div>`;

  // The whole way from nothing to first figures, shown on every setup page so people always know where they are.
  const JOURNEY = ['Organisation', 'Project', 'Prompt', 'Connection', 'What to measure', 'Baseline and send', 'Approval', 'First figures'];
  const journey = (cur) => `<ol class="journey" aria-label="Setting up a project">${JOURNEY.map((l, i) => `<li class="${i < cur ? 'done' : i === cur ? 'now' : ''}" ${i === cur ? 'aria-current="step"' : ''}><b>${i < cur ? icon('check', 'sm') : i + 1}</b><span>${l}</span></li>`).join('')}</ol>`;
  const methodCards = (cur, attr) => `<div class="choice-grid methods">${Object.entries(WMETHODS).map(([k, x]) => `<button type="button" class="choice method" ${attr}="${k}" aria-pressed="${cur === k}"><span class="ic">${icon(x.ic)}</span><b>${x.t}</b><span class="d">${x.d}</span><span class="effort">${icon('clock', 'sm')}${x.effort}</span>${x.tag ? `<span class="pill info tag">${x.tag}</span>` : ''}</button>`).join('')}</div>`;
  function copyText(text, msg) { const done = () => toast(msg); try { navigator.clipboard.writeText(text).then(done, done); } catch (err) { done(); } }

  pages.connect = (id) => {
    if (id) state.focusSim = id;
    let s = wizSim();
    if (!s || s.stage !== 'draft') { s = state.sims.find((x) => x.stage === 'draft'); if (s) { state.focusSim = s.id; state.wiz = freshWizard(); } }
    if (!s) return `${head({ title: 'Connect a solution' })}<section class="card"><div class="empty">${emptyArt}<h3>${state.orgs.length ? 'Create a project first' : 'Add the organisation and project first'}</h3><p>A solution is measured against a project’s outcome, so we need both before connecting.</p><a class="btn primary" href="${state.orgs.length ? '#new-project' : '#new-organisation'}">${state.orgs.length ? 'Create project' : 'New organisation'}</a></div></section>`;
    const w = state.wiz, o = orgOf(s), K = kindOf(s), solName = w.solName || s.name, m = WMETHODS[w.method];
    if (!w.baseline) w.baseline = { method: 'sample', mid: K.base.mid, low: K.base.low, high: K.base.high, n: 20, period: `${day(M.addDays(today(), 5))} to ${day(M.addDays(today(), 9))}`, note: '' };
    const back = w.step > 1 ? `<button type="button" class="btn ghost" data-act="w-back">${icon('back', 'sm')}Back</button>` : `<a class="btn ghost" href="#organisation-${o.id}">Later</a>`;
    const foot = (label, disabled, extra = '') => `<div class="wfoot">${back}<span class="head-actions">${extra}<button type="button" class="btn primary lg" data-act="w-next" ${disabled ? 'disabled' : ''}>${label}</button></span></div>`;
    const props = kpiProposals(s), testing = w.tests.length && !w.tested;
    // Content animates in only when it changes (a new step, the test finishing, the suggestions arriving), never on each tick.
    const shown = `${w.step}:${w.tested}:${!!w.proposals}:${w.method}`, enter = w.shown !== shown; w.shown = shown;
    const lastOk = w.tests.filter((t) => t[1] === 'ok').length - 1;
    const change = `<details class="more"><summary>Shares by ${m.t.toLowerCase()}. Change</summary><div style="margin-top:10px">${methodCards(w.method, 'data-method')}</div></details>`;
    let panel = '';
    if (w.step === 3) panel = !w.proposals ? `<div class="thinking" style="padding:8px 0"><img src="${SPARK}" alt=""><span>Reading 4 figures and suggesting KPIs for ${esc(s.project.name)}…</span></div><div class="grid" style="gap:10px"><div class="skel" style="height:72px"></div><div class="skel" style="height:72px"></div><div class="skel" style="height:72px"></div></div>` : `
        <div class="card-head" style="margin:0"><div><h2>Choose what to measure</h2><p class="small muted" style="margin-top:4px">Suggested from what ${esc(solName)} shares and what the project is for.</p></div>${aiMark()}</div>
        ${props.map((p, i) => `<div class="pick ${w.keep[p.id] ? 'on' : 'off'}" style="--i:${i}"><div class="top"><div><h3>${esc(p.name)}</h3><div class="meta-line" style="margin-top:6px"><span class="pill idle">${p.kind}</span>${q(p.quality)}</div></div><button type="button" class="switch" role="switch" aria-checked="${!!w.keep[p.id]}" aria-label="Measure ${esc(p.name)}" data-keep="${p.id}"></button></div><p class="why">${esc(p.why)}</p><details class="more"><summary>How it’s worked out</summary><div class="small">${esc(p.formula)}</div></details>${p.needsBaseline && w.keep[p.id] ? `<div class="callout warn" style="padding:10px 12px">${icon('target', 'sm')}<span>Needs a baseline. You’ll set it next.</span></div>` : ''}</div>`).join('')}
        <div class="callout ai">${icon('insight')}<span style="flex:1"><b>Accuracy</b> would be worth measuring, but the solution doesn’t count reviewer corrections yet.</span><button type="button" class="btn sm" data-act="add-gap">Ask the developer</button></div>
        <details class="more"><summary>What ${esc(solName)} shares</summary><div style="margin-top:10px">${foundList(K)}</div></details>
        ${foot(`Continue with ${Object.values(w.keep).filter(Boolean).length} KPIs`, !Object.values(w.keep).some(Boolean))}`;
    if (w.step === 4) {
      const kept = props.filter((p) => w.keep[p.id]), b = w.baseline;
      panel = `${w.keep.impact ? `<div><h2>How long does a ${K.noun} take by hand?</h2><p class="small muted" style="margin-top:4px">Hours saved compares today with before. Agree this with ${esc(o.name)}: it appears in every report.</p></div>
        <div class="grid g2" style="gap:10px">${[['sample', 'clock', 'Time a sample', `Someone times 20 or more ${K.nouns} by hand. Most trusted.`], ['history', 'documents', 'Use past records', 'From the organisation’s own system, if it logged the time.'], ['estimate', 'people', 'The organisation’s estimate', 'Quickest. Reports label it as an estimate.'], ['none', 'target', 'Not available yet', 'Hours saved shows “needs a baseline” until you add one.']].map(([k, ic, t, d]) => `<button type="button" class="choice" style="grid-template-columns:44px minmax(0,1fr)" data-bmethod="${k}" aria-pressed="${b.method === k}"><span class="ic">${icon(ic)}</span><span><b>${t}</b><span class="d">${d}</span></span></button>`).join('')}</div>
        ${b.method !== 'none' ? `<div class="form-grid">
          <div class="field"><label for="b-mid">Typical minutes per ${K.noun}</label><input id="b-mid" type="number" inputmode="decimal" value="${b.mid}"></div>
          <div class="field"><label for="b-low">Fastest and slowest</label><div class="with-btn"><input id="b-low" type="number" aria-label="Fastest, minutes" value="${b.low}"><input id="b-high" type="number" aria-label="Slowest, minutes" value="${b.high}"></div><span class="help">Reports show hours saved as a range from these.</span></div>
          ${b.method === 'sample' ? `<div class="field"><label for="b-n">${cap(K.nouns)} timed</label><input id="b-n" type="number" value="${b.n}"></div><div class="field"><label for="b-period">When</label><input id="b-period" value="${esc(b.period)}"><span class="help">Before go-live, so it reflects the old way.</span></div>` : ''}
          <div class="field full"><label for="b-note">Evidence</label><input id="b-note" placeholder="e.g. Timing sheet signed by Farah Idris" value="${esc(b.note)}"></div></div>` : ''}` : `<div><h2>Send for approval</h2></div><div class="callout info">${icon('check')}<span>None of the KPIs you chose need a baseline.</span></div>`}
        <section class="review"><h3>What you’re sending</h3>${kv([['Solution', `${esc(solName)} · ${esc(o.name)}`], ['Shares by', esc(m.t)], ['Collects', w.method === 'sheet' ? 'When the weekly file is uploaded' : 'Every night at 06:00 MYT · health every 15 minutes'], ['KPIs', kept.map((p) => esc(p.name)).join('<br>')], ['Baseline', w.keep.impact ? (b.method === 'none' ? 'Not available yet' : `${b.mid} min per ${K.noun}, ${b.low} to ${b.high} · ${({ sample: `timed sample of ${b.n} ${K.nouns}`, history: 'past records', estimate: 'organisation estimate' })[b.method]}`) : '–'], ['Held back', `${cap(K.nouns)} by customer name`]], 120)}
        <div class="field" style="margin-top:12px"><label for="w-appr">Who approves</label><select id="w-appr"><option>Aisyah Rahman · Admin</option></select><span class="help">You can’t approve what you set up yourself. Collection starts once they do.</span></div></section>
        ${foot('Send for approval')}`;
    }
    return `${head({ crumbs: crumbs(['Organisations', '#organisations'], [o.name, '#organisation-' + o.id], [s.project.name], ['Connect']), title: `Connect ${esc(solName)}`, topTitle: 'Connect a solution', lead: `${esc(s.project.name)} · ${esc(o.name)}` })}
      <div class="wizard">${journey(w.step + 1)}<div class="card wpanel${enter ? ' enter' : ''}" id="wpanel">${connMap(w, s, o)}${panel}</div></div>`;
  };
  pages.connect.after = () => {
    const w = state.wiz;
    const map = { 'b-mid': 'mid', 'b-low': 'low', 'b-high': 'high', 'b-n': 'n', 'b-period': 'period', 'b-note': 'note' };
    Object.keys(map).forEach((id) => { const el = $('#' + id); if (el) el.addEventListener('input', () => { w.baseline[map[id]] = el.type === 'number' ? +el.value : el.value; }); });
    const url = $('#w-url'); if (url) url.addEventListener('input', () => { w.url = url.value; url.removeAttribute('aria-invalid'); });
    const nt = $('#w-notify'); if (nt) nt.addEventListener('change', () => { w.notify = nt.checked; });
    const prod = $('#w-prod'); if (prod) prod.addEventListener('change', () => { w.product = prod.value; render(); });
    const f = $('#w-file'); if (f) f.addEventListener('change', () => { const x = f.files && f.files[0]; if (!x) return; if (!/\.csv$/i.test(x.name)) { toast('Choose a CSV file, saved from the template.'); return; } w.sheetFile = x.name; runTests(); });
    if (w.step === 3 && !w.proposals) setTimeout(() => { w.proposals = true; if (/^#(connect|track)/.test(location.hash)) render(); }, reduceMotion ? 0 : 1500);
  };
  function runTests() {
    const w = state.wiz, s = wizSim(); if (!s || w.tested || w.tests.length) return;
    const lines = wizTests(w, orgOf(s)), name = w.solName || s.name;
    w.tests = lines.map((t) => [t, 'wait']); render();
    lines.forEach((t, i) => setTimeout(() => {
      if (state.wiz !== w) return;
      w.tests[i] = [t, 'ok'];
      if (i === lines.length - 1) { w.tested = true; log(`${name} connected for ${orgOf(s).name}: every check passed`, 'Collector'); if (!/^#(connect|track)/.test(location.hash)) toast(`${name} is connected.`); }
      if (/^#(connect|track)/.test(location.hash)) render();
    }, reduceMotion ? 0 : 450 * (i + 1)));
  }
  function wizardNext() {
    const w = state.wiz, s = wizSim(); if (!s) return;
    if (w.step === 1) {
      if (w.method === 'link') { w.promptAt = now(); copyText(devPrompt(s), 'Prompt copied. Send it to the developer.'); log(`Copied the developer prompt for ${w.solName || s.name}`); }
      if (w.method === 'sheet') copyText(sheetTemplate(kindOf(s)), 'Columns copied. Share them with whoever fills in the sheet.');
      w.step = 2; render(); window.scrollTo(0, 0);
      if (w.method === 'axle') runTests();
      return;
    }
    if (w.step === 2) { if (!w.tested) { if (w.method === 'axle') runTests(); return; } }
    if (w.step === 4 && w.keep.impact && w.baseline.method !== 'none' && !(w.baseline.low <= w.baseline.mid && w.baseline.mid <= w.baseline.high && w.baseline.mid > 0)) { toast('Check the minutes: fastest ≤ typical ≤ slowest.'); return; }
    if (w.step === 4) { finishWizard(); return; }
    w.step++; render(); window.scrollTo(0, 0);
  }
  // ------------------------------------------------------------------ START TRACKING (one wizard: organisation, project, prompt, connection)
  // One question at a time on the left; on the right, what is being set up builds itself as you answer, then the
  // connection animates as it waits, is tested and goes live. KPIs and the baseline follow on the connect page.
  const TRK_STEPS = ['Organisation', 'Project', 'Prompt', 'Connection'];
  const trkFresh = () => ({ step: 1, orgId: null, isNew: false, q: '', industry: 'Property and real estate', signed: true, name: '', kind: 'documents', sol: '', solTouched: false, method: 'link', objective: '', simId: null, copied: false });
  const trkSim = () => { const t = state.trk; return t && t.simId ? simById(t.simId) : null; };
  // Where the person is: steps 1 and 2 before anything exists, then the wizard's own steps for the solution.
  function trkStep() { const t = state.trk, s = trkSim(); return s && s.stage === 'draft' ? 2 + Math.min(state.wiz.step, 2) : t.step; }
  function trkVisual(n) {
    const t = state.trk, s = trkSim(), w = state.wiz, o = s ? orgOf(s) : t.orgId ? state.orgs.find((x) => x.id === t.orgId) : null;
    const orgName = o ? o.name : t.isNew && t.q.trim() ? t.q.trim() : '', K = KINDS[t.kind], projName = s ? s.project.name : t.name.trim(), solName = s ? (w.solName || s.name) : (t.sol.trim() || K.sol);
    const m = WMETHODS[s ? w.method : t.method], tests = s ? w.tests : [], done = tests.filter((x) => x[1] === 'ok').length;
    const st = !s ? 'idle' : w.tested ? 'live' : tests.length ? 'test' : n >= 4 ? 'wait' : 'idle';
    const seen = t.vis || {}; t.vis = {};
    const node = (id, ic, label, val, sub, on, cls = '') => { t.vis[id] = !!val; return `<div class="tnode ${on ? 'on' : ''} ${val && !seen[id] ? 'pop' : ''} ${cls}" id="${id}"><span class="cic">${icon(ic)}</span><span class="tl">${label}</span><b class="nm">${val ? esc(val) : '<span class="ph">Not chosen yet</span>'}</b>${sub ? `<span class="sub">${sub}</span>` : ''}</div>`; };
    const link = (on) => `<div class="twire ${on ? 'on' : ''}" aria-hidden="true"><span class="track"></span></div>`;
    const flow = `<div class="cwire" aria-hidden="true"><span class="track"></span><i></i><i></i><i></i></div>`;
    const word = st === 'live' ? 'Connected' : st === 'test' ? `Checking, ${done} of ${tests.length}` : st === 'wait' ? ({ link: 'Waiting for the developer', axle: 'Ready to test', sheet: 'Waiting for a file' })[w.method] : 'Not connected yet';
    return `<aside class="tvis" aria-label="What you are setting up"><div class="tvis-head"><span class="eyebrow">What you’re setting up</span>${st === 'live' ? '<span class="pill ok"><span class="dot"></span>Live</span>' : ''}</div>
      ${node('tv-org', 'organisation', 'Organisation', orgName, o ? (o.signed === false ? 'Data agreement not signed' : 'Data agreement signed') : t.isNew && orgName ? 'New' : '', !!orgName)}
      ${link(!!orgName && !!projName)}
      ${node('tv-proj', 'projects', 'Project', projName, projName ? esc(K.label) : '', !!projName)}
      ${link(!!projName && (n >= 3 || !!s))}
      <div class="cmap vert" data-st="${st}">
        ${node('tv-sol', 'box', 'Solution', projName ? solName : '', projName ? `${esc(orgName || 'Their')}’s system` : '', !!s && st === 'live', st === 'live' ? 'ok' : '')}
        ${flow}
        <div class="tnode door ${st === 'live' || (st === 'test' && done >= Math.ceil(tests.length / 2)) ? 'ok on' : ''}"><span class="cic">${icon(m.ic)}</span><span class="tl">How it shares</span><b class="nm">${m.door}</b><span class="cword">${word}</span></div>
        ${flow}
        <div class="tnode out ${st === 'live' ? 'ok on' : ''}"><span class="cic"><img src="assets/antarax-mark.svg" alt=""></span><span class="tl">Outcomes</span><b class="nm">Collects ${s && w.method === 'sheet' ? 'each week' : 'every night'}</b><span class="sub">Reads totals, changes nothing</span></div>
      </div></aside>`;
  }
  pages.track = (id) => {
    if (id && simById(id) && (!state.trk || state.trk.simId !== id)) { state.trk = Object.assign(trkFresh(), { simId: id }); state.focusSim = id; }
    state.trk = state.trk || trkFresh();
    const t = state.trk, n = trkStep(), s = trkSim(), w = state.wiz, K = KINDS[t.kind];
    if (s && s.stage !== 'draft') { state.trk = trkFresh(); return pages.track(); }
    const shown = `${n}:${s ? w.tested : ''}:${s ? w.method : t.isNew}`, enter = t.shown !== shown; t.shown = shown;
    const steps = `<ol class="tsteps">${TRK_STEPS.map((l, i) => `<li class="${i + 1 < n ? 'done' : i + 1 === n ? 'now' : ''}" ${i + 1 === n ? 'aria-current="step"' : ''}><b>${i + 1 < n ? icon('check', 'sm') : i + 1}</b><span>${l}</span></li>`).join('')}<li class="then"><span>Then: what to measure, baseline, approval</span></li></ol>`;
    const back = n > 1 && n !== 3 && !(n === 4 && s && w.tested) ? `<button type="button" class="btn ghost" data-act="trk-back">${icon('back', 'sm')}Back</button>` : n === 3 ? '<span></span>' : `<a class="btn ghost" href="#home">Cancel</a>`;
    const foot = (label, attrs = '', extra = '', cls = 'btn primary lg') => `<div class="wfoot">${back}<span class="head-actions">${extra}<button type="button" class="${cls}" ${attrs}>${label}</button></span></div>`;
    let body = '';
    if (n === 1) {
      const q = t.q.trim(), list = state.orgs, exact = list.some((o) => o.name.toLowerCase() === q.toLowerCase());
      body = `<div class="tq"><span class="tq-n">1 of 4</span><h2>Which organisation is this for?</h2><p class="muted">Pick one, or type a new name to add it.</p></div>
        <div class="field"><label for="tk-q" class="sr-only">Organisation</label><div class="tk-search">${icon('search', 'sm')}<input id="tk-q" autocomplete="off" placeholder="Type an organisation’s name" value="${esc(t.q)}"></div></div>
        <div class="tk-orgs" role="listbox" aria-label="Organisations">
          ${list.map((o) => `<button type="button" class="tk-org" role="option" data-trk-org="${o.id}" aria-selected="${t.orgId === o.id}" data-name="${esc(o.name.toLowerCase())}"><span class="avatar" style="border-radius:10px">${initials(o.name)}</span><span><b class="ink">${esc(o.name)}</b><small>${esc(o.industry)} · ${simsOf(o).length} project${simsOf(o).length === 1 ? '' : 's'}</small></span>${icon('check', 'sm')}</button>`).join('')}
          <button type="button" class="tk-org add" data-trk-new="1" aria-selected="${t.isNew}" ${q && !exact ? '' : 'hidden'} id="tk-add"><span class="avatar" style="border-radius:10px;background:var(--primary-tint);color:var(--primary-ink)">${icon('plus', 'sm')}</span><span><b class="ink">Add “<span id="tk-add-name">${esc(q)}</span>”</b><small>A new organisation</small></span>${icon('check', 'sm')}</button>
        </div>
        ${!list.length && !q ? '<p class="small muted">No organisations yet. Type the first one’s name.</p>' : ''}
        ${t.isNew ? `<div class="tk-new form-grid"><div class="field"><label for="tk-ind">Industry</label><select id="tk-ind">${['Property and real estate', 'Food and beverage', 'Logistics', 'Manufacturing', 'Healthcare', 'Engineering and construction', 'Retail', 'Other'].map((x) => `<option ${t.industry === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
          <label class="check" style="align-self:end"><input type="checkbox" id="tk-signed" ${t.signed ? 'checked' : ''}><span><b class="ink">Data agreement signed</b><br><span class="small muted">Nothing is collected until it is</span></span></label></div>` : ''}
        ${foot('Continue', `data-act="trk-next" ${t.orgId || (t.isNew && q) ? '' : 'disabled'}`)}`;
    }
    if (n === 2) {
      body = `<div class="tq"><span class="tq-n">2 of 4</span><h2>What’s the project?</h2><p class="muted">The name ${esc(t.isNew ? t.q.trim() : (state.orgs.find((o) => o.id === t.orgId) || {}).name || 'they')} use for it.</p></div>
        <div class="field"><label for="tk-name" class="sr-only">Project name</label><input id="tk-name" class="tk-big" placeholder="e.g. Lease abstraction" value="${esc(t.name)}" autocomplete="off"></div>
        <div class="field"><span class="lab">Kind of work <span class="muted" style="font-weight:400">· steers the KPIs AI suggests</span></span><div class="tk-kinds">${Object.entries(KINDS).map(([k, x]) => `<button type="button" class="tk-kind" data-trk-kind="${k}" aria-pressed="${t.kind === k}">${icon(x.icon, 'sm')}<span>${x.label}</span></button>`).join('')}</div></div>
        <div class="form-grid"><div class="field"><label for="tk-sol">The solution is called</label><input id="tk-sol" value="${esc(t.sol || K.sol)}"></div>
          <div class="field"><span class="lab">It shares figures by</span><div class="seg tk-seg" role="group" aria-label="How it shares">${Object.entries(WMETHODS).map(([k, x]) => `<button type="button" data-trk-method="${k}" aria-pressed="${t.method === k}">${{ link: 'Link', axle: 'AntaraX product', sheet: 'Spreadsheet' }[k]}</button>`).join('')}</div><span class="help">${esc(WMETHODS[t.method].effort)}${t.method === 'link' ? '. Best for anything REKA builds' : ''}</span></div></div>
        <details class="more"><summary>The outcome, in their words (you can add it later)</summary><div class="field" style="margin-top:8px"><textarea id="tk-obj" rows="2">${esc(t.objective || K.objective)}</textarea></div></details>
        ${foot(t.method === 'link' ? 'Create and get the prompt' : 'Create and connect', `data-act="trk-next" ${t.name.trim() ? '' : 'disabled'}`)}`;
    }
    if (n === 3 && s) {
      const solName = w.solName || s.name;
      if (w.method === 'link') body = `<div class="tq"><span class="tq-n">3 of 4</span><h2>Send this prompt to the developer</h2><p class="muted">Paste it into Claude Code or Codex, or send it to whoever builds ${esc(solName)}. About a day of work.</p></div>
        <div class="tk-prompt"><div class="code-block prompt" id="dev-prompt">${esc(devPrompt(s))}</div><button type="button" class="btn primary lg tk-copy ${t.copied ? 'copied' : ''}" data-act="trk-copy">${t.copied ? `${icon('check', 'sm')}Copied` : `${icon('copy', 'sm')}Copy prompt`}</button></div>
        <p class="small muted">${icon('link', 'sm')} Or send the <button type="button" class="lnk" data-act="copy-devlink">developer link</button>: the prompt, their own key, and the test runs when they paste the address.</p>
        ${foot('I’ve sent it', 'data-act="w-next"', '', 'btn lg')}`;
      if (w.method === 'axle') body = `<div class="tq"><span class="tq-n">3 of 4</span><h2>Which product is it?</h2><p class="muted">AntaraX products already share daily totals. Nothing to build, no prompt.</p></div>
        <div class="tk-kinds">${['Yara', 'Janka'].map((p) => `<button type="button" class="tk-kind" data-trk-prod="${p}" aria-pressed="${w.product === p}">${icon('box', 'sm')}<span>${p}</span></button>`).join('')}</div>
        ${foot('Connect', 'data-act="w-next"')}`;
      if (w.method === 'sheet') body = `<div class="tq"><span class="tq-n">3 of 4</span><h2>Share the spreadsheet template</h2><p class="muted">One row a day, one column a figure. Totals only, no names.</p></div>
        <div class="tk-prompt"><div class="code-block" id="w-tpl">${esc(sheetTemplate(kindOf(s)))}</div><button type="button" class="btn primary lg tk-copy ${t.copied ? 'copied' : ''}" data-act="trk-copy">${t.copied ? `${icon('check', 'sm')}Copied` : `${icon('copy', 'sm')}Copy columns`}</button></div>
        ${foot('Next: the first file', 'data-act="w-next"', '', 'btn lg')}`;
    }
    if (n === 4 && s) {
      const solName = w.solName || s.name, testing = w.tests.length && !w.tested, lastOk = w.tests.filter((x) => x[1] === 'ok').length - 1;
      const checks = w.tests.length ? `<div class="checks" aria-live="polite">${w.tests.map(([x, ok], i) => `<div${i === lastOk && !w.tested ? ' class="just"' : ''}><span class="tick ${ok}">${ok === 'ok' ? '✓' : '…'}</span><span>${esc(x)}</span></div>`).join('')}</div>` : '';
      if (w.tested) body = `<div class="tq"><span class="tq-n">4 of 4</span><h2 class="tk-win">${icon('check')}${esc(solName)} is connected</h2><p class="muted">Every check passed. It shares 6 figures: 4 ready, 1 with a note, 1 held back because it could identify people.</p></div>
        ${foundChips(kindOf(s))}${checks}
        ${foot(`Choose what to measure${icon('chev', 'sm')}`, 'data-act="trk-measure"', `<a class="btn" href="#organisation-${s.orgId}">Later</a>`)}`;
      else if (testing) body = `<div class="tq"><span class="tq-n">4 of 4</span><h2>Testing the connection</h2><p class="muted">Checking it is signed and reading one day of figures. Nothing is saved until every check passes.</p></div>${checks}`;
      else if (w.method === 'sheet') body = `<div class="tq"><span class="tq-n">4 of 4</span><h2>Waiting for the first file</h2><p class="muted">Upload a week of figures saved from the template. It is checked straight away.</p></div>
        <div class="tk-drop" id="tk-drop"><span class="radar">${icon('sheet')}</span><div><b class="ink">Drop the CSV here</b><p class="small muted">or</p><div class="head-actions" style="justify-content:center"><button type="button" class="btn" data-act="w-pickfile">${icon('upload', 'sm')}Choose a file</button><button type="button" class="btn ghost" data-act="w-examplefile">Use the example file</button></div></div><input type="file" id="w-file" accept=".csv,text/csv" hidden></div>
        ${foot('Waiting for the file', 'disabled', `<a class="btn" href="#organisation-${s.orgId}">Leave and come back</a>`)}`;
      else body = `<div class="tq"><span class="tq-n">4 of 4</span><h2>Waiting for ${esc(solName)}</h2><p class="muted">The developer adds the link and runs the contract test. When they paste the address in their developer link, Outcomes tests it at once and tells you. You can leave this page.</p></div>
        <div class="tk-listen"><span class="radar">${icon('lock')}</span><div><b class="ink">Listening for the link</b><p class="small muted">Prompt sent ${esc((w.promptAt || now()).replace(' 2026,', ''))} · usually about a day</p><label class="check" style="margin-top:8px"><input type="checkbox" id="w-notify" ${w.notify === false ? '' : 'checked'}><span>Email me when it connects</span></label></div></div>
        <details class="more"><summary>Have the address? Test it now</summary><div class="with-btn" style="margin-top:8px"><input id="w-url" class="mono" aria-label="Link address" value="${esc(w.url)}"><button type="button" class="btn" data-act="w-test">Test</button></div></details>
        <div class="demo-bar"><span class="tag">MOCK CONTROLS</span><button type="button" class="btn sm" data-act="w-devdone">The developer finished</button></div>
        ${foot('Waiting for the connection', 'disabled', `<a class="btn" href="#organisation-${s.orgId}">Leave and come back</a>`)}`;
    }
    return `${head({ title: 'Start tracking', kind: 'manage', lead: 'Four short steps: the organisation, the project, the prompt for the developer, and the connection.', state: s ? `${esc(orgOf(s).name)} · ${esc(s.project.name)}` : undefined, actions: s ? '<button type="button" class="btn sm ghost" data-act="trk-new">Start another</button>' : '' })}
      <div class="track">${steps}<div class="track-grid"><section class="card tq-card${enter ? ' enter' : ''}" id="wpanel">${body}</section>${trkVisual(n)}</div></div>`;
  };
  pages.track.after = () => {
    const t = state.trk; if (!t) return;
    const q = $('#tk-q');
    if (q) {
      // Filter and name the new organisation without re-rendering, so typing never loses focus.
      const sync = () => {
        const v = q.value.trim(), lv = v.toLowerCase(); t.q = q.value;
        $$('.tk-org[data-trk-org]').forEach((b) => { b.hidden = !!lv && !b.dataset.name.includes(lv); });
        const add = $('#tk-add'), exact = state.orgs.find((o) => o.name.toLowerCase() === lv);
        if (add) { add.hidden = !v || !!exact; $('#tk-add-name').textContent = v; }
        if (t.isNew && (!v || exact)) { t.isNew = false; }
        const nm = $('#tv-org .nm'); if (nm) nm.innerHTML = (t.isNew && v) ? esc(v) : t.orgId ? esc((state.orgs.find((o) => o.id === t.orgId) || {}).name || '') : '<span class="ph">Not chosen yet</span>';
        const nx = $('[data-act=trk-next]'); if (nx) nx.disabled = !(t.orgId || (t.isNew && v));
      };
      q.addEventListener('input', () => { if (t.orgId) { t.orgId = null; $$('.tk-org').forEach((b) => b.setAttribute('aria-selected', 'false')); } sync(); });
      q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const v = q.value.trim(), ex = state.orgs.find((o) => o.name.toLowerCase() === v.toLowerCase()); if (ex) { t.orgId = ex.id; t.isNew = false; } else if (v) { t.isNew = true; } render(); const f = $('#tk-q'); if (f) f.focus(); } });
      sync(); if (t.step === 1 && !t.orgId) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    }
    const ind = $('#tk-ind'); if (ind) ind.addEventListener('change', () => { t.industry = ind.value; });
    const sg = $('#tk-signed'); if (sg) sg.addEventListener('change', () => { t.signed = sg.checked; render(); });
    const nm = $('#tk-name');
    if (nm) {
      nm.addEventListener('input', () => { t.name = nm.value; const v = $('#tv-proj .nm'); if (v) v.innerHTML = nm.value.trim() ? esc(nm.value.trim()) : '<span class="ph">Not chosen yet</span>'; $('#tv-proj').classList.toggle('on', !!nm.value.trim()); const nx = $('[data-act=trk-next]'); if (nx) nx.disabled = !nm.value.trim(); const sv = $('#tv-sol .nm'); if (sv) sv.innerHTML = nm.value.trim() ? esc(t.sol.trim() || KINDS[t.kind].sol) : '<span class="ph">Not chosen yet</span>'; });
      nm.addEventListener('keydown', (e) => { if (e.key === 'Enter' && nm.value.trim()) { e.preventDefault(); trkNext(); } });
      if (!nm.value) nm.focus();
    }
    const so = $('#tk-sol'); if (so) so.addEventListener('input', () => { t.sol = so.value; t.solTouched = true; const v = $('#tv-sol .nm'); if (v && t.name.trim()) v.textContent = so.value.trim() || KINDS[t.kind].sol; });
    const ob = $('#tk-obj'); if (ob) ob.addEventListener('input', () => { t.objective = ob.value; });
    pages.connect.after();
    const dz = $('#tk-drop'); if (dz) {
      ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('over'); }));
      dz.addEventListener('dragleave', () => dz.classList.remove('over'));
      dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('over'); const x = e.dataTransfer.files[0]; if (!x || !/\.csv$/i.test(x.name)) { toast('Drop a CSV file, saved from the template.'); return; } state.wiz.sheetFile = x.name; runTests(); });
    }
  };
  function trkNext() {
    const t = state.trk;
    if (t.step === 1) { if (!(t.orgId || (t.isNew && t.q.trim()))) return; t.step = 2; render(); return; }
    if (t.step === 2 && !t.simId) {
      if (!t.name.trim()) { const el = $('#tk-name'); if (el) { el.setAttribute('aria-invalid', 'true'); el.focus(); } return; }
      state.mode = 'new';
      let org = state.orgs.find((o) => o.id === t.orgId);
      if (!org) { org = newOrg(t.q.trim(), t.industry, t.signed); log(`Added organisation ${org.name}`); }
      const sol = t.sol.trim() || KINDS[t.kind].sol;
      const sim = newSim(org, { kind: t.kind, project: t.name.trim(), objective: (t.objective || '').trim() || KINDS[t.kind].objective, sol });
      log(`Created project ${sim.project.name} for ${org.name}`);
      t.simId = sim.id; t.orgId = org.id; state.focusSim = sim.id;
      state.wiz = Object.assign(freshWizard(), { method: t.method, solName: sol });
      go('track-' + sim.id); return;
    }
  }
  function finishWizard() {
    const w = state.wiz, s = wizSim();
    s.name = w.solName || s.name;
    s.base = w.keep.impact ? Object.assign({}, w.baseline) : { method: 'none' };
    const n = sendSimForApproval(s, w.keep, false);
    state.approvalSel = state.myApprovals[0] && state.myApprovals[0].id;
    log(`Connected ${s.name} and sent ${n} KPIs to Aisyah Rahman`);
    state.wiz = freshWizard();
    go('sim-' + s.id); toast(`Sent ${n} KPIs for approval.`);
  }

  // ------------------------------------------------------------------ APPROVALS
  pages.approvals = () => {
    const list = demo() ? state.approvals : state.myApprovals;
    if (!list.length) return `${head({ title: 'Approvals', lead: 'KPIs, baselines and reports wait here until someone other than the proposer approves them.' })}<section class="card"><div class="empty">${emptyArt}<h3>Nothing to approve</h3><p>When you connect a solution, its KPIs come here for a second person to check.</p></div></section>`;
    const sel = list.find((a) => a.id === state.approvalSel) || list[0];
    state.approvalSel = sel.id;
    const orgName = (a) => a.projOrg || (a.simId ? orgOf(simById(a.simId)).name : orgById(a.org).short);
    const mine = sel.proposer === state.role || sel.editedBy === state.role;
    const can = has('Approve') && !mine && sel.status === 'waiting';
    const why = sel.status === 'blocked' ? 'Needs a baseline first' : mine ? 'You set this up, so someone else approves it.' : !has('Approve') ? 'You can comment, but not approve.' : '';
    const sp = (a) => ({ waiting: '<span class="pill warn"><span class="dot"></span>Waiting</span>', blocked: '<span class="pill fault"><span class="dot"></span>Blocked</span>', approved: '<span class="pill ok"><span class="dot"></span>Approved</span>', changes: '<span class="pill info">Changes asked</span>', declined: '<span class="pill idle">Declined</span>' })[a.status];
    const who = (id) => id === 'ai' ? `<span class="ai-mark"><img src="${SPARK}" alt="">Suggested by AI</span>` : id === 'collector' ? 'Spotted automatically' : M.staff[id].name;
    return `${head({ title: 'Approvals', lead: 'Nothing is measured or shown to an organisation until someone other than the proposer approves it.', meta: `<span>${list.filter((a) => a.status === 'waiting').length} waiting</span><span>${list.filter((a) => a.status === 'blocked').length} blocked</span>` })}
    ${!demo() && state.role === 'daniel' && list.some((a) => a.status === 'waiting' && a.editedBy === 'daniel') ? `<div class="callout info">${icon('people')}<span>You set these up, so Aisyah Rahman approves them. To try it, switch to Aisyah from your profile menu.</span></div>` : ''}
    <div class="grid ap-split" id="ap-split">
      <div class="grid" style="gap:8px;align-content:start">${list.map((a) => `<button type="button" class="choice" style="grid-template-columns:minmax(0,1fr);gap:6px" data-sel="${a.id}" aria-pressed="${a.id === sel.id}"><span class="meta-line" style="margin:0">${sp(a)}<span class="pill idle">${a.type}</span></span><b>${esc(a.title)}</b><span class="d">${esc(orgName(a))} · ${esc(a.since.replace(' 2026,', ''))}</span></button>`).join('')}</div>
      <section class="card" aria-labelledby="ap-h">
        <div class="meta-line" style="margin:0 0 8px">${sp(sel)}<span class="pill idle">${sel.type}</span></div><h2 id="ap-h">${esc(sel.title)}</h2>
        <p class="ink" style="margin-top:6px">${esc(sel.summary)}</p>
        <div style="margin-top:12px">${kv([['Organisation', esc(orgName(sel))], ['Proposed by', who(sel.proposer) + (sel.editedBy ? `, edited by ${M.staff[sel.editedBy].name}` : '')]].concat((sel.fields || []).map(([k, v]) => [k, esc(v)])).concat([['Evidence', esc(sel.evidence)], ['Changes', esc(sel.affects)]]), 140)}</div>
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
      if (a.cmId) { const pj = projById(a.projId), cm = pj && pj.custom().find((x) => x.id === a.cmId); if (cm) cm.status = { approved: 'live', changes: 'changes', declined: 'declined' }[dec]; }
      if (a.simId && !a.cmId) { const s = simById(a.simId), its = list.filter((x) => x.simId === s.id); if (s.stage === 'review' && !its.some((x) => x.status === 'waiting') && its.some((x) => x.status === 'approved')) s.stage = 'approved'; }
      log(`${({ approved: 'Approved', changes: 'Asked for changes to', declined: 'Declined' })[dec]} “${a.title}”: ${reason}`);
      const nxt = list.find((x) => x.status === 'waiting'); if (nxt) state.approvalSel = nxt.id;
      render();
      toast(({ approved: 'Approved', changes: 'Changes requested', declined: 'Declined' })[dec] + '.', () => { a.status = prev; auditList().shift(); render(); });
    });
  };

  // ------------------------------------------------------------------ REPORTS
  // One row per project report, tagged with its organisation, in every workspace.
  function reportRows() {
    const pill = (c, t, dot = true) => `<span class="pill ${c}">${dot ? '<span class="dot"></span>' : ''}${t}</span>`;
    if (!demo()) return state.sims.map((s) => { const r = simReportState(s), open = r.st === 'ready' || r.st === 'approved';
      return { cid: s.orgId, name: s.project.name, cadence: s.project.cadence, period: open ? monthName(r.ym) : '–', due: r.st === 'ready', go: open ? 'report-' + s.id : null,
        status: ({ none: pill('idle', s.stage === 'collecting' ? 'Not scheduled' : 'Waiting for data', false), waiting: pill('info', `First draft ${nextMonthStart()}`, false), ready: pill('warn', 'Ready to review'), approved: pill('ok', 'Approved') })[r.st],
        action: r.st === 'none' && s.stage === 'collecting' ? `<button type="button" class="btn sm" data-act="schedule-report" data-sim="${s.id}">Schedule</button>` : open ? `<a class="btn sm" href="#report-${s.id}">Open</a>` : '' }; });
    return [
      { cid: 'contoh-logistik', name: 'Accounts payable automation', cadence: 'Monthly', period: 'Sep 2026', due: !state.reportApproved, go: 'report', status: state.reportApproved ? pill('ok', 'Approved') : pill('warn', 'Ready to review'), action: '<a class="btn sm" href="#report">Open</a>' },
      { cid: 'acme-plastics', name: 'Production planning assistant', cadence: 'Monthly', period: 'Sep 2026', status: pill('ok', 'Sent 3 Oct'), action: '' },
      { cid: 'bina-jaya', name: 'Quotation drafting', cadence: 'Quarterly', period: 'Q3 2026', status: pill('ok', 'Sent 7 Oct'), action: '' },
      { cid: 'sampel-medik', name: 'Patient enquiry triage', cadence: 'Monthly', period: 'Oct 2026', status: pill('idle', 'Drafts 1 Nov', false), action: '' },
    ];
  }
  const repKey = () => demo() ? 'example' : state.ws;
  const repFor = () => { const f = state.repFor; return f && f.k === repKey() && coById(f.id) ? coById(f.id) : null; };
  pages.reports = () => {
    const lead = 'Each organisation gets a report on their schedule. It’s drafted for you and goes out only after you check it.';
    if (!demo() && !state.sims.length) return `${head({ title: 'Reports', lead })}<section class="card"><div class="empty">${emptyArt}<h3>No reports yet</h3><p>Once a solution is collecting data, you can schedule its report here.</p></div></section>`;
    const all = reportRows(), one = repFor();
    const opts = companies().filter((c) => all.some((r) => r.cid === c.id) || (one && one.id === c.id));
    const count = (id) => all.filter((r) => r.cid === id).length;
    const rows = (one ? all.filter((r) => r.cid === one.id) : all).map((r, i) => ({ r, i, c: coById(r.cid) })).sort((a, b) => opts.indexOf(a.c) - opts.indexOf(b.c) || a.i - b.i);
    const due = rows.filter((x) => x.r.due).length, cur = one ? one.id : 'all';
    const pick = opts.length <= 5
      ? `<div class="seg" role="group" aria-label="Organisation">${[['all', 'All organisations']].concat(opts.map((c) => [c.id, c.short])).map(([k, l]) => `<button type="button" data-repfor="${k}" aria-pressed="${cur === k}">${esc(l)}</button>`).join('')}</div>`
      : `<div class="field" style="min-width:200px"><select id="rep-for" aria-label="Organisation"><option value="all">All organisations (${all.length})</option>${opts.map((c) => `<option value="${c.id}" ${cur === c.id ? 'selected' : ''}>${esc(c.short)} (${count(c.id)})</option>`).join('')}</select></div>`;
    const cols = one ? 4 : 5;
    const ghost = !demo() && all.some((r) => /First draft/.test(r.status));
    return `${head({ title: 'Reports', lead })}
    <section class="card" style="padding:14px 18px"><div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">${pick}<span class="small muted">${rows.length} report${rows.length === 1 ? '' : 's'}${due ? ` · ${due} ready to review` : ''}</span></div></section>
    <section class="card">${one ? `<div class="card-head"><div><h2>Reports for ${esc(one.short)}</h2><p class="sub">${esc(one.industry)} · ${one.projects.length} project${one.projects.length === 1 ? '' : 's'}</p></div><a class="btn sm ghost" href="${one.href}">Open organisation${icon('chev', 'sm')}</a></div>` : ''}
      <div class="table-wrap"><table class="report-table"><thead><tr><th>Report</th>${one ? '' : '<th class="rt-client">Organisation</th>'}<th>Period</th><th>Status</th><th></th></tr></thead><tbody>
      ${rows.length ? rows.map(({ r, c }) => `<tr ${r.go ? `class="link" data-go="${r.go}" tabindex="0"` : ''}><td><span class="name">${esc(r.name)}</span><span class="sub">${esc(r.cadence)}</span>${one ? '' : `<span class="sub rt-co">${esc(c.short)}</span>`}</td>${one ? '' : `<td class="rt-client"><span class="name">${esc(c.short)}</span><span class="sub">${esc(c.industry)}</span></td>`}<td class="mono">${esc(r.period)}</td><td>${r.status}</td><td>${r.action}</td></tr>`).join('')
        : `<tr><td colspan="${cols}"><div class="empty" style="padding:16px"><p>No reports for ${esc(one.short)} yet. The first is drafted once a solution has a month of figures. <button type="button" class="btn sm ghost" data-repfor="all">Show all organisations</button></p></div></td></tr>`}
    </tbody></table></div></section>${ghost ? `<div class="demo-bar"><span class="tag">MOCK CONTROLS</span><span>Reports draft on the 1st of each month.</span><button type="button" class="btn sm" data-act="to-month-end">Jump to ${nextMonthStart()}</button></div>` : ''}`;
  };
  pages.reports.after = () => { const sel = $('#rep-for'); if (sel) sel.addEventListener('change', (e) => { state.repFor = e.target.value === 'all' ? null : { k: repKey(), id: e.target.value }; render(); }); };
  const paper = (o) => `<article class="paper" aria-label="Report preview">
      <header class="paper-head"><div class="top"><span class="eyebrow"><img src="${SPARK}" alt="">Performance report</span><img class="reka" src="assets/reka-lockup.svg" alt="REKA"></div>
        <h1>${esc(o.title)}</h1>
        <div class="meta"><span>Prepared for ${esc(o.org)}</span><span>Period <span class="mono">${esc(o.period)}</span></span><span>Generated <span class="mono">${esc(o.generated)}</span></span><span class="example">${o.tag}</span></div></header>
      <section><h2>Summary</h2><div class="headline">${o.headline.map(([l, v, s]) => `<div><span class="l">${l}</span><span class="v">${v}</span><span class="s">${s}</span></div>`).join('')}</div></section>
      <section><h2>Outcomes</h2><div class="table-wrap"><table><thead><tr><th>Measure</th><th class="num">${o.cols[0]}</th><th class="num">${o.cols[1]}</th><th class="num">Before</th><th>Kind</th></tr></thead><tbody>${o.rows.map(([n, a, b, c, k]) => `<tr><td><span class="name">${n}</span></td><td class="num">${a}</td><td class="num">${b}</td><td class="num">${c}</td><td>${q(k)}</td></tr>`).join('')}</tbody></table></div></section>
      <section><h2>What changed</h2><ul>${o.changed.map((x) => `<li>${x}</li>`).join('')}</ul></section>
      <section><h2>How we measured</h2><div class="fn">${o.notes.map((x, i) => `<span><sup>${i + 1}</sup> ${x}</span>`).join('')}</div></section>
      <section><h2>Caveats</h2><div class="note">${o.caveat}</div></section>
      <section><h2>Recommended next steps</h2><ol>${o.next.map((x) => `<li>${x}</li>`).join('')}</ol></section>
      <footer class="paper-foot"><span>Run by REKA as part of Managed AI.</span><span class="mono">Page 1 of 1</span><span>REKA Inisiatif Sdn Bhd</span></footer>
    </article>`;
  pages.report = (id) => {
    if (id) return simReportPage(simById(id));
    if (!demo()) return pages.reports();
    const sep = contohMonth('2026-09'), aug = contohMonth('2026-08'), canApprove = has('Approve') && state.role !== 'nurul';
    const delta = (a, b) => (a - b >= 0 ? '+' : '−') + nf(Math.abs(a - b));
    return `${head({ crumbs: crumbs(['Reports', '#reports'], ['Contoh Logistik, September 2026']), title: 'September 2026 report',
      meta: `${state.reportApproved ? '<span class="pill ok"><span class="dot"></span>Approved, ready to send</span>' : '<span class="pill warn"><span class="dot"></span>Ready to review</span>'}${aiMark('Drafted by AI, edited by Nurul Aina')}<span>Every figure checked</span><span>No fees shown</span>`,
      actions: state.reportApproved ? '<button type="button" class="btn primary" data-act="send-report">Send to Contoh Logistik</button>' : gate(canApprove, 'Approve report', state.role === 'nurul' ? 'You edited this, so someone else approves.' : 'Needs approval rights', 'data-act="approve-report"') })}
    ${paper({ title: 'Accounts payable automation: September 2026', org: 'Contoh Logistik Sdn Bhd', period: '1 to 30 Sep 2026', generated: '15 Oct 2026, 06:12 MYT', tag: 'Example data', cols: ['September', 'August'],
      headline: [['Documents completed', nf(sep.docs), `${delta(sep.docs, aug.docs)} on August · measured<sup>1</sup>`], ['Preparation hours freed', nf(sep.imp.mid), `likely ${nf(sep.imp.low)} to ${nf(sep.imp.high)} · estimated<sup>2</sup>`], ['Sent back for correction', nf(sep.rate, 1) + '%', '7.4% before go-live · derived<sup>3</sup>']],
      rows: [['Documents completed', nf(sep.docs), nf(aug.docs), '–', 'measured'], ['Preparation hours freed', nf(sep.imp.mid), nf(aug.imp.mid), '18 min/doc', 'estimated'], ['Sent back for correction', nf(sep.rate, 1) + '%', nf(aug.rate, 1) + '%', '7.4%', 'derived'], ['Days to approve an invoice', nf(sep.ct, 1), nf(aug.ct, 1), '4.5', 'derived'], ['Invoices triaged', nf(sep.invoices), nf(aug.invoices), '–', 'measured']],
      changed: ['More documents went through the workflow than in August, mostly invoices.', 'Fewer needed correction, which also shortens the review step.', 'Invoices moved from receipt to approval faster through the month.'],
      notes: ['Counted by the workflow, collected daily. 21 and 22 Sep are missing and not counted.', `Documents × (18 minutes by hand − ${nf(sep.imp.machineMean, 1)} machine minutes − 4 review minutes) ÷ 60. By-hand time from 40 documents timed on 2 to 6 Jun 2026, before go-live; review time from 30 documents on 1 to 3 Oct 2026. The range uses both samples’ low and high ends. Machine time is never counted as time saved.`, 'Documents sent back ÷ documents completed. Before go-live: system records, Mar to May 2026.'],
      caveat: 'These figures compare September with the baseline. They don’t show what caused every change: invoice volumes and supplier mix also moved. Hours freed are an estimate, not hours removed from anyone’s week.',
      next: ['Split hours freed by document type from October, now that the workflow reports why documents are sent back.', 'Re-time a fresh sample of 20 statements: they take longest by hand and are a growing share.', 'Agree how to count Invoice triage’s hours alongside the document workflow, so its savings can be reported without double counting.'] })}`;
  };
  function simReportPage(s) {
    const o = orgOf(s), K = kindOf(s), r = simReportState(s), ym = r.ym, pm = prevMonth(ym);
    const cur = simSum(s, monthWindow(ym)), prev = simSum(s, monthWindow(pm));
    if (!cur.n) return `${head({ crumbs: crumbs(['Reports', '#reports'], [s.project.name]), title: `${esc(s.project.name)} report` })}<section class="card"><div class="empty">${emptyArt}<h3>The first report needs a full month of figures</h3><p>The first draft arrives on ${nextMonthStart()}. Move the date forward in Demo studio to see it.</p><button type="button" class="btn primary" data-act="to-month-end">Jump to ${nextMonthStart()}</button></div></section>`;
    const approved = r.st === 'approved', canApprove = has('Approve');
    const B = s.base, pct = (x) => x === null ? '–' : nf(x, 1) + '%', hasPrev = prev.n > 0;
    const delta = (a, b) => (a - b >= 0 ? '+' : '−') + nf(Math.abs(a - b));
    const firstMonth = !hasPrev;
    const rows = [[`${cap(K.nouns)} handled`, nf(cur.vol), hasPrev ? nf(prev.vol) : '–', '–', 'measured']];
    if (s.kpis.includes('impact') && hasBase(s)) rows.push(['Hours freed', nf(cur.mid), hasPrev ? nf(prev.mid) : '–', `${B.mid} min/${K.noun}`, 'estimated']);
    if (s.kpis.includes('quality')) rows.push([`${cap(K.qual.label)}`, pct(cur.rate), hasPrev ? pct(prev.rate) : '–', nf(K.qual.from, 1) + '%', 'derived']);
    return `${head({ crumbs: crumbs(['Reports', '#reports'], [`${o.name}, ${monthName(ym)}`]), title: `${monthName(ym)} report`,
      meta: `${approved ? '<span class="pill ok"><span class="dot"></span>Approved, ready to send</span>' : '<span class="pill warn"><span class="dot"></span>Ready to review</span>'}${aiMark('Drafted by AI from the figures')}<span>Every figure checked</span>`,
      actions: approved ? `<button type="button" class="btn primary" data-act="send-report">Send to ${esc(o.name)}</button>` : gate(canApprove, 'Approve report', 'Needs approval rights', `data-act="approve-sim-report" data-sim="${s.id}"`) })}
    ${paper({ title: `${s.project.name}: ${monthName(ym)}`, org: o.name, period: `1 to ${monthWindow(ym).length} ${MON[+ym.slice(5) - 1]} ${ym.slice(0, 4)}`, generated: `${day(today())}, 06:12 MYT`, tag: sandbox() ? 'Demo workspace · simulated' : 'Example data', cols: [MONTHS[+ym.slice(5) - 1], hasPrev ? MONTHS[+pm.slice(5) - 1] : '–'],
      headline: [[`${cap(K.nouns)} handled`, nf(cur.vol), hasPrev ? `${delta(cur.vol, prev.vol)} on ${MONTHS[+pm.slice(5) - 1]} · measured<sup>1</sup>` : 'first month · measured<sup>1</sup>'], ['Hours freed', s.kpis.includes('impact') && hasBase(s) ? nf(cur.mid) : '–', s.kpis.includes('impact') && hasBase(s) ? `likely ${nf(cur.low)} to ${nf(cur.high)} · estimated<sup>2</sup>` : 'needs a baseline'], [cap(K.qual.label), pct(cur.rate), `${nf(K.qual.from, 1)}% at the start · derived<sup>3</sup>`]],
      rows,
      changed: [firstMonth ? `This is the first full month of figures from ${esc(s.name)}.` : `${cap(K.nouns)} handled ${cur.vol >= prev.vol ? 'rose' : 'fell'} by ${nf(Math.abs(100 * (cur.vol - prev.vol) / prev.vol), 0)}% on the month before.`, cur.rate !== null && hasPrev && prev.rate !== null ? `The share ${K.qual.label} ${cur.rate <= prev.rate ? 'fell' : 'rose'} from ${pct(prev.rate)} to ${pct(cur.rate)}.` : `The share ${K.qual.label} was ${pct(cur.rate)}.`, cur.missing ? `${cur.missing} day${cur.missing > 1 ? 's are' : ' is'} missing and not counted.` : 'Every day of the month was collected.'],
      notes: [`Counted by ${esc(s.name)}, collected nightly.${cur.missing ? ` ${cur.missing} missing day${cur.missing > 1 ? 's' : ''} not counted.` : ''}`, hasBase(s) ? `${cap(K.nouns)} × (${B.mid} minutes by hand − ${nf(cur.machine, 1)} machine minutes − ${K.review.mid} review minutes) ÷ 60. By-hand time: ${({ sample: `a timed sample of ${B.n} ${K.nouns}`, history: 'the organisation’s past records', estimate: 'the organisation’s estimate' })[B.method]}. The range uses the fastest and slowest times. Machine time is never counted as time saved.` : 'No baseline has been agreed, so hours freed are not reported.', `${cap(K.nouns)} ${K.qual.label} ÷ ${K.nouns} handled.`],
      caveat: 'These figures compare this month with the baseline. They don’t show what caused every change. Hours freed are an estimate, not hours removed from anyone’s week.',
      next: [`Re-time a fresh sample of ${K.nouns} to confirm the baseline.`, `Look at the ${K.nouns} ${K.qual.label} to see what the AI finds hard.`, 'Agree the next quarter’s target with the organisation.'] })}`;
  }

  // ------------------------------------------------------------------ MEASURES tab: the standard library and your own
  function measuresTab(proj) {
    if (!proj) return '';
    const days = aWindow(30), prevDays = windowDays(30, M.addDays(days[0], -1));
    const T = totals(proj, days), P = totals(proj, prevDays), wt = weeksOf(aWindow(84)).map((w) => totals(proj, w));
    const tile = (name, quality, val, rangeTxt, chg, spark, how, extra) => `<article class="card kpi"><div class="top"><h3>${esc(name)}</h3>${q(quality)}</div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:10px"><div class="stat"><span class="value" style="font-size:1.5rem">${val === null ? dash() : esc(val)}</span>${val === null ? '<span class="hint">Not shared by this solution yet</span>' : `<span class="hint">${rangeTxt ? `Likely ${esc(rangeTxt)} · ` : ''}${chg || 'No earlier period'}</span>`}</div>${spark}</div>
      ${extra || ''}<p class="src">${esc(how)}</p></article>`;
    const cmpOk = comparable(T, P);
    const chgTxt = (v, pv, better) => { if (!cmpOk) return 'Too few days before to compare'; if (v === null || pv === null || pv === undefined || !isFinite(pv) || pv === 0) return null; const c = 100 * (v - pv) / Math.abs(pv); const good = better === 'up' ? c >= 0 : c <= 0; return `<span class="delta" style="color:var(--${Math.abs(c) < 1 ? 'muted' : good ? 'ok-ink' : 'fault-ink'})">${c >= 0 ? '▲' : '▼'} ${nf(Math.abs(c), 0)}%</span> vs before`; };
    let html = `<section class="grid" style="gap:6px"><div class="card-head" style="margin:0"><div><h2>Measures</h2><p class="sub">Last 30 days · the same library for every project, worked out from the solution’s daily figures</p></div><span class="head-actions"><a class="btn sm" href="#analytics" data-an-proj="${proj.id}">Open in analytics</a><button type="button" class="btn sm" data-tab="explore"><img src="${SPARK}" alt="" style="width:16px">Explore other measures</button><button type="button" class="btn sm primary" data-act="bld-open" data-proj="${proj.id}">${icon('plus', 'sm')}Add a measure</button></span></div></section>`;
    if (state.bld && state.bld.proj === proj.id) html += builderHtml(proj);
    const cms = proj.custom();
    html += `<section class="grid" style="gap:12px"><h3 class="muted" style="font-weight:500">Your measures</h3>${cms.length ? `<div class="grid ${gridFor(Math.min(3, cms.length))}">${cms.map((cm) => {
      const meta = customMeta(cm), v = evalCustom(proj, cm, days), pv = evalCustom(proj, cm, prevDays);
      const pill = cm.status === 'live' ? '' : `<div class="meta-line" style="margin:0">${cm.status === 'waiting' ? '<span class="pill warn"><span class="dot"></span>Waiting for approval</span>' : cm.status === 'changes' ? '<span class="pill info">Changes asked</span>' : '<span class="pill idle">Declined</span>'}${cm.status === 'waiting' && cm.by === state.role && cm.by !== 'aisyah' ? `<button type="button" class="btn sm ghost" data-act="cm-approve" data-proj="${proj.id}" data-cm="${cm.id}">Mock: Aisyah approves</button>` : ''}</div>`;
      return tile(cm.name, meta.quality, fmtM(meta, v), null, chgTxt(v, pv, 'up'), sparkline(weeksOf(aWindow(84)).map((w) => evalCustom(proj, cm, w))), `${customFormula(cm)} · ${cm.aud === 'client' ? 'staff and organisation' : 'staff only'}${cm.target ? ` · target ${cm.target}` : ''}`, pill);
    }).join('')}</div>` : `<div class="card"><div class="empty" style="padding:16px"><p>Add a measure of your own from the figures this solution shares, for example “hours saved per person”. It goes for approval like any KPI.</p></div></div>`}</section>`;
    DOMAINS.forEach((dm) => {
      const ms = MEASURES.filter((m) => m.domain === dm);
      if (dm === 'Commercial' && !has('Commercial')) { html += `<section class="grid" style="gap:12px"><h3 class="muted" style="font-weight:500">${dm}</h3><div class="callout info">${icon('lock')}<span>Running cost per item is REKA only, for people with the commercial right. Switch to Aisyah Rahman from your profile menu to see it.</span></div></section>`; return; }
      html += `<section class="grid" style="gap:12px"><h3 class="muted" style="font-weight:500">${dm}${dm === 'Commercial' ? ' · REKA only, never in organisation output' : ''}</h3><div class="grid ${ms.length === 1 ? 'g2' : gridFor(Math.min(4, ms.length))}">${ms.map((m) => {
        const v = m.calc(T), pv = m.calc(P), rg = m.range ? m.range(T) : null;
        return tile(m.name, m.quality, fmtM(m, v), rg ? `${fmtM(m, rg[0])} to ${fmtM(m, rg[1])}` : null, chgTxt(v, pv, m.better), sparkline(wt.map((t) => m.calc(t))), m.how);
      }).join('')}</div></section>`;
    });
    return html;
  }
  function builderHtml(proj) {
    const b = state.bld, meta = customMeta(b), d30 = aWindow(30), v = evalCustom(proj, b, d30), pv = evalCustom(proj, b, windowDays(30, M.addDays(d30[0], -1)));
    const fieldOpts = (sel) => Object.entries(FIELDS).map(([k, f]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${f.label}</option>`).join('');
    return `<section class="card" id="bld" style="border-color:var(--primary);box-shadow:0 0 0 3px var(--primary-tint)">
      <div class="card-head"><div><h2>Add a measure</h2><p class="sub">Built from the figures ${esc(proj.sol)} already shares. Someone else approves it before it counts.</p></div><button type="button" class="icon-btn" data-act="bld-close" aria-label="Close">${icon('x')}</button></div>
      <div class="form-grid">
        <div class="field full"><label for="bld-name">Name</label><input id="bld-name" value="${esc(b.name)}" placeholder="e.g. Hours saved per person"></div>
        <div class="field full"><span class="lab">Worked out as</span><div class="chips">${Object.entries(OPS).map(([k, l]) => `<button type="button" class="chip" data-bop="${k}" aria-pressed="${b.op === k}">${l}</button>`).join('')}</div></div>
        <div class="field"><label for="bld-a">${b.op === 'ratio' ? 'Part' : b.op === 'per' ? 'This' : 'Figure'}</label><select id="bld-a">${fieldOpts(b.a)}</select></div>
        ${b.op === 'ratio' || b.op === 'per' ? `<div class="field"><label for="bld-b">${b.op === 'ratio' ? 'Out of' : 'Per'}</label><select id="bld-b">${fieldOpts(b.b)}</select></div>` : b.op === 'value' ? `<div class="field"><label for="bld-rate">Rate, RM each</label><input id="bld-rate" type="number" value="${esc(b.rate)}"><span class="help">Agree the rate with the organisation. Shown as an estimate.</span></div>` : '<div></div>'}
        <div class="field"><label for="bld-target">Target, optional</label><input id="bld-target" value="${esc(b.target)}" placeholder="e.g. 40"></div>
        <div class="field"><span class="lab">Who sees it</span><div class="seg"><button type="button" data-baud="team" aria-pressed="${b.aud !== 'client'}">Staff only</button><button type="button" data-baud="client" aria-pressed="${b.aud === 'client'}">Staff and organisation</button></div></div>
      </div>
      <div class="callout ai" style="margin-top:16px;align-items:center;flex-wrap:wrap"><img src="${SPARK}" alt="" style="width:18px"><span style="flex:1;min-width:200px"><b>Preview, last 30 days:</b> <span class="mono">${fmtM(meta, v) || '– not enough data'}</span>${pv !== null && v !== null ? ` · previous 30 days <span class="mono">${fmtM(meta, pv)}</span>` : ''} · ${q(meta.quality)}<br><span class="small muted">${esc(customFormula(b))}</span></span>${sparkline(weeksOf(aWindow(84)).map((w) => evalCustom(proj, b, w)), 120, 36)}</div>
      <div class="wfoot" style="margin-top:14px"><button type="button" class="btn ghost" data-act="bld-close">Cancel</button><button type="button" class="btn primary" data-act="bld-save" data-proj="${proj.id}">Send for approval</button></div>
    </section>`;
  }
  function builderAfter() {
    const b = state.bld; if (!b || !$('#bld')) return;
    const bind = (id, k, num) => { const el = $('#' + id); if (!el) return; el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => { b[k] = num ? +el.value : el.value; if (el.tagName === 'SELECT') render(); }); if (k === 'rate') el.addEventListener('change', render); };
    bind('bld-name', 'name'); bind('bld-a', 'a'); bind('bld-b', 'b'); bind('bld-rate', 'rate', true); bind('bld-target', 'target');
  }

  // ------------------------------------------------------------------ CLIENT CONTEXT
  // What organisations tell the account team: notes, documents, photos, voice notes and links. Kept per organisation,
  // REKA only, never shown to the organisation. AI reads it as quoted data, never as instructions, when suggesting measures.
  const CTX_KINDS = [['feedback', 'Feedback'], ['goal', 'Goal'], ['concern', 'Concern'], ['request', 'Request'], ['meeting', 'Meeting note'], ['material', 'Their material']];
  const CTX_SOURCES = ['Meeting', 'Call', 'Email', 'Quarterly review', 'Site visit', 'Survey', 'Chat message', 'Document they shared'];
  const CTX_LIMITS = { mb: 25, files: 10, voiceMin: 30 };
  const CTX_TYPE = { file: ['documents', 'Document'], photo: ['image', 'Photo'], voice: ['mic', 'Voice note'], link: ['link', 'Link'] };
  const CTX_EXAMPLE = [
    ['contoh-logistik', 'doc-workflow', 'concern', 'Quarterly review', '2026-10-02', 'Finance director', 'Late payments to suppliers cost us penalties every month, and two suppliers put us on cash terms. That matters more to us than typing time.', ['money', 'risk'], 'siti'],
    ['contoh-logistik', 'doc-workflow', 'feedback', 'Site visit', '2026-09-18', 'Accounts payable lead', 'The team no longer works late at month end. They now spend the time chasing missing delivery orders.', ['time', 'adoption'], 'siti'],
    ['contoh-logistik', 'invoice-triage', 'request', 'Email', '2026-10-08', 'Finance director', 'Can the report show which document types still come back for correction? Credit notes seem worst.', ['quality'], 'daniel'],
    ['acme-plastics', 'shift-planner', 'feedback', 'Call', '2026-09-29', 'Production manager', 'Supervisors used to spend Sunday evening on the plan. Now the plan is ready on Friday, but changeovers still cause downtime on Mondays.', ['time', 'quality'], 'siti'],
    ['sampel-medik', 'enquiry-triage', 'concern', 'Survey', '2026-10-05', 'Head of patient services', 'Patients still complain about waiting for a reply on weekends. Our satisfaction survey is the number the board looks at.', ['cx', 'time'], 'siti'],
    ['bina-jaya', 'quote-drafter', 'goal', 'Meeting', '2026-09-24', 'Sales director', 'We lose bids when a quote takes more than two days. We want to win more of the jobs we quote for, not just quote faster.', ['money', 'cx'], 'daniel'],
  ];
  // Example attachments, invented like the organisations: no file or recording sits behind them.
  const CTX_EX_ITEMS = {
    0: [{ type: 'file', name: 'Q3 review, Contoh Logistik.pdf', meta: '14 pages', extract: 'Page 6, supplier payments: two suppliers moved us to cash terms in August after repeated late payments. Late-payment penalties are charged every month. Page 9, priorities for Q4: pay suppliers on time, and hold fewer invoices for missing delivery orders.' }],
    1: [{ type: 'voice', name: 'Site visit voice note', meta: '1:42', extract: 'Walked the accounts payable floor with the team lead. Month end used to mean late nights; this month nobody stayed late. Most of their time now goes on chasing delivery orders that are missing from the invoice pack.' }],
    3: [{ type: 'photo', name: 'Whiteboard after the call.jpg', meta: 'Photo', url: 'assets/ctx-whiteboard.svg', extract: 'Monday changeovers. Line 2 waits for moulds. Plan ready Friday, not Sunday. Overtime on Monday? Ask: can we see changeovers per week?' }],
    4: [{ type: 'file', name: 'Patient survey, September.xlsx', meta: '1 sheet', extract: 'Question 3, how quickly did we reply: most negative comments mention weekends. The board pack uses the overall satisfaction score.' }, { type: 'link', name: 'Board pack summary, on their shared drive', url: 'https://files.example/sampel-medik/board-pack', meta: 'files.example' }],
    5: [{ type: 'link', name: 'Email thread on bid timings', url: 'https://mail.example/thread/bina-jaya-bids', meta: 'mail.example' }],
  };
  function ctxAll() {
    state.ctx = state.ctx || {};
    const k = demo() ? 'example' : state.ws;
    if (!state.ctx[k]) state.ctx[k] = k === 'example' ? CTX_EXAMPLE.map(([org, proj, kind, source, date, from, text, tags, by], i) => ({ id: 'cx' + i, org, proj, kind, source, date, from, text, tags, ai: true, by: M.staff[by].name, at: day(date) + ', 17:30', uses: 0, example: true, items: (CTX_EX_ITEMS[i] || []).map((x, j) => Object.assign({ id: `cx${i}i${j}`, status: 'ready', extract: null }, x)) })) : [];
    return state.ctx[k];
  }
  const ctxFor = (orgId, projId) => ctxAll().filter((e) => e.org === orgId && !e.archived && (!projId || !e.proj || e.proj === projId));
  const orgOfProj = (proj) => companies().find((c) => coSolutions(c).some((x) => x.id === proj.id)) || null;
  // Everything AI may read from an entry: the summary and what was read from its attachments.
  const ctxBody = (e) => [e.text].concat((e.items || []).filter((x) => x.extract).map((x) => x.extract)).join(' ');
  // The words that ranked a suggestion: the summary, or the sentence of an attachment that matched.
  function ctxQuote(e, re) {
    if (re.test(e.text.toLowerCase())) return { q: e.text, src: '' };
    for (const x of e.items || []) if (x.extract && re.test(x.extract.toLowerCase())) return { q: x.extract.split(/(?<=[.!?])\s+/).find((s) => re.test(s.toLowerCase())) || x.extract, src: x.name };
    return null;
  }
  // Before saving: no names, emails, phone numbers or identity card numbers. Record the role instead.
  const ctxPersonal = (t) => /[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(t) || /\b\d{6}-\d{2}-\d{4}\b/.test(t) || /(\+?6?0)[\s-]?1\d[\s-]?\d{3,4}[\s-]?\d{4}\b/.test(t) || /\d{10,}/.test(t);
  // In what is read from an attachment, the same details are hidden before anyone, or AI, reads it.
  function ctxRedact(t) {
    let n = 0; const r = (re, w) => { t = t.replace(re, () => { n++; return `[${w} hidden]`; }); };
    r(/[^\s@]+@[^\s@]+\.[a-z]{2,}/gi, 'email'); r(/\b\d{6}-\d{2}-\d{4}\b/g, 'identity card number'); r(/(\+?6?0)[\s-]?1\d[\s-]?\d{3,4}[\s-]?\d{4}\b/g, 'phone number'); r(/\d{10,}/g, 'number');
    return { text: t, n };
  }
  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const fsize = (b) => b >= 1048576 ? nf(b / 1048576, 1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
  function ctxAtt(x, draft) {
    const [ic, label] = CTX_TYPE[x.type] || CTX_TYPE.file, voice = x.type === 'voice', photo = x.type === 'photo';
    const st = x.status === 'reading' ? `<span class="pill info"><span class="dot"></span>${voice ? 'Transcribing' : 'Reading'}…</span>` : x.extract ? `<span class="pill ok">${icon('check', 'sm')}${voice ? 'Transcribed' : photo ? 'Text read' : 'Read'}</span>` : x.type === 'link' ? '' : '<span class="pill idle">Not read in the mock</span>';
    const hid = x.hidden ? `<span class="xs muted">${x.hidden} personal detail${x.hidden === 1 ? '' : 's'} hidden</span>` : '';
    const media = photo && x.url ? `<img class="ctx-photo" src="${x.url}" alt="${esc(x.name)}">` : voice && x.url ? `<audio controls preload="metadata" src="${x.url}"></audio>` : x.type === 'link' ? `<a class="small" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.url)}</a>` : '';
    const ex = x.extract ? `<div class="ctx-extract"><span class="xs muted">${voice ? 'Transcript' : photo ? 'Text in the photo' : 'What it says'}</span><p>${esc(x.extract)}</p></div>` : x.type !== 'link' && x.status !== 'reading' ? `<p class="xs muted">In the product, AI ${voice ? 'transcribes it' : photo ? 'reads any text in it' : 'reads it'} and you check the text before saving. This mock reads plain text files only.</p>` : '';
    const head = `<span class="ctx-att-ic">${photo && x.url ? `<img src="${x.url}" alt="">` : icon(ic, 'sm')}</span><span class="nm">${esc(x.name)}</span><span class="xs muted">${esc([label, x.meta].filter(Boolean).join(' · '))}</span>${st}${hid}`;
    if (draft) return `<li class="ctx-att draft"><div class="ctx-att-h">${head}<button type="button" class="btn sm ghost" data-act="ctx-att-rm" data-id="${x.id}" aria-label="Remove ${esc(x.name)}">${icon('x', 'sm')}</button></div>${voice && x.url ? media : ''}${x.status === 'reading' ? '' : ex}</li>`;
    return `<details class="ctx-att"><summary>${head}<span class="ctx-more">${icon('chev-down', 'sm')}</span></summary><div>${media}${ex}</div></details>`;
  }
  function ctxEntry(e, opts = {}) {
    const c = coById(e.org), sol = e.proj && coSolutions(c || { projects: [] }).find((x) => x.id === e.proj);
    const kind = (CTX_KINDS.find((k) => k[0] === e.kind) || [, 'Note'])[1], items = e.items || [];
    return `<article class="ctx-entry${e.ai ? '' : ' off'}"><div class="ctx-top"><span class="pill ${e.kind === 'concern' ? 'warn' : e.kind === 'goal' ? 'info' : 'idle'}">${kind}</span>${opts.org ? `<a class="small" href="#results-${e.org}">${esc(c ? c.short : e.org)}</a>` : ''}${sol ? `<span class="xs muted">${esc(sol.name)}</span>` : '<span class="xs muted">Whole organisation</span>'}<span class="ctx-ai ${e.ai ? 'on' : ''}"><img src="${SPARK}" alt="">${e.ai ? 'AI uses this' : 'Not for AI'}</span></div>
      <blockquote>${esc(e.text)}</blockquote>
      ${items.length ? `<div class="ctx-atts">${items.map((x) => ctxAtt(x)).join('')}</div>` : ''}
      <div class="ctx-meta"><span><b class="ink">${esc(e.from)}</b> · ${esc(e.source)} · <span class="mono">${dayShort(e.date)}</span></span><span>Added by ${esc(e.by)}</span>${e.tags.length ? `<span>${e.tags.map((t) => esc((XP_FOCUS.find((f) => f[0] === t) || [, t])[1])).join(', ')}</span>` : ''}${e.uses ? `<span>Used in ${e.uses} suggestion run${e.uses === 1 ? '' : 's'}</span>` : ''}${e.example ? '<span class="pill warn" style="padding:1px 8px">Example</span>' : ''}</div>
      <div class="head-actions">${coSolutions(c || { projects: [] }).some((x) => x.proj) && e.ai ? `<button type="button" class="btn sm" data-act="ctx-explore" data-id="${e.id}"><img src="${SPARK}" alt="" style="width:16px">Suggest measures from this</button>` : ''}${atLeast('Support') ? `<button type="button" class="btn sm ghost" data-act="ctx-ai" data-id="${e.id}">${e.ai ? 'Stop AI using this' : 'Let AI use this'}</button><button type="button" class="btn sm ghost" data-act="ctx-archive" data-id="${e.id}">Archive</button>` : ''}</div></article>`;
  }
  function ctxForm(orgId) {
    const orgs = companies(), sel = orgId || state.ctxOrg || (orgs[0] && orgs[0].id), c = coById(sel), d = state.ctxDraft || { tags: [], items: [] }, items = d.items || [];
    if (!atLeast('Support')) return '<p class="needs">Needs Support to add client context</p>';
    return `<form id="f-ctx" class="card ctx-form" novalidate><div class="card-head"><div><h2>Add what they told you or gave you</h2><p class="sub">A note, a document, a photo, a voice note or a link. Record the person’s role, never their name, email or phone.</p></div></div>
      <div class="form-grid">
        ${orgId ? `<input type="hidden" id="ctx-org" value="${orgId}">` : `<div class="field"><label for="ctx-org">Organisation</label><select id="ctx-org">${orgs.map((o) => `<option value="${o.id}" ${o.id === sel ? 'selected' : ''}>${esc(o.short)}</option>`).join('')}</select></div>`}
        <div class="field"><label for="ctx-proj">About</label><select id="ctx-proj"><option value="">The whole organisation</option>${c ? coSolutions(c).map((x) => `<option value="${x.id}" ${d.proj === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('') : ''}</select></div>
        <div class="field full"><span class="lab">Attach what they gave you, optional</span>
          <div class="ctx-drop" id="ctx-drop">
            <div class="ctx-tools">
              <button type="button" class="btn sm" data-act="ctx-pick" data-for="ctx-files">${icon('upload', 'sm')}Upload files</button>
              <button type="button" class="btn sm" data-act="ctx-pick" data-for="ctx-photo">${icon('camera', 'sm')}Take a photo</button>
              <button type="button" class="btn sm${state.ctxRec ? ' rec' : ''}" data-act="ctx-rec" aria-pressed="${!!state.ctxRec}">${state.ctxRec ? `${icon('stop', 'sm')}Stop recording <span class="mono" id="ctx-rec-t">${mmss(state.ctxRec.secs)}</span>` : `${icon('mic', 'sm')}Record a voice note`}</button>
              <button type="button" class="btn sm" data-act="ctx-link" aria-expanded="${!!state.ctxLinkOpen}">${icon('link', 'sm')}Add a link</button>
              <input type="file" id="ctx-files" multiple hidden accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md,.eml,image/*,audio/*">
              <input type="file" id="ctx-photo" hidden accept="image/*" capture="environment">
            </div>
            <p class="xs muted">Or drop files here. Documents, slides, spreadsheets, emails, photos and audio, up to ${CTX_LIMITS.mb} MB each and ${CTX_LIMITS.files} to an entry; voice notes up to ${CTX_LIMITS.voiceMin} minutes. Photos of documents, whiteboards and screens, not of people.</p>
            ${state.ctxLinkOpen ? `<div class="ctx-linkrow"><input id="ctx-link-url" type="url" placeholder="https://" aria-label="Link"><input id="ctx-link-label" placeholder="What it is, for example: email thread on bid timings" aria-label="What the link is"><button type="button" class="btn sm" data-act="ctx-link-add">Add link</button></div>` : ''}
            ${items.length ? `<ul class="ctx-attlist">${items.map((x) => ctxAtt(x, true)).join('')}</ul>` : ''}
          </div></div>
        <div class="field full"><label for="ctx-text">What they said, in a sentence or two</label><textarea id="ctx-text" placeholder="For example: Late payments cost us penalties every month. That matters more than typing time.">${esc(d.text || '')}</textarea><span class="help" id="ctx-help">Plain words, as close to theirs as you can. Numbers they mention are kept as their words: they become figures only through a baseline and approval.</span>${items.some((x) => x.extract) ? `<div style="margin-top:6px"><button type="button" class="btn sm ghost" data-act="ctx-draft-sum"><img src="${SPARK}" alt="" style="width:16px">Draft it from the attachments</button></div>` : ''}</div>
        <div class="field"><label for="ctx-kind">Kind</label><select id="ctx-kind">${CTX_KINDS.map(([k, l]) => `<option value="${k}" ${d.kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label for="ctx-source">Where it came from</label><select id="ctx-source">${CTX_SOURCES.map((x) => `<option ${d.source === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
        <div class="field"><label for="ctx-from">Who said it, by role</label><input id="ctx-from" placeholder="For example: Finance director" value="${esc(d.from || '')}"></div>
        <div class="field"><label for="ctx-date">When</label><input id="ctx-date" type="date" value="${d.date || today()}"></div>
        <div class="field full"><span class="lab">What it is about, optional</span><div class="chips">${XP_FOCUS.map(([k, l]) => `<button type="button" class="chip" data-ctx-tag="${k}" aria-pressed="${d.tags.includes(k)}">${l}</button>`).join('')}</div></div>
        <label class="check full"><input type="checkbox" id="ctx-ai" ${d.ai === false ? '' : 'checked'}><span>AI may use this, and what was read from its attachments, when suggesting measures and answering questions about ${esc(c ? c.short : 'this organisation')}. It is never shown to the organisation.</span></label>
      </div><div class="head-actions" style="margin-top:14px"><button type="submit" class="btn primary">Add to client context</button></div></form>`;
  }
  // The client context list, for one organisation or all (Outcomes only → Client context, and the Results page's tab).
  function ctxList(orgId) {
    const f = state.ctxF || { kind: 'all', q: '' }, has = (e) => (ctxBody(e) + ' ' + e.from + ' ' + (e.items || []).map((x) => x.name).join(' ')).toLowerCase().includes(f.q.toLowerCase());
    const list = ctxAll().filter((e) => !e.archived && (!orgId || e.org === orgId) && (f.kind === 'all' || e.kind === f.kind) && (!f.q || has(e))).sort((a, b) => b.date.localeCompare(a.date));
    return `<section class="card" style="padding:14px 18px"><div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center"><div class="seg" role="group" aria-label="Kind">${[['all', 'All']].concat(CTX_KINDS).map(([k, l]) => `<button type="button" data-ctxkind="${k}" aria-pressed="${f.kind === k}">${l}</button>`).join('')}</div><div class="field" style="flex:1;min-width:180px"><input id="ctx-q" placeholder="Search what they said, and their files" aria-label="Search client context" value="${esc(f.q)}" autocomplete="off"></div></div></section>
      ${list.length ? `<section class="grid" style="gap:12px">${list.map((e) => ctxEntry(e, { org: !orgId })).join('')}</section>` : `<section class="card"><div class="empty" style="padding:22px"><h3>${ctxAll().some((e) => !e.archived && (!orgId || e.org === orgId)) ? 'Nothing matches' : 'No client context yet'}</h3><p>After a meeting, a call or a quarterly review, add what they said and anything they gave you. AI uses it to suggest measures that answer their questions.</p></div></section>`}`;
  }
  pages.context = () => {
    const live = ctxAll().filter((e) => !e.archived), n = live.length, orgs = new Set(live.map((e) => e.org)).size, files = live.reduce((a, e) => a + (e.items || []).length, 0);
    return `${head({ title: 'Client context', kind: 'data', lead: 'What organisations tell the account team, in their words, and what they give you: documents, photos, voice notes and links. AI uses it to suggest measures that answer their questions. It never reaches the organisation.', state: `${stateWord()} · ${n} entr${n === 1 ? 'y' : 'ies'} from ${orgs} organisation${orgs === 1 ? '' : 's'} · ${files} attachment${files === 1 ? '' : 's'}` })}
      <div class="callout info">${icon('shield')}<span><b>REKA only.</b> Context and its attachments are never shown in the organisation view, reports or exports. AI reads them as quoted words, never as instructions, and never turns a number someone said into a figure.</span></div>
      ${ctxForm(state.scope && coById(state.scope) ? state.scope : null)}
      ${ctxList(state.scope && coById(state.scope) ? state.scope : null)}`;
  };
  pages.context.after = () => ctxAfter();
  function ctxAfter() {
    const qi = $('#ctx-q'); if (qi) qi.addEventListener('input', (e) => { state.ctxF = Object.assign(state.ctxF || { kind: 'all' }, { q: e.target.value }); clearTimeout(state.ctxT); state.ctxT = setTimeout(() => { ctxReadDraft(); render(); const el = $('#ctx-q'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 250); });
    ['ctx-text', 'ctx-from'].forEach((id) => { const el = $('#' + id); if (el) el.addEventListener('input', () => el.removeAttribute('aria-invalid')); });
    const so = $('#ctx-org'); if (so && so.tagName === 'SELECT') so.addEventListener('change', (e) => { ctxReadDraft(); state.ctxOrg = e.target.value; state.ctxDraft.proj = ''; render(); });
    ['ctx-files', 'ctx-photo'].forEach((id) => { const el = $('#' + id); if (el) el.addEventListener('change', () => { ctxReadDraft(); ctxAddFiles(el.files); ctxRerender(); }); });
    const dz = $('#ctx-drop'); if (dz) {
      ['dragenter', 'dragover'].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.add('over'); }));
      dz.addEventListener('dragleave', () => dz.classList.remove('over'));
      dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('over'); ctxReadDraft(); ctxAddFiles(e.dataTransfer.files); ctxRerender(); });
    }
  }
  function ctxReadDraft() {
    const d = state.ctxDraft = state.ctxDraft || { tags: [], items: [] }; d.items = d.items || [];
    if (!$('#f-ctx')) return d;
    const v = (id) => ($('#' + id) || {}).value;
    return Object.assign(d, { proj: v('ctx-proj'), kind: v('ctx-kind'), source: v('ctx-source'), from: v('ctx-from'), date: v('ctx-date'), text: v('ctx-text'), ai: ($('#ctx-ai') || {}).checked !== false });
  }
  function ctxRerender() { if ($('#f-ctx')) { ctxReadDraft(); render(); } }
  // Attachments. Plain text is read here; everything else is read by AI in the product (documents, text in photos,
  // voice transcribed), with personal details hidden, and a person checks the text before the entry is saved.
  const CTX_OK = /\.(pdf|docx?|pptx?|xlsx?|csv|txt|md|eml|jpe?g|png|heic|webp|gif|m4a|mp3|wav|ogg|webm|aac)$/i, CTX_TEXT = /\.(txt|md|csv|eml)$/i;
  function ctxAddFiles(files) {
    const d = ctxReadDraft(), refused = [];
    [...(files || [])].forEach((f) => {
      if (d.items.length >= CTX_LIMITS.files) { refused.push(`${f.name} (${CTX_LIMITS.files} to an entry at most)`); return; }
      if (f.size > CTX_LIMITS.mb * 1048576) { refused.push(`${f.name} (larger than ${CTX_LIMITS.mb} MB)`); return; }
      if (!CTX_OK.test(f.name) && !/^(image|audio)\//.test(f.type)) { refused.push(`${f.name} (not a document, photo or audio file)`); return; }
      const type = /^image\//.test(f.type) ? 'photo' : /^audio\//.test(f.type) ? 'voice' : 'file';
      const x = { id: 'ci' + state.seq++, type, name: f.name, meta: fsize(f.size), url: type === 'file' ? null : URL.createObjectURL(f), status: 'reading', extract: null };
      d.items.push(x);
      const done = (text) => { if (text && text.trim()) { const r = ctxRedact(text.replace(/\s+/g, ' ').trim().slice(0, 4000)); x.extract = r.text; x.hidden = r.n; } x.status = 'ready'; ctxRerender(); };
      if (CTX_TEXT.test(f.name) || /^text\//.test(f.type)) f.text().then(done, () => done(null)); else setTimeout(() => done(null), reduceMotion ? 0 : 900);
    });
    if (refused.length) toast(`Not added: ${refused.join('; ')}.`);
  }
  async function ctxRecord() {
    if (state.ctxRec) { state.ctxRec.stop(); return; }
    let stream;
    try { if (!navigator.mediaDevices || !window.MediaRecorder) throw new Error('none'); stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (err) { toast('The microphone isn’t available here. Record on your phone and upload the audio file instead.'); return; }
    const d = ctxReadDraft(); if (d.items.length >= CTX_LIMITS.files) { stream.getTracks().forEach((tr) => tr.stop()); toast(`${CTX_LIMITS.files} attachments to an entry at most.`); return; }
    const rec = new MediaRecorder(stream), chunks = [], t0 = Date.now();
    const st = state.ctxRec = { secs: 0, stop: () => { if (rec.state !== 'inactive') rec.stop(); } };
    st.timer = setInterval(() => { st.secs = Math.round((Date.now() - t0) / 1000); const el = $('#ctx-rec-t'); if (el) el.textContent = mmss(st.secs); if (st.secs >= CTX_LIMITS.voiceMin * 60) st.stop(); }, 1000);
    rec.ondataavailable = (ev) => chunks.push(ev.data);
    rec.onstop = () => { clearInterval(st.timer); stream.getTracks().forEach((tr) => tr.stop()); state.ctxRec = null; d.items.push({ id: 'ci' + state.seq++, type: 'voice', name: `Voice note, ${day(today())}`, meta: mmss(st.secs), url: URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })), status: 'ready', extract: null }); ctxRerender(); };
    rec.start(); ctxRerender();
  }
  // Context used by Explore: the organisation's entries AI may use, for this solution or the whole organisation.
  function ctxForProj(proj) { const c = orgOfProj(proj); return c ? ctxFor(c.id, proj.id).filter((e) => e.ai) : []; }

  // ------------------------------------------------------------------ EXPLORE IMPACT
  // Re-prompt and explore other measures of business impact, for any project collecting data, in every workspace.
  // Suggestions come from a fixed catalog (XP_CATALOG), chosen and ranked by the kind of work, the words in the brief,
  // the focus chips and the figures the solution already shares. Nothing is invented: previews come only from the
  // project's own daily figures, and a figure the solution doesn't share turns the idea into a request or a record.
  const XP_FOCUS = [['money', 'Money'], ['time', 'Time'], ['quality', 'Quality'], ['risk', 'Risk'], ['cx', 'Customer experience'], ['adoption', 'Adoption']];
  const XP_WORDS = {
    money: /money|cost|spend|revenue|cash|ringgit|\brm\b|price|penalt|fee|margin|profit|discount|saving|paid|pay/,
    time: /time|hour|fast|slow|quick|wait|late|delay|turnaround|backlog|overdue|deadline|same day|sooner/,
    quality: /quality|error|mistake|wrong|correct|accura|rework|\bfix|sent back|revis|better/,
    risk: /risk|complian|audit|penalt|breach|late|overdue|fraud|fail|miss|duplicate|unfilled/,
    cx: /customer|patient|supplier|guest|wait|satisf|complain|experience|respon|rating|answer/,
    adoption: /adopt|staff|team|people|using|usage|train|freed|higher.value|morale|per person|spend/,
  };
  const XP_TYPE = { a: 'Ready now', b: 'Needs a new figure', c: 'Needs a baseline or their number' };
  const XP_CAVEAT = { a: 'Shows what changed alongside the solution, not proof that it caused it.', b: 'Counts only from the day the solution starts sharing it. Earlier days stay empty, never zero.', c: 'Only as good as the organisation’s own records. Check how they were counted.' };
  const XP_STD_NEEDS = { tat: ['tat'], sla: ['sla'], quality: ['corrected'], straight: ['corrected'], hours: ['hours'], people: ['people'], perPerson: ['people'], fails: ['fails'] };
  // What a solution would add to its Measurement Link to share one of the standard figures (PRD §10.6).
  const XP_FIELD_FIG = {
    corrected: { key: '{nk}.corrected', type: 'counter', unit: 'item', desc: '{Nouns} a person sent back or corrected, counted on the day.', dims: ['reason'], label: '{Nouns} corrected' },
    straight: { key: '{nk}.corrected', type: 'counter', unit: 'item', desc: '{Nouns} a person sent back or corrected, counted on the day.', dims: ['reason'], label: '{Nouns} corrected' },
    machine: { key: '{nk}.processing_time', type: 'duration', unit: 'second', agg: 'mean', desc: 'Average machine seconds per {noun}, sent with the sum and count.', dims: [], label: 'Machine time' },
    tat: { key: '{nk}.turnaround', type: 'duration', unit: 'hour', agg: 'median', desc: 'Median hours from a {noun} arriving to it being done.', dims: [], label: 'Turnaround' },
    sla: { key: '{nk}.within_agreed_time', type: 'counter', unit: 'item', desc: '{Nouns} done inside the time agreed with the organisation.', dims: [], label: '{Nouns} within agreed time' },
    people: { key: 'operators.active', type: 'distinct', unit: 'person', desc: 'Distinct people who used it that day, each counted once by a pseudonymous id.', dims: [], label: 'People using it' },
    fails: { key: 'runs.failed', type: 'counter', unit: 'run', desc: 'Runs the solution reported as failed.', dims: ['reason'], label: 'Failed runs' },
  };
  const X = (id, k, t, name, why, tags, words, more) => Object.assign({ id, k, t, name, why, tags, words }, more || {});
  // a: ready now (cm over FIELDS), b: needs a new figure (fig in the Measurement Link contract's shape), c: needs a baseline or their number (rec).
  // std: the idea is a standard measure, so it is "Already measured" when the solution shares what it needs.
  const XP_CATALOG = [
    // ---- any kind of work
    X('g-hrs-person', ['*'], 'a', 'Hours freed per person', 'Shows how much time each person using it gets back, the time that can move to other work.', ['time', 'adoption'], /freed|higher.value|per person|capacity|team|staff/, { cm: { op: 'per', a: 'hours', b: 'people' }, better: 'up', caveat: 'Freed time is an estimate. It shows time made available, not what people did with it.' }),
    X('g-machine', ['*'], 'a', 'Machine minutes per {noun}', 'Shows whether the solution is getting quicker or slower at the part it does itself.', ['time', 'quality'], /machine|speed|slow|process/, { cm: { op: 'per', a: 'machine', b: 'handled' }, better: 'down', caveat: 'Machine time is never a person’s time, so it never counts as hours saved.' }),
    X('g-fails', ['*'], 'a', 'Share of runs that failed', 'Failed runs are work a person has to pick up, which eats into the time saved.', ['risk', 'quality'], /fail|break|outage|reliab/, { cm: { op: 'ratio', a: 'fails', b: 'handled' }, better: 'down', caveat: 'A failed run may be retried and succeed, so this can overstate lost work.' }),
    X('g-per-day', ['*'], 'a', '{Nouns} handled a day', 'A steady daily volume shows the team relies on it, and every other result depends on it.', ['adoption'], /volume|adopt|\buse\b|busy|how many/, { cm: { op: 'avg', a: 'handled' }, better: 'up', caveat: 'Volume shows use, not value on its own.' }),
    X('g-tat', ['*'], 'a', 'Turnaround time', '', ['time', 'cx'], /turnaround|how long|fast|slow|wait|quick|sooner/, { std: 'tat' }),
    X('g-sla', ['*'], 'a', 'Within agreed time', '', ['time', 'cx', 'risk'], /agreed time|deadline|on time|\bsla\b|late/, { std: 'sla' }),
    X('g-quality', ['*'], 'a', 'Needed a person to fix', '', ['quality', 'risk'], /error|mistake|correct|\bfix|quality|rework|accura/, { std: 'quality' }),
    X('g-hours', ['*'], 'a', 'Hours saved', '', ['time', 'money'], /hours|time saved|sav(e|ed|ing)|freed/, { std: 'hours' }),
    X('g-people', ['*'], 'a', 'People using it, a day', '', ['adoption'], /people|staff|using|adopt|team/, { std: 'people' }),
    X('g-exceptions', ['*'], 'b', 'Minutes a person spends on each exception', 'Shows where the remaining manual work is, so the team can see what to improve next.', ['time', 'adoption', 'quality'], /exception|manual|remaining|higher.value|freed|spend/, { fig: { key: '{nk}.exception_time', type: 'duration', unit: 'minute', agg: 'mean', desc: 'Average minutes a person spends on a {noun} the solution could not finish, for that day.', dims: ['reason'], label: 'Exception minutes', weighted: true, as: { op: 'avg' }, gen: (p, r) => +(6 + 5 * r).toFixed(1) }, better: 'down' }),
    X('g-complaints', ['*'], 'b', 'Complaints about the result', 'Shows whether faster work is costing goodwill, which hours saved can’t show.', ['cx', 'quality', 'risk'], /complain|unhappy|escalat|goodwill/, { fig: { key: 'complaints.received', type: 'counter', unit: 'item', desc: 'Complaints logged about work the solution handled, counted on the day received.', dims: ['channel'], label: 'Complaints', as: { op: 'ratio', b: 'handled', name: 'Complaints per 100 {nouns}' }, gen: (p, r) => Math.round(p.v * 0.006 * r) }, better: 'down' }),
    X('g-reopened', ['*'], 'b', '{Nouns} reopened after done', 'Work that comes back is hidden rework. It shows whether done really means done.', ['quality', 'risk'], /reopen|come back|rework|again|redo/, { fig: { key: '{nk}.reopened', type: 'counter', unit: 'item', desc: '{Nouns} reopened after being marked done, counted on the day reopened.', dims: ['reason'], label: '{Nouns} reopened', as: { op: 'ratio', b: 'handled', name: 'Share of {nouns} reopened' }, gen: (p, r) => Math.round(p.v * (0.01 + 0.02 * r)) }, better: 'down' }),
    X('g-before-tat', ['*'], 'c', 'Turnaround against before go-live', 'Puts today’s turnaround next to the organisation’s own figure from before.', ['time', 'cx'], /before|go.live|used to|baseline/, { rec: { label: 'Turnaround before go-live', unit: 'hours', base: true, use: { kind: 'vs', cm: { op: 'avg', a: 'tat' }, unit: 'h', dp: 1, better: 'down' } } }),
    X('g-redeploy', ['*'], 'c', 'Time moved to higher-value work', 'Answers what the team did with the time it got back, in the organisation’s own words.', ['adoption', 'time'], /higher.value|freed|spend|redeploy|instead/, { rec: { label: 'Hours a week spent on higher-value work', unit: 'hours a week' }, caveat: 'Usually from a survey or time sheets, so it is an estimate. Ask how it was collected.' }),
    // ---- documents
    X('d-hrs-each', ['documents'], 'a', 'Hours saved per {noun}', 'Shows whether each {noun} takes less people time as the team trusts the solution more.', ['time', 'money'], /per (document|invoice|item)|each/, { cm: { op: 'per', a: 'hours', b: 'handled' }, better: 'up' }),
    X('d-corr-person', ['documents'], 'a', 'Corrections per person a day', 'Shows how much checking each person still does, the work the solution should keep shrinking.', ['quality', 'adoption'], /check|correct|review|team|staff/, { cm: { op: 'per', a: 'corrected', b: 'people' }, better: 'down' }),
    X('d-corrected', ['documents'], 'a', '{Nouns} a person corrected', 'The count behind the correction rate, useful when volume swings.', ['quality', 'risk'], /correct|error|mistake|wrong/, { cm: { op: 'sum', a: 'corrected' }, better: 'down' }),
    X('d-straight', ['documents'], 'a', 'Straight-through rate', '', ['quality'], /straight|no (fix|touch)|automat/, { std: 'straight' }),
    X('d-paid-late', ['documents'], 'b', 'Invoices paid after their due date', 'Late payment is what suppliers feel. It shows whether faster processing reaches them.', ['money', 'risk', 'time', 'cx'], /late pay|paid late|due date|overdue|supplier|on time|\blate\b/, { fig: { key: 'invoices.paid_late', type: 'counter', unit: 'document', desc: 'Invoices paid after the due date on the invoice, counted on the day they are paid.', dims: ['supplier_size'], label: 'Invoices paid late', as: { op: 'ratio', b: 'handled', name: 'Share of invoices paid late' }, gen: (p, r) => Math.round(p.v * (0.03 + 0.04 * r)) }, better: 'down' }),
    X('d-cycle', ['documents'], 'b', 'Days from receipt to payment', 'The end-to-end time the business cares about, not only the part the solution does.', ['time', 'cx', 'money'], /cycle|receipt|end.to.end|days to pay|payment/, { fig: { key: 'invoices.receipt_to_payment', type: 'duration', unit: 'day', agg: 'median', desc: 'Median days from an invoice arriving to it being paid, for invoices paid that day.', dims: [], label: 'Days from receipt to payment', weighted: true, as: { op: 'avg' }, gen: (p, r) => +(5 + 4 * r).toFixed(1) }, better: 'down' }),
    X('d-dupes', ['documents'], 'b', 'Duplicate invoices caught', 'Each duplicate caught is money not paid twice, a saving the organisation can check.', ['money', 'risk'], /duplicate|double|overpa|fraud/, { fig: { key: 'invoices.duplicates_caught', type: 'counter', unit: 'document', desc: 'Invoices flagged as duplicates and stopped before payment.', dims: [], label: 'Duplicates caught', as: { op: 'sum' }, gen: (p, r) => Math.round(p.v * 0.008 * r) }, better: 'up' }),
    X('d-discount', ['documents'], 'b', 'Early-payment discounts taken', 'Paying on time can earn discounts, cash the organisation can see in its accounts.', ['money'], /discount|early pay|cash/, { fig: { key: 'invoices.discount_taken', type: 'money', unit: 'MYR', desc: 'Early-payment discounts taken on invoices paid that day, in ringgit.', dims: [], label: 'Discounts taken, RM', as: { op: 'sum' }, gen: (p, r) => Math.round(p.v * (1.2 + 1.6 * r)) }, better: 'up' }),
    X('d-penalty', ['documents'], 'c', 'Cost of late-payment penalties', 'Turns late payments into ringgit, using the penalty the organisation actually pays.', ['money', 'risk'], /penalt|late pay|interest|fine/, { rec: { label: 'Penalty per late invoice', unit: 'RM', use: { kind: 'mul', fig: 'd-paid-late', unit: 'RM', dp: 0, label: 'Penalties this period' } } }),
    X('d-corr-cost', ['documents'], 'c', 'Cost of corrections', 'Puts a ringgit figure on the checking still done, using the organisation’s own cost of one correction.', ['money', 'quality'], /cost|rework|correct/, { rec: { label: 'Cost of one correction', unit: 'RM', use: { kind: 'mul', cm: { op: 'sum', a: 'corrected' }, unit: 'RM', dp: 0, label: 'Corrections cost this period' } } }),
    X('d-err-before', ['documents'], 'c', 'Corrections against before go-live', 'Shows whether the work is more accurate than when people typed it, not only faster.', ['quality'], /before|used to|go.live|accura/, { rec: { label: 'Share corrected before go-live', unit: '%', base: true, use: { kind: 'vs', cm: { op: 'ratio', a: 'corrected', b: 'handled' }, unit: '%', dp: 1, better: 'down' } } }),
    // ---- triage
    X('t-auto', ['triage'], 'a', '{Nouns} answered without a person', 'The routine work the solution takes off the desk, as a count the team recognises.', ['adoption', 'cx', 'time'], /without a person|automat|routine|answered|desk/, { cm: { op: 'sum', a: 'straight' }, better: 'up' }),
    X('t-handoff-person', ['triage'], 'a', 'Hand-offs per person a day', 'Shows how much each person still picks up, and whether that is shrinking.', ['adoption', 'quality'], /hand.?off|team|staff|per person|workload/, { cm: { op: 'per', a: 'corrected', b: 'people' }, better: 'down' }),
    X('t-hrs-each', ['triage'], 'a', 'Hours saved per {noun}', 'Shows whether each {noun} costs less people time as the solution improves.', ['time', 'money'], /per (enquiry|ticket|item)|each/, { cm: { op: 'per', a: 'hours', b: 'handled' }, better: 'up' }),
    X('t-per-person', ['triage'], 'a', 'Handled per person, a day', '', ['adoption'], /per person|productiv/, { std: 'perPerson' }),
    X('t-first', ['triage'], 'b', 'Time to first response', 'What the customer feels first. It shows whether they get an answer sooner.', ['cx', 'time'], /first (response|reply|answer)|wait|respon|reply|quick|fast|sooner/, { fig: { key: '{nk}.first_response', type: 'duration', unit: 'hour', agg: 'median', desc: 'Median hours from a {noun} arriving to its first useful answer, for {nouns} answered that day.', dims: ['channel'], label: 'Hours to first response', weighted: true, as: { op: 'avg' }, gen: (p, r) => +(0.4 + 1.2 * r).toFixed(2) }, better: 'down' }),
    X('t-misrouted', ['triage'], 'b', '{Nouns} sent to the wrong desk', 'A wrong route costs a second hand-off and a slower answer.', ['quality', 'risk', 'cx'], /wrong desk|rout|transfer|misdirect/, { fig: { key: '{nk}.misrouted', type: 'counter', unit: 'item', desc: '{Nouns} a person moved to a different desk after the solution routed them.', dims: ['desk'], label: '{Nouns} misrouted', as: { op: 'ratio', b: 'handled', name: 'Share of {nouns} misrouted' }, gen: (p, r) => Math.round(p.v * (0.02 + 0.03 * r)) }, better: 'down' }),
    X('t-abandoned', ['triage'], 'b', '{Nouns} abandoned before an answer', 'People who give up are lost goodwill or business. It shows whether faster answers keep them.', ['cx', 'risk', 'money'], /abandon|give up|gave up|\blost\b|drop/, { fig: { key: '{nk}.abandoned', type: 'counter', unit: 'item', desc: '{Nouns} closed by the sender, or timed out, before any answer.', dims: ['channel'], label: '{Nouns} abandoned', as: { op: 'ratio', b: 'handled', name: 'Share of {nouns} abandoned' }, gen: (p, r) => Math.round(p.v * (0.01 + 0.03 * r)) }, better: 'down' }),
    X('t-rating', ['triage'], 'b', 'Rating after an answer', 'The customer’s own view of the answer, next to how fast it came.', ['cx', 'quality'], /satisf|rating|happy|experience|csat|feedback/, { fig: { key: '{nk}.rating', type: 'gauge', unit: 'x.score', agg: 'mean', desc: 'Average rating out of 5 given after an answer, for ratings given that day.', dims: ['channel'], label: 'Average rating', weighted: true, as: { op: 'avg' }, gen: (p, r) => +(3.9 + 0.8 * r).toFixed(2) }, better: 'up' }),
    X('t-wait-before', ['triage'], 'c', 'Customer wait time before go-live', 'Compares today’s turnaround with how long people waited before, from the organisation’s records.', ['cx', 'time'], /wait|before|go.live|used to/, { rec: { label: 'Average wait before go-live', unit: 'hours', base: true, use: { kind: 'vs', cm: { op: 'avg', a: 'tat' }, unit: 'h', dp: 1, better: 'down' } } }),
    X('t-handoff-cost', ['triage'], 'c', 'Cost of hand-offs', 'Turns the hand-offs that remain into ringgit, using the organisation’s own cost of one.', ['money'], /cost|money|spend/, { rec: { label: 'Cost of one hand-off', unit: 'RM', use: { kind: 'mul', cm: { op: 'sum', a: 'corrected' }, unit: 'RM', dp: 0, label: 'Hand-offs cost this period' } } }),
    X('t-complaints-before', ['triage'], 'c', 'Complaints a month before go-live', 'A before figure to set any change in complaints against, once they are counted.', ['cx', 'risk'], /complain|before/, { rec: { label: 'Complaints a month before go-live', unit: 'complaints', base: true } }),
    // ---- planning
    X('p-hrs-plan', ['planning'], 'a', 'Supervisor hours saved per plan', 'Shows whether each plan takes less of a supervisor’s time as the solution learns.', ['time', 'money'], /per plan|supervisor|each/, { cm: { op: 'per', a: 'hours', b: 'handled' }, better: 'up' }),
    X('p-changes-person', ['planning'], 'a', 'Heavy changes per supervisor a day', 'Shows how much supervisors still rework, the effort the solution should take away.', ['quality', 'adoption'], /change|rework|supervisor|edit/, { cm: { op: 'per', a: 'corrected', b: 'people' }, better: 'down' }),
    X('p-used', ['planning'], 'a', 'Plans used without heavy changes', 'Counts the plans supervisors trusted enough to use as made.', ['quality', 'adoption'], /trust|used|as made|accept/, { cm: { op: 'sum', a: 'straight' }, better: 'up' }),
    X('p-straight', ['planning'], 'a', 'Straight-through rate', '', ['quality'], /straight|as made/, { std: 'straight' }),
    X('p-overtime', ['planning'], 'b', 'Overtime hours in each plan', 'Overtime is a direct cost. Better plans should need less of it.', ['money', 'time', 'risk'], /overtime|labou?r cost|wage|cost/, { fig: { key: 'plans.overtime_hours', type: 'duration', unit: 'hour', agg: 'mean', desc: 'Average overtime hours scheduled in each plan made that day.', dims: ['site'], label: 'Overtime hours per plan', weighted: true, as: { op: 'avg' }, gen: (p, r) => +(6 + 6 * r).toFixed(1) }, better: 'down' }),
    X('p-unfilled', ['planning'], 'b', 'Shifts left unfilled', 'An unfilled shift is a risk to output or service, whatever the plan saved.', ['risk', 'cx'], /unfilled|cover|short.?staff|understaff|gap/, { fig: { key: 'shifts.unfilled', type: 'counter', unit: 'x.shift', desc: 'Shifts in published plans with nobody assigned, counted on the day of the shift.', dims: ['site'], label: 'Unfilled shifts', as: { op: 'sum' }, gen: (p, r) => Math.round(p.v * 1.5 * r) }, better: 'down' }),
    X('p-late-change', ['planning'], 'b', 'Changes after a plan is published', 'Late changes upset staff. Fewer of them means the first plan was right.', ['quality', 'adoption', 'risk'], /late change|after publish|last.minute|morale/, { fig: { key: 'plans.changed_after_publish', type: 'counter', unit: 'x.plan', desc: 'Plans changed after they were sent to staff, counted on the day changed.', dims: ['reason'], label: 'Plans changed after publishing', as: { op: 'ratio', b: 'handled', name: 'Share of plans changed after publishing' }, gen: (p, r) => Math.round(p.v * 0.4 * r) }, better: 'down' }),
    X('p-fair', ['planning'], 'b', 'Weekend shifts per person', 'A fair spread of weekend work keeps people. It shows the plans are fair, not only fast.', ['adoption', 'risk'], /fair|weekend|morale|retention|turnover/, { fig: { key: 'shifts.weekend_per_person', type: 'gauge', unit: 'x.shift', agg: 'mean', desc: 'Average weekend shifts per person in the plans made that day.', dims: ['site'], label: 'Weekend shifts per person', weighted: true, as: { op: 'avg' }, gen: (p, r) => +(1.2 + 0.8 * r).toFixed(2) }, better: 'down' }),
    X('p-before-hours', ['planning'], 'c', 'Time to build a plan, against before', 'Compares today’s turnaround with the hours a plan took before, from the organisation’s records.', ['time'], /before|used to|go.live|how long/, { rec: { label: 'Hours to build a plan before go-live', unit: 'hours', base: true, use: { kind: 'vs', cm: { op: 'avg', a: 'tat' }, unit: 'h', dp: 1, better: 'down' } } }),
    X('p-ot-cost', ['planning'], 'c', 'Overtime cost per hour', 'Needed to turn any change in overtime into ringgit.', ['money'], /overtime|cost/, { rec: { label: 'Overtime cost per hour', unit: 'RM' } }),
    X('p-unfilled-before', ['planning'], 'c', 'Unfilled shifts a month before go-live', 'A before figure for unfilled shifts, so any change has something to be set against.', ['risk'], /unfilled|before/, { rec: { label: 'Unfilled shifts a month before go-live', unit: 'shifts', base: true } }),
    // ---- quotations and proposals
    X('q-hrs', ['quotes'], 'a', 'Estimator hours saved per {noun}', 'Shows whether each {noun} takes less of an estimator’s time as the solution improves.', ['time', 'money'], /per (quote|quotation|proposal)|estimator|each/, { cm: { op: 'per', a: 'hours', b: 'handled' }, better: 'up' }),
    X('q-clean', ['quotes'], 'a', '{Nouns} sent with no revision', 'Counts first drafts good enough to send as they were.', ['quality', 'cx'], /revision|first draft|as drafted|accura/, { cm: { op: 'sum', a: 'straight' }, better: 'up' }),
    X('q-rev-person', ['quotes'], 'a', 'Revisions per estimator a day', 'Shows how much estimators still rework, and whether it is shrinking.', ['quality', 'adoption'], /revis|rework|estimator|team/, { cm: { op: 'per', a: 'corrected', b: 'people' }, better: 'down' }),
    X('q-per-person', ['quotes'], 'a', 'Handled per person, a day', '', ['adoption'], /per person|productiv/, { std: 'perPerson' }),
    X('q-won', ['quotes'], 'b', 'Quotations won', 'Winning work is the result the business wants, beyond quoting faster.', ['money', 'cx'], /\bwin|\bwon\b|revenue|sales|convert|order/, { fig: { key: 'quotations.won', type: 'counter', unit: 'item', desc: 'Quotations the customer accepted, counted on the day accepted.', dims: ['customer_type'], label: 'Quotations won', as: { op: 'ratio', b: 'handled', name: 'Win rate' }, gen: (p, r) => Math.round(p.v * (0.2 + 0.15 * r)) }, better: 'up' }),
    X('q-value', ['quotes'], 'b', 'Value of quotations sent', 'Shows the size of the work being quoted, not only the count.', ['money'], /value|revenue|pipeline|sales/, { fig: { key: 'quotations.value_sent', type: 'money', unit: 'MYR', desc: 'Total value of quotations sent that day, in ringgit.', dims: ['customer_type'], label: 'Value quoted, RM', as: { op: 'sum' }, gen: (p, r) => Math.round(p.v * (9000 + 6000 * r)) }, better: 'up' }),
    X('q-first', ['quotes'], 'b', 'Hours from drawing to first quotation', 'The wait the customer sees. Same-day quotations win more work.', ['time', 'cx'], /same day|drawing|response|fast|sooner/, { fig: { key: 'quotations.first_draft_time', type: 'duration', unit: 'hour', agg: 'median', desc: 'Median hours from a customer’s drawing arriving to the first quotation being sent.', dims: [], label: 'Hours to first quotation', weighted: true, as: { op: 'avg' }, gen: (p, r) => +(3 + 5 * r).toFixed(1) }, better: 'down' }),
    X('q-expired', ['quotes'], 'b', 'Quotations expired without an answer', 'Expired quotations are effort with no result. Fewer means better follow-up.', ['money', 'risk'], /expire|no answer|follow.up|lost/, { fig: { key: 'quotations.expired', type: 'counter', unit: 'item', desc: 'Quotations that passed their validity date with no answer.', dims: [], label: 'Quotations expired', as: { op: 'ratio', b: 'handled', name: 'Share of quotations expired' }, gen: (p, r) => Math.round(p.v * 0.15 * r) }, better: 'down' }),
    X('q-order', ['quotes'], 'c', 'Value of work won', 'Turns quotations won into ringgit, using the organisation’s average order value.', ['money'], /revenue|order value|won|sales/, { rec: { label: 'Average order value', unit: 'RM', use: { kind: 'mul', fig: 'q-won', unit: 'RM', dp: 0, label: 'Value of work won this period' } } }),
    X('q-win-before', ['quotes'], 'c', 'Win rate against before go-live', 'Shows whether faster quotations win more work than before.', ['money', 'cx'], /before|win rate|go.live/, { rec: { label: 'Win rate before go-live', unit: '%', base: true, use: { kind: 'vs', cm: { op: 'ratio', a: 'fig:q-won', b: 'handled' }, unit: '%', dp: 1, better: 'up' } } }),
    // ---- other work
    X('o-hrs-each', ['other'], 'a', 'Hours saved per {noun}', 'Shows whether each {noun} takes less people time as the solution improves.', ['time', 'money'], /per item|each/, { cm: { op: 'per', a: 'hours', b: 'handled' }, better: 'up' }),
    X('o-fix-person', ['other'], 'a', 'Fixes per person a day', 'Shows how much each person still corrects, and whether that is shrinking.', ['quality', 'adoption'], /fix|correct|team|staff/, { cm: { op: 'per', a: 'corrected', b: 'people' }, better: 'down' }),
    X('o-clean', ['other'], 'a', '{Nouns} done with no fix', 'Counts the work the solution finished with nobody touching it.', ['quality', 'adoption'], /no fix|automat|untouched/, { cm: { op: 'sum', a: 'straight' }, better: 'up' }),
    X('o-per-person', ['other'], 'a', 'Handled per person, a day', '', ['adoption'], /per person|productiv/, { std: 'perPerson' }),
    X('o-backlog', ['other'], 'b', 'Work waiting at the end of the day', 'A shrinking backlog shows the team is keeping up, not just working faster.', ['time', 'risk', 'cx'], /backlog|queue|waiting|pile/, { fig: { key: '{nk}.backlog', type: 'gauge', unit: 'item', agg: 'last', desc: '{Nouns} waiting to be handled at the end of the day.', dims: [], label: '{Nouns} waiting', weighted: true, as: { op: 'avg' }, gen: (p, r) => Math.round(p.v * (0.2 + 0.3 * r)) }, better: 'down' }),
    X('o-escalated', ['other'], 'b', '{Nouns} escalated to a manager', 'Escalations are the hard cases. Fewer of them means the routine is handled well.', ['quality', 'risk'], /escalat|manager|hard case/, { fig: { key: '{nk}.escalated', type: 'counter', unit: 'item', desc: '{Nouns} passed to a manager, counted on the day escalated.', dims: ['reason'], label: '{Nouns} escalated', as: { op: 'ratio', b: 'handled', name: 'Share of {nouns} escalated' }, gen: (p, r) => Math.round(p.v * 0.02 * r) }, better: 'down' }),
    X('o-mistake-cost', ['other'], 'c', 'Cost of fixes', 'Puts a ringgit figure on the fixing still done, using the organisation’s own cost of one fix.', ['money', 'quality'], /cost|mistake|rework/, { rec: { label: 'Cost of one fix', unit: 'RM', use: { kind: 'mul', cm: { op: 'sum', a: 'corrected' }, unit: 'RM', dp: 0, label: 'Fixes cost this period' } } }),
    X('o-before-vol', ['other'], 'c', 'Work handled a month before go-live', 'A before figure for volume, so any growth has something to be set against.', ['adoption'], /before|volume|go.live/, { rec: { label: 'Work handled a month before go-live', unit: 'items', base: true } }),
  ];
  const XP_EX = { 'doc-workflow': ['documents', 'document', 'documents'], 'invoice-triage': ['triage', 'invoice', 'invoices'], 'shift-planner': ['planning', 'plan', 'plans'], 'enquiry-triage': ['triage', 'enquiry', 'enquiries'], 'quote-drafter': ['quotes', 'quotation', 'quotations'] };
  const XP_EXAMPLES = { documents: 'Has it reduced late payments to suppliers?', triage: 'Are customers waiting less for an answer?', planning: 'Has overtime gone down since the plans got faster?', quotes: 'Are we winning more of the work we quote for?', other: 'Is the work more accurate than before?' };
  const xpKindLabel = (k) => KINDS[k] ? KINDS[k].label : 'Other work';
  let XP_CUR = null;
  function xpInfo(proj) {
    const s = !demo() && simById(proj.id);
    if (s) { const K = kindOf(s) || {}; return { kind: KINDS[s.kind] ? s.kind : 'other', noun: K.noun || 'item', nouns: K.nouns || 'items', objective: s.project.objective || '', url: '<url>', sim: s }; }
    const e = XP_EX[proj.id] || ['other', 'item', 'items'], sol = M.solutions[proj.id], o = sol && orgById(sol.org), pr = o && o.projects.find((x) => x.solutions.includes(proj.id));
    return { kind: e[0], noun: e[1], nouns: e[2], objective: pr ? pr.objective : '', url: (sol && sol.base) || '<url>', sim: null };
  }
  const xpFill = (s, info) => String(s || '').replace(/\{nk\}/g, info.nouns.toLowerCase().replace(/[^a-z0-9]+/g, '_')).replace(/\{Nouns\}/g, cap(info.nouns)).replace(/\{nouns\}/g, info.nouns).replace(/\{noun\}/g, info.noun);
  function xpStore(proj, info) {
    const s = !demo() && simById(proj.id);
    const fresh = () => ({ brief: { outcome: info.objective, kind: info.kind, q: '', focus: [] }, runs: [], cur: null, picks: [], reqs: {}, recs: {}, thinking: false, recOpen: null, recDraft: null, open: null });
    if (s) return (s.xp = s.xp || fresh());
    state.xpDemo = state.xpDemo || {};
    return (state.xpDemo[proj.id] = state.xpDemo[proj.id] || fresh());
  }
  function xpShares(proj) {
    const pts = aWindow(84).map((d) => proj.point(d)).filter((p) => !p.before && !p.gap), out = {};
    Object.keys(FIELDS).forEach((k) => { out[k] = pts.some((p) => { const v = FIELDS[k].get(p); return v !== undefined && v !== null && !isNaN(v); }); });
    return out;
  }
  const xpCatById = (id) => XP_CATALOG.find((x) => x.id === id);
  const xpFieldKey = (proj, id) => 'xf:' + proj.id + ':' + id;
  // A figure the developer shipped: a hidden field (left out of the builder's lists) that reads from the day after it shipped.
  function xpEnsureField(proj, it, req, info) {
    const k = xpFieldKey(proj, it.id);
    if (!Object.prototype.hasOwnProperty.call(FIELDS, k)) Object.defineProperty(FIELDS, k, { enumerable: false, configurable: true, value: { label: xpFill(it.fig.label, info), weighted: !!it.fig.weighted, get: (p) => (req.shipped && p.d > req.shipped && p.v !== undefined && p.v !== null) ? it.fig.gen(p, hash(proj.id + p.d + it.id)) : undefined } });
    return k;
  }
  function xpFigReady(proj, xs, id) {
    const req = xs.reqs[id], k = xpFieldKey(proj, id);
    if (!req || !req.shipped || !FIELDS[k]) return null;
    return evalCustom(proj, { op: 'sum', a: k }, aWindow(84)) === null ? null : k;
  }
  const xpSameCm = (x, cm) => x.op === cm.op && x.a === cm.a && (x.b || null) === (cm.b || null) && x.status !== 'declined';
  function xpFig(spec, info) {
    return { key: xpFill(spec.key, info), type: spec.type, unit: spec.unit, agg: spec.agg || null, desc: xpFill(spec.desc, info), dims: spec.dims || [], label: xpFill(spec.label, info), weighted: !!spec.weighted, gen: spec.gen || null };
  }
  function xpConvert(proj, info, idea, miss) {
    if (miss === 'hours') return Object.assign(idea, { t: 'c', conv: 'hours', needs: `Needs hours saved, and hours saved needs a baseline: how long a ${info.noun} took by hand.`, rec: { label: `Minutes by hand per ${info.noun}`, unit: 'minutes', base: true, use: { kind: 'mul', cm: { op: 'sum', a: 'handled' }, factor: 1 / 60, unit: 'h', dp: 0, label: 'Time the same work took by hand' } }, q: 'estimated', effort: 'A timed sample of 20 to 30 with the organisation', caveat: 'A baseline is an estimate. Its range carries into every figure built on it.' });
    return Object.assign(idea, { t: 'b', conv: miss, fig: xpFig(XP_FIELD_FIG[miss], info), as: null, needs: `Needs ${FIELDS[miss].label.toLowerCase()}, which ${proj.sol} doesn’t share yet.`, effort: 'A small change by the developer, then approval', caveat: XP_CAVEAT.b });
  }
  function xpResolve(proj, info, it, sh, xs) {
    const base = { id: it.id, it, name: xpFill(it.name, info), why: xpFill(it.why, info), better: it.better || 'up', caveat: it.caveat || XP_CAVEAT[it.t], effort: it.effort || null };
    if (it.std) {
      const m = mByKey(it.std); if (!m || (m.reka && !has('Commercial'))) return null;
      const miss = (XP_STD_NEEDS[it.std] || []).filter((k) => !sh[k]);
      if (!miss.length) return Object.assign(base, { t: 'a', already: true, name: m.name });
      return xpConvert(proj, info, Object.assign(base, { name: m.name, why: `The standard measure every project gets. ${proj.sol} can’t show it yet.`, how: m.how, q: m.quality, better: m.better }), miss[0]);
    }
    if (it.t === 'a') {
      const cm = Object.assign({}, it.cm), how = customFormula(cm), miss = [cm.a, cm.b].filter((k) => k && !sh[k]);
      if (miss.length) return xpConvert(proj, info, Object.assign(base, { how, q: customMeta(cm).quality }), miss[0]);
      return Object.assign(base, { t: 'a', cm, how, q: customMeta(cm).quality, effort: base.effort || 'None. Ready now.', dup: proj.custom().find((x) => xpSameCm(x, cm)) || null });
    }
    if (it.t === 'b') {
      const fig = xpFig(it.fig, info), as = it.fig.as || { op: 'sum' };
      const how = as.op === 'ratio' ? `${fig.label} ÷ ${FIELDS[as.b].label.toLowerCase()} × 100` : as.op === 'avg' ? `Average a day of ${fig.label.toLowerCase()}` : `Total of ${fig.label.toLowerCase()}`;
      const fk = xpFigReady(proj, xs, it.id), mcm = fk ? { op: as.op, a: fk, b: as.b || null } : null;
      return Object.assign(base, { t: 'b', fig, as, how, mname: xpFill(as.name, info) || base.name, q: as.op === 'ratio' ? 'derived' : 'measured', effort: base.effort || 'A small change by the developer, then approval', mcm, dup: mcm ? proj.custom().find((x) => xpSameCm(x, mcm)) || null : null });
    }
    const rec = Object.assign({}, it.rec, { label: xpFill(it.rec.label, info) });
    const u = rec.use, how = !u ? `Recorded as ${rec.label.toLowerCase()}, with its source and evidence.` : u.kind === 'vs' ? `Now against ${rec.label.toLowerCase()}, from the organisation’s records.` : `${rec.label} × ${u.fig ? xpFill(xpCatById(u.fig).fig.label, info).toLowerCase() : FIELDS[u.cm.a].label.toLowerCase()}`;
    return Object.assign(base, { t: 'c', rec, how, q: 'estimated', effort: base.effort || 'A short conversation with the organisation' });
  }
  // ct and ctags: the organisation's client context, as one lower-case text and its tags. Quoted words only: they
  // move ideas up the list, never add an idea that isn't in the catalog, and never become a figure.
  function xpScore(it, kind, qt, ot, focus, ct = '', ctags = []) {
    let s;
    if (it.k.includes(kind)) s = 3; else if (it.k.includes('*')) s = 1; else if (qt && it.words.test(qt)) s = -2; else if (ct && it.words.test(ct)) s = -3; else return -1;
    if (qt && it.words.test(qt)) s += 6;
    if (ot && it.words.test(ot)) s += 2;
    if (ct && it.words.test(ct)) s += 3;
    it.tags.forEach((tg) => { if (qt && XP_WORDS[tg].test(qt)) s += 2; if (ot && XP_WORDS[tg].test(ot)) s += 0.5; if (focus.includes(tg)) s += 3; if (ct && XP_WORDS[tg].test(ct)) s += 1; if (ctags.includes(tg)) s += 1.5; });
    return s + (it.t === 'a' ? 0.25 : 0);
  }
  // Chooses and ranks ideas for one brief. Deterministic: same brief and same figures, same answer.
  function xpSuggest(proj, info, brief, xs) {
    const sh = xpShares(proj), qt = (brief.q || '').toLowerCase(), ot = (brief.outcome || '').toLowerCase();
    const cx = brief.useCtx === false ? [] : ctxForProj(proj), ct = cx.map(ctxBody).join(' ').toLowerCase(), ctags = [...new Set(cx.flatMap((e) => e.tags))];
    const ranked = XP_CATALOG.map((it, i) => ({ it, i, s: xpScore(it, brief.kind, qt, ot, brief.focus || [], ct, ctags) })).filter((x) => x.s >= 0).sort((x, y) => y.s - x.s || x.i - y.i);
    const ids = [], already = [], per = { a: 0, b: 0, c: 0 }, LIM = { a: 3, b: 2, c: 2 }, keys = new Set();
    ranked.forEach(({ it, s }) => {
      const idea = xpResolve(proj, info, it, sh, xs);
      if (!idea) return;
      if (idea.already || idea.dup) { if (s >= 3 && already.length < 4 && !already.includes(idea.name)) already.push(idea.name); return; }
      if (per[idea.t] >= LIM[idea.t]) return;
      const key = idea.t === 'b' ? idea.fig.key : idea.t === 'c' ? idea.rec.label : idea.id;
      if (keys.has(key)) return;
      keys.add(key); per[idea.t]++; ids.push(idea.id);
    });
    return { ids, already, ctx: cx.map((e) => e.id) };
  }
  function xpRun(proj, xs) {
    const info = xpInfo(proj), res = xpSuggest(proj, info, xs.brief, xs);
    const run = { id: 'r' + state.seq++, at: now(), who: me().name, brief: JSON.parse(JSON.stringify(xs.brief)), ids: res.ids, already: res.already, count: res.ids.length, ctx: res.ctx };
    ctxAll().forEach((e) => { if (res.ctx.includes(e.id)) e.uses = (e.uses || 0) + 1; });
    xs.runs.unshift(run); xs.cur = run.id; xs.thinking = false;
    log(`Asked AI for measure ideas for ${proj.sol}: “${xs.brief.q || 'from the outcome only'}”, ${run.count} suggestion${run.count === 1 ? '' : 's'}${res.ctx.length ? `, using ${res.ctx.length} note${res.ctx.length === 1 ? '' : 's'} of client context` : ''}`);
    return run;
  }
  const xpUnit = (u, v, dp) => u === 'RM' ? 'RM' + nf(v, dp) : u === '%' ? nf(v, dp) + '%' : u === 'h' ? nf(v, dp) + ' h' : nf(v, dp);
  function xpChg(v, pv, better, ok) {
    if (!ok) return 'Too few days before to compare';
    if (v === null || pv === null || pv === undefined || !isFinite(pv) || pv === 0) return 'No earlier figures to compare';
    const c = 100 * (v - pv) / Math.abs(pv), good = better === 'up' ? c >= 0 : c <= 0;
    return `<span class="delta" style="color:var(--${Math.abs(c) < 1 ? 'muted' : good ? 'ok-ink' : 'fault-ink'})">${c >= 0 ? '▲' : '▼'} ${nf(Math.abs(c), 0)}%</span> vs before`;
  }
  function xpPreview(proj, cm, better) {
    const days = aWindow(state.range), prev = windowDays(state.range, M.addDays(days[0], -1));
    const meta = customMeta(cm), v = evalCustom(proj, cm, days), pv = evalCustom(proj, cm, prev);
    return `<div class="xp-prev"><div class="stat"><span class="small muted">Preview, ${esc(RANGES[state.range].toLowerCase())}</span><span class="value" style="font-size:1.375rem">${fmtM(meta, v) || dash('no figures in this period')}</span><span class="hint">${xpChg(v, pv, better, comparable(totals(proj, days), totals(proj, prev)))}</span></div>${sparkline(weeksOf(aWindow(84)).map((w) => evalCustom(proj, cm, w)), 110, 32)}</div>`;
  }
  function xpUse(proj, idea, val, xs, info) {
    const u = idea.rec.use; if (!u) return null;
    const ref = (k) => { if (!k || !String(k).startsWith('fig:')) return k; return xpFigReady(proj, xs, k.slice(4)); };
    let cm = u.fig ? { op: 'sum', a: 'fig:' + u.fig } : Object.assign({}, u.cm);
    const figId = [u.fig, String(cm.a).startsWith('fig:') ? cm.a.slice(4) : null].find(Boolean);
    cm = Object.assign(cm, { a: ref(cm.a), b: ref(cm.b) || null });
    if (!cm.a) return `Shows once ${xpFill(xpCatById(figId).fig.label, info).toLowerCase()} arrives from the solution.`;
    if (!FIELDS[cm.a] || (cm.b && !FIELDS[cm.b])) return null;
    const days = aWindow(state.range), now2 = evalCustom(proj, cm, days);
    if (now2 === null) return `${proj.sol} doesn’t share ${FIELDS[cm.a].label.toLowerCase()} for this period, so there is nothing to work out yet.`;
    if (u.kind === 'mul') return `<b>${esc(u.label)}:</b> <span class="mono">${xpUnit(u.unit, now2 * val * (u.factor || 1), u.dp)}</span> ${q('estimated')} <span class="muted">· ${esc(RANGES[state.range].toLowerCase())}</span>`;
    const c = val ? 100 * (now2 - val) / Math.abs(val) : null, good = c === null ? null : (u.better === 'up' ? c >= 0 : c <= 0);
    return `<b>Now <span class="mono">${xpUnit(u.unit, now2, u.dp)}</span> against <span class="mono">${xpUnit(u.unit, val, u.dp)}</span> before.</b>${c === null ? '' : ` <span class="delta" style="color:var(--${good ? 'ok-ink' : 'fault-ink'})">${c >= 0 ? '▲' : '▼'} ${nf(Math.abs(c), 0)}%</span>`}`;
  }
  const xpReqOf = (xs, idea) => xs.reqs[idea.id] || Object.values(xs.reqs).find((r) => idea.fig && r.key === idea.fig.key) || null;
  const xpRecOf = (xs, idea) => xs.recs[idea.id] || Object.values(xs.recs).find((r) => idea.rec && r.label === idea.rec.label) || null;
  const xpAp = (proj, id) => id ? proj.approvals().find((a) => a.id === id) : null;
  const XP_AP_PILL = { waiting: '<span class="pill warn"><span class="dot"></span>Waiting for approval</span>', approved: '<span class="pill ok"><span class="dot"></span>Approved</span>', changes: '<span class="pill info">Changes asked</span>', declined: '<span class="pill idle">Declined</span>', blocked: '<span class="pill fault">Blocked</span>' };
  const xpMockApprove = (proj, a) => a && a.status === 'waiting' && a.proposer === state.role && state.role !== 'aisyah' ? `<button type="button" class="btn sm ghost" data-xp-act="mock-approve" data-xp-proj="${proj.id}" data-xp-ap="${a.id}">Mock: Aisyah approves</button>` : '';
  function xpCmStatus(proj, cm) {
    const a = proj.approvals().find((x) => x.cmId === cm.id);
    const pill = cm.status === 'live' ? '<span class="pill ok"><span class="dot"></span>Measured</span>' : cm.status === 'waiting' ? '<span class="pill warn"><span class="dot"></span>Added · waiting for approval</span>' : cm.status === 'changes' ? '<span class="pill info">Changes asked</span>' : '<span class="pill idle">Declined</span>';
    return `<div class="xp-acts">${pill}${cm.status === 'waiting' && cm.by === state.role && cm.by !== 'aisyah' && a ? `<button type="button" class="btn sm ghost" data-act="cm-approve" data-proj="${proj.id}" data-cm="${cm.id}">Mock: Aisyah approves</button>` : ''}</div>`;
  }
  const xpPickChip = (proj, xs, key) => `<button type="button" class="chip" data-xp-pick="${esc(key)}" data-xp-proj="${proj.id}" aria-pressed="${xs.picks.includes(key)}">${xs.picks.includes(key) ? icon('check', 'sm') : ''}Compare</button>`;
  function xpDevBrief(proj, info, idea) {
    const f = idea.fig, metric = `{ "key": "${f.key}", "type": "${f.type}", "unit": "${f.unit}",${f.agg ? ` "aggregation": "${f.agg}",` : ''} "description": "${f.desc}", "dimensions": [${f.dims.map((x) => `"${x}"`).join(', ')}] }`;
    return `Add one figure to the Measurement Link of ${proj.sol} (${proj.org}). Nothing else changes.

- Add this metric to the catalog that manifest and metrics return:
  ${metric}
- Report it in observations as a total for each finished day, in the organisation’s time zone. A day without it is left out, never sent as zero.
- Bump metric_catalog_version, for example to "${M.addDays(endDay(), 1)}".
- No names, document text or personal data. Dimension values are short codes.
- Before you finish, re-run the contract test:
  AX_MEASURE_KEY=… node contract-test/cli.mjs --base ${info.url}`;
  }
  function xpCard(proj, info, xs, idea) {
    const parts = [`<div class="top"><h3>${esc(idea.t === 'b' && idea.mcm ? idea.mname : idea.name)}</h3>${q(idea.q)}</div>`];
    if (idea.why) parts.push(`<p class="small ink">${esc(idea.why)}</p>`);
    if (idea.needs) parts.push(`<p class="xp-needs">${esc(idea.needs)}</p>`);
    const run = xs.runs.find((r) => r.id === xs.cur);
    let cite = null; if (run && run.ctx && run.ctx.length) ctxForProj(proj).some((e) => { const m = run.ctx.includes(e.id) && ctxQuote(e, idea.it.words); if (m) cite = Object.assign({ e }, m); return !!m; });
    if (cite) parts.push(`<blockquote class="xp-ctx"><span class="xs muted">From client context</span>“${esc(cite.q.length > 140 ? cite.q.slice(0, 137).replace(/\s+\S*$/, '') + '…' : cite.q)}”<span class="xs muted">${esc(cite.e.from)}, ${dayShort(cite.e.date)}${cite.src ? ' · ' + esc(cite.src) : ''}</span></blockquote>`);
    let acts = '';
    if (idea.t === 'a') {
      parts.push(xpPreview(proj, idea.cm, idea.better));
      acts = idea.dup ? xpCmStatus(proj, idea.dup) : `<div class="xp-acts"><button type="button" class="btn sm" data-xp-act="add" data-xp-proj="${proj.id}" data-xp-id="${idea.id}">${icon('plus', 'sm')}Add as a measure</button><button type="button" class="btn sm" data-xp-act="builder" data-xp-proj="${proj.id}" data-xp-id="${idea.id}">Open in builder</button>${xpPickChip(proj, xs, 'i:' + idea.id)}</div>`;
    } else if (idea.t === 'b') {
      const f = idea.fig, req = xpReqOf(xs, idea), a = req && xpAp(proj, req.apId);
      parts.push(`<div class="xp-def">${kv([['Key', `<span class="mono">${esc(f.key)}</span>`], ['Type', esc(f.type + (f.agg ? ' · ' + f.agg : ''))], ['Unit', `<span class="mono">${esc(f.unit)}</span>`], ['Means', esc(f.desc)], ['Split by', esc(f.dims.length ? f.dims.join(', ') : 'Nothing. A daily total only.')]], 76)}</div>`);
      if (idea.mcm) parts.push(xpPreview(proj, idea.mcm, idea.better));
      if (!req) acts = `<div class="xp-acts"><button type="button" class="btn sm" data-xp-act="request" data-xp-proj="${proj.id}" data-xp-id="${idea.id}">${icon('connect-ai', 'sm')}Ask the developer for it</button></div>`;
      else {
        const st = req.shipped ? (idea.mcm ? '<span class="pill ok"><span class="dot"></span>Arriving</span>' : `<span class="pill ok"><span class="dot"></span>Shipped</span><span class="small muted">First figures from ${dayShort(M.addDays(req.shipped, 1))}</span>`) : '<span class="pill info"><span class="dot"></span>Requested</span>';
        acts = `<div class="xp-acts">${st}${a ? `<span class="small muted">Request:</span>${XP_AP_PILL[a.status] || ''}${xpMockApprove(proj, a)}` : ''}</div>`;
        acts += `<details class="xp-brief" ${xs.open === idea.id ? 'open' : ''}><summary>Developer brief</summary><div><div class="code-block" id="xp-dev-${idea.id}">${esc(xpDevBrief(proj, info, idea))}</div><div class="xp-acts"><button type="button" class="btn sm" data-xp-act="copy" data-xp-proj="${proj.id}" data-xp-id="${idea.id}">${icon('copy', 'sm')}Copy brief</button></div></div></details>`;
        if (!req.shipped) acts += sandbox() && f.gen ? `<div class="demo-bar"><span class="tag">MOCK CONTROLS</span><button type="button" class="btn sm" data-xp-act="ship" data-xp-proj="${proj.id}" data-xp-id="${idea.id}">The developer shipped it</button></div>` : `<p class="xs muted">It arrives after the developer ships it and the next nightly collection runs.</p>`;
        else if (!idea.mcm) acts += `<div class="demo-bar"><span class="tag">MOCK CONTROLS</span><span>Nothing has arrived yet.</span><button type="button" class="btn sm" data-adv="7">Move the date on a week</button></div>`;
        else acts += idea.dup ? xpCmStatus(proj, idea.dup) : `<div class="xp-acts"><button type="button" class="btn sm" data-xp-act="add" data-xp-proj="${proj.id}" data-xp-id="${idea.id}">${icon('plus', 'sm')}Add as a measure</button>${xpPickChip(proj, xs, 'i:' + idea.id)}</div>`;
      }
    } else {
      const rec = xpRecOf(xs, idea), a = rec && xpAp(proj, rec.apId);
      parts.push(`<p class="small"><span class="muted">Needs:</span> <b class="ink">${esc(idea.rec.label)}</b>${idea.rec.base ? ' <span class="pill idle">Baseline</span>' : ''}</p>`);
      if (rec) {
        parts.push(`<div class="xp-prev"><span class="small">Recorded <span class="mono ink">${esc(nf(rec.value, rec.value % 1 ? 2 : 0))} ${esc(rec.unit)}</span> · ${esc(rec.source)}</span></div>`);
        const use = a && a.status === 'approved' ? xpUse(proj, idea, rec.value, xs, info) : null;
        if (use) parts.push(`<p class="small">${use}</p>`);
        acts = `<div class="xp-acts">${a ? XP_AP_PILL[a.status] || '' : ''}${xpMockApprove(proj, a)}</div>`;
      } else if (xs.recOpen === idea.id) {
        const dr = xs.recDraft;
        acts = `<div class="xp-rec" id="xp-rec"><div class="grid g2" style="gap:10px"><div class="field"><label for="xp-rv">Value</label><input id="xp-rv" type="number" step="any" inputmode="decimal" value="${esc(dr.v)}"></div><div class="field"><label for="xp-ru">Unit</label><input id="xp-ru" value="${esc(dr.u)}"></div></div>
          <div class="field"><label for="xp-rs">Source</label><select id="xp-rs">${['The organisation’s records', 'A timed sample', 'The organisation’s estimate', 'A staff survey'].map((x) => `<option ${x === dr.s ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
          <div class="field"><label for="xp-re">Evidence</label><input id="xp-re" value="${esc(dr.e)}" placeholder="e.g. Finance report, Jan to Jun 2026"><span class="help">Kept with the approval. A second person checks it.</span></div>
          <div class="xp-acts"><button type="button" class="btn sm primary" data-xp-act="rec-save" data-xp-proj="${proj.id}" data-xp-id="${idea.id}">Send for approval</button><button type="button" class="btn sm ghost" data-xp-act="rec-cancel" data-xp-proj="${proj.id}">Cancel</button></div></div>`;
      } else acts = `<div class="xp-acts"><button type="button" class="btn sm" data-xp-act="rec-open" data-xp-proj="${proj.id}" data-xp-id="${idea.id}">Record it</button></div>`;
    }
    parts.push(kv([['Worked out', esc(idea.how)], ['Effort', esc(idea.effort)]], 76));
    parts.push(acts);
    parts.push(`<p class="src">${icon('alerts', 'sm')} ${esc(idea.caveat)}</p>`);
    return `<article class="card kpi xp-idea" id="xp-i-${idea.id}" data-type="${idea.t}">${parts.join('')}</article>`;
  }
  function xpResults(proj, info, xs, run) {
    const sh = xpShares(proj), ideas = run.ids.map((id) => xpCatById(id)).filter(Boolean).map((it) => xpResolve(proj, info, it, sh, xs)).filter(Boolean);
    const groups = [['a', 'Ready now', `Worked out from figures ${proj.sol} already shares. The preview uses its own history.`], ['b', 'Needs a new figure from the solution', 'The developer adds it to the Measurement Link. It counts from the day it arrives.'], ['c', 'Needs a baseline or the organisation’s own number', 'Someone records it with its source, and a second person approves it.']];
    const fx = (run.brief.focus || []).map((k) => XP_FOCUS.find((x) => x[0] === k)[1]).join(', ');
    return `<section class="grid" id="xp-results" style="gap:16px">
      <div class="card-head" style="margin:0"><div><h2>Suggestions</h2><p class="sub">Run ${esc(run.at.replace(' 2026,', ''))} by ${esc(run.who)} · “${esc(run.brief.q || 'from the outcome only')}”${fx ? ' · focus: ' + esc(fx) : ''}${run.ctx && run.ctx.length ? ` · ${run.ctx.length} note${run.ctx.length === 1 ? '' : 's'} of client context` : ''}</p></div>${aiMark('Suggested by AI from your figures. You decide.')}</div>
      ${ideas.length ? groups.map(([t, h, sub]) => { const xs2 = ideas.filter((x) => x.t === t); return xs2.length ? `<div class="xp-group"><h3>${h} <span class="pill idle">${xs2.length}</span></h3><p class="small muted">${esc(sub)}</p><div class="grid ${xs2.length >= 3 ? 'g3' : 'g2'}">${xs2.map((x) => xpCard(proj, info, xs, x)).join('')}</div></div>` : ''; }).join('') : '<div class="card"><p class="small muted">Nothing in the catalog matched this brief. Try other words, or a focus.</p></div>'}
      ${run.already.length ? `<div class="card flat xp-already"><span class="small muted">Already measured, so not suggested again:</span><div class="chips" style="margin-top:8px">${run.already.map((n) => `<span class="pill ok">${icon('check', 'sm')}${esc(n)}</span>`).join('')}</div></div>` : ''}
    </section>`;
  }
  // Compare: ideas ready now (or a shipped figure with data) and measures that already exist, as an index.
  function xpCompareItems(proj, info, xs) {
    const sh = xpShares(proj), out = [];
    xs.picks.forEach((key) => {
      const [k, id] = [key.slice(0, 1), key.slice(2)];
      if (k === 'i') { const it = xpCatById(id), idea = it && xpResolve(proj, info, it, sh, xs), cm = idea && (idea.t === 'a' ? idea.cm : idea.mcm); if (cm) out.push({ key, name: idea.t === 'b' ? idea.mname : idea.name, val: (w) => evalCustom(proj, cm, w) }); }
      if (k === 'm') { const m = mByKey(id); if (m) out.push({ key, name: m.name, val: (w) => m.calc(totals(proj, w)) }); }
      if (k === 'c') { const cm = proj.custom().find((x) => x.id === id); if (cm) out.push({ key, name: cm.name, val: (w) => evalCustom(proj, cm, w) }); }
    });
    return out;
  }
  function xpCompare(proj, info, xs) {
    const wk = weeksOf(aWindow(84)), T84 = totals(proj, aWindow(84));
    const std = MEASURES.filter((m) => (!m.reka || has('Commercial')) && m.calc(T84) !== null), cms = proj.custom().filter((x) => x.status !== 'declined');
    const items = xpCompareItems(proj, info, xs), ideaPicks = items.filter((x) => x.key.startsWith('i:'));
    const chip = (key, name) => `<button type="button" class="chip" data-xp-pick="${esc(key)}" data-xp-proj="${proj.id}" aria-pressed="${xs.picks.includes(key)}">${esc(name)}</button>`;
    return `<section class="card" id="xp-compare"><div class="card-head"><div><h2>Compare</h2><p class="sub">Pick two or three: suggestions ready now, or measures you already have. Last 12 weeks, by week.</p></div>${xs.picks.length ? `<button type="button" class="btn sm ghost" data-xp-act="pick-clear" data-xp-proj="${proj.id}">Clear</button>` : ''}</div>
      ${ideaPicks.length ? `<div class="chips" style="margin-bottom:8px">${ideaPicks.map((x) => chip(x.key, x.name)).join('')}</div>` : ''}
      <div class="chips">${std.map((m) => chip('m:' + m.key, m.name)).concat(cms.map((c) => chip('c:' + c.id, c.name))).join('')}</div>
      ${items.length >= 2 ? `<div class="chart" id="xp-cmp" style="margin-top:14px"></div><div class="legend">${items.map((x, i) => `<span><i style="background:var(--s${i + 1})"></i>${esc(x.name)}</span>`).join('')}</div><p class="xs muted" style="margin-top:8px">Shown as an index: each line’s first week with figures is 100, so measures in different units can share one chart. It shows direction, not size, and what moved together, not why.</p>` : `<p class="small muted" style="margin-top:12px">Tick Compare on two or three suggestions ready now, or pick measures above. ${wk.length} weeks of figures.</p>`}
    </section>`;
  }
  function xpRuns(proj, xs) {
    return `<section class="card" id="xp-runs"><div class="card-head"><div><h2>Runs</h2><p class="sub">Every brief is kept, with who ran it and when. Re-open one to see its suggestions, or run it again.</p></div><span class="pill idle">${xs.runs.length}</span></div>
      ${xs.runs.length ? `<div class="list">${xs.runs.map((r) => `<div class="row"><span class="ico ai"><img src="${SPARK}" alt="" style="width:16px"></span><div><div class="what">“${esc(r.brief.q || 'From the outcome only')}”</div><div class="meta"><span>${esc(r.at.replace(' 2026,', ''))}</span><span>${esc(r.who)}</span><span>${r.count} suggestion${r.count === 1 ? '' : 's'}</span><span>${esc(xpKindLabel(r.brief.kind))}</span>${r.id === xs.cur ? '<span class="pill info">Showing</span>' : ''}</div></div><span class="head-actions"><button type="button" class="btn sm" data-xp-act="reopen" data-xp-proj="${proj.id}" data-xp-run="${r.id}">Re-open</button><button type="button" class="btn sm ghost" data-xp-act="rerun" data-xp-proj="${proj.id}" data-xp-run="${r.id}">Run again</button></span></div>`).join('')}</div>` : '<p class="small muted">No runs yet. Each time you press Suggest measures, the brief and its answer are kept here and in the audit trail.</p>'}
    </section>`;
  }
  function exploreTab(proj) {
    if (!proj) return '';
    XP_CUR = proj;
    const info = xpInfo(proj), xs = xpStore(proj, info), b = xs.brief, sh = xpShares(proj);
    const run = xs.runs.find((r) => r.id === xs.cur);
    const kinds = Object.keys(KINDS).concat(KINDS.other ? [] : ['other']);
    const exs = [XP_EXAMPLES[b.kind] || XP_EXAMPLES.other, 'Is the team spending the freed time on higher-value work?'];
    const shared = Object.keys(FIELDS).filter((k) => sh[k]).map((k) => FIELDS[k].label.toLowerCase());
    return `<section class="grid xp" id="xp" style="gap:18px">
      <div class="callout info xp-rules">${icon('shield')}<div><b>How this works</b><ul><li>AI suggests, people decide.</li><li>Nothing reaches the organisation or the report until a second person approves it.</li><li>A new figure from the solution also changes the solution’s catalog, so it goes through the developer and approval.</li></ul></div></div>
      <section class="card ai-card" id="xp-brief">
        <div class="card-head"><div><span class="eyebrow"><img src="${SPARK}" alt="">Explore impact</span><h2 style="margin-top:4px">What else could we measure for ${esc(proj.sol)}?</h2><p class="sub">The suggestions are based on this brief. Change it and run it again as often as you like.</p></div></div>
        <div class="form-grid">
          <div class="field full"><label for="xp-outcome">Outcome, in the organisation’s words</label><textarea id="xp-outcome" rows="2" style="min-height:64px">${esc(b.outcome)}</textarea><span class="help">From the project. Changing it here doesn’t change the project.</span></div>
          <div class="field"><label for="xp-kind">Kind of work</label><select id="xp-kind">${kinds.map((k) => `<option value="${k}" ${k === b.kind ? 'selected' : ''}>${esc(xpKindLabel(k))}</option>`).join('')}</select></div>
          <div class="field"><span class="lab">Focus, optional</span><div class="chips">${XP_FOCUS.map(([k, l]) => `<button type="button" class="chip" data-xp-focus="${k}" data-xp-proj="${proj.id}" aria-pressed="${b.focus.includes(k)}">${l}</button>`).join('')}</div></div>
          <div class="field full"><label for="xp-q">What do you want to find out?</label><textarea id="xp-q" rows="2" style="min-height:64px" placeholder="For example: ${esc(exs[0])}">${esc(b.q)}</textarea><div class="chips">${exs.map((x) => `<button type="button" class="chip" data-xp-ex="${esc(x)}" data-xp-proj="${proj.id}">${esc(x)}</button>`).join('')}</div></div>
          ${xpCtxPanel(proj, b)}
        </div>
        <div class="xp-run"><button type="button" class="btn primary" data-xp-act="run" data-xp-proj="${proj.id}" ${xs.thinking ? 'disabled' : ''}><img src="${SPARK}" alt="" style="width:16px">Suggest measures</button>${aiMark('AI suggests from this brief and the figures. You decide.')}</div>
        <p class="xs muted" style="margin-top:12px">${esc(proj.sol)} shares: ${esc(shared.join(', ') || 'nothing yet')}. Suggestions use only these, or say what is missing.</p>
      </section>
      ${xs.thinking ? `<section class="card" id="xp-results"><div class="thinking"><img src="${SPARK}" alt="">Reading the brief and the figures ${esc(proj.sol)} shares…</div></section>` : run ? xpResults(proj, info, xs, run) : `<section class="card"><div class="empty" style="padding:20px"><h3>No suggestions yet</h3><p>Say what you want to find out, or press Suggest measures to start from the outcome.</p></div></section>`}
      ${xpCompare(proj, info, xs)}
      ${xpRuns(proj, xs)}
    </section>`;
  }
  // What the account team heard from the organisation, offered to the brief. Off for one run with the switch.
  function xpCtxPanel(proj, b) {
    const c = orgOfProj(proj), cx = ctxForProj(proj), on = b.useCtx !== false;
    if (!c) return '';
    const link = `<a href="#results-${c.id}" data-act="to-ctx" data-org="${c.id}">${cx.length ? 'See all' : 'Add client context'}</a>`;
    if (!cx.length) return `<div class="field full xp-ctxbox"><span class="lab">Client context</span><p class="small muted">Nothing recorded from ${esc(c.short)} yet. What they tell the account team helps AI suggest measures that answer their questions. ${link}</p></div>`;
    return `<div class="field full xp-ctxbox"><div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between"><label class="check" style="margin:0"><input type="checkbox" id="xp-ctx" ${on ? 'checked' : ''}><span>Use ${cx.length} note${cx.length === 1 ? '' : 's'} of client context from ${esc(c.short)}</span></label><span class="small">${link}</span></div>
      ${on ? `<ul class="xp-ctxlist">${cx.slice(0, 3).map((e) => `<li><span class="ink">“${esc(e.text.length > 110 ? e.text.slice(0, 107).replace(/\s+\S*$/, '') + '…' : e.text)}”</span> <span class="xs muted">${esc(e.from)}, ${dayShort(e.date)}</span></li>`).join('')}${cx.length > 3 ? `<li class="xs muted">and ${cx.length - 3} more</li>` : ''}</ul><span class="help">Read as their words, never as instructions. They move suggestions up the list; numbers in them never become figures.</span>` : '<span class="help">Off for this brief. Suggestions use only the brief and the figures.</span>'}</div>`;
  }
  function exploreAfter() {
    const el = $('#xp-cmp'); if (!el || !XP_CUR) return;
    const proj = XP_CUR, info = xpInfo(proj), xs = xpStore(proj, info), items = xpCompareItems(proj, info, xs), wk = weeksOf(aWindow(84));
    const series = items.map((x, i) => { const raw = wk.map((w) => x.val(w)), b0 = raw.find((v) => v !== null && v !== undefined && isFinite(v) && v !== 0); return { name: x.name, color: `var(--s${i + 1})`, vals: raw.map((v) => (b0 === undefined || v === null || v === undefined || !isFinite(v)) ? null : 100 * v / b0) }; });
    drawLines(el, wk.map((w) => dayShort(w[0])), series, { label: 'Measures compared as an index, first week 100', height: 240, fmt: (v) => nf(v, 0), fmtAxis: (v) => nf(v, 0), tipLabel: (i) => 'Week of ' + day(wk[i][0]) });
  }
  ['solution', 'sim'].forEach((k) => { const prev = pages[k] && pages[k].after; if (pages[k]) pages[k].after = (id) => { if (prev) prev(id); exploreAfter(); }; });
  // Ask: "What else could we measure for <solution or organisation>?"
  function exploreAsk(ql, ps) {
    if (!/what else|other (measures|metrics|kpis)|(more|new|different) (measures|metrics|kpis)|(could|should|can) we (also )?(measure|track)|explore (impact|measures)/.test(ql)) return null;
    const ment = ps.filter((p) => [p.name, p.sol, p.org].some((x) => ql.includes(x.toLowerCase())) || ql.includes(p.org.split(' ')[0].toLowerCase()));
    const p = ment[0] || ps[0], info = xpInfo(p), xs = xpStore(p, info), sh = xpShares(p);
    const res = xpSuggest(p, info, { outcome: xs.brief.outcome, kind: xs.brief.kind, q: ql, focus: xs.brief.focus }, xs);
    const ideas = res.ids.map((id) => xpResolve(p, info, xpCatById(id), sh, xs)).filter(Boolean), pick = [];
    ['a', 'b', 'c'].forEach((t) => { const x = ideas.find((i) => i.t === t); if (x) pick.push(x); });
    pick.sort((x, y) => res.ids.indexOf(x.id) - res.ids.indexOf(y.id));
    if (!pick.length) return { html: `<p>I couldn’t find anything new to suggest for ${citeOf(p)}. It already measures what fits its kind of work.</p>` };
    const days = aWindow(30);
    return { html: `<p>For ${citeOf(p)}${ment.length ? '' : ' (name a solution or organisation to focus on another)'}, ${pick.length} idea${pick.length === 1 ? '' : 's'} from its outcome and the figures it shares:</p>
      <ul>${pick.map((i) => { const cm = i.t === 'a' ? i.cm : i.mcm, v = cm ? evalCustom(p, cm, days) : null; return `<li><b>${esc(i.name)}</b> <span class="muted">· ${XP_TYPE[i.t]}</span><br>${esc(i.why || i.needs || '')}${v !== null ? ` Last 30 days: <span class="mono">${fmtM(customMeta(cm), v)}</span> ${q(customMeta(cm).quality)}` : ''}</li>`; }).join('')}</ul>
      ${new Set(ment.map((x) => x.org)).size === 1 && ment.length > 1 ? `<p class="xs muted">${esc(p.org)} has ${ment.length} solutions collecting. Ask about each by name.</p>` : ''}
      ${res.ctx.length ? `<p class="small">Ranked with ${res.ctx.length} note${res.ctx.length === 1 ? '' : 's'} of client context from ${esc(p.org)}, read as their words.</p>` : ''}
      <p><a class="btn sm" href="${p.href}" data-xp-open="1"><img src="${SPARK}" alt="" style="width:16px">Open Explore for ${esc(p.sol)}</a></p>
      <p class="xs muted">${aiMark('Suggested by AI. You decide.')} Figures come from the solution’s own history. Nothing is measured until a second person approves it.</p>` };
  }
  // Demo studio: ship figures someone asked a developer for (demo workspace only).
  function exploreStudioSec() {
    const items = [];
    state.sims.forEach((s) => { if (s.xp) Object.entries(s.xp.reqs).forEach(([id, r]) => { if (!r.shipped && r.canShip) items.push([s, id, r]); }); });
    return `<section class="studio-sec"><h3>${icon('connect-ai', 'sm')}Figures asked of developers</h3><p class="help">When someone asks a developer for a new figure in Explore, pretend it shipped. Figures start arriving from the next day.</p>
      ${items.length ? `<div class="list">${items.map(([s, id, r]) => `<div class="row" style="grid-template-columns:minmax(0,1fr) auto"><div><div class="what small">${esc(r.label)}</div><div class="meta"><span class="mono">${esc(r.key)}</span><span>${esc(s.name)}</span></div></div><button type="button" class="btn sm" data-xp-act="ship" data-xp-proj="${s.id}" data-xp-id="${id}">Ship it</button></div>`).join('')}</div>` : '<p class="help">Nothing asked for yet.</p>'}</section>`;
  }
  function xpAddMeasure(proj, name, cm) {
    const c = { id: 'c' + state.seq++, name, op: cm.op, a: cm.a, b: cm.op === 'ratio' || cm.op === 'per' ? cm.b : null, rate: 2, target: '', aud: 'team', status: 'waiting', by: state.role };
    proj.custom().push(c);
    proj.approvals().unshift({ id: 'a' + state.seq++, cmId: c.id, projId: proj.id, projOrg: proj.org, type: 'Measure', title: c.name, proposer: state.role, since: now(), status: 'waiting', summary: `A new measure for ${proj.sol}, suggested in Explore and built from the figures it shares.`, fields: [['Worked out as', customFormula(c)], ['Kind', customMeta(c).quality], ['Who sees it', 'Team only']], evidence: `Preview checked on ${day(M.addDays(endDay(), 1))}`, affects: `${proj.sol} measures` });
    log(`Proposed the measure “${c.name}” for ${proj.sol}, from an Explore suggestion`);
    return c;
  }
  const XP_ACTS = {
    run: (proj, xs, d, keep) => {
      if (!keep) xpReadBrief(xs);
      xs.thinking = true; render();
      setTimeout(() => { xpRun(proj, xs); render(); const r = $('#xp-results'); if (r) r.scrollIntoView({ block: 'nearest' }); }, reduceMotion ? 0 : 700);
    },
    reopen: (proj, xs, d) => { const r = xs.runs.find((x) => x.id === d.xpRun); if (!r) return; xs.cur = r.id; xs.brief = JSON.parse(JSON.stringify(r.brief)); render(); const el = $('#xp-results'); if (el) el.scrollIntoView({ block: 'nearest' }); },
    rerun: (proj, xs, d) => { const r = xs.runs.find((x) => x.id === d.xpRun); if (!r) return; xs.brief = JSON.parse(JSON.stringify(r.brief)); XP_ACTS.run(proj, xs, d, true); },
    add: (proj, xs, d) => {
      const info = xpInfo(proj), idea = xpResolve(proj, info, xpCatById(d.xpId), xpShares(proj), xs), cm = idea && (idea.t === 'a' ? idea.cm : idea.mcm);
      if (!cm || idea.dup) return;
      xpAddMeasure(proj, idea.t === 'b' ? idea.mname : idea.name, cm); render(); toast('Measure sent for approval.');
    },
    builder: (proj, xs, d) => {
      const idea = xpResolve(proj, xpInfo(proj), xpCatById(d.xpId), xpShares(proj), xs); if (!idea || !idea.cm) return;
      state.bld = { proj: proj.id, name: idea.name, op: idea.cm.op, a: idea.cm.a, b: idea.cm.b || 'handled', rate: 2, target: '', aud: 'team' };
      state.solTab = 'measures'; render(); const b = $('#bld'); if (b) b.scrollIntoView({ block: 'center' });
    },
    request: (proj, xs, d) => {
      const info = xpInfo(proj), idea = xpResolve(proj, info, xpCatById(d.xpId), xpShares(proj), xs); if (!idea || idea.t !== 'b' || xpReqOf(xs, idea)) return;
      const f = idea.fig, apId = 'a' + state.seq++;
      proj.approvals().unshift({ id: apId, projId: proj.id, projOrg: proj.org, type: 'New figure', title: f.label, proposer: state.role, since: now(), status: 'waiting', summary: `Ask the developer of ${proj.sol} to share a new figure, so “${idea.t === 'b' && idea.as ? xpFill(idea.as.name, info) || idea.name : idea.name}” can be measured.`, fields: [['Key', f.key], ['Type', f.type + (f.agg ? ' · ' + f.agg : '')], ['Unit', f.unit], ['Means', f.desc], ['Split by', f.dims.join(', ') || '–']], evidence: 'Suggested by AI in Explore from the brief and the figures the solution shares', affects: `${proj.sol} catalog (metric_catalog_version) and its measures` });
      xs.reqs[idea.id] = { apId, key: f.key, label: f.label, at: now(), shipped: null, canShip: !!f.gen };
      xs.open = idea.id;
      log(`Asked the developer of ${proj.sol} for a new figure, ${f.key}`);
      render(); toast('Request sent. The developer brief is ready to copy.');
    },
    copy: (proj, xs, d) => {
      const el = $('#xp-dev-' + d.xpId); if (!el) return;
      const fallback = () => { const r = document.createRange(); r.selectNodeContents(el); getSelection().removeAllRanges(); getSelection().addRange(r); toast('Selected. Press Ctrl C to copy.'); };
      try { navigator.clipboard.writeText(el.textContent).then(() => toast('Copied. Send it to the developer.'), fallback); } catch (err) { fallback(); }
    },
    ship: (proj, xs, d) => {
      const req = xs.reqs[d.xpId], it = xpCatById(d.xpId); if (!req || req.shipped || !sandbox() || !it.fig || !it.fig.gen) return;
      req.shipped = state.simDay; xpEnsureField(proj, it, req, xpInfo(proj));
      log(`${proj.sol} started sharing ${req.key}; metric_catalog_version bumped`, 'Demo studio');
      render(); toast(`Shipped. Figures arrive from ${dayShort(M.addDays(state.simDay, 1))}.`);
    },
    'mock-approve': (proj, xs, d) => { const a = xpAp(proj, d.xpAp); if (!a) return; a.status = 'approved'; log(`Approved “${a.title}”`, 'Aisyah Rahman'); render(); toast('Aisyah approved it.'); },
    'rec-open': (proj, xs, d) => { const idea = xpResolve(proj, xpInfo(proj), xpCatById(d.xpId), xpShares(proj), xs); xs.recOpen = d.xpId; xs.recDraft = { v: '', u: idea.rec.unit, s: 'The organisation’s records', e: '' }; render(); const f = $('#xp-rv'); if (f) f.focus(); },
    'rec-cancel': (proj, xs) => { xs.recOpen = null; xs.recDraft = null; render(); },
    'rec-save': (proj, xs, d) => {
      const dr = xs.recDraft, info = xpInfo(proj), idea = xpResolve(proj, info, xpCatById(d.xpId), xpShares(proj), xs);
      const v = parseFloat(dr.v), bad = (id, msg) => { const el = $('#' + id); el.setAttribute('aria-invalid', 'true'); if (msg) el.placeholder = msg; el.focus(); };
      if (!isFinite(v)) { bad('xp-rv'); return; }
      if (!dr.e.trim()) { bad('xp-re', 'Say where the number comes from first'); return; }
      const apId = 'a' + state.seq++;
      proj.approvals().unshift({ id: apId, projId: proj.id, projOrg: proj.org, type: idea.rec.base ? 'Baseline' : 'Organisation figure', title: idea.rec.label, proposer: state.role, since: now(), status: 'waiting', summary: `A number from the organisation, so “${idea.name}” can be worked out for ${proj.sol}.`, fields: [['Value', `${v} ${dr.u}`], ['Source', dr.s], ['Used for', idea.name]], evidence: dr.e.trim(), affects: `${idea.name} for ${proj.sol}` });
      xs.recs[idea.id] = { apId, label: idea.rec.label, value: v, unit: dr.u, source: dr.s, evidence: dr.e.trim() };
      xs.recOpen = null; xs.recDraft = null;
      log(`Recorded “${idea.rec.label}” as ${v} ${dr.u} for ${proj.sol}, sent for approval`);
      render(); toast('Sent for approval.');
    },
    'pick-clear': (proj, xs) => { xs.picks = []; render(); },
  };
  function xpReadBrief(xs) { const o = $('#xp-outcome'), qq = $('#xp-q'), k = $('#xp-kind'); if (o) xs.brief.outcome = o.value; if (qq) xs.brief.q = qq.value.trim(); if (k) xs.brief.kind = k.value; }
  const xpProjOf = (d) => (d.xpProj && projById(d.xpProj)) || XP_CUR;
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-xp-act], [data-xp-focus], [data-xp-pick], [data-xp-ex], [data-xp-open]');
    if (!t) return;
    const d = t.dataset;
    if (d.xpOpen) { state.solTab = 'explore'; return; }
    const proj = xpProjOf(d); if (!proj) return;
    const xs = xpStore(proj, xpInfo(proj));
    if (d.xpFocus) { xpReadBrief(xs); const f = xs.brief.focus, i = f.indexOf(d.xpFocus); if (i >= 0) f.splice(i, 1); else f.push(d.xpFocus); render(); return; }
    if (d.xpEx) { xpReadBrief(xs); xs.brief.q = d.xpEx; render(); return; }
    if (d.xpPick) { const i = xs.picks.indexOf(d.xpPick); if (i >= 0) xs.picks.splice(i, 1); else if (xs.picks.length >= 3) { toast('Compare up to three at a time.'); return; } else xs.picks.push(d.xpPick); render(); return; }
    if (d.xpAct && XP_ACTS[d.xpAct]) { e.preventDefault(); XP_ACTS[d.xpAct](proj, xs, d); }
  });
  document.addEventListener('input', (e) => {
    const id = e.target.id; if (!/^xp-/.test(id) || !XP_CUR) return;
    const xs = xpStore(XP_CUR, xpInfo(XP_CUR));
    if (id === 'xp-outcome') xs.brief.outcome = e.target.value;
    if (id === 'xp-q') xs.brief.q = e.target.value;
    if (xs.recDraft && ({ 'xp-rv': 'v', 'xp-ru': 'u', 'xp-re': 'e' })[id]) { xs.recDraft[({ 'xp-rv': 'v', 'xp-ru': 'u', 'xp-re': 'e' })[id]] = e.target.value; e.target.removeAttribute('aria-invalid'); }
  });
  document.addEventListener('change', (e) => {
    const id = e.target.id; if (!/^xp-/.test(id) || !XP_CUR) return;
    const xs = xpStore(XP_CUR, xpInfo(XP_CUR));
    if (id === 'xp-kind') { xpReadBrief(xs); render(); }
    if (id === 'xp-ctx') { xpReadBrief(xs); xs.brief.useCtx = e.target.checked; render(); }
    if (id === 'xp-rs' && xs.recDraft) xs.recDraft.s = e.target.value;
  });

  // ------------------------------------------------------------------ ANALYTICS: standard views over any measure
  // scope is 'all', 'c:<organisation id>' or a project id
  function anSel(a, ps) {
    if (a.proj === 'all') return ps;
    if (a.proj.startsWith('c:')) { const c = coById(a.proj.slice(2)), ids = c ? coSolutions(c).map((x) => x.id) : []; return ps.filter((p) => ids.includes(p.id)); }
    return ps.filter((p) => p.id === a.proj);
  }
  pages.analytics = () => {
    const ps = projects();
    if (!ps.length) return `${head({ title: 'Analytics', lead: 'Trends, comparisons and patterns for any measure, across one project or all of them.' })}<section class="card"><div class="empty">${emptyArt}<h3>Nothing to analyse yet</h3><p>Analytics appears once a solution is collecting figures. Connect one, or simulate a few in Demo studio.</p><div class="head-actions" style="justify-content:center"><button type="button" class="btn primary" data-act="studio">Open Demo studio</button><button type="button" class="btn" data-act="switch-mode">Example workspace</button></div></div></section>`;
    const a = state.an = state.an || { measure: 'hours', proj: 'all', range: 90 };
    a.by = a.by || 'client';
    if (!anSel(a, ps).length) a.proj = 'all';
    const sel = anSel(a, ps), cos = companies().map((c) => ({ c, list: ps.filter((p) => coSolutions(c).some((x) => x.id === p.id)) })).filter((x) => x.list.length);
    const scopeName = a.proj === 'all' ? 'all organisations' : a.proj.startsWith('c:') ? coById(a.proj.slice(2)).short : `${sel[0].org} · ${sel[0].sol}`;
    const visible = MEASURES.filter((m) => !m.reka || has('Commercial'));
    if (!visible.some((m) => m.key === a.measure)) a.measure = 'hours';
    const m = mByKey(a.measure);
    const days = aWindow(a.range), prevDays = windowDays(a.range, M.addDays(days[0], -1));
    const cur = mergeTotals(sel.map((p) => totals(p, days))), prv = mergeTotals(sel.map((p) => totals(p, prevDays)));
    const v = m.calc(cur), pv = m.calc(prv), rg = m.range ? m.range(cur) : null;
    const okCmp = comparable(cur, prv);
    const chg = okCmp && v !== null && pv ? 100 * (v - pv) / Math.abs(pv) : null;
    const groups = a.by === 'client' ? cos.map(({ c, list }) => ({ id: 'c:' + c.id, name: c.short, sub: `${c.projects.length} project${c.projects.length === 1 ? '' : 's'} · ${list.length} solution${list.length === 1 ? '' : 's'} collecting`, list }))
      : ps.map((p) => ({ id: p.id, name: p.sol, sub: `${p.org} · ${p.name} · ${STATUS[p.stat()][1].toLowerCase()}`, list: [p] }));
    const rows = groups.map((g) => { const t = mergeTotals(g.list.map((p) => totals(p, days))), tp = mergeTotals(g.list.map((p) => totals(p, prevDays))); return { g, v: m.calc(t), pv: comparable(t, tp) ? m.calc(tp) : null }; }).sort((x, y) => (y.v === null ? -1e12 : y.v) - (x.v === null ? -1e12 : x.v));
    const maxV = Math.max(...rows.map((r) => r.v || 0), 1);
    const wd = [1, 2, 3, 4, 5, 6, 0].map((w) => { const dd = days.filter((d) => M.weekday(d) === w); const ts = sel.map((p) => totals(p, dd)); const t = mergeTotals(ts); const val = m.calc(t); const nd = Math.max(...ts.map((x) => x.n), 0); return [DAYS[w].slice(0, 3), val === null ? null : m.sum ? (nd ? val / nd : null) : val]; });
    const wdMax = Math.max(...wd.map(([, x]) => x || 0), 1);
    const good = chg === null ? null : (m.better === 'up' ? chg >= 0 : chg <= 0);
    const pctTxt = (c) => c === null ? '–' : (c >= 0 ? '+' : '−') + nf(Math.abs(c), 0) + '%';
    return `${head({ title: 'Analytics', lead: 'Trends, comparisons and patterns for any measure, across one project or all of them.', actions: `<button type="button" class="btn sm" data-act="an-ask"><img src="${SPARK}" alt="" style="width:16px">Ask about this</button><button type="button" class="btn sm" data-act="export">Export CSV</button>` })}
    <section class="card" style="padding:14px 18px"><div class="form-grid an-controls">
      <div class="field"><label for="an-m">Measure</label><select id="an-m">${DOMAINS.map((dm) => { const xs = visible.filter((x) => x.domain === dm); return xs.length ? `<optgroup label="${dm}">${xs.map((x) => `<option value="${x.key}" ${x.key === a.measure ? 'selected' : ''}>${x.name}</option>`).join('')}</optgroup>` : ''; }).join('')}</select></div>
      <div class="field"><label for="an-p">Show</label><select id="an-p"><option value="all">All organisations (${ps.length} solution${ps.length === 1 ? '' : 's'})</option>${cos.map(({ c, list }) => `<optgroup label="${esc(c.short)}"><option value="c:${c.id}" ${a.proj === 'c:' + c.id ? 'selected' : ''}>All of ${esc(c.short)}</option>${list.map((p) => `<option value="${p.id}" ${p.id === a.proj ? 'selected' : ''}>${esc(p.name)} · ${esc(p.sol)}</option>`).join('')}</optgroup>`).join('')}</select></div>
      <div class="field"><span class="lab">Period</span><div class="seg">${[[30, '30 days'], [90, '90 days'], [365, '12 months']].map(([d, l]) => `<button type="button" data-anrange="${d}" aria-pressed="${a.range === d}">${l}</button>`).join('')}</div></div>
    </div></section>
    <section class="grid g4 stats">
      <div class="card stat"><span class="label">${esc(m.name)} ${q(m.quality)}</span><span class="value">${fmtM(m, v) || '–'}</span><span class="hint">${rg ? `Likely ${fmtM(m, rg[0])} to ${fmtM(m, rg[1])}` : esc(RANGES[a.range])}</span></div>
      <div class="card stat"><span class="label">The period before</span><span class="value">${fmtM(m, pv) || '–'}</span><span class="hint">${pv === null ? 'No figures then' : 'Same length, just before'}</span></div>
      <div class="card stat"><span class="label">Change</span><span class="value" style="color:var(--${good === null ? 'ink' : good ? 'ok-ink' : 'fault-ink'})">${pctTxt(chg)}</span><span class="hint">${chg === null ? (okCmp ? 'Needs two periods of figures' : 'Too few days of data before to compare fairly') : (good ? 'Better' : 'Worse') + (m.better === 'up' ? ', higher is better' : ', lower is better')}</span></div>
      <div class="card stat"><span class="label">Days with data</span><span class="value">${cur.expected ? nf(100 * cur.n / cur.expected, 0) + '%' : '–'}</span><span class="hint">${cur.missing} missing day${cur.missing === 1 ? '' : 's'}, never counted as zero</span></div>
    </section>
    <section class="card"><div class="card-head"><div><h2>${esc(m.name)} over time</h2><p class="sub">${a.range > 30 ? 'By week' : 'By day'} · ${esc(scopeName)} · against the period before</p></div></div>
      <div class="chart" id="ch-an"></div>
      <div class="legend"><span><i style="background:var(--s1)"></i>This period</span><span><i style="background:var(--baseline)"></i>The period before, dashed</span></div></section>
    <section class="grid g-main">
      <div class="card"><div class="card-head"><div><h2>By ${a.by === 'client' ? 'client' : 'solution'}</h2><p class="sub">${esc(RANGES[a.range])} · ${m.sum ? 'added up within each row' : 'each from its own totals, never averaged'}</p></div><div class="seg" role="group" aria-label="Compare by"><button type="button" data-anby="client" aria-pressed="${a.by === 'client'}">Organisations</button><button type="button" data-anby="project" aria-pressed="${a.by !== 'client'}">Solutions</button></div></div>
        <div class="table-wrap"><table><thead><tr><th>${a.by === 'client' ? 'Client' : 'Solution'}</th><th class="num">${esc(m.name)}</th><th class="num">Change</th><th>12 weeks</th></tr></thead><tbody>
        ${rows.map((r) => { const c = r.v !== null && r.pv ? 100 * (r.v - r.pv) / Math.abs(r.pv) : null, gd = c === null ? null : (m.better === 'up' ? c >= 0 : c <= 0); return `<tr class="link ${a.proj === r.g.id ? 'sel' : ''}" data-anpick="${r.g.id}" tabindex="0"><td><span class="name">${esc(r.g.name)}</span><span class="sub">${esc(r.g.sub)}</span>${m.sum && r.v !== null ? `<div class="bar-track" style="margin-top:6px;height:6px"><div class="bar-fill" style="width:${100 * r.v / maxV}%"></div></div>` : ''}</td><td class="num">${fmtM(m, r.v) || '<span class="dash">–</span> <span class="needs">not shared</span>'}</td><td class="num" style="color:var(--${gd === null ? 'muted' : gd ? 'ok-ink' : 'fault-ink'})">${pctTxt(c)}</td><td>${sparkline(weeksOf(aWindow(84)).map((w) => m.calc(mergeTotals(r.g.list.map((p) => totals(p, w))))), 90, 26)}</td></tr>`; }).join('')}
        </tbody></table></div></div>
      <div class="card"><div class="card-head"><div><h2>By weekday</h2><p class="sub">${m.sum ? 'Average a day' : 'From that weekday’s totals'}</p></div></div>
        <div class="impact">${wd.map(([l, x]) => `<div class="ib-row" style="grid-template-columns:40px minmax(0,1fr)"><span class="lab">${l}</span><div class="ib-bar" style="align-items:center;gap:8px;height:22px"><div class="ib-seg measured" style="width:${x === null ? 0 : Math.max(1, 72 * x / wdMax)}%"></div><span class="mono xs ink">${fmtM(m, x) || '–'}</span></div></div>`).join('')}</div>
        <p class="small muted" style="margin-top:12px">${esc(m.how)}</p></div>
    </section>`;
  };
  pages.analytics.after = () => {
    const el = $('#ch-an'); if (!el) return;
    const a = state.an, ps = projects(), sel = anSel(a, ps), m = mByKey(a.measure);
    const days = aWindow(a.range), prevDays = windowDays(a.range, M.addDays(days[0], -1));
    const chunk = (ds) => a.range > 30 ? weeksOf(ds) : ds.map((d) => [d]);
    const cb = chunk(days), pb = chunk(prevDays);
    const val = (b) => m.calc(mergeTotals(sel.map((p) => totals(p, b))));
    drawLines(el, cb.map((b) => dayShort(b[0])), [{ name: 'This period', vals: cb.map(val), color: 'var(--s1)' }, { name: 'The period before', vals: pb.map(val), color: 'var(--baseline)', dashed: true }],
      { label: m.name + ' over time', height: 250, fmt: (x) => fmtM(m, x), fmtAxis: (x) => m.unit === 'RM' ? 'RM' + (x >= 1000 ? nf(x / 1000, 0) + 'k' : nf(x, 0)) : nf(x, x % 1 ? 1 : 0), tipLabel: (i) => a.range > 30 ? 'Week of ' + day(cb[i][0]) : day(cb[i][0]) });
    $('#an-m').addEventListener('change', (e) => { a.measure = e.target.value; render(); });
    $('#an-p').addEventListener('change', (e) => { a.proj = e.target.value; render(); });
  };

  // ------------------------------------------------------------------ ASK: questions about the data, answered from the figures
  const MEASURE_WORDS = [['costPer', /cost per|running cost/], ['value', /value|worth|money|ringgit|\brm\b/], ['tat', /turnaround|how (fast|quick)|speed|faster|slower|cycle time|how long/], ['sla', /agreed time|\bsla\b|on time|deadline/], ['quality', /quality|correct|mistake|accura|\bfix|sent back|errors?\b/], ['people', /people|users|adoption|using it|staff/], ['fails', /fail/], ['hours', /hour|time saved|sav(e|ed|ing)|freed|impact/], ['volume', /volume|handled|how many|processed|work done|throughput|busy/]];
  function askPeriod(q) {
    const end = endDay(), mi = MONTHS.findIndex((x) => q.includes(x.toLowerCase()));
    if (mi >= 0 || /last month/.test(q)) {
      const ym = mi >= 0 ? `${end.slice(0, 4)}-${String(mi + 1).padStart(2, '0')}` : lastFullMonth();
      return { days: monthWindow(ym).filter((d) => d <= end), prev: monthWindow(prevMonth(ym)), label: monthName(ym), prevLabel: monthName(prevMonth(ym)) };
    }
    const n = /week|7 days/.test(q) ? 7 : /quarter|90 days|3 months/.test(q) ? 90 : /year|12 months/.test(q) ? 365 : 30;
    const days = aWindow(n);
    return { days, prev: windowDays(n, M.addDays(days[0], -1)), label: RANGES[n].toLowerCase(), prevLabel: `the ${n === 365 ? '12 months' : n + ' days'} before` };
  }
  const citeOf = (p) => `<a class="cite" href="${p.href}">${esc(p.sol)}</a>`;
  // "What has <organisation> told us?": the client context, quoted with who said it and when. Staff only, like Ask.
  function ctxAsk(ql) {
    if (!/(told|tell us|feedback|said|say|context|concern|complain|asked for|care about|goals?\b|priorit)/.test(ql)) return null;
    const co = companies().find((c) => [c.name, c.short].some((x) => ql.includes(x.toLowerCase())) || ql.includes(c.short.split(' ')[0].toLowerCase()));
    if (!co) return null;
    const list = ctxFor(co.id).sort((a, b) => b.date.localeCompare(a.date)), link = `<a href="#results-${co.id}" data-act="to-ctx" data-org="${co.id}">client context for ${esc(co.short)}</a>`;
    if (!list.length) return { html: `<p>Nothing recorded from <b>${esc(co.short)}</b> yet. After a meeting or a call, add what they said to the ${link}.</p>` };
    return { html: `<p>What <b>${esc(co.short)}</b> has told the account team, newest first:</p><ul>${list.slice(0, 5).map((e) => `<li>“${esc(e.text)}” <span class="muted">· ${esc(e.from)}, ${esc(e.source.toLowerCase())}, ${dayShort(e.date)}${(e.items || []).length ? ` · ${(e.items || []).map((x) => esc(x.name)).join(', ')}` : ''}${e.ai ? '' : ' · not for AI'}</span></li>`).join('')}</ul>${list.length > 5 ? `<p class="small">And ${list.length - 5} more in the ${link}.</p>` : `<p class="small">From the ${link}.</p>`}
      <p class="xs muted">Quoted as recorded, by role. REKA only: never shown to ${esc(co.short)}. Numbers in what people said are their words, not measured figures.</p>` };
  }
  function askAnswer(raw) {
    const ql = raw.toLowerCase(), ps = projects();
    const cxa = ctxAsk(ql); if (cxa) return cxa;
    if (!ps.length) return { html: '<p>There are no figures to answer from yet. Connect a solution, or simulate one in Demo studio, and ask again.</p>' };
    const xpa = exploreAsk(ql, ps); if (xpa) return xpa;
    const per = askPeriod(ql);
    const ment = ps.filter((p) => [p.name, p.sol, p.org].some((x) => ql.includes(x.toLowerCase())) || ql.includes(p.org.split(' ')[0].toLowerCase()));
    const mw = MEASURE_WORDS.find(([, re]) => re.test(ql));
    const m = mByKey(mw ? mw[0] : 'hours');
    if (m.reka && !has('Commercial')) return { html: '<p>Running cost is REKA only, for people with the commercial right, so I can’t show it to you.</p>' };
    const scope = ment.length ? ment : ps;
    const T = (p, d) => totals(p, d), V = (p, d) => m.calc(T(p, d));
    const missing = scope.reduce((a, p) => a + T(p, per.days).missing, 0);
    const src = `<p class="xs muted">Worked out from ${scope.length} project${scope.length === 1 ? '' : 's'}, ${esc(per.label)}${missing ? `. ${missing} missing day${missing === 1 ? '' : 's'} not counted` : ''}.${m.quality === 'estimated' ? ' Estimates come from agreed baselines.' : ''}</p>`;
    const pc = (x, y) => y ? (x - y) / Math.abs(y) * 100 : 0;
    const co = companies().find((c) => [c.name, c.short].some((x) => ql.includes(x.toLowerCase())));
    if (/attention|needs? (me|you)|problem|wrong|issue|alert|broken|stuck/.test(ql)) {
      const list = co ? coNeeds(co) : demo() ? demoAtt() : needsYou();
      return { html: list.length ? `<p>${list.length} thing${list.length === 1 ? '' : 's'} need you, worst first:</p><ul>${list.slice(0, 6).map(([, , t, mm, h]) => `<li><a href="${h}">${esc(t)}</a> <span class="muted">· ${esc(mm)}</span></li>`).join('')}</ul>` : '<p>Nothing needs you. Every solution sent its figures on time.</p>' };
    }
    if (co && /doing|going|summar|overview|status|update|how.?s|how is/.test(ql) && !/calculat|formula|worked out/.test(ql)) {
      const cps = coProjs(co), hm = mByKey('hours'), ct = coTotals(co, per.days), cp = coTotals(co, per.prev), h = hm.calc(ct), rg = hm.range(ct), needs = coNeeds(co);
      const ch = comparable(ct, cp) && h !== null ? chgPct(h, hm.calc(cp)) : null;
      if (!cps.length) return { html: `<p><b>${esc(co.short)}</b> has ${co.projects.length ? `${co.projects.length} project${co.projects.length === 1 ? '' : 's'}, but none is collecting figures yet` : 'no projects yet'}. I can only answer once a solution is sending data.</p>${needs.length ? `<p>What needs you:</p><ul>${needs.map(([, , t, , hr]) => `<li><a href="${hr}">${esc(t)}</a></li>`).join('')}</ul>` : ''}` };
      return { html: `<p><b>${esc(co.short)}</b>, ${esc(per.label)}: ${h !== null ? `an estimated <span class="mono" style="font-size:1.1em">${nf(h)} hours</span> saved ${q('estimated')}, likely ${nf(rg[0])} to ${nf(rg[1])}${ch !== null ? `, ${ch >= 0 ? 'up' : 'down'} ${nf(Math.abs(ch), 0)}% on ${esc(per.prevLabel)}` : ''}` : 'no hours saved yet, because no project has an approved baseline'}. <span class="mono">${nf(ct.vol)}</span> items handled across ${cps.length} solution${cps.length === 1 ? '' : 's'}.</p>
        <ul>${co.projects.map((pr) => { const ss = pr.solutions.filter((x) => x.proj), t = mergeTotals(ss.map((x) => totals(x.proj, per.days))), hv = hm.calc(t); return `<li>${esc(pr.name)}: ${ss.length ? ss.map((x) => citeOf(x.proj)).join(', ') + ` <span class="mono">${hv !== null ? nf(hv) + ' h' : nf(t.vol) + ' handled'}</span>` : '<span class="muted">not collecting yet</span>'} · ${esc(STATUS[worstOf(pr.solutions.map((x) => x.status))][1].toLowerCase())}</li>`; }).join('')}</ul>
        ${needs.length ? `<p>${needs.length} thing${needs.length === 1 ? '' : 's'} need${needs.length === 1 ? 's' : ''} you here:</p><ul>${needs.map(([, , t, , hr]) => `<li><a href="${hr}">${esc(t)}</a></li>`).join('')}</ul>` : '<p>Nothing needs you for this organisation.</p>'}
        <p class="xs muted">Worked out from ${cps.length} project${cps.length === 1 ? '' : 's'} for this organisation, ${esc(per.label)}${ct.missing ? `. ${ct.missing} missing day${ct.missing === 1 ? '' : 's'} not counted` : ''}. Hours add up across projects without counting the same work twice.</p>` };
    }
    if (/how (is|are|do|does)|calculat|formula|worked out|what does .* mean|definition/.test(ql)) {
      return { html: `<p><b>${esc(m.name)}</b> ${q(m.quality)}</p><p>${esc(m.how)}</p>${m.key === 'hours' ? '<p>Minutes by hand come from the baseline the organisation agreed. Machine time is never counted as a person’s time. The likely range uses the fastest and slowest times in the baseline.</p>' : ''}<p class="xs muted">Every project uses the same definition, so they can be compared.</p>` };
    }
    if (/why|drop|fell|fall|went (down|up)|rise|rose|increase|decrease|change|differen/.test(ql)) {
      const week = /week/.test(ql) || !/month|quarter|year|days/.test(ql);
      const cd = week ? aWindow(7) : per.days, pd = week ? windowDays(7, M.addDays(aWindow(7)[0], -1)) : per.prev;
      const cand = ment.length ? ment : ps.slice().sort((x, y) => Math.abs(pc(V(y, cd) || 0, V(y, pd) || 0)) - Math.abs(pc(V(x, cd) || 0, V(x, pd) || 0)));
      const p = cand[0], a = T(p, cd), b = T(p, pd), va = m.calc(a), vb = m.calc(b);
      if (!comparable(a, b)) return { html: `<p>${citeOf(p)} doesn\u2019t have enough figures from the period before to compare fairly.</p>` };
      if (va === null || vb === null) return { html: `<p>${esc(p.sol)} doesn’t have ${esc(m.name.toLowerCase())} for both periods, so I can’t compare them.</p>` };
      const drivers = [];
      if (Math.abs(pc(a.vol, b.vol)) >= 5) drivers.push(`Work handled ${a.vol > b.vol ? 'rose' : 'fell'} ${nf(Math.abs(pc(a.vol, b.vol)), 0)}%, from <span class="mono">${nf(b.vol)}</span> to <span class="mono">${nf(a.vol)}</span>.`);
      if (a.missing > b.missing) drivers.push(`<span class="mono">${a.missing}</span> day${a.missing === 1 ? ' is' : 's are'} missing this time, against <span class="mono">${b.missing}</span> before. Missing days aren’t counted, so totals look lower.`);
      const qa = mByKey('quality').calc(a), qb = mByKey('quality').calc(b);
      if (qa !== null && qb !== null && Math.abs(qa - qb) >= 0.8 && m.key !== 'quality') drivers.push(`The share needing a person to fix moved from <span class="mono">${nf(qb, 1)}%</span> to <span class="mono">${nf(qa, 1)}%</span>.`);
      const ta = mByKey('tat').calc(a), tb = mByKey('tat').calc(b);
      if (ta !== null && tb !== null && Math.abs(pc(ta, tb)) >= 8 && m.key !== 'tat') drivers.push(`Turnaround went from <span class="mono">${nf(tb, 1)} h</span> to <span class="mono">${nf(ta, 1)} h</span>.`);
      return { html: `<p><b>${esc(m.name)}</b> for ${citeOf(p)} ${va >= vb ? 'rose' : 'fell'} from <span class="mono">${fmtM(m, vb)}</span> to <span class="mono">${fmtM(m, va)}</span> (${va >= vb ? '+' : '−'}${nf(Math.abs(pc(va, vb)), 0)}%), ${week ? 'this week against last week' : esc(per.label) + ' against ' + esc(per.prevLabel)}.</p>${drivers.length ? `<p>What moved at the same time:</p><ul>${drivers.map((x) => `<li>${x}</li>`).join('')}</ul>` : '<p>Nothing else moved much at the same time.</p>'}<p class="xs muted">This shows what changed alongside it. It isn’t proof of the cause.</p>`, chart: { proj: p.id, m: m.key } };
    }
    if (/best|worst|most|least|top|rank|improv|highest|lowest|leader/.test(ql)) {
      const byChange = /improv/.test(ql), low = /worst|least|lowest/.test(ql);
      const rows = ps.map((p) => { const ta = T(p, per.days), tb = T(p, per.prev), v = m.calc(ta), pv = comparable(ta, tb) ? m.calc(tb) : null; return { p, v, c: v !== null && pv ? pc(v, pv) : null }; }).filter((r) => (byChange ? r.c : r.v) !== null);
      if (!rows.length) return { html: byChange ? `<p>No project has enough figures from ${esc(per.prevLabel)} to compare fairly. Try a shorter period, like this week.</p>` : `<p>None of the projects share ${esc(m.name.toLowerCase())} for ${esc(per.label)} yet.</p>` };
      const score = (r) => byChange ? (m.better === 'up' ? r.c : -r.c) : r.v;
      rows.sort((x, y) => low ? score(x) - score(y) : score(y) - score(x));
      const top = rows[0];
      return { html: `<p>${byChange ? 'Most improved' : low ? 'Lowest' : 'Highest'} on <b>${esc(m.name.toLowerCase())}</b>, ${esc(per.label)}: ${citeOf(top.p)} ${byChange ? `at <span class="mono">${top.c >= 0 ? '+' : '−'}${nf(Math.abs(top.c), 0)}%</span> on ${esc(per.prevLabel)}` : `with <span class="mono">${fmtM(m, top.v)}</span>`}.</p>
        <div class="table-wrap"><table><thead><tr><th>Project</th><th class="num">${esc(m.name)}</th><th class="num">Change</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.p.org)} · ${esc(r.p.name)}</td><td class="num">${fmtM(m, r.v) || '–'}</td><td class="num">${r.c === null ? '–' : (r.c >= 0 ? '+' : '−') + nf(Math.abs(r.c), 0) + '%'}</td></tr>`).join('')}</tbody></table></div>${src}` };
    }
    if (/compare| vs |versus|each project|by project|all projects|side by side/.test(ql)) {
      const keys = mw ? [m.key] : ['hours', 'volume', 'quality', 'tat'];
      return { html: `<p>${scope.length} project${scope.length === 1 ? '' : 's'}, ${esc(per.label)}:</p><div class="table-wrap"><table><thead><tr><th>Project</th>${keys.map((k) => `<th class="num">${esc(mByKey(k).name)}</th>`).join('')}</tr></thead><tbody>${scope.map((p) => { const t = T(p, per.days); return `<tr><td>${esc(p.org)} · ${esc(p.name)}</td>${keys.map((k) => `<td class="num">${fmtM(mByKey(k), mByKey(k).calc(t)) || '–'}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div><p class="xs muted">Rates are worked out per project from its own totals. A dash means that solution doesn’t share the figure.</p>${src}` };
    }
    if (/trend|chart|graph|over time|show me|show the|plot/.test(ql)) {
      const p = ment[0] || null;
      return { html: `<p><b>${esc(m.name)}</b> by week, last 12 weeks, ${p ? citeOf(p) : 'all projects'}:</p>`, chart: { proj: p ? p.id : 'all', m: m.key } };
    }
    if (mw) {
      const t = mergeTotals(scope.map((p) => T(p, per.days))), v = m.calc(t), rg = m.range ? m.range(t) : null;
      if (v === null) return { html: `<p>${ment.length ? esc(ment[0].sol) + ' doesn’t share' : 'None of the projects share'} ${esc(m.name.toLowerCase())} for ${esc(per.label)}.</p>` };
      return { html: `<p><b>${esc(m.name)}</b>, ${esc(per.label)}: <span class="mono" style="font-size:1.1em">${fmtM(m, v)}</span> ${q(m.quality)}${rg ? `, likely ${fmtM(m, rg[0])} to ${fmtM(m, rg[1])}` : ''}.</p>${scope.length > 1 ? `<ul>${scope.map((p) => `<li>${citeOf(p)} <span class="mono">${fmtM(m, V(p, per.days)) || '–'}</span></li>`).join('')}</ul>${m.sum ? '' : '<p class="xs muted">Worked out from the combined totals, not an average of the projects.</p>'}` : ''}${src}` };
    }
    return { html: '<p>I can only answer from the figures Outcomes collects: hours saved, work handled, turnaround, time agreed, corrections, people using it and failed runs, for any project and period.</p><p>Try one of the suggestions below.</p>' };
  }
  function askSuggestions() {
    const p = projects()[0];
    const c = companies().find((x) => coProjs(x).length);
    return [`How many hours did we save in ${monthName(lastFullMonth())}?`, 'What needs my attention?', c ? `How is ${c.short} doing this month?` : null, c ? `What has ${c.short} told us?` : null, p ? `Why did ${p.sol} change this week?` : null, p ? `What else could we measure for ${p.sol}?` : null, 'Which project improved most this month?', 'Compare all projects', 'Show the trend of work handled', 'How is hours saved worked out?'].filter(Boolean);
  }
  pages.ask = () => {
    const chat = state.chat = state.chat || [];
    return `${head({ title: 'Ask', lead: 'Ask about your projects in plain words. Answers come only from the figures Outcomes collects, and show where each number came from.', actions: chat.length ? '<button type="button" class="btn sm ghost" data-act="ask-clear">New conversation</button>' : '' })}
    <section class="card" style="display:grid;gap:16px">
      ${chat.length ? `<div class="grid" style="gap:16px" id="chat">${chat.map((x, i) => x.role === 'user'
        ? `<div style="justify-self:end;max-width:min(75%,560px);background:var(--primary);color:var(--on-primary);padding:10px 14px;border-radius:16px 16px 4px 16px">${esc(x.text)}</div>`
        : `<div style="display:grid;grid-template-columns:32px minmax(0,1fr);gap:12px;align-items:start"><span class="ico ai" style="width:32px;height:32px;border-radius:10px;display:grid;place-items:center"><img src="${SPARK}" alt="" style="width:18px${x.thinking && !reduceMotion ? ';animation:breathe 1.2s infinite alternate' : ''}"></span><div class="narrative" style="font-size:.9375rem;max-width:none;min-width:0">${x.thinking ? '<p class="muted">Working it out from the figures…</p>' : x.html}${x.chart ? `<div class="chart" id="ask-ch-${i}"></div>` : ''}</div></div>`).join('')}</div>`
      : `<div class="empty" style="padding:12px"><span class="ico ai" style="width:52px;height:52px;border-radius:14px;display:grid;place-items:center"><img src="${SPARK}" alt="" style="width:28px"></span><h3>What do you want to know?</h3><p>For example, how much time an organisation saved last month, why a figure moved, or which project is improving fastest.</p></div>`}
      <div class="chips">${askSuggestions().map((t) => `<button type="button" class="chip" data-askq="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      <form id="f-ask" style="display:flex;gap:8px;align-items:flex-end"><div class="field" style="flex:1"><input id="ask-q" placeholder="Ask about hours saved, turnaround, corrections, any project…" aria-label="Your question" autocomplete="off" value="${esc(state.askDraft || '')}"></div><button type="submit" class="btn primary" style="min-height:44px">Ask</button></form>
      <p class="xs muted">Ask never makes up a figure, says when it can’t answer, and doesn’t claim what caused a change. ${demo() ? 'Answers here use the example data.' : 'Answers use your workspace.'}</p>
    </section>`;
  };
  pages.ask.after = () => {
    (state.chat || []).forEach((x, i) => {
      if (!x.chart) return;
      const el = $('#ask-ch-' + i), ps = x.chart.proj === 'all' ? projects() : [projById(x.chart.proj)].filter(Boolean), m = mByKey(x.chart.m), wk = weeksOf(aWindow(84));
      drawLines(el, wk.map((w) => dayShort(w[0])), [{ name: m.name, vals: wk.map((w) => m.calc(mergeTotals(ps.map((p) => totals(p, w))))), color: 'var(--s1)' }], { label: m.name, height: 180, fmt: (v) => fmtM(m, v), tipLabel: (i2) => 'Week of ' + day(wk[i2][0]) });
    });
    $('#f-ask').addEventListener('submit', (e) => { e.preventDefault(); askSubmit($('#ask-q').value); });
    $('#ask-q').addEventListener('input', (e) => { state.askDraft = e.target.value; });
    if (state.askScroll) { const c = $('#chat'); if (c && c.lastElementChild) c.lastElementChild.scrollIntoView({ block: 'nearest' }); state.askScroll = false; }
  };
  function askSubmit(text) {
    text = (text || '').trim(); if (!text) return;
    state.chat = state.chat || [];
    state.chat.push({ role: 'user', text }); const slot = { role: 'ai', thinking: true }; state.chat.push(slot);
    state.askDraft = ''; state.askScroll = true;
    if (location.hash !== '#ask') location.hash = '#ask'; else render();
    setTimeout(() => { Object.assign(slot, askAnswer(text), { thinking: false }); state.askScroll = true; if (location.hash === '#ask') render(); }, reduceMotion ? 0 : 700);
  }
  function demoAtt() {
    const waiting = state.approvals.filter((a) => a.status === 'waiting').length;
    return [['fault', 'alerts', 'Quote drafter stopped answering', 'Bina Jaya · since 14 Oct, 22:00', '#troubleshoot-quote-drafter', 'Troubleshoot'], ['warn', 'clock', 'Shift planner hasn’t sent data for 2 days', 'Acme Plastics · showing the last good figures', '#troubleshoot-shift-planner', 'Troubleshoot'], ['warn', 'shield', `${waiting} item${waiting === 1 ? '' : 's'} waiting for approval`, has('Approve') ? 'Some are yours to decide' : 'A project manager decides', '#approvals', 'Review'], ['info', 'target', 'Front-desk hours saved needs a baseline', 'Sampel Medik · impact can’t be shown yet', '#approvals', 'Add'], ['info', 'reports', state.reportApproved ? 'September report approved' : 'September report is ready to review', 'Contoh Logistik · due 17 Oct', '#report', 'Open']];
  }

  // ------------------------------------------------------------------ SETTINGS and HELP
  // ---------- Platform and Trail pages (SPEC §7.3): Settings, Demo, Audit, Staff, and Watch → Adoption
  const SWITCHES = [['collect', 'Nightly collection', 'Reads every measurement link each night. Off pauses every organisation’s figures; days missed are filled in when it comes back.'], ['ai', 'AI drafting', 'Report summaries, KPI and measure suggestions, and Ask. Off shows people a plain message instead.'], ['email', 'Report emails', 'Sends approved reports to each organisation’s contacts. Off keeps them in Reports.']];
  const swOn = (k) => !(state.switchesOff || {})[k];
  pages.settings = () => `${head({ title: 'Settings', lead: 'Platform switches, collection, retention and the integration pack. Each switch asks for a reason first.' })}
    <section class="card"><div class="card-head"><h2>Platform switches</h2><span class="xs muted">Operator for switches</span></div><div class="list">
      ${SWITCHES.map(([k, l, d]) => `<div class="row" style="grid-template-columns:minmax(0,1fr) auto"><div><div class="what">${l}</div><div class="meta">${d}</div></div>${atLeast('Operator') ? `<button type="button" class="switch" role="switch" aria-checked="${swOn(k)}" data-act="switch" data-k="${k}" aria-label="${l}"><span></span></button>` : `<span class="head-actions"><button type="button" class="switch" role="switch" aria-checked="${swOn(k)}" disabled aria-label="${l}"><span></span></button><span class="needs">Needs Operator</span></span>`}</div>`).join('')}</div></section>
    <div class="grid g2">
      <section class="card"><div class="card-head"><h2>Collection and measures</h2></div>${kv([['Nightly figures', '02:00 in each organisation’s time'], ['Health checks', 'Every 15 minutes'], ['Data kept in', 'Singapore'], ['Kept for', 'The contract plus 24 months, then monthly totals'], ['Hourly staff cost', 'RM45 an hour, for every organisation. Used for “value of time freed”, always shown as an estimate'], ['Demo workspaces', 'Simulated only, never send anything, cleared after 90 days unless kept']], 140)}</section>
      <section class="card"><div class="card-head"><h2>Integration pack</h2></div><p class="small">Everything a developer needs to add a Measurement Link: the contract, examples and a test to run before handing over.</p><div class="code-block" style="margin-top:12px">AX_MEASURE_KEY=ax_msr_… node contract-test/cli.mjs --base https://your-solution/internal/measure/v1</div></section>
    </div>`;
  pages.staff = () => {
    const rights = { Approve: 'Approve', Commercial: 'Commercial (fees and cost)', Measurement: 'Measurement' };
    return `${head({ title: 'Staff', lead: 'REKA staff who use AXLE · Outcomes: their rung, rights and two-step sign-in. Organisation contacts are never listed here.', actions: atLeast('Admin') ? `<button type="button" class="btn primary" data-act="invite">${icon('user-plus', 'sm')}Add staff</button>` : '<span class="head-actions"><button type="button" class="btn primary" disabled>Add staff</button><span class="needs">Needs Admin</span></span>' })}
    <section class="card"><div class="table-wrap"><table><thead><tr><th>Person</th><th>Rung</th><th>Rights</th><th>Two-step sign-in</th><th>Last active</th><th></th></tr></thead><tbody>
      ${Object.values(M.staff).map((x) => `<tr><td><div style="display:flex;gap:10px;align-items:center"><span class="avatar">${x.initials}</span><div><span class="name">${esc(x.name)}</span><span class="sub">${esc(x.note)}</span></div></div></td><td><span class="rung-chip">${esc(x.rung.toUpperCase())}</span></td><td>${x.rights.map((r) => `<span class="pill idle">${esc(rights[r] || r)}</span>`).join(' ')}</td><td>${stChip('ok', 'On')}</td><td class="mono">${x.id === state.role ? 'Now' : dayShort(today()) + ', 09:' + (10 + x.name.length)}</td>
        <td style="text-align:right">${atLeast('Admin') && x.id !== state.role ? '<button type="button" class="btn sm" data-act="staff-change">Change rung</button>' : x.id === state.role ? '<span class="needs">You can’t lower your own rung</span>' : '<span class="needs">Needs Admin</span>'}</td></tr>`).join('')}
    </tbody></table></div></section>
    <section class="card"><h2>The ladder</h2><div class="table-wrap" style="margin-top:10px"><table><tbody>${[['Viewer', 'Read everything except secrets and areas behind a right'], ['Support', 'Plus: acknowledge incidents, add notes and conclusions'], ['Operator', 'Plus: switches, Level 1 R8 actions (run, retry, test, suppress)'], ['Admin', 'Plus: staff, settings, key rotation'], ['Owner', 'Plus: secrets, deletion, two-person approvals']].map(([r, d]) => `<tr><td style="width:130px"><span class="rung-chip">${r.toUpperCase()}</span></td><td>${d}</td></tr>`).join('')}</tbody></table></div>
      <p class="small muted" style="margin-top:10px">Approve and Commercial are rights on top of a rung. Nobody approves a change they proposed.</p></section>`;
  };
  pages.audit = () => {
    const f = (state.auditQ || '').toLowerCase(), list = auditList().filter(([t, w, x]) => !f || (t + ' ' + w + ' ' + x).toLowerCase().includes(f));
    return `${head({ title: 'Audit', lead: 'Every staff action, with who and when. It can’t be edited from AXLE.', actions: '<button type="button" class="btn" data-act="export">Export CSV</button>' })}
    <section class="card" style="padding:14px 18px"><div class="field"><input id="audit-q" placeholder="Search by person, organisation or action" aria-label="Search the audit" value="${esc(state.auditQ || '')}" autocomplete="off"></div></section>
    <section class="card">${list.length ? `<div class="table-wrap"><table><thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead><tbody>${list.slice(0, 60).map(([t, w, x]) => `<tr><td class="mono" style="white-space:nowrap">${esc(t.replace(' 2026,', ','))}</td><td><span class="name">${esc(w.split(' · ')[0])}</span></td><td>${esc(x)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="small muted">Nothing matches.</p>'}</section>`;
  };
  pages.audit.after = () => { const qi = $('#audit-q'); if (qi) qi.addEventListener('input', (e) => { state.auditQ = e.target.value; clearTimeout(state.auditT); state.auditT = setTimeout(() => { render(); const el = $('#audit-q'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 250); }); };
  pages.adoption = () => {
    const pm = mByKey('people'), days = aWindow(state.range), prev = windowDays(state.range, M.addDays(days[0], -1)), wk = weeksOf(aWindow(84));
    const rows = companies().map((c) => { const ps = coProjs(c), t = coTotals(c, days), tp = coTotals(c, prev), v = pm.calc(t), pv = comparable(t, tp) ? pm.calc(tp) : null; return { c, ps, v, ch: v !== null && pv ? chgPct(v, pv) : null }; });
    const stopped = rows.filter((r) => r.ch !== null && r.ch < -20);
    return `${head({ title: 'Adoption', lead: 'How many people use each organisation’s solutions, and who stopped.', actions: rangeSeg() })}
    ${stopped.length ? `<div class="callout warn">${icon('alerts')}<span><b>Use fell by more than a fifth</b> at ${stopped.map((r) => esc(r.c.short)).join(', ')}. Worth a call before the next report.</span></div>` : ''}
    <section class="card"><div class="table-wrap"><table><thead><tr><th>Organisation</th><th class="num">People a day ${q(pm.quality)}</th><th class="num">Change</th><th>12 weeks</th><th class="num">Solutions in use</th></tr></thead><tbody>
      ${rows.map((r) => `<tr class="link" data-go="${r.c.href.slice(1)}" tabindex="0"><td><span class="name">${esc(r.c.name)}</span><span class="sub">${esc(r.c.industry)}</span></td><td class="num">${r.v === null ? '<span class="dash">–</span> <span class="needs">not shared</span>' : nf(r.v, 1)}</td><td class="num">${chgHtml(r.ch)}</td><td>${r.ps.length ? sparkline(wk.map((w) => pm.calc(mergeTotals(r.ps.map((p) => totals(p, w))))), 90, 26) : ''}</td><td class="num">${r.ps.length}</td></tr>`).join('')}
    </tbody></table></div><p class="xs muted" style="margin-top:10px">People are counted once a day by each solution and never added across days.</p></section>`;
  };
  pages.demo = () => `${head({ title: 'Demo', lead: 'Demo data and demo organisations, kept apart from real ones. Nothing here is ever sent or counted.' })}
    <section class="grid g2">
      <div class="card"><div class="card-head"><h2>Demo workspace</h2>${sandbox() ? '<span class="pill info">Open now</span>' : ''}</div><p class="small">A separate workspace of simulated organisations for sales demos, training and rehearsing a first report. Demo studio simulates projects, moves the date and causes problems. Cleared 90 days after its last use.</p>
        <div class="head-actions" style="margin-top:12px"><button type="button" class="btn primary" data-ws="sandbox">Open ${esc(state.sandboxName)}</button><button type="button" class="btn" data-act="tour-start">Watch the guided demo</button><a class="btn" href="#screens">See every screen</a></div></div>
      <div class="card"><div class="card-head"><h2>Example data</h2>${demo() ? '<span class="pill info">Open now</span>' : ''}</div><p class="small">Five invented organisations with a year of figures, approvals and a report, for learning the console. Read-only in spirit: anything you change resets when you leave.</p>
        <div class="head-actions" style="margin-top:12px"><button type="button" class="btn" data-ws="example">Open example data</button></div></div>
    </section>
    <section class="card"><h2>Rules</h2>${kv([['Kept apart', 'Demo organisations never mix with real ones, in lists, totals, Ask, reports or audit'], ['Never sends', 'No emails, report delivery or calls to real solutions'], ['Names', 'Invented by default; a typed real name is allowed and flagged in audit'], ['Live database', `${esc(state.setup.workspace)}: real organisations only`]], 140)}</section>`;
  pages.guide = () => `${head({ title: 'Help', lead: 'How Outcomes measures, and what each label means.' })}
    <div class="grid g3">${[['measured', 'Measured', 'Counted or timed by the solution itself.'], ['derived', 'Derived', 'Worked out only from measured figures, like a rate.'], ['estimated', 'Estimated', 'Uses a sample or an agreed baseline. Always shown with a likely range.']].map(([k, t, d]) => `<div class="card"><div style="margin-bottom:8px">${q(k)}</div><h3>${t}</h3><p class="small" style="margin-top:6px">${d}</p></div>`).join('')}</div>
    <section class="card"><h2>Never a false zero</h2><p class="small" style="margin-top:6px;max-width:70ch">If a solution stops sending data, its figures fade and say why. A missing day is a gap, never a zero. A real zero, like an office closed on Sunday, shows as 0.</p></section>
    <section class="card"><h2>Need help?</h2><p class="small" style="margin-top:6px">Email support@go.antarax.ai and the team will reply.</p></section>`;

  // ------------------------------------------------------------------ DEMO STUDIO (mock only)
  function freshSf() {
    const used = state.orgs.map((o) => o.name), c = SAMPLE_CLIENTS.find((x) => !used.includes(x[0])) || SAMPLE_CLIENTS[state.seq % SAMPLE_CLIENTS.length];
    return { name: c[0], industry: c[1], kind: c[2], project: c[3], sol: c[4], vol: KINDS[c[2]].vol, base: KINDS[c[2]].base.mid, history: 60, approval: 'approved' };
  }
  function studioHtml() {
    if (!state.sf) state.sf = freshSf();
    const f = state.sf, live = state.sims.filter((s) => s.stage === 'collecting');
    if (!state.eventSim || !simById(state.eventSim)) state.eventSim = live[0] ? live[0].id : null;
    const es = simById(state.eventSim);
    return `<div class="scrim" data-act="studio-close"></div><aside class="studio" role="dialog" aria-label="Demo studio">
      <div class="studio-head">${icon('flask')}<h2>Demo studio</h2><span class="pill ai">${esc(state.sandboxName)}</span><button type="button" class="icon-btn" data-act="studio-close" aria-label="Close">${icon('x')}</button></div>
      <div class="studio-body">
        <section class="studio-sec"><h3>${icon('settings', 'sm')}This demo workspace</h3><div class="field"><label for="sb-name">Name</label><input id="sb-name" value="${esc(state.sandboxName)}"><span class="help">For example \u201cDemo for Harapan Foods\u201d before a sales call. Only REKA staff see it. It never sends anything to organisations and is cleared after 90 days unless kept.</span></div></section>
        <section class="studio-sec"><h3>${icon('live', 'sm')}Guided demo</h3><p class="help">Plays a new organisation from nothing to its first report, then measures, analytics and Ask. It clears this demo workspace first.</p><button type="button" class="btn primary" data-act="tour-start">Start the guided demo</button></section>
        <section class="studio-sec"><h3>${icon('plus', 'sm')}Simulate a new project</h3><p class="help">Creates the organisation, project and solution, with daily figures already flowing. Every name and number is invented.</p>
          <div class="field"><label for="sf-name">Organisation</label><input id="sf-name" value="${esc(f.name)}"></div>
          <div class="field"><label for="sf-project">Project</label><input id="sf-project" value="${esc(f.project)}"></div>
          <div class="field"><span class="lab">Kind of work</span><div class="chips">${Object.entries(KINDS).map(([k, x]) => `<button type="button" class="chip" data-sfkind="${k}" aria-pressed="${f.kind === k}">${x.label.split(' ')[0]}</button>`).join('')}</div></div>
          <div class="grid g2" style="gap:10px"><div class="field"><label for="sf-vol">${cap(KINDS[f.kind].nouns)} a weekday</label><input id="sf-vol" type="number" value="${f.vol}"></div><div class="field"><label for="sf-base">Minutes by hand</label><input id="sf-base" type="number" value="${f.base}"><span class="help">0 means no baseline yet</span></div></div>
          <div class="field"><span class="lab">History</span><div class="chips">${[[14, '2 weeks'], [60, '2 months'], [120, '4 months']].map(([v, l]) => `<button type="button" class="chip" data-sfhist="${v}" aria-pressed="${f.history === v}">${l}</button>`).join('')}</div></div>
          <div class="field"><span class="lab">KPIs</span><div class="chips"><button type="button" class="chip" data-sfappr="approved" aria-pressed="${f.approval === 'approved'}">Already approved</button><button type="button" class="chip" data-sfappr="review" aria-pressed="${f.approval === 'review'}">Waiting for approval</button><button type="button" class="chip" data-sfappr="draft" aria-pressed="${f.approval === 'draft'}">Not connected yet</button></div></div>
          <div class="head-actions"><button type="button" class="btn primary" data-act="sf-create">Create project</button><button type="button" class="btn ghost" data-act="sf-three">Add three at once</button></div></section>
        <section class="studio-sec"><h3>${icon('calendar', 'sm')}Simulated date</h3><div class="sim-date">${dayLong(today())}</div><p class="help">Moving forward runs the nightly collection for every approved solution and drafts reports on the 1st.</p>
          <div class="chips"><button type="button" class="chip" data-adv="1">+1 day</button><button type="button" class="chip" data-adv="7">+1 week</button><button type="button" class="chip" data-adv="30">+1 month</button><button type="button" class="chip ${state.playing ? 'warn' : 'ok'}" data-act="play">${state.playing ? 'Pause' : 'Play, a day a second'}</button></div></section>
        <section class="studio-sec"><h3>${icon('alerts', 'sm')}Cause something</h3>
          ${es ? `<div class="field"><label for="ev-sim">Solution</label><select id="ev-sim">${live.map((s) => `<option value="${s.id}" ${s.id === es.id ? 'selected' : ''}>${esc(orgOf(s).name)} · ${esc(s.name)}</option>`).join('')}</select></div>
          <div class="chips"><button type="button" class="chip warn" data-ev="stale">Data stops arriving</button><button type="button" class="chip fault" data-ev="down">Stops answering</button><button type="button" class="chip" data-ev="spike">Volume spike</button><button type="button" class="chip" data-ev="quality">Quality drops</button><button type="button" class="chip" data-ev="manifest">New detail in data</button></div>
          <div class="chips"><button type="button" class="chip ok" data-ev="recover">Recover</button><button type="button" class="chip ok" data-ev="backfill">Recover and fill the gap</button></div>
          <p class="help">Status now: ${STATUS[simStatus(es)][1]}${es.ev.spike ? ' · volume spike on' : ''}${es.ev.quality ? ' · quality drop on' : ''}</p>` : '<p class="help">Create or connect a solution first.</p>'}</section>
        ${exploreStudioSec()}
        <section class="studio-sec"><h3>${icon('x', 'sm')}Start over</h3><div class="head-actions"><button type="button" class="btn sm" data-act="reset-ws">Clear this demo workspace</button></div><p class="help">Your real workspace is never touched.</p></section>
      </div></aside>`;
  }
  function createSimProject(f, quiet) {
    const o = state.orgs.find((x) => x.name === f.name) || newOrg(f.name, f.industry || 'Other');
    const K = KINDS[f.kind];
    const s = newSim(o, { kind: f.kind, project: f.project, sol: f.sol || K.sol, vol: +f.vol || K.vol, history: f.history });
    s.base = +f.base > 0 ? { method: 'sample', mid: +f.base, low: Math.round(+f.base * 0.78), high: Math.round(+f.base * 1.22), n: 25, note: 'Simulated timed sample' } : { method: 'none' };
    if (f.approval !== 'draft') {
      sendSimForApproval(s, { volume: true, quality: true, impact: true }, f.approval === 'approved');
      if (f.approval === 'approved') { s.stage = 'collecting'; s.start = M.addDays(state.simDay, -(f.history - 1)); s.reportScheduled = true; }
    }
    log(`Simulated ${f.project} for ${o.name}`, 'Demo studio');
    if (!quiet) toast(`${f.project} for ${o.name} created.`);
    return s;
  }
  function addThree() {
    const used = state.orgs.map((o) => o.name);
    SAMPLE_CLIENTS.filter((c) => !used.includes(c[0])).slice(0, 3).forEach((c, i) => createSimProject({ name: c[0], industry: c[1], kind: c[2], project: c[3], sol: c[4], vol: KINDS[c[2]].vol, base: i === 2 ? 0 : KINDS[c[2]].base.mid, history: [120, 60, 30][i], approval: 'approved' }, true));
  }
  function applyEvent(s, ev) {
    const d = M.addDays(state.simDay, 1);
    if (ev === 'stale' || ev === 'down') { s.ev.stale = null; s.ev.down = null; s.ev[ev] = M.addDays(state.simDay, -1); log(ev === 'stale' ? `Marked ${s.name} late: no figures for 2 nights` : `Marked ${s.name} not answering: 503 from /health`, 'Collector'); }
    if (ev === 'spike') { s.ev.spike = s.ev.spike ? null : M.addDays(state.simDay, -6); }
    if (ev === 'quality') { s.ev.quality = s.ev.quality ? null : M.addDays(state.simDay, -6); }
    if (ev === 'manifest') { state.myApprovals.unshift({ id: 'a' + state.seq++, simId: s.id, type: 'Mapping', title: 'New detail in the data: a reason', proposer: 'collector', since: now(), status: 'waiting', summary: `${s.name} now shares why ${kindOf(s).nouns} are ${kindOf(s).qual.label}. Your KPIs keep working; the reasons become available for splitting.`, diff: [['Split by', '–', 'reason (6 values)']], evidence: 'Checked: 6 values, no personal data', affects: 'No KPI changes' }); log(`Spotted a new detail in ${s.name}'s data`, 'Collector'); }
    if (ev === 'recover' || ev === 'backfill') {
      const stop = s.ev.stale || s.ev.down;
      if (stop && ev === 'recover') s.gaps.push([stop, state.simDay]);
      s.ev.stale = null; s.ev.down = null;
      log(ev === 'backfill' ? `${s.name} recovered; missing days filled in` : `${s.name} recovered`, 'Collector');
    }
    return d;
  }

  // ------------------------------------------------------------------ GUIDED TOUR (mock only)
  const T = state.tourCtx;
  const tsim = () => simById(T.simId);
  const TOUR = [
    { t: 'Meet Outcomes', d: 'REKA builds AI solutions for organisations. Outcomes shows each organisation what their solution changed. Let’s take a new organisation from nothing to their first report.', go() { setWs('sandbox'); resetWorkspace(true); go('home'); } },
    { t: 'Start tracking: the organisation', d: 'One wizard, four short steps. Type the organisation’s name: pick it if it exists, or add it. The picture on the right builds as you answer.', mark: '#wpanel', go() { state.trk = Object.assign(trkFresh(), { q: 'Harapan Foods', isNew: true, industry: 'Food and beverage' }); go('track'); } },
    { t: 'Name the project', d: 'The project’s name, the kind of work (it steers which KPIs AI suggests), the solution and how it shares its figures.', mark: '#wpanel', go() { state.trk = Object.assign(trkFresh(), { step: 2, q: 'Harapan Foods', isNew: true, industry: 'Food and beverage', name: 'Supplier invoices', kind: 'documents', sol: 'Invoice reader', solTouched: true }); go('track'); } },
    { t: 'Copy the prompt', d: 'Outcomes writes the prompt for the developer, or for Claude Code or Codex. One button copies it and moves on to the connection.', mark: '#wpanel', go() { if (!T.simId && state.trk && state.trk.simId && simById(state.trk.simId)) { T.simId = state.trk.simId; T.orgId = simById(T.simId).orgId; } if (!T.orgId) { const o = newOrg('Harapan Foods', 'Food and beverage'); T.orgId = o.id; log('Added organisation Harapan Foods'); } if (!T.simId) { const s = newSim(state.orgs.find((o) => o.id === T.orgId), { kind: 'documents', project: 'Supplier invoices', sol: 'Invoice reader', vol: 220, history: 14 }); T.simId = s.id; state.focusSim = s.id; state.wiz = freshWizard(); log('Created project Supplier invoices for Harapan Foods'); } wizTo(1); } },
    { t: 'Wait for the connection', d: 'The developer adds a small read-only link, about a day of work. Outcomes listens for it; you can leave and are told when it connects.', mark: '#wpanel', go() { wizTo(2); } },
    { t: 'Connected', d: 'Outcomes checks the link is signed and reads one day of figures; each part of the picture lights up as it passes. Anything that could identify people is held back. Then on to what to measure.', mark: '#wpanel', go() { wizTo(2); setTimeout(() => { if (state.tour === 5) runTests(); }, 300); } },
    { t: 'AI suggests the KPIs', d: 'AI reads the figures and the project, and suggests what to measure and why. People keep or drop each one.', mark: '#wpanel', go() { wizTo(3); } },
    { t: 'Agree the baseline', d: 'Hours saved needs how long the work took by hand. Here, a timed sample of 30 invoices. Below it, everything being sent for approval.', mark: '#wpanel', go() { wizTo(4); Object.assign(state.wiz.baseline, { method: 'sample', mid: 16, low: 12, high: 21, n: 30 }); render(); } },
    { t: 'Send for approval', d: 'Someone other than the person who set it up approves every KPI and the baseline.', go() { if (tsim().stage === 'draft') { wizTo(4); finishWizard(); } else go('sim-' + T.simId); } },
    { t: 'Approved', d: 'Aisyah checks and approves. The first collection runs tonight.', go() { if (tsim().stage === 'review') approveSim(tsim()); go('sim-' + T.simId); } },
    { t: 'First figures', d: 'Overnight, Outcomes collects the last two weeks of figures. KPIs appear straight away, with estimates shown as a likely range.', go() { if (tsim().stage !== 'collecting') advance(1); go('sim-' + T.simId); } },
    { t: 'Five weeks later', d: 'Time moves on. Every night the KPIs update. Watch the trend build.', go() { if (!T.aged) { advance(35); T.aged = true; } state.range = 30; go('sim-' + T.simId); } },
    { t: 'Something breaks', d: 'The solution stops sending data. Figures fade and say why. Nothing turns into a zero, and the project owner is told.', go() { if (!T.broke) { applyEvent(tsim(), 'stale'); T.broke = true; } go('sim-' + T.simId); } },
    { t: 'Back on track', d: 'The developer fixes it. The missing days are collected again, so the record has no gap.', go() { if (!T.fixed) { applyEvent(tsim(), 'backfill'); T.fixed = true; } go('sim-' + T.simId); } },
    { t: 'The monthly report', d: 'Drafted for you from the figures, with how they were measured and the caveats. A person approves it before the organisation sees it.', go() { tsim().reportScheduled = true; go('report-' + T.simId); } },
    { t: 'Across every organisation', d: 'Three more organisations, simulated with their own history. Home shows what needs you across all of them, worst first.', go() { if (!T.three) { addThree(); T.three = true; } state.range = 30; go('home'); } },
    { t: 'More than three numbers', d: 'Every project gets the same library of measures across health, usage, operations, impact and cost, so projects can be compared fairly.', go() { state.solTab = 'measures'; state.bld = null; go('sim-' + T.simId); } },
    { t: 'Add your own measure', d: 'Build a measure from the figures the solution shares, with a live preview. Here, hours saved per person. It goes for approval like any KPI.', mark: '#bld', go() { state.solTab = 'measures'; state.bld = { proj: T.simId, name: 'Hours saved per person', op: 'per', a: 'hours', b: 'people', rate: 2, target: '', aud: 'client' }; go('sim-' + T.simId); setTimeout(() => { const b = $('#bld'); if (b) b.scrollIntoView({ block: 'center' }); }, 60); } },
    { t: 'Standard analytics', d: 'Any measure over time against the period before, by project and by weekday. Rates are always worked out from totals, never averaged.', go() { state.bld = null; state.an = { measure: 'hours', proj: 'all', range: 90 }; go('analytics'); } },
    { t: 'Ask the data', d: 'Ask in plain words. Answers come only from the collected figures, show where each number came from, and never claim a cause.', go() { state.chat = []; go('ask'); askSubmit('Which project improved most this month?'); const k = state.tour; setTimeout(() => { if (state.tour === k) askSubmit('Why did Invoice reader change this week?'); }, reduceMotion ? 10 : 1000); } },
    { t: 'Your turn', d: 'Open Demo studio to create projects, move the date forward or cause problems. Everything updates as you go.', go() { state.studio = true; go('home'); } },
  ];
  function wizTo(n) {
    const s = tsim(); state.focusSim = s.id;
    const w = state.wiz;
    w.method = 'link';
    if (n >= 2 && !w.promptAt) w.promptAt = now();
    if (n >= 3) { w.tested = true; w.tests = wizTests(w, orgOf(s)).map((t) => [t, 'ok']); }
    if (n === 2 && state.tour === 4) { w.tested = false; w.tests = []; }
    if (n >= 4) w.proposals = true;
    w.step = n; w.solName = 'Invoice reader';
    if (n < 3) { state.trk = Object.assign(trkFresh(), { simId: s.id, copied: n > 1 }); go('track-' + s.id); } else go('connect-' + s.id);
  }
  function tourHtml() {
    const i = state.tour, st = TOUR[i];
    return `<div class="tour" role="dialog" aria-label="Guided demo"><div class="bar">${TOUR.map((_, k) => `<span class="${k <= i ? 'on' : ''}"></span>`).join('')}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="mock-tag" style="color:var(--primary-tint-2)">GUIDED DEMO</span><span class="count">${i + 1} of ${TOUR.length}</span></div>
      <h3>${esc(st.t)}</h3><p>${esc(st.d)}</p>
      <div class="tour-nav"><button type="button" class="btn ghost sm" data-act="tour-end">End</button><span class="head-actions">${i > 0 ? '<button type="button" class="btn ghost sm" data-act="tour-back">Back</button>' : ''}<button type="button" class="btn primary sm" data-act="tour-next">${i === TOUR.length - 1 ? 'Finish' : 'Next'}</button></span></div></div>`;
  }
  function tourGo(i) {
    state.tour = i;
    if (state.playing) { clearInterval(state.playing); state.playing = null; }
    state.studio = false;
    TOUR[i].go();
    render();
    const mk = TOUR[i].mark && $(TOUR[i].mark); if (mk) mk.classList.add('tour-mark');
  }
  // ------------------------------------------------------------------ ALL SCREENS (mock only)
  // Every screen in the order people meet it, so the whole product can be judged for convenience in one sitting.
  // Setup screens open in the demo workspace with the guided demo at that step; the rest open in the example workspace.
  const SCREENS = [
    ['Setting up a project, in order', 'Opens in the demo workspace, with the guided demo at that step. Your own workspace is not touched.', true, [
      ['home', 'Overview, first use', 'The checklist from nothing to a first report', 0],
      ['organisation', 'Start tracking: organisation', 'Pick one, or type a new name to add it', 1],
      ['projects', 'Start tracking: project', 'Name, kind of work, solution and how it shares', 2],
      ['copy', 'Start tracking: prompt', 'One button copies it and moves on', 3],
      ['clock', 'Start tracking: connection', 'Listening for the link; you can leave', 4],
      ['link', 'Connected', 'Each check lights up; what it shares', 5],
      ['target', 'What to measure', 'AI suggests KPIs; keep or drop each', 6],
      ['savings', 'Baseline and send', 'Time by hand, and what goes for approval', 7],
      ['clock', 'Waiting for approval', 'The solution page says what happens next', 8],
      ['check', 'Approved', 'A second person approves; collection starts tonight', 9],
      ['analytics', 'First figures', 'KPIs and the trend once figures arrive', 10],
      ['alerts', 'When something breaks', 'Figures fade and say why; never a zero', 12],
      ['reports', 'The monthly report', 'Drafted for you; a person approves it', 14],
    ]],
    ['Client data, every week', 'Opens in the example workspace: five invented organisations.', false, [
      ['analytics', 'Results', 'Every organisation’s figures', 'results'],
      ['organisation', 'One organisation’s results', 'Figures, summary, reports, client context', 'results-contoh-logistik'],
      ['box', 'A solution', 'Where the time goes; measures; Explore', 'solution-doc-workflow'],
      ['reports', 'Reports', 'Every report, by organisation', 'reports'],
      ['documents', 'A client report', 'What the organisation receives', 'report'],
      ['check', 'Approvals', 'Nothing counts until someone else approves', 'approvals'],
      ['documents', 'Client context', 'What organisations told and gave you', 'context'],
      ['analytics', 'Analytics', 'Any measure over time', 'analytics'],
      ['ask', 'Ask', 'Questions in plain words', 'ask'],
    ]],
    ['Managing Outcomes', 'Opens in the example workspace.', false, [
      ['overview', 'Overview', 'What needs a person, worst first', 'home'],
      ['organisation', 'Organisations', 'Stage, readiness, agreement', 'organisations'],
      ['organisation', 'An organisation’s account', 'Readiness, projects, notes, audit', 'organisation-contoh-logistik'],
      ['people', 'Adoption', 'Who uses each solution, and who stopped', 'adoption'],
      ['flask', 'Demo', 'Demo workspaces and Demo studio', 'demo'],
      ['settings', 'Settings', 'Switches, collection, retention', 'settings'],
      ['trace', 'Audit', 'Every action, never editable', 'audit'],
      ['people', 'Staff', 'The ladder and rights', 'staff'],
    ]],
    ['R8: the machinery', 'Opens in the example workspace, in R8 mode.', false, [
      ['monitoring', 'R8 overview', 'One word for the platform', 'r8'],
      ['alerts', 'Incidents', 'What broke and who is on it', 'incidents'],
      ['health', 'Troubleshoot', 'Evidence in layers, Level 1 actions', 'troubleshoot-quote-drafter'],
      ['clock', 'Jobs', 'Every background job', 'jobs'],
      ['api', 'Providers', 'Outside services', 'providers'],
      ['system', 'Services', 'Outcomes’ own parts', 'services'],
      ['settings', 'Configuration', 'Set or missing, never values', 'configuration'],
      ['trace', 'Operations audit', 'Every R8 action, with why', 'ops-audit'],
      ['link', 'Measurement links', 'Each organisation’s link and its test', 'links'],
    ]],
  ];
  const NOT_DRAWN = ['Members', 'Invitations', 'Requests', 'Support', 'Models & keys', 'AI usage', 'Live trace', 'Prompts & quality', 'Plans & features', 'Errors', 'Alerts', 'Backups', 'Access'];
  pages.screens = () => `${head({ title: 'All screens', kind: 'mock', lead: 'Every screen in the mock, in the order people meet them. Open any one to judge whether it is convenient to use.', state: `Mock only · ${SCREENS.reduce((a, g) => a + g[3].length, 0)} screens` })}
    ${SCREENS.map(([h, sub, flow, items], g) => `<section class="grid" style="gap:10px"><div><h2>${h}</h2><p class="small muted">${sub}</p></div>
      <div class="scr-grid${flow ? ' flow' : ''}">${items.map(([ic, t, d], i) => `<button type="button" class="scr" data-scr="${g}:${i}"><span class="scr-n">${flow ? i + 1 : icon(ic, 'sm')}</span><span class="scr-t">${flow ? `${icon(ic, 'sm')} ` : ''}${t}</span><span class="scr-d">${d}</span></button>`).join('')}</div></section>`).join('')}
    <section class="card flat"><h3>Standard AXLE pages not drawn in this mock</h3><p class="small muted" style="margin-top:4px">They appear in the menu in grey. Outcomes uses them as the AXLE standard defines them.</p><div class="chips" style="margin-top:10px">${NOT_DRAWN.map((x) => `<span class="pill idle">${x}</span>`).join('')}</div></section>`;
  function tourJump(n) {
    state.studio = false;
    for (let j = 0; j < n; j++) { state.tour = j; TOUR[j].go(); }
    tourGo(n);
  }
  function screenOpen(key) {
    const [g, i] = key.split(':').map(Number), it = SCREENS[g] && SCREENS[g][3][i]; if (!it) return;
    if (typeof it[3] === 'number') { tourJump(it[3]); return; }
    state.tour = null; state.studio = false;
    if (!demo()) setWs('example');
    if (/^solution-/.test(it[3])) state.solTab = 'outcomes';
    go(it[3]);
  }
  function resetWorkspace(forTour) {
    if (state.playing) { clearInterval(state.playing); state.playing = null; }
    state.orgs = []; state.sims = []; state.myApprovals = []; state.myAudit = []; state.simReports = {}; state.focusSim = null; state.simDay = START_DAY; state.wiz = freshWizard(); state.sf = null; state.eventSim = null;
    Object.keys(T).forEach((k) => delete T[k]);
    if (!forTour) state.tour = null;
  }

  // ------------------------------------------------------------------ search palette
  function openPalette() {
    const el = $('#palette'); if (!el) return;
    const items = [['Home', '#home'], ['Organisations', '#organisations'], ['Approvals', '#approvals'], ['Reports', '#reports'], ['Settings', '#settings'], ['Connect a solution', '#connect'], ['New organisation', '#new-organisation']]
      .concat(demo() ? M.orgs.map((o) => [o.name, '#organisation-' + o.id]).concat(Object.values(M.solutions).filter((s) => s.status !== 'not_connected').map((s) => [`${s.name} · ${orgById(s.org).short}`, '#solution-' + s.id])) : state.orgs.map((o) => [o.name, '#organisation-' + o.id]).concat(state.sims.map((s) => [`${s.name} · ${orgOf(s).name}`, '#sim-' + s.id])));
    el.hidden = false;
    el.innerHTML = `<div class="scrim" data-act="close-palette"></div><div class="card" role="dialog" aria-label="Search" style="position:fixed;z-index:60;top:12vh;left:50%;transform:translateX(-50%);width:min(560px,calc(100vw - 32px));padding:10px;box-shadow:var(--shadow-lg)"><div class="field"><input id="pal-q" placeholder="Search organisations, projects, solutions" aria-label="Search" autocomplete="off"></div><div id="pal-list" style="max-height:50vh;overflow:auto;margin-top:6px;display:grid;gap:2px"></div></div>`;
    const draw = (qv) => { $('#pal-list').innerHTML = items.filter(([l]) => l.toLowerCase().includes(qv.toLowerCase())).slice(0, 10).map(([l, h]) => `<a href="${h}" style="padding:10px 12px;border-radius:10px;color:var(--ink);text-decoration:none;display:block">${esc(l)}</a>`).join('') || '<p class="small muted" style="padding:10px">Nothing matches.</p>'; };
    draw(''); const inp = $('#pal-q'); inp.focus();
    inp.addEventListener('input', () => draw(inp.value));
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const a = $('#pal-list a'); if (a) { closePalette(); location.hash = a.getAttribute('href'); } } });
  }
  function closePalette() { const el = $('#palette'); if (el) { el.hidden = true; el.innerHTML = ''; } }

  // ------------------------------------------------------------------ router
  // Old addresses (before organisations were called organisations) still work: they redirect to the new ones.
  const OLD = { clients: 'organisations', 'new-client': 'new-organisation' };
  function parse() {
    const was = (location.hash || '').slice(1);
    let h = was || (state.signedIn ? 'home' : 'signin');
    const old = /^(?:client|org)-(.+)$/.exec(h);
    if (old) h = 'organisation-' + old[1]; else if (OLD[h]) h = OLD[h];
    if (was && h !== was) { try { history.replaceState(null, '', '#' + h); } catch (err) { /* file pages may refuse; the alias still works */ } }
    for (const p of ['organisation', 'results', 'solution', 'sim', 'connect', 'track', 'report', 'troubleshoot']) if (h.startsWith(p + '-')) return [p, h.slice(p.length + 1), h];
    return [h, null, h];
  }
  let last = '';
  const TITLES = { results: 'Results', analytics: 'Analytics', ask: 'Ask', signin: 'Sign in', welcome: 'Welcome', home: 'Overview', organisations: 'Organisations', 'new-organisation': 'New organisation', 'new-project': 'New project', connect: 'Connect a solution', approvals: 'Approvals', reports: 'Reports', report: 'Report', settings: 'Settings', guide: 'AXLE guide', adoption: 'Adoption', demo: 'Demo', audit: 'Audit', staff: 'Staff', r8: 'Overview', incidents: 'Incidents', troubleshoot: 'Troubleshoot', jobs: 'Jobs', providers: 'Providers', services: 'Services', configuration: 'Configuration', 'ops-audit': 'Operations audit', links: 'Measurement links', context: 'Client context', screens: 'All screens', track: 'Start tracking' };
  // "How this page works" for the standard pages (SPEC §3.6). Pages may pass their own.
  const HOW = {
    home: 'Start with <b>Needs a person</b>: each row says what is wrong and links to the fix; a technical problem opens Troubleshoot in R8. Every figure is worked out from the solutions’ daily figures and opens the list behind it. Hours saved and value are estimates against agreed baselines, always shown with a likely range. Fees need the Commercial right; without it you see a dash, never a zero.',
    organisations: 'The strip above the list counts organisations by state; click one to filter. Search covers organisations and their projects. Sort and group are kept while you move around. Each row opens the organisation.',
    approvals: 'Every KPI, baseline, measure, mapping and report waits here for someone other than the person who proposed it. Approving or rejecting asks for a reason and is recorded.',
    reports: 'Reports are drafted on the 1st once a month of figures is in. Nothing reaches an organisation until a second person approves it.',
    r8: 'One word for the whole platform, then what needs an operator, worst first. Each row opens Troubleshoot. R8 words stay in R8; the Dashboard says “not answering” and links here.',
    jobs: 'Every background job with its schedule in plain words, its last run and what failed. Run now and Retry failures are Level 1 actions: they ask for a reason and go to the operations audit.',
    providers: 'Every outside service Outcomes depends on. Test provider makes one real call and shows the result and the time. Keys and secrets are never shown here; they live in the vault.',
    context: 'Anyone with Support or above adds what an organisation told them or gave them: a short summary in their words, plus documents, photos, voice notes and links, by the person’s role, never their name. AI reads the attachments, hides personal details, and you check what it read before saving; the mock reads plain text files only. Entries marked for AI feed Explore impact and Ask for that organisation only, as quoted words, never as instructions or figures. Nothing here reaches the organisation. Archive an entry to stop using it; the audit keeps who added or changed it.',
    links: 'Each organisation’s solution exposes a read-only Measurement Link. This page shows each link’s state, its last good collection, the nightly contract test and its key’s age. A failing link opens Troubleshoot.',
  };
  function render() {
    let [page, arg, raw] = parse();
    if (!state.signedIn) { page = 'signin'; raw = 'signin'; } else if (!state.mode) { page = 'welcome'; raw = 'welcome'; } else if (page === 'signin' || page === 'welcome') { page = 'home'; raw = 'home'; }
    if (page === 'organisation' && !coById(arg)) { page = 'organisations'; raw = page; }
    if (page === 'solution' && (!demo() || !M.solutions[arg] || M.solutions[arg].status === 'not_connected')) { page = 'home'; raw = page; }
    if (page === 'sim' && (demo() || !simById(arg))) { page = demo() ? 'home' : 'organisations'; raw = page; }
    if (page === 'report' && arg && (demo() || !simById(arg))) { page = 'reports'; raw = page; }
    if (page === 'connect' && demo()) { setWs('real'); }
    if (page === 'connect' && state.mode) {
      const cs = (arg && simById(arg)) || simById(state.focusSim) || state.sims.find((x) => x.stage === 'draft');
      if (cs && cs.stage === 'draft' && (cs.id !== state.focusSim || state.wiz.step < 3)) {
        if (cs.id !== state.focusSim) { state.focusSim = cs.id; state.wiz = freshWizard(); }
        page = 'track'; arg = cs.id; raw = 'track-' + cs.id;
        try { history.replaceState(null, '', '#' + raw); } catch (err) { /* the page still shows the wizard */ }
      }
    }
    if (page === 'new-project' && state.mode) { state.trk = Object.assign(trkFresh(), { step: state.newProjOrg ? 2 : 1, orgId: state.newProjOrg || null }); state.newProjOrg = null; page = 'track'; arg = null; raw = 'track'; try { history.replaceState(null, '', '#track'); } catch (err) { /* fine */ } }
    if (!pages[page]) { page = 'home'; raw = 'home'; }
    if (state.playing && /^(new-|connect)/.test(page)) { clearInterval(state.playing); state.playing = null; }
    const root = $('#root');
    const scroll = window.scrollY;
    if (state.mode && routeClient(raw)) { const c = coById(routeClient(raw)); if (c) rememberClient(c); }
    curTitle = ''; curPage = page;
    root.innerHTML = (page === 'signin' || page === 'welcome') ? pages[page]() : appShell(raw, pages[page](arg));
    document.title = (page === 'signin' || page === 'welcome') ? `${TITLES[page]} · AXLE · Outcomes` : `${curTitle || TITLES[page] || 'Outcomes'} · AXLE · Outcomes`;
    if (pages[page].after) pages[page].after(arg);
    if (last !== raw) { window.scrollTo(0, 0); last = raw; } else window.scrollTo(0, scroll);
  }

  // ------------------------------------------------------------------ events
  const closePops = (except) => ['#new-pop', '#bell-pop', '#user-pop', '#ws-pop', '#scope-pop'].forEach((s) => { const p = $(s); if (p && s !== except) p.hidden = true; });
  const toggle = (sel) => { const p = $(sel); closePops(sel); p.hidden = !p.hidden; };
  const readSf = () => { const f = state.sf; if (!f) return; ['name', 'project', 'vol', 'base'].forEach((k) => { const el = $('#sf-' + k); if (el) f[k] = el.type === 'number' ? +el.value : el.value; }); };
  const acts = {
    signin: () => { state.signedIn = true; location.hash = '#welcome'; render(); },
    'ws-next': () => { state.setup.step = 3; render(); toast('Invites sent.'); },
    'ws-skip': () => { state.setup.step = 3; render(); },
    'add-invite': () => { state.setup.invites.push({ email: '', role: 'Analyst' }); render(); },
    'new-menu': () => toggle('#new-pop'), bell: () => toggle('#bell-pop'), user: () => toggle('#user-pop'),
    palette: openPalette, 'close-palette': closePalette,
    signout: () => { state.signedIn = false; state.mode = null; state.setup.step = 1; state.tour = null; state.studio = false; location.hash = '#signin'; render(); },
    'switch-mode': () => { setWs(demo() ? 'real' : 'example'); state.tour = null; location.hash = '#home'; render(); toast(demo() ? 'Example data opened.' : 'Back to your workspace.'); },
    'ws-menu': () => toggle('#ws-pop'),
    scope: () => toggle('#scope-pop'),
    switch: (d) => { const k = d.k, on = swOn(k), l = SWITCHES.find((x) => x[0] === k)[1]; askReason({ title: `${on ? 'Switch off' : 'Switch on'} ${l.toLowerCase()}`, confirm: `${on ? 'Switch off' : 'Switch on'} ${l.toLowerCase()}`, body: on ? 'A banner shows on every page until it is back on.' : '', what: on ? 'Switched off' : 'Switched on', target: l, done: `${l} ${on ? 'switched off' : 'switched on'}.`, run: () => { state.switchesOff = state.switchesOff || {}; state.switchesOff[k] = on; } }); },
    'staff-change': () => toast('In the real product this asks which rung, and a reason. Rungs change only with Admin.'),
    'reason-cancel': () => { closeReason(); },
    'r8-ack': (d) => askReason({ title: `Acknowledge ${d.id}`, confirm: `Acknowledge ${d.id}`, level: 1, body: 'Says someone is on it. The incident stays open until it recovers.', what: 'Acknowledged incident', target: d.id, done: `Acknowledged ${d.id}.`, run: () => { state.ack = state.ack || {}; state.ack[d.link] = true; } }),
    'r8-retry': (d) => { const L = r8Model().links.find((l) => l.id === d.id); askReason({ title: `Retry collection for ${L.name}`, confirm: 'Retry collection now', level: 1, body: 'Reads the last missing day again, now.', what: 'Retried collection', target: L.name, done: L.st === 'fault' ? `Retried: ${L.name} still answers 503.` : `Retried: still no figures from ${L.name} for the day.` }); },
    'r8-test': (d) => { const L = r8Model().links.find((l) => l.id === d.id); askReason({ title: `Run the contract test on ${L.name}`, confirm: 'Run the contract test', level: 1, what: 'Ran the contract test', target: L.name, done: L.st === 'fault' ? 'Contract test: 3 of 17 checks ran, then the link stopped answering.' : 'Contract test: 17 of 17 passed.' }); },
    'r8-suppress': (d) => { const L = r8Model().links.find((l) => l.id === d.id); askReason({ title: `Suppress alerts for ${L.name}`, confirm: 'Suppress for 1 hour', level: 1, body: 'Alerts stop for one hour, then start again by themselves. A suppression always ends.', what: 'Suppressed alerts for 1 hour', target: L.name, done: 'Alerts suppressed until 15:30.', run: () => { state.suppress = state.suppress || {}; state.suppress[L.id] = '15:30 MYT'; } }); },
    'r8-run': (d) => { const j = r8Model().jobs.find((x) => x.id === d.id); askReason({ title: `Run ${j.name} now`, confirm: 'Run now', level: 1, what: 'Ran job now', target: j.name, done: j.failed ? `${j.name} ran: ${j.processed} of ${j.eligible} processed, ${j.failed} failed again.` : `${j.name} ran: ${j.processed} of ${j.eligible} processed.` }); },
    'r8-retryjob': (d) => { const j = r8Model().jobs.find((x) => x.id === d.id); askReason({ title: `Retry the ${j.failed} failed item${j.failed === 1 ? '' : 's'}`, confirm: 'Retry failures', level: 1, body: 'Runs only the failed items, not the whole job.', what: 'Retried failed items', target: j.name, done: `Retried ${j.failed} item${j.failed === 1 ? '' : 's'}: still failing.` }); },
    'r8-pause': (d) => { const j = r8Model().jobs.find((x) => x.id === d.id), on = (state.paused || {})[j.id]; askReason({ title: `${on ? 'Resume' : 'Pause'} ${j.name}`, confirm: on ? 'Resume' : 'Pause', level: 1, body: on ? '' : 'Paused jobs show a banner on every page until they are resumed.', what: on ? 'Resumed job' : 'Paused job', target: j.name, done: `${j.name} ${on ? 'resumed' : 'paused'}.`, run: () => { state.paused = state.paused || {}; state.paused[j.id] = !on; } }); },
    'r8-ptest': (d) => { const x = r8Model().providers.find((p) => p.id === d.id); opsLog().unshift({ at: now(), who: me().name, rung: rungOf(me()), what: 'Tested provider', target: x.name, reason: 'Test provider', level: 1 }); state.provTest = state.provTest || {}; state.provTest[x.id] = { ok: true, ms: Math.round(x.ms * (0.8 + 0.4 * Math.random())), at: now() }; render(); toast(`${x.name} answered.`); },
    'r8-rotate': (d) => askReason({ title: d.name.replace('Measurement key · ', 'Rotate the key for '), confirm: 'Rotate key', level: 1, body: 'Makes a new key. The solution accepts both for 7 days (AX_MEASURE_KEY_NEXT), then the old one stops working.', what: 'Rotated measurement key', target: d.name.replace('Measurement key · ', ''), done: 'New key made. Send it to the developer from the vault; the old one works for 7 more days.' }),
    'save-conc': (d) => { state.conclusions = state.conclusions || {}; state.conclusions[d.id] = ($('#conc') || {}).value || ''; log('Saved a troubleshooting conclusion'); toast('Conclusion saved.'); },
    'nav-all': () => { const mode = axMode(parse()[2]); const groups = navModel()[mode].map((g) => g[0]); const m = state.navClosed[mode]; const allOpen = groups.every((g) => !m[g]); groups.forEach((g) => { m[g] = allOpen; }); render(); },
    'w-next': wizardNext,
    'w-back': () => { state.wiz.step--; render(); },
    'copy-devlink': () => { const s = wizSim(), u = `https://outcomes.reka.example/connect/dev/${s ? s.id : ''}`; const done = () => toast('Copied. The developer sees the brief, their key once, and the test result as soon as the link answers.'); try { navigator.clipboard.writeText(u).then(done, done); } catch (err) { done(); } },
    'copy-tpl': () => { const el = $('#w-tpl'); const done = () => toast('Columns copied. Paste them into the first row of the sheet.'); try { navigator.clipboard.writeText(el ? el.textContent : '').then(done, done); } catch (err) { done(); } },
    'w-pickfile': () => { const f = $('#w-file'); if (f) f.click(); },
    'w-examplefile': () => { state.wiz.sheetFile = 'example-week.csv'; runTests(); },
    'w-devdone': () => { runTests(); },
    'trk-next': () => trkNext(),
    'trk-back': () => { const t = state.trk, n = trkStep(); if (n === 2) t.step = 1; else if (n === 4) { state.wiz.step = 1; t.copied = false; } render(); },
    'trk-new': () => { state.trk = trkFresh(); go('track'); },
    'trk-copy': () => {
      const t = state.trk, w = state.wiz, s = wizSim(); if (!s) return;
      copyText(w.method === 'sheet' ? sheetTemplate(kindOf(s)) : devPrompt(s), w.method === 'sheet' ? 'Columns copied. Share them with whoever fills in the sheet.' : 'Prompt copied. Send it to the developer.');
      if (w.method === 'link') { w.promptAt = now(); log(`Copied the developer prompt for ${w.solName || s.name}`); }
      t.copied = true; render();
      setTimeout(() => { if (state.trk === t && w.step === 1 && /^#track/.test(location.hash)) { w.step = 2; render(); } }, reduceMotion ? 0 : 900);
    },
    'trk-measure': () => { const s = wizSim(); if (!s) return; state.wiz.step = 3; go('connect-' + s.id); },
    'w-test': () => { const w = state.wiz, u = $('#w-url'); if (u) w.url = u.value.trim(); if (!/^https:\/\/\S+\.\S+/.test(w.url)) { if (u) { u.setAttribute('aria-invalid', 'true'); u.focus(); } toast('The address must start with https.'); return; } runTests(); },
    'copy-prompt': () => {
      const fallback = () => { const r = document.createRange(); r.selectNodeContents($('#dev-prompt')); getSelection().removeAllRanges(); getSelection().addRange(r); toast('Selected. Press Ctrl C to copy.'); };
      try { navigator.clipboard.writeText($('#dev-prompt').textContent).then(() => toast('Copied. Send it to the developer.'), fallback); } catch (err) { fallback(); }
    },
    'add-gap': () => toast('Added to the developer’s list.'),
    'proj-for': (d) => { state.trk = Object.assign(trkFresh(), { step: 2, orgId: d.org }); go('track'); },
    'sim-approve': (d) => { approveSim(simById(d.sim)); render(); toast('Aisyah approved the KPIs.'); },
    'sim-pull': (d) => { collectNow(simById(d.sim)); render(); toast('First figures collected.'); },
    'schedule-report': (d) => { const s = simById(d.sim) || firstSim(); s.reportScheduled = true; log(`Scheduled the ${s.project.cadence.toLowerCase()} report for ${orgOf(s).name}`); render(); toast('Report scheduled.'); },
    'approve-sim-report': (d) => { const s = simById(d.sim), ym = lastFullMonth(); state.simReports[s.id + ym] = true; log(`Approved the ${monthName(ym)} report for ${orgOf(s).name}`); render(); toast('Report approved.', () => { delete state.simReports[s.id + ym]; render(); }); },
    'to-month-end': () => { const t = M.toDate(today()); const target = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 1)).toISOString().slice(0, 10); advance(Math.round((M.toDate(target) - t) / 864e5)); render(); toast(`Moved to ${day(today())}.`); },
    'approve-report': () => { state.reportApproved = true; const a = state.approvals.find((x) => x.report); if (a) a.status = 'approved'; log('Approved the September report for Contoh Logistik'); render(); toast('Report approved.', () => { state.reportApproved = false; if (a) a.status = 'waiting'; auditList().shift(); render(); }); },
    'send-report': () => toast(sandbox() ? 'Demo workspaces never send anything to organisations.' : 'Email delivery comes in phase 2. The PDF is ready.'),
    'approve-narrative': () => { state.narrativeApproved = true; log('Approved the September summary for Contoh Logistik'); render(); toast('Summary approved.', () => { state.narrativeApproved = false; auditList().shift(); render(); }); },
    retry: () => toast('Retrying now.'),
    invite: () => toast('Invites come from your REKA account directory.'),
    studio: () => { if (!sandbox()) { setWs('sandbox'); state.studio = true; location.hash = '#home'; render(); toast('Opened the demo workspace. Your real workspace is unchanged.'); return; } state.studio = !state.studio; render(); },
    'studio-close': () => { readSf(); state.studio = false; render(); },
    'sf-create': () => { readSf(); const s = createSimProject(state.sf); state.sf = null; state.eventSim = s.stage === 'collecting' ? s.id : state.eventSim; go(s.stage === 'draft' ? 'organisation-' + s.orgId : 'sim-' + s.id); },
    'sf-three': () => { addThree(); state.sf = null; go('home'); toast('Three projects added.'); },
    play: () => { if (state.playing) { clearInterval(state.playing); state.playing = null; render(); return; } state.playing = setInterval(() => { advance(1); render(); }, 1000); render(); },
    'reset-ws': () => { resetWorkspace(false); state.studio = false; go('home'); toast('Workspace cleared.'); },
    'bld-open': (d) => { state.bld = { proj: d.proj, name: '', op: 'ratio', a: 'straight', b: 'handled', rate: 2, target: '', aud: 'team' }; render(); const b = $('#bld'); if (b) b.scrollIntoView({ block: 'center' }); },
    'bld-close': () => { state.bld = null; render(); },
    'bld-save': (d) => {
      const b = state.bld, pj = projById(d.proj);
      if (!b.name.trim()) { const el = $('#bld-name'); el.setAttribute('aria-invalid', 'true'); el.placeholder = 'Give the measure a name first'; el.focus(); return; }
      const cm = { id: 'c' + state.seq++, name: b.name.trim(), op: b.op, a: b.a, b: b.op === 'ratio' || b.op === 'per' ? b.b : null, rate: b.rate, target: b.target, aud: b.aud, status: 'waiting', by: state.role };
      pj.custom().push(cm);
      pj.approvals().unshift({ id: 'a' + state.seq++, cmId: cm.id, projId: pj.id, projOrg: pj.org, type: 'Measure', title: cm.name, proposer: state.role, since: now(), status: 'waiting', summary: `A new measure for ${pj.sol}, built from the figures it already shares.`, fields: [['Worked out as', customFormula(cm)], ['Kind', customMeta(cm).quality], ['Who sees it', cm.aud === 'client' ? 'Staff and organisation' : 'Staff only']].concat(cm.target ? [['Target', cm.target]] : []), evidence: `Preview checked on ${day(M.addDays(endDay(), 1))}`, affects: `${pj.sol} measures${cm.aud === 'client' ? ' and the organisation report' : ''}` });
      log(`Proposed the measure \u201c${cm.name}\u201d for ${pj.sol}`);
      state.bld = null; render(); toast('Measure sent for approval.');
    },
    'cm-approve': (d) => { const pj = projById(d.proj), cm = pj.custom().find((x) => x.id === d.cm); cm.status = 'live'; const a = pj.approvals().find((x) => x.cmId === cm.id); if (a) a.status = 'approved'; log(`Approved the measure \u201c${cm.name}\u201d`, 'Aisyah Rahman'); render(); toast('Aisyah approved the measure.'); },
    'ask-clear': () => { state.chat = []; render(); },
    'an-ask': () => { const m = mByKey(state.an.measure), c = state.an.proj.startsWith('c:') ? coById(state.an.proj.slice(2)) : null; askSubmit(c ? `How is ${c.short} doing this month?` : `Which project improved most on ${m.name.toLowerCase()} this month?`); },
    export: () => toast('Exports download in the real product. The mock can\u2019t save files.'),
    'tour-start': () => { tourGo(0); },
    'ask-client': (d) => askSubmit(`How is ${d.name} doing this month?`),
    'to-ctx': (d) => { state.coFor = d.org + 'results'; state.resTab = 'context'; state.audience = 'staff'; go('results-' + d.org); },
    'ctx-pick': (d) => { const el = $('#' + d.for); if (el) el.click(); },
    'ctx-rec': () => { ctxRecord(); },
    'ctx-link': () => { ctxReadDraft(); state.ctxLinkOpen = !state.ctxLinkOpen; render(); const el = $('#ctx-link-url'); if (el) el.focus(); },
    'ctx-link-add': () => {
      const u = ($('#ctx-link-url').value || '').trim(), l = ($('#ctx-link-label').value || '').trim(), dr = ctxReadDraft();
      let host = ''; try { const p = new URL(u); if (!/^https?:$/.test(p.protocol)) throw new Error('x'); host = p.hostname; } catch (err) { $('#ctx-link-url').setAttribute('aria-invalid', 'true'); $('#ctx-link-url').focus(); toast('Paste a full link, starting https://'); return; }
      if (dr.items.length >= CTX_LIMITS.files) { toast(`${CTX_LIMITS.files} attachments to an entry at most.`); return; }
      dr.items.push({ id: 'ci' + state.seq++, type: 'link', name: l || host, url: u, meta: host, status: 'ready', extract: null }); state.ctxLinkOpen = false; render();
    },
    'ctx-att-rm': (d) => { const dr = ctxReadDraft(), x = dr.items.find((i) => i.id === d.id); if (x && x.url && x.url.startsWith('blob:')) URL.revokeObjectURL(x.url); dr.items = dr.items.filter((i) => i.id !== d.id); render(); },
    'ctx-draft-sum': () => {
      const dr = ctxReadDraft(), parts = dr.items.filter((x) => x.extract).map((x) => x.extract.split(/(?<=[.!?])\s+/).slice(0, 2).join(' '));
      let t = parts.join(' '); if (t.length > 400) t = t.slice(0, 397).replace(/\s+\S*$/, '') + '…';
      dr.text = dr.text && dr.text.trim() ? dr.text.trim() + ' ' + t : t; render(); const el = $('#ctx-text'); if (el) el.focus(); toast('Drafted from the attachments. Check it says what they meant.');
    },
    'ctx-ai': (d) => { const e = ctxAll().find((x) => x.id === d.id); if (!e) return; e.ai = !e.ai; const c = coById(e.org); log(`${e.ai ? 'Let AI use' : 'Stopped AI using'} a client context note from ${c ? c.short : e.org} (${e.from})`); render(); toast(e.ai ? 'AI may use this note.' : 'AI won’t use this note.'); },
    'ctx-archive': (d) => { const e = ctxAll().find((x) => x.id === d.id); if (!e) return; e.archived = true; const c = coById(e.org); log(`Archived a client context note from ${c ? c.short : e.org} (${e.from})`); render(); toast('Archived. AI no longer uses it.', () => { e.archived = false; render(); }); },
    'ctx-explore': (d) => {
      const e = ctxAll().find((x) => x.id === d.id), c = e && coById(e.org); if (!c) return;
      const sols = coSolutions(c).filter((x) => x.proj && x.href), sol = sols.find((x) => x.id === e.proj) || sols[0]; if (!sol) return;
      const proj = sol.proj, xs = xpStore(proj, xpInfo(proj));
      xs.brief.q = e.text; xs.brief.focus = e.tags.slice(); xs.brief.useCtx = true;
      xpRun(proj, xs); state.solTab = 'explore'; go(sol.href.slice(1)); toast(`Suggestions for ${sol.name}, from what the ${e.from.toLowerCase()} said.`);
    },
    'reports-for': (d) => { state.repFor = { k: repKey(), id: d.org }; go('reports'); },
    'cf-reset': () => { state.cf = { show: 'all', sort: state.cf.sort, q: '' }; render(); },
    'tour-next': () => { if (state.tour >= TOUR.length - 1) { state.tour = null; render(); toast('Demo finished. Demo studio is yours.'); return; } tourGo(state.tour + 1); },
    'tour-back': () => tourGo(state.tour - 1),
    'tour-end': () => { state.tour = null; render(); },
  };
  document.addEventListener('click', (e) => {
    if (e.target.id === 'scrim') { $('#sidebar').classList.remove('open'); e.target.hidden = true; return; }
    if (!e.target.closest('.rel')) closePops();
    if (e.target.closest('[data-stop]')) return;
    const cg = e.target.closest('[data-cfshow-go]'); if (cg) { state.cf = Object.assign(state.cf || { sort: 'needs', q: '' }, { show: cg.dataset.cfshowGo }); }
    if (e.target.closest('#pal-list a')) { closePalette(); return; }
    const t = e.target.closest('button, [data-go], [data-act], [data-anpick], [data-jobsel], [data-provsel]');
    if (!t) return;
    const d = t.dataset;
    if (d.range) { state.range = +d.range; render(); return; }
    if (d.anrange) { state.an.range = +d.anrange; render(); return; }
    if (d.anpick) { state.an.proj = state.an.proj === d.anpick ? 'all' : d.anpick; render(); return; }
    if (d.anby) { state.an.by = d.anby; render(); return; }
    if (d.anProj && t.tagName === 'A') { state.an = Object.assign(state.an || { measure: 'hours', range: 90 }, { proj: d.anProj }); return; }
    if (d.askq) { askSubmit(d.askq); return; }
    if (d.bop) { state.bld.op = d.bop; if ((d.bop === 'ratio' || d.bop === 'per') && !state.bld.b) state.bld.b = 'handled'; render(); return; }
    if (d.baud) { state.bld.aud = d.baud; render(); return; }
    if (d.aud) { state.audience = d.aud; render(); return; }
    if (d.navgroup !== undefined) { const mode = axMode(parse()[2]); state.navClosed[mode][d.navgroup] = t.getAttribute('aria-expanded') === 'true'; render(); return; }
    if (d.scope !== undefined) { closePops(); state.scope = d.scope || null; const wk = demo() ? 'example' : state.ws; state.repFor = d.scope ? { k: wk, id: d.scope } : null; state.an = Object.assign(state.an || { measure: 'hours', range: 90 }, { proj: d.scope ? 'c:' + d.scope : 'all' }); const c = d.scope && coById(d.scope); if (c && /^(home|organisations)$/.test(parse()[0])) location.hash = c.href; else render(); toast(c ? `Scoped to ${c.short}.` : 'Showing all organisations.'); return; }
    if (d.incf) { state.incF = d.incf; render(); return; }
    if (d.jobsel) { state.jobSel = d.jobsel; render(); return; }
    if (d.provsel) { state.provSel = d.provsel; render(); return; }
    if (d.cfshow) { state.cf.show = d.cfshow; render(); return; }
    if (d.cotab) { state[state.coView === 'results' ? 'resTab' : 'coTab'] = d.cotab; render(); return; }
    if (d.ctxTag) { ctxReadDraft(); const tg = state.ctxDraft.tags, i = tg.indexOf(d.ctxTag); if (i >= 0) tg.splice(i, 1); else tg.push(d.ctxTag); render(); return; }
    if (d.ctxkind) { ctxReadDraft(); state.ctxF = Object.assign(state.ctxF || { q: '' }, { kind: d.ctxkind }); render(); return; }
    if (d.repfor) { state.repFor = d.repfor === 'all' ? null : { k: repKey(), id: d.repfor }; render(); return; }
    if (d.tab) { state.solTab = d.tab; render(); return; }
    if (d.demo) { state.demoState = d.demo; render(); return; }
    if (d.go) { location.hash = '#' + d.go; return; }
    if (d.sel) { state.approvalSel = d.sel; render(); if (window.innerWidth < 1024) $('#ap-h').scrollIntoView(); return; }
    if (d.kind) { state.newKind = d.kind; render(); return; }
    if (d.method) { state.wiz.method = d.method; state.wiz.tests = []; state.wiz.tested = false; render(); return; }
    if (d.scr) { screenOpen(d.scr); return; }
    if (d.trkOrg) { const t = state.trk, o = state.orgs.find((x) => x.id === d.trkOrg); t.orgId = d.trkOrg; t.isNew = false; t.q = o ? o.name : t.q; render(); return; }
    if (d.trkNew) { const t = state.trk, q = $('#tk-q'); if (q) t.q = q.value; t.isNew = true; t.orgId = null; render(); return; }
    if (d.trkKind) { const t = state.trk; t.kind = d.trkKind; if (!t.solTouched) t.sol = ''; t.objective = ''; render(); return; }
    if (d.trkMethod) { state.trk.method = d.trkMethod; render(); return; }
    if (d.trkProd) { state.wiz.product = d.trkProd; render(); return; }
    if (d.pmethod) { ['p-name', 'p-sol'].forEach((id) => { const el = $('#' + id); if (el) state[id === 'p-name' ? 'draftProj' : 'draftSol'] = el.value; }); state.newMethod = d.pmethod; render(); return; }
    if (d.keep) { state.wiz.keep[d.keep] = !state.wiz.keep[d.keep]; render(); return; }
    if (d.bmethod) { state.wiz.baseline.method = d.bmethod; render(); return; }
    if (d.sfkind) { readSf(); state.sf.kind = d.sfkind; state.sf.vol = KINDS[d.sfkind].vol; state.sf.base = KINDS[d.sfkind].base.mid; render(); return; }
    if (d.sfhist) { readSf(); state.sf.history = +d.sfhist; render(); return; }
    if (d.sfappr) { readSf(); state.sf.approval = d.sfappr; render(); return; }
    if (d.adv) { readSf(); advance(+d.adv); render(); toast(`Moved to ${day(today())}.`); return; }
    if (d.ev) { const s = simById(($('#ev-sim') || {}).value || state.eventSim); if (!s) return; state.eventSim = s.id; applyEvent(s, d.ev); render(); toast(({ stale: 'Data stopped arriving.', down: 'Solution stopped answering.', spike: s.ev.spike ? 'Volume spike on.' : 'Volume spike off.', quality: s.ev.quality ? 'Quality drop on.' : 'Quality drop off.', manifest: 'New detail sent for approval.', recover: 'Recovered. The gap stays.', backfill: 'Recovered and filled in.' })[d.ev]); return; }
    if (d.start) { if (d.start === 'tour') { tourGo(0); return; } setWs(d.start === 'demo' ? 'example' : 'real'); location.hash = '#home'; render(); toast(d.start === 'demo' ? 'Example data opened.' : 'Your workspace is ready.'); return; }
    if (d.ws) { const k = d.ws; closePops(); state.tour = null; setWs(k); location.hash = '#home'; render(); toast(k === 'sandbox' ? `${state.sandboxName} opened.` : k === 'example' ? 'Example data opened.' : `${state.setup.workspace} opened.`); return; }
    if (d.role) { state.role = d.role; closePops(); render(); toast(`Now signed in as ${me().name}.`); return; }
    if (d.themeSet) {
      const v = d.themeSet;
      if (v === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', v);
      try { if (v === 'system') localStorage.removeItem('outcomes-theme'); else localStorage.setItem('outcomes-theme', v); } catch (err) { /* storage blocked */ }
      render(); $('#user-pop').hidden = false; return;
    }
    if (t.id === 'menu-btn') { $('#sidebar').classList.add('open'); $('#scrim').hidden = false; return; }
    if (d.act && acts[d.act]) { e.preventDefault(); acts[d.act](d); }
  });
  document.addEventListener('change', (e) => { if (e.target.id === 'ev-sim') { state.eventSim = e.target.value; render(); } if (e.target.id === 'sb-name') { state.sandboxName = e.target.value.trim() || 'Demo workspace'; render(); } });
  document.addEventListener('submit', (e) => {
    if (e.target.id === 'f-ctx') {
      e.preventDefault(); ctxReadDraft();
      const dr = state.ctxDraft, org = ($('#ctx-org') || {}).value, text = (dr.text || '').trim(), from = (dr.from || '').trim(), help = $('#ctx-help');
      const bad = (id, msg) => { const el = $('#' + id); el.setAttribute('aria-invalid', 'true'); if (msg && help) { help.textContent = msg; help.classList.add('err'); } el.focus(); };
      if (!coById(org)) return;
      if (dr.items.some((x) => x.status === 'reading')) { toast('Wait until the attachments are read.'); return; }
      if (text.length < 10) { bad('ctx-text', 'Write what they said, in a sentence or more.'); return; }
      if (!from) { bad('ctx-from', 'Say who said it, by role: for example, Finance director.'); return; }
      if (ctxPersonal(text + ' ' + from)) { bad('ctx-text', 'That looks like an email, phone or identity card number. Take it out and record the person’s role instead.'); return; }
      const c = coById(org);
      ctxAll().unshift({ id: 'cn' + state.seq++, org, proj: dr.proj || null, kind: dr.kind || 'feedback', source: dr.source || CTX_SOURCES[0], date: dr.date || today(), from, text, tags: dr.tags.slice(), ai: dr.ai !== false, by: me().name, at: now(), uses: 0, items: dr.items.slice() });
      log(`Added client context from ${c.short} (${from}, ${(dr.source || CTX_SOURCES[0]).toLowerCase()})${dr.items.length ? `, with ${dr.items.length} attachment${dr.items.length === 1 ? '' : 's'}` : ''}`);
      state.ctxDraft = null; render(); toast(dr.ai !== false ? `Added. AI can use it for ${c.short}.` : 'Added. AI won’t use it.'); return;
    }
    if (e.target.id === 'f-note') { e.preventDefault(); const t = ($('#note-t').value || '').trim(); if (!t) return; const id = e.target.dataset.org; state.notes[id].unshift([me().name, now(), t]); log(`Added a note on ${coById(id).short}`); render(); toast('Note added.'); return; }
    if (e.target.id === 'reason-form') { e.preventDefault(); const r = ($('#reason-t').value || '').trim(); if (r.length < 3) { $('#reason-t').setAttribute('aria-invalid', 'true'); $('#reason-t').focus(); return; } r8Do(state.reasonFor, r); return; }
    if (e.target.id === 'f-ws') { e.preventDefault(); state.setup.workspace = $('#ws-name').value.trim() || 'REKA Inisiatif'; state.setup.step = 2; render(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closePops(); closePalette(); if (state.studio) { readSf(); state.studio = false; render(); } const sb = $('#sidebar'); if (sb) { sb.classList.remove('open'); $('#scrim').hidden = true; } }
    if (e.key === 'Enter' && e.target.matches('tr[data-go]')) location.hash = '#' + e.target.dataset.go;
    if (e.key === 'Enter' && e.target.matches('tr[data-anpick], tr[data-jobsel], tr[data-provsel]')) e.target.click();
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && state.mode) { e.preventDefault(); openPalette(); }
  });
  window.addEventListener('hashchange', () => { closePalette(); render(); });
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { const [p, a] = parse(); if (['home', 'client', 'solution', 'sim', 'analytics'].includes(p) && pages[p].after && state.mode) pages[p].after(a); }, 150); });
  render();
})();
