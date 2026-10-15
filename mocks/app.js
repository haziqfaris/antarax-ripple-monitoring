/* Outcomes product mock.
   - Your workspace: sign in, set up, add organisations, create projects, connect solutions, approve, collect, report.
     Any number of projects; their daily figures are simulated from each project's kind, volume and baseline.
   - Demo studio (mock only): create simulated projects, move the date forward, cause problems, and a guided tour.
   - The example workspace: five fixed clients from data.js.
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
  const freshWizard = () => ({ step: 1, method: 'link', devReady: false, solName: '', url: 'https://lease.teladan.example/internal/measure/v1', tests: [], tested: false, proposals: null, keep: { volume: true, quality: true, impact: true }, baseline: null });
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
  // Workspaces: your real one, a demo workspace (Demo studio and the guided demo live only here), and the example clients.
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
  const wsName = () => demo() ? 'Example clients' : sandbox() ? state.sandboxName : state.setup.workspace;

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
    { key: 'sla', domain: 'Operations', name: 'Within agreed time', unit: '%', quality: 'measured', dp: 1, better: 'up', how: 'Share done inside the time agreed with the client, weighted by volume.', calc: (t) => t.has.sla && t.vol ? t.slaW / t.vol : null },
    { key: 'quality', domain: 'Operations', name: 'Needed a person to fix', unit: '%', quality: 'derived', dp: 1, better: 'down', how: 'Items sent back or corrected ÷ items handled, from the totals.', calc: (t) => t.has.flagged && t.vol ? 100 * t.flagged / t.vol : null },
    { key: 'straight', domain: 'Operations', name: 'Straight-through rate', unit: '%', quality: 'derived', dp: 1, better: 'up', how: 'Items done with no correction ÷ items handled.', calc: (t) => t.has.flagged && t.vol ? 100 * (t.vol - t.flagged) / t.vol : null },
    { key: 'hours', domain: 'Business impact', name: 'Hours saved', unit: 'h', quality: 'estimated', dp: 0, better: 'up', sum: true, how: 'Items × (minutes by hand − machine − review) ÷ 60, with a likely range.', calc: (t) => t.has.mid ? t.mid : null, range: (t) => t.has.mid ? [t.low, t.high] : null },
    { key: 'value', domain: 'Business impact', name: 'Value of time freed', unit: 'RM', quality: 'estimated', dp: 0, better: 'up', sum: true, how: 'Hours saved × RM45, the hourly staff cost agreed with the client. An estimate, not cash saved.', calc: (t) => t.has.mid ? t.mid * 45 : null, range: (t) => t.has.mid ? [t.low * 45, t.high * 45] : null },
    { key: 'tatChange', domain: 'Business impact', name: 'Faster than before', unit: '%', quality: 'derived', dp: 0, better: 'up', how: 'Turnaround now against turnaround before go-live.', calc: (t) => t.has.tat && t.vol && t.tatBeforeW ? 100 * (t.tatBeforeW - t.tatW) / t.tatBeforeW : null },
    { key: 'costPer', domain: 'Commercial', name: 'Running cost per item', unit: 'RM', quality: 'derived', dp: 2, better: 'down', reka: true, how: 'Running cost from AX Frame ÷ work handled. REKA only, never in client output.', calc: (t) => t.runCost && t.vol ? t.runCost * t.days / 30 / t.vol : null },
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
      { id: 'impact', name: `Hours saved on ${sim.project.name.toLowerCase()}`, kind: 'Business impact', quality: 'estimated', why: `The outcome the client is paying for. Needs a baseline: how long a ${K.noun} takes by hand.`, formula: `${cap(K.nouns)} × (minutes by hand − machine minutes − review minutes) ÷ 60`, needsBaseline: true },
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
        evidence: p.needsBaseline ? (hasBase(sim) ? (sim.base.note || ({ sample: `Timed sample of ${sim.base.n} ${kindOf(sim).nouns}`, history: 'Past records', estimate: 'Client estimate' })[sim.base.method]) : 'No baseline yet') : `Figures checked on ${day(today())}`,
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
  const rangeSeg = () => `<div class="seg" role="group" aria-label="Date range">${[[7, '7D'], [30, '30D'], [90, '90D'], [365, '12M']].map(([v, l]) => `<button type="button" data-range="${v}" aria-pressed="${state.range === v}" aria-label="${RANGES[v]}">${l}</button>`).join('')}</div>`;
  const gate = (ok, label, need, attrs = '', cls = 'btn primary') => ok ? `<button ${/type=/.test(attrs) ? '' : 'type="button"'} class="${cls}" ${attrs}>${label}</button>` : `<span class="head-actions"><button type="button" class="${cls}" disabled>${label}</button><span class="needs">${need}</span></span>`;
  const head = (o) => `<header class="page-head"><div style="min-width:0">${o.crumbs ? `<nav class="crumbs" aria-label="Breadcrumbs">${o.crumbs}</nav>` : ''}<h1>${o.title}</h1>${o.lead ? `<p class="lead">${o.lead}</p>` : ''}${o.meta ? `<div class="meta-line">${o.meta}</div>` : ''}</div><div class="head-actions">${o.actions || ''}</div></header>`;
  const crumbs = (...parts) => parts.map((p, i) => i < parts.length - 1 ? `<a href="${p[1]}">${esc(p[0])}</a>${icon('chev', 'sm')}` : `<span>${esc(p[0])}</span>`).join('');
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
        <div class="logo"><img src="assets/antarax-mark.svg" alt="">Outcomes</div>
        <div class="auth-body"><div class="auth-card">${inner}</div></div>
        <div class="auth-foot"><span>REKA Inisiatif Sdn Bhd · for REKA staff</span><span>Need help? support@go.antarax.ai</span></div>
      </div>
      <aside class="auth-side" aria-hidden="true"><div class="art" style="background-image:url(assets/panel-white.svg)"></div>
        <span class="eyebrow" style="color:var(--hero-ink)"><img src="${SPARK}" alt="">Managed AI, measured</span>
        <h2>Show every client what their AI solution changed.</h2>
        <p>Connect a solution once. Outcomes collects its figures, compares them with the baseline you agreed, and drafts the monthly report for you to check.</p>
        <div class="quote-card"><div style="display:flex;justify-content:space-between;font-size:.8125rem"><span>Hours saved, September</span><span class="mono">Example</span></div><div class="big">1,035 h</div><div style="display:flex;justify-content:space-between;font-size:.8125rem"><span>Estimated · likely 572 to 1,421</span><span>vs baseline</span></div></div>
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
          <button type="button" class="choice" data-start="tour" aria-pressed="false"><span class="ic">${icon('live')}</span><span><b>Watch the guided demo</b><span class="d">See a new project go from nothing to its first report, in 19 short steps.</span></span><span class="radio"></span></button>
          <button type="button" class="choice" data-start="demo" aria-pressed="false"><span class="ic">${icon('overview')}</span><span><b>Explore with example data</b><span class="d">A workspace with five clients already running. Every figure is invented.</span></span><span class="radio"></span></button>
        </div>`);
  };

  // ------------------------------------------------------------------ APP SHELL
  function navHtml(route) {
    const waiting = (demo() ? state.approvals : state.myApprovals).filter((a) => a.status === 'waiting').length;
    const reportsDue = demo() ? (state.reportApproved ? 0 : 1) : state.sims.filter((s) => simReportState(s).st === 'ready').length;
    const items = [['home', 'Home', 'home'], ['organisations', 'Organisations', 'organisation'], ['analytics', 'Analytics', 'analytics'], ['ask', 'Ask', 'ask'], ['approvals', 'Approvals', 'shield', waiting, has('Approve')], ['reports', 'Reports', 'reports', reportsDue]];
    const isCur = (k) => route === k || (k === 'organisations' && /^(new-organisation|new-project|connect)$/.test(route)) || (k === 'reports' && /^report/.test(route));
    const sub = (href, label) => `<a class="sub" href="#${href}" ${route === href ? 'aria-current="page"' : ''}>${esc(label)}</a>`;
    const subs = demo() ? sub('organisation-contoh-logistik', 'Contoh Logistik') + sub('solution-doc-workflow', 'Document workflow') : state.orgs.slice(0, 5).map((o) => sub('org-' + o.id, o.name)).join('') + (state.orgs.length > 5 ? `<a class="sub" href="#organisations">${state.orgs.length - 5} more</a>` : '');
    return items.map(([k, l, ic, c, loud], i) => `<a href="#${k}" ${isCur(k) ? 'aria-current="page"' : ''}>${icon(ic)}<span>${l}</span>${c ? `<span class="count ${loud ? 'loud' : ''}" aria-label="${c} waiting">${c}</span>` : ''}</a>${i === 1 ? subs : ''}`).join('')
      + `<span class="grp">Workspace</span><a href="#settings" ${route === 'settings' ? 'aria-current="page"' : ''}>${icon('settings')}<span>Settings</span></a><a href="#guide" ${route === 'guide' ? 'aria-current="page"' : ''}>${icon('insight')}<span>Help</span></a>`;
  }
  function needsYou() {
    if (demo()) return [];
    const out = [];
    state.sims.forEach((s) => {
      const o = orgOf(s), st = simStatus(s);
      if (st === 'failing') out.push(['fault', 'alerts', `${s.name} stopped answering`, `${o.name} · since ${dayShort(s.ev.down)}`, '#sim-' + s.id, 'Check']);
      if (st === 'stale') out.push(['warn', 'clock', `${s.name} hasn’t sent data since ${dayShort(M.addDays(s.ev.stale, -1))}`, `${o.name} · showing the last good figures`, '#sim-' + s.id, 'Open']);
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
    const u = me(), theme = document.documentElement.getAttribute('data-theme') || 'system';
    const alert = !demo() && needsYou().some((x) => x[0] !== 'info');
    return `<a class="skip" href="#view">Skip to content</a>
    <div class="app">
      <aside class="sidebar" id="sidebar" aria-label="Navigation">
        <div class="brand"><img src="assets/antarax-mark.svg" alt=""><div><b>Outcomes</b><small>REKA Managed AI</small></div></div>
        <div class="rel"><button type="button" class="btn primary new-btn" data-act="new-menu" aria-haspopup="true">${icon('plus', 'sm')}New</button>
          <div class="pop" id="new-pop" hidden style="left:0;right:auto;top:48px;width:100%"><a href="#new-organisation">${icon('organisation', 'sm')}<span>Organisation</span></a><a href="#new-project">${icon('projects', 'sm')}<span>Project</span></a><a href="#connect">${icon('connect-ai', 'sm')}<span>Connect a solution</span></a></div></div>
        <nav class="nav" aria-label="Main">${navHtml(route)}</nav>
        <div class="rel"><button type="button" class="workspace" data-act="ws-menu" aria-haspopup="true" style="width:100%;cursor:pointer;text-align:left"><span class="ws" style="${sandbox() ? 'background:var(--ai)' : demo() ? 'background:var(--warn)' : ''}">${initials(wsName())}</span><div style="min-width:0;flex:1"><b>${esc(wsName())}</b><span>${demo() ? 'Example data' : sandbox() ? 'Demo workspace · simulated' : 'Your workspace'}</span></div>${icon('chev-down', 'sm')}</button>
          <div class="pop" id="ws-pop" hidden style="left:0;right:auto;top:auto;bottom:62px;width:100%"><h4>Switch workspace</h4>${[['real', state.setup.workspace, 'Real clients and their data'], ['sandbox', state.sandboxName, 'Simulated clients for demos, training and rehearsing reports'], ['example', 'Example clients', 'Five fixed example clients']].map(([k, n, d2]) => `<button type="button" data-ws="${k}" aria-pressed="${(k === 'example' ? demo() : !demo() && state.ws === k)}"><span class="ws" style="flex:none;width:28px;height:28px;border-radius:8px;display:grid;place-items:center;font-size:.6875rem;font-weight:700;color:var(--surface);background:${k === 'sandbox' ? 'var(--ai)' : k === 'example' ? 'var(--warn)' : 'var(--ink)'}">${initials(n)}</span><span><b class="ink">${esc(n)}</b><small>${d2}</small></span></button>`).join('')}</div></div>
      </aside>
      <div class="scrim" id="scrim" hidden></div>
      <div class="main">
        <header class="topbar">
          <button type="button" class="icon-btn menu-btn" id="menu-btn" aria-label="Open navigation" aria-controls="sidebar">${icon('menu')}</button>
          <button type="button" class="search" data-act="palette">${icon('search', 'sm')}<span class="t">Search organisations, solutions, pages</span><kbd>⌘K</kbd></button>
          <div class="top-right">
            <a class="btn sm ghost" href="#ask" style="gap:6px"><img src="${SPARK}" alt="" style="width:16px">Ask</a>
            ${demo() ? '<span class="pill warn" title="Every figure is invented">Example data</span>' : sandbox() ? `<button type="button" class="studio-btn" data-act="studio" aria-expanded="${state.studio}">${icon('flask', 'sm')}<span class="lbl">Demo studio</span><span class="date">${dayShort(today())}</span></button>` : ''}
            <div class="rel"><button type="button" class="icon-btn" data-act="bell" aria-label="Notifications">${icon('bell')}${demo() || alert ? '<span class="badge"></span>' : ''}</button><div class="pop" id="bell-pop" hidden>${bellHtml()}</div></div>
            <div class="rel"><button type="button" class="user-btn" data-act="user" aria-haspopup="true"><span class="avatar">${u.initials}</span><span class="nm">${u.name}</span>${icon('chev-down', 'sm')}</button>
              <div class="pop" id="user-pop" hidden>
                <h4>Signed in as</h4>${Object.values(M.staff).map((s) => `<button type="button" data-role="${s.id}" aria-pressed="${s.id === state.role}"><span class="avatar">${s.initials}</span><span><b class="ink">${s.name}</b><small>${s.note}</small></span></button>`).join('')}
                <p class="xs muted" style="padding:2px 10px 6px">Mock only: switch person to see how permissions change.</p>
                <hr><h4>Appearance</h4><div style="padding:4px 10px 8px"><div class="seg">${[['light', 'Light'], ['dark', 'Dark'], ['system', 'System']].map(([v, l]) => `<button type="button" data-theme-set="${v}" aria-pressed="${theme === v}">${l}</button>`).join('')}</div></div>
                <hr><h4>Workspace</h4>${[['real', state.setup.workspace], ['sandbox', state.sandboxName], ['example', 'Example clients']].map(([k, n]) => `<button type="button" data-ws="${k}" aria-pressed="${(k === 'example' ? demo() : !demo() && state.ws === k)}">${icon(k === 'sandbox' ? 'flask' : k === 'example' ? 'overview' : 'home', 'sm')}<span>${esc(n)}</span></button>`).join('')}
                <button type="button" data-act="signout">${icon('logout', 'sm')}<span>Sign out</span></button>
              </div></div>
          </div>
        </header>
        ${sandbox() ? `<div class="ws-banner">${icon('flask', 'sm')}<span><b>${esc(state.sandboxName)}.</b> Every client and figure here is simulated. Nothing is sent to clients or counted in real totals.</span><button type="button" class="btn sm" data-act="studio">Demo studio</button></div>` : ''}
        <main class="content" id="view" tabindex="-1">${inner}</main>
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
      { t: 'Add your first organisation', d: 'The client, and their data agreement.', done: state.orgs.length > 0, href: '#new-organisation', cta: 'Add organisation' },
      { t: 'Create a project', d: 'What the solution is for, in the client’s words.', done: !!s, href: '#new-project', cta: 'Create project' },
      { t: 'Connect the solution', d: 'Check its data, choose KPIs and record the baseline.', done: !!s && st !== 'draft', href: '#connect', cta: 'Connect' },
      { t: 'Get the KPIs approved', d: 'Someone else checks every KPI and baseline.', done: st === 'approved' || st === 'collecting', href: s ? '#sim-' + s.id : '#approvals', cta: 'Check status' },
      { t: 'See your first results', d: 'Figures arrive after the first nightly collection.', done: st === 'collecting', href: s ? '#sim-' + s.id : '#home', cta: 'Open solution' },
      { t: 'Schedule the client report', d: 'Drafted for you. Nothing goes out until you check it.', done: !!s && s.reportScheduled, href: '#reports', cta: 'Schedule' },
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
    const greet = head({ title: `Good morning, ${me().name.split(' ')[0]}`, lead: `${dayLong(today())} · ${esc(wsName())}`, actions: collecting.length ? rangeSeg() : '' });
    if (!collecting.length) {
      return `${greet}
      <section class="grid g-side">${checklistCard(false)}
        <div class="grid" style="gap:16px;align-content:start">
          <div class="card"><h3>How it works</h3><div class="list" style="margin-top:10px">
            ${[['connect-ai', 'Connect', 'The solution shares a few daily totals through a small read-only link. Its own code and data stay as they are.'], ['target', 'Agree', 'Choose KPIs and baselines with the client. Someone else approves them.'], ['savings', 'Measure', 'Each KPI is worked out every night. You can always see what is measured and what is estimated.'], ['reports', 'Report', 'A report is drafted for you. You check it before the client sees it.']].map(([ic, t, d]) => `<div class="row" style="grid-template-columns:36px minmax(0,1fr)"><span class="ico info">${icon(ic, 'sm')}</span><div><div class="what">${t}</div><div class="meta">${d}</div></div></div>`).join('')}</div></div>
          <div class="card"><h3>Want to see it working first?</h3><p class="small muted" style="margin:6px 0 12px">Watch a new project go from nothing to its first report, or open a workspace with five example clients.</p><div class="head-actions"><button type="button" class="btn primary sm" data-act="tour-start">Watch the guided demo</button><button type="button" class="btn sm" data-act="switch-mode">Example workspace</button></div></div>
        </div>
      </section>
      ${state.orgs.length ? `<section class="card"><div class="card-head"><h2>Your organisations</h2></div>${myOrgTable()}</section>` : ''}`;
    }
    const days = simWindow(state.range), withBase = collecting.filter(hasBase);
    const tot = withBase.reduce((a, s) => { const r = simSum(s, days); return { mid: a.mid + r.mid, low: a.low + r.low, high: a.high + r.high }; }, { mid: 0, low: 0, high: 0 });
    const handled = collecting.reduce((a, s) => a + simSum(s, days).vol, 0);
    const onTime = collecting.filter((s) => simStatus(s) === 'fresh').length;
    const live = state.sims.reduce((a, s) => a + (s.stage === 'collecting' ? s.kpis.filter((k) => k !== 'impact' || hasBase(s)).length : 0), 0), total = state.sims.reduce((a, s) => a + (s.kpis.length || 0), 0);
    const att = needsYou();
    return `${greet}
    ${checklistCard(true)}
    <section class="grid g4 stats">
      <div class="card stat"><span class="label">Hours saved ${q('estimated')}</span><span class="value">${withBase.length ? nf(tot.mid) : '–'}<small>${withBase.length ? 'h' : ''}</small></span><span class="hint">${withBase.length ? `Likely ${nf(tot.low)} to ${nf(tot.high)}` : 'Needs a baseline'}</span></div>
      <div class="card stat"><span class="label">Work handled ${q('measured')}</span><span class="value">${nf(handled)}</span><span class="hint">Across ${collecting.length} solution${collecting.length === 1 ? '' : 's'}</span></div>
      <div class="card stat"><span class="label">Solutions sending data</span><span class="value">${onTime}<small>of ${state.sims.length}</small></span><span class="hint">${state.sims.length - collecting.length ? `${state.sims.length - collecting.length} not collecting yet` : 'All connected'}</span></div>
      <div class="card stat"><span class="label">KPIs live</span><span class="value">${live}<small>of ${total}</small></span><span class="hint">${state.myApprovals.filter((a) => a.status === 'waiting').length} waiting for approval</span></div>
    </section>
    <section class="grid g-main">
      <div class="card"><div class="card-head"><div><h2>Hours saved</h2><p class="sub">${rangeLabel()} · every project with an approved baseline</p></div></div><div class="chart" id="ch-mine-home"></div>
        <div class="legend"><span><i style="background:var(--s1)"></i>Hours saved</span><span><i style="background:repeating-linear-gradient(135deg,var(--s1) 0 2px,var(--s1-soft) 2px 5px)"></i>Likely range</span><span><i style="box-shadow:inset 0 0 0 1.5px var(--warn)"></i>No data that day, not zero</span></div></div>
      <div class="card"><div class="card-head"><h2>Needs you</h2><span class="pill idle">${att.length}</span></div>
        ${att.length ? `<div class="list">${att.slice(0, 6).map(([sev, ic, t, m, h, a]) => `<div class="row"><span class="ico ${sev}">${icon(ic, 'sm')}</span><div><div class="what">${esc(t)}</div><div class="meta">${esc(m)}</div></div><a class="btn sm" href="${h}">${a}</a></div>`).join('')}</div>` : `<div class="empty" style="padding:16px"><p>Nothing needs you. Every solution sent its figures on time.</p></div>`}</div>
    </section>
    <section class="grid" style="gap:12px"><div class="card-head" style="margin:0"><h2>Projects</h2><a class="btn sm ghost" href="#organisations">All organisations${icon('chev', 'sm')}</a></div>
      <div class="grid g3">${state.sims.map((s) => simCard(s, days)).join('')}
        <a class="card proj" href="#new-project" style="border-style:dashed;place-content:center;justify-items:center;text-align:center;min-height:200px;box-shadow:none"><span class="ico info" style="width:44px;height:44px;border-radius:12px;display:grid;place-items:center">${icon('plus')}</span><b class="ink">Add a project</b><span class="small muted">Or simulate one in Demo studio</span></a></div></section>
    <section class="card"><div class="card-head"><h2>Recent activity</h2><a class="btn sm ghost" href="#settings">Audit trail${icon('chev', 'sm')}</a></div>${activityList(6)}</section>`;
  }
  function activityList(n) {
    const list = auditList().slice(0, n);
    if (!list.length) return '<p class="small muted">Nothing yet.</p>';
    return `<div class="list">${list.map(([t, w, what]) => `<div class="row"><span class="avatar">${w === 'Collector' ? icon('live', 'sm') : w === 'AI proposals' ? `<img src="${SPARK}" alt="" style="width:16px">` : initials(w.split(' · ')[0])}</span><div class="small"><b class="ink">${esc(w.split(' · ')[0])}</b> ${esc(what)}</div><span class="xs muted mono">${esc(t.replace(' 2026,', ''))}</span></div>`).join('')}</div>`;
  }
  function simCard(s, days) {
    const o = orgOf(s), st = simStatus(s);
    let fig, spark = '';
    if (s.stage === 'collecting' && hasBase(s)) {
      const r = simSum(s, days);
      fig = `<div class="stat"><span class="label">Hours saved ${q('estimated')}</span><span class="value ${st !== 'fresh' ? 'stale-val' : ''}" style="font-size:1.5rem">${nf(r.mid)}<small>h</small></span></div>`;
      spark = sparkline(bucket(simDaily(s, simWindow(Math.min(state.range, 90))), state.range > 30).map((p) => (p.gap || p.before) ? null : p.mid));
    } else if (s.stage === 'collecting') {
      const r = simSum(s, days);
      fig = `<div class="stat"><span class="label">${cap(kindOf(s).nouns)} handled</span><span class="value" style="font-size:1.5rem">${nf(r.vol)}</span><span class="hint">Hours saved needs a baseline</span></div>`;
      spark = sparkline(bucket(simDaily(s, simWindow(Math.min(state.range, 90))), state.range > 30).map((p) => (p.gap || p.before) ? null : p.v));
    } else fig = `<div class="stat"><span class="label">Hours saved</span><span class="value" style="font-size:1.5rem">${dash()}</span><span class="hint">${({ draft: 'Not connected yet', review: 'KPIs waiting for approval', approved: 'First data tonight' })[s.stage]}</span></div>`;
    const live = s.stage === 'collecting' ? s.kpis.filter((k) => k !== 'impact' || hasBase(s)).length : 0;
    return `<a class="card proj" href="#${s.stage === 'draft' ? 'connect-' + s.id : 'sim-' + s.id}">
      <div class="top"><div><div class="org">${esc(o.name)}</div><h3>${esc(s.project.name)}</h3></div>${statusPill(st)}</div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:10px">${fig}${spark}</div>
      <div><div class="xs muted" style="display:flex;justify-content:space-between;margin-bottom:6px"><span>KPIs live</span><span class="mono">${live} of ${s.kpis.length || '–'}</span></div><div class="bar-track"><div class="bar-fill" style="width:${s.kpis.length ? 100 * live / s.kpis.length : 0}%"></div></div></div></a>`;
  }
  function myOrgTable() {
    return `<div class="table-wrap"><table><thead><tr><th>Organisation</th><th>Projects</th><th>Data</th><th>Hours saved, ${rangeLabel().toLowerCase()}</th></tr></thead><tbody>${state.orgs.map((o) => {
      const sims = simsOf(o), worst = ['failing', 'stale', 'review', 'approved', 'not_connected', 'fresh'].find((st) => sims.some((s) => simStatus(s) === st));
      const hs = sims.filter((s) => s.stage === 'collecting' && hasBase(s));
      return `<tr class="link" data-go="org-${o.id}" tabindex="0"><td><div style="display:flex;gap:10px;align-items:center"><span class="avatar" style="border-radius:10px">${initials(o.name)}</span><div><span class="name">${esc(o.name)}</span><span class="sub">${esc(o.industry)}</span></div></div></td><td>${sims.length ? sims.map((s) => esc(s.project.name)).join(', ') : '<span class="muted">None yet</span>'}</td><td>${worst ? statusPill(worst) : '<span class="muted">–</span>'}</td><td>${hs.length ? `<span class="mono ink">${nf(hs.reduce((a, s) => a + simSum(s, simWindow(state.range)).mid, 0))} h</span> ${q('estimated')}` : dash()}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }
  pages.home.after = () => {
    if (demo()) {
      const daily = windowDays(state.range).map((d) => {
        const parts = ROLLED.map((s) => impactDaily(s, [d])[0]), ok = parts.filter((p) => !p.gap && !p.before);
        if (!ok.length) return { d, gap: parts.some((p) => p.gap), before: parts.every((p) => p.before) };
        return { d, mid: ok.reduce((a, p) => a + p.mid, 0), low: ok.reduce((a, p) => a + p.low, 0), high: ok.reduce((a, p) => a + p.high, 0) };
      });
      drawChart($('#ch-home'), bucket(daily, state.range > 30), { id: 'home', kind: 'band', label: 'Hours saved across clients', height: 240, tip: bandTip });
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
    const days = windowDays(state.range);
    const imp = portfolioImpact(days), prev = portfolioImpact(windowDays(state.range, M.addDays(M.LAST_DAY, -state.range)));
    const items = [['doc-workflow', 'documents.generated'], ['invoice-triage', 'invoices.triaged'], ['quote-drafter', 'quotes.drafted'], ['shift-planner', 'plans.generated'], ['enquiry-triage', 'enquiries.received']].reduce((a, [s, k]) => a + sumMetric(s, k, days).sum, 0);
    const waiting = state.approvals.filter((a) => a.status === 'waiting').length;
    const change = prev.mid > 0 && state.range < 90 ? Math.round(100 * (imp.mid - prev.mid) / prev.mid) : null;
    const att = demoAtt();
    const projects = [['contoh-logistik', 'doc-workflow'], ['acme-plastics', 'shift-planner'], ['bina-jaya', 'quote-drafter'], ['sampel-medik', 'enquiry-triage'], ['teladan-properties', 'lease-reader']];
    return `
    ${head({ title: `Good morning, ${me().name.split(' ')[0]}`, lead: 'Here’s what your clients’ solutions delivered, and what needs you.', actions: rangeSeg() })}
    <section class="grid g4 stats">
      <div class="card stat"><span class="label">Hours saved ${q('estimated')}</span><span class="value">${nf(imp.mid)}<small>h</small></span><span class="hint">${change !== null ? `<span class="delta">${change >= 0 ? '▲' : '▼'} ${Math.abs(change)}%</span> vs previous · ` : ''}likely ${nf(imp.low)} to ${nf(imp.high)}</span></div>
      <div class="card stat"><span class="label">Work handled ${q('measured')}</span><span class="value">${nf(items)}</span><span class="hint">Documents, invoices, plans, enquiries, quotes</span></div>
      <div class="card stat"><span class="label">Solutions sending data</span><span class="value">3<small>of 6</small></span><span class="hint">1 late · 1 not answering · 1 not connected</span></div>
      <div class="card stat"><span class="label">KPIs live</span><span class="value">12<small>of 16</small></span><span class="hint">${waiting} waiting for approval</span></div>
    </section>
    <section class="grid g-main">
      <div class="card"><div class="card-head"><div><h2>Hours saved</h2><p class="sub">${rangeLabel()} · every client with an approved baseline</p></div></div><div class="chart" id="ch-home"></div>
        <div class="legend"><span><i style="background:var(--s1)"></i>Hours saved</span><span><i style="background:repeating-linear-gradient(135deg,var(--s1) 0 2px,var(--s1-soft) 2px 5px)"></i>Likely range</span><span><i style="box-shadow:inset 0 0 0 1.5px var(--warn)"></i>No data that day, not zero</span></div></div>
      <div class="card"><div class="card-head"><h2>Needs you</h2><span class="pill idle">${att.length}</span></div>
        <div class="list">${att.map(([sev, ic, t, m, h, a]) => `<div class="row"><span class="ico ${sev}">${icon(ic, 'sm')}</span><div><div class="what">${esc(t)}</div><div class="meta">${esc(m)}</div></div><a class="btn sm" href="${h}">${a}</a></div>`).join('')}</div></div>
    </section>
    <section class="grid" style="gap:12px"><div class="card-head" style="margin:0"><h2>Projects</h2><a class="btn sm ghost" href="#organisations">All organisations${icon('chev', 'sm')}</a></div>
      <div class="grid g3">${projects.map(([o, s]) => projCard(o, s, days)).join('')}
        <a class="card proj" href="#connect" style="border-style:dashed;place-content:center;justify-items:center;text-align:center;min-height:200px;box-shadow:none"><span class="ico info" style="width:44px;height:44px;border-radius:12px;display:grid;place-items:center">${icon('plus')}</span><b class="ink">Connect another solution</b><span class="small muted">About a day of developer time</span></a></div></section>
    <section class="card"><div class="card-head"><h2>Recent activity</h2><a class="btn sm ghost" href="#settings">Audit trail${icon('chev', 'sm')}</a></div>${activityList(5)}</section>`;
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
      <div><div class="xs muted" style="display:flex;justify-content:space-between;margin-bottom:6px"><span>KPIs live</span><span class="mono">${k.approved} of ${k.total || '–'}</span></div><div class="bar-track"><div class="bar-fill" style="width:${k.total ? 100 * k.approved / k.total : 0}%"></div></div></div></a>`;
  }

  // ------------------------------------------------------------------ ORGANISATIONS
  pages.organisations = () => {
    if (!demo()) return `${head({ title: 'Organisations', lead: 'The clients whose solutions you measure.', actions: `${state.orgs.length ? rangeSeg() : ''}<a class="btn primary" href="#new-organisation">${icon('plus', 'sm')}Add organisation</a>` })}
      ${state.orgs.length ? `<section class="card">${myOrgTable()}</section>` : `<section class="card"><div class="empty">${emptyArt}<h3>No organisations yet</h3><p>Start with the client. You record their data agreement here, because nothing is collected until it is signed.</p><div class="head-actions" style="justify-content:center"><a class="btn primary" href="#new-organisation">${icon('plus', 'sm')}Add organisation</a><button type="button" class="btn" data-act="studio">Simulate one</button></div></div></section>`}`;
    const days = windowDays(state.range);
    return `${head({ title: 'Organisations', lead: 'Every client, their projects and how their solutions are doing.', actions: `${rangeSeg()}<a class="btn primary" href="#new-organisation">${icon('plus', 'sm')}Add organisation</a>` })}
    <section class="card"><div class="table-wrap"><table><thead><tr><th>Organisation</th><th>Stage</th><th>Data</th><th>KPIs live</th><th>Hours saved, ${rangeLabel().toLowerCase()}</th>${has('Commercial') ? '<th>Monthly fee</th>' : ''}<th>Renewal</th></tr></thead><tbody>
    ${M.orgs.map((o) => { const sols = o.projects.flatMap((p) => p.solutions), worst = ['failing', 'stale', 'not_connected', 'fresh'].find((st) => sols.some((s) => solStatus(s) === st)), k = sols.reduce((a, s) => [a[0] + M.solutions[s].kpis.approved, a[1] + M.solutions[s].kpis.total], [0, 0]), rolled = sols.filter((s) => ROLLED.includes(s)), hs = rolled.length ? rolled.reduce((a, s) => a + impactSum(s, days).mid, 0) : null;
      return `<tr class="link" data-go="organisation-${o.id}" tabindex="0"><td><div style="display:flex;gap:10px;align-items:center"><span class="avatar" style="border-radius:10px">${initials(o.short)}</span><div><span class="name">${esc(o.name)}</span><span class="sub">${esc(o.projects[0].name)}</span></div></div></td><td><span class="pill ${o.stage === 'live' ? 'info' : 'idle'}">${cap(o.stage)}</span></td><td>${statusPill(worst)}</td><td class="mono">${k[0]} of ${k[1] || '–'}</td><td>${hs !== null ? `<span class="mono ink">${nf(hs)} h</span> ${q('estimated')}` : dash(o.stage === 'planning' ? 'Not connected' : 'Needs a baseline')}</td>${has('Commercial') ? `<td class="mono">${money(o.contract.amount, o.contract.currency)}</td>` : ''}<td class="mono">${o.renewal}</td></tr>`; }).join('')}
    </tbody></table></div></section>`;
  };

  pages['new-organisation'] = () => `
    ${head({ crumbs: crumbs(['Organisations', '#organisations'], ['Add organisation']), title: 'Add an organisation', lead: 'The client whose solution you’ll measure.' })}
    <form id="f-org" class="card narrow grid" style="gap:24px" novalidate>
      <div class="form-grid">
        <div class="field full"><label for="o-name">Organisation name</label><input id="o-name" placeholder="e.g. Teladan Properties" value="${esc(state.draftOrg || (state.orgs.length ? '' : 'Teladan Properties'))}" required><span class="help" id="o-name-help">As it appears on their contract.</span></div>
        <div class="field"><label for="o-ind">Industry</label><select id="o-ind">${['Property and real estate', 'Food and beverage', 'Logistics', 'Manufacturing', 'Healthcare', 'Engineering and construction', 'Retail', 'Other'].map((x) => `<option>${x}</option>`).join('')}</select></div>
        <div class="field"><label for="o-tz">Time zone</label><select id="o-tz"><option>Asia/Kuala_Lumpur (MYT)</option><option>Asia/Singapore (SGT)</option></select><span class="help">Their reports use this.</span></div>
        <div class="field"><label for="o-contact">Main contact</label><input id="o-contact" value="Farah Idris"></div>
        <div class="field"><label for="o-email">Contact email</label><input id="o-email" type="email" value="farah@client.example"></div>
      </div>
      <div class="grid" style="gap:10px;border-top:1px solid var(--line);padding-top:20px"><h3>Data agreement</h3>
        <p class="small muted">Outcomes only collects totals, and only after the client agrees in writing.</p>
        <label class="check"><input type="checkbox" id="o-signed" checked><span><b class="ink">The client has signed the data agreement</b><br><span class="small muted">Totals only · kept in Singapore · for the contract plus 24 months</span></span></label>
      </div>
      <div class="wfoot"><a class="btn ghost" href="#organisations">Cancel</a><button type="submit" class="btn primary lg">Add organisation</button></div>
    </form>`;
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
      go('org-' + o.id); toast(`${name} added.`);
    });
  };

  pages['new-project'] = () => {
    if (!state.orgs.length) return `${head({ title: 'Create a project' })}<section class="card"><div class="empty">${emptyArt}<h3>Add an organisation first</h3><p>A project belongs to a client.</p><a class="btn primary" href="#new-organisation">Add organisation</a></div></section>`;
    const K = KINDS[state.newKind], orgId = state.newProjOrg || state.orgs[state.orgs.length - 1].id;
    return `
    ${head({ crumbs: crumbs(['Organisations', '#organisations'], ['New project']), title: 'Create a project', lead: 'What you agreed to deliver for the client. Its solution is measured against it.' })}
    <form id="f-proj" class="card narrow grid" style="gap:24px" novalidate>
      <div class="form-grid">
        <div class="field"><label for="p-org">Organisation</label><select id="p-org">${state.orgs.map((o) => `<option value="${o.id}" ${o.id === orgId ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="p-name">Project name</label><input id="p-name" value="${esc(state.draftProj || (state.sims.length ? '' : 'Lease abstraction'))}" placeholder="e.g. Lease abstraction" required><span class="help" id="p-name-help">Use the name the client uses.</span></div>
      </div>
      <div class="grid" style="gap:10px"><span class="ink" style="font-weight:500">What kind of work does it take on?</span><p class="small muted" style="margin-top:-6px">We use this to suggest KPIs that fit. You can change any of them.</p>
        <div class="grid g2" style="gap:10px">${Object.entries(KINDS).map(([k, x]) => `<button type="button" class="choice" style="grid-template-columns:44px minmax(0,1fr)" data-kind="${k}" aria-pressed="${state.newKind === k}"><span class="ic">${icon(x.icon)}</span><span><b>${x.label}</b><span class="d">${x.d}</span></span></button>`).join('')}</div></div>
      <div class="form-grid">
        <div class="field full"><label for="p-obj">The outcome the client wants, in their words</label><textarea id="p-obj">${esc(K.objective)}</textarea><span class="help">This goes at the top of every report.</span></div>
        <div class="field"><label for="p-live">Planned go-live</label><input id="p-live" value="${day(M.addDays(today(), 19))}"></div>
        <div class="field"><label for="p-cad">Client report</label><select id="p-cad"><option>Monthly</option><option>Quarterly</option></select></div>
      </div>
      <div class="wfoot"><a class="btn ghost" href="#organisations">Cancel</a><button type="submit" class="btn primary lg">Create project</button></div>
    </form>`;
  };
  pages['new-project'].after = () => {
    const f = $('#f-proj'); if (!f) return;
    $('#p-name').addEventListener('input', (e) => { state.draftProj = e.target.value; });
    $('#p-org').addEventListener('change', (e) => { state.newProjOrg = e.target.value; });
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#p-name').value.trim();
      if (!name) { $('#p-name').setAttribute('aria-invalid', 'true'); const h = $('#p-name-help'); h.textContent = 'Give the project a name to continue.'; h.style.color = 'var(--fault-ink)'; return; }
      const org = state.orgs.find((o) => o.id === $('#p-org').value);
      const sim = newSim(org, { kind: state.newKind, project: name, objective: $('#p-obj').value.trim(), live: $('#p-live').value, cadence: $('#p-cad').value, sol: state.sims.length ? KINDS[state.newKind].sol : 'Lease reader' });
      state.focusSim = sim.id; state.draftProj = null; state.wiz = freshWizard();
      log(`Created project ${name} for ${org.name}`);
      go('org-' + org.id); toast('Project created.');
    });
  };

  // ---------- your organisation page
  pages.org = (id) => {
    const o = state.orgs.find((x) => x.id === id);
    const sims = simsOf(o), coll = sims.filter((s) => s.stage === 'collecting'), days = simWindow(state.range);
    const withBase = coll.filter(hasBase);
    const tot = withBase.reduce((a, s) => { const r = simSum(s, days); return { mid: a.mid + r.mid, low: a.low + r.low, high: a.high + r.high }; }, { mid: 0, low: 0, high: 0 });
    return `
    ${head({ crumbs: crumbs(['Organisations', '#organisations'], [o.name]), title: orgTitle(o.name),
      meta: `<span>${esc(o.industry)}</span>${o.signed ? `<span class="pill ok">${icon('check', 'sm')}Data agreement signed</span>` : '<span class="pill warn">Data agreement not signed</span>'}`,
      actions: `${coll.length ? rangeSeg() : ''}<button type="button" class="btn ${sims.length ? '' : 'primary'}" data-act="proj-for" data-org="${o.id}">${icon('plus', 'sm')}New project</button>` })}
    ${!o.signed ? `<div class="callout warn">${icon('alerts')}<span><b>Nothing will be collected yet.</b> Record the signed data agreement first.</span></div>` : ''}
    ${withBase.length ? `<section class="card"><p class="xs muted">Across ${withBase.length} project${withBase.length === 1 ? '' : 's'}</p><div class="stat" style="margin-top:6px"><span class="label">Hours saved, ${rangeLabel().toLowerCase()} ${q('estimated')}</span><span class="value">${nf(tot.mid)}<small>h</small></span><span class="hint">Likely ${nf(tot.low)} to ${nf(tot.high)} · each project counted once</span></div></section>` : ''}
    ${!sims.length ? `<section class="card"><div class="empty">${emptyArt}<h3>No projects yet</h3><p>Create the project you agreed with ${esc(o.name)}. You’ll connect its solution next.</p><button type="button" class="btn primary" data-act="proj-for" data-org="${o.id}">${icon('plus', 'sm')}Create project</button></div></section>` : sims.map((s) => `
    <section class="card">
      <div class="card-head"><div><p class="xs muted">Project</p><h2>${esc(s.project.name)}</h2></div><span class="head-actions"><span class="pill idle">${kindOf(s).label}</span>${statusPill(simStatus(s))}</span></div>
      <p class="ink" style="max-width:70ch">“${esc(s.project.objective)}”</p>
      <div class="meta-line"><span>Go-live ${esc(s.project.live)}</span><span>${esc(s.project.cadence)} report</span><span>Owner: Daniel Lim</span></div>
      <div style="margin-top:16px;border-top:1px solid var(--line);padding-top:16px">
      ${s.stage === 'draft' ? `<div class="row" style="border:0;padding:0"><span class="ico info">${icon('connect-ai', 'sm')}</span><div><div class="what">Next: connect the solution</div><div class="meta">Check its data, pick KPIs and record the baseline. About 10 minutes once the developer has added the link.</div></div><a class="btn primary sm" href="#connect-${s.id}">Connect</a></div>`
      : `<div class="row" style="border:0;padding:0"><span class="ico info">${icon('box', 'sm')}</span><div><div class="what">${esc(s.name)}</div><div class="meta">${s.kpis.length} KPIs${s.stage === 'collecting' ? ` · ${nf(simSum(s, days).vol)} ${kindOf(s).nouns} ${rangeLabel().toLowerCase()}` : ''}</div></div><a class="btn sm" href="#sim-${s.id}">Open</a></div>`}
      </div>
    </section>`).join('')}`;
  };

  // ---------- example organisation page
  pages.organisation = (id) => {
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
    ${head({ crumbs: crumbs(['Organisations', '#organisations'], [o.short]), title: orgTitle(o.name),
      meta: `<span>${esc(o.projects[0].name)}</span><span class="pill ${o.stage === 'live' ? 'info' : 'idle'}">${cap(o.stage)}</span>${o.renewal !== '–' ? `<span>Renews ${o.renewal}</span>` : ''}`,
      actions: o.stage === 'planning' ? '' : `<div class="seg" role="group" aria-label="View as"><button type="button" data-aud="staff" aria-pressed="${!client}">Team view</button><button type="button" data-aud="client" aria-pressed="${client}">Client view</button></div>${rangeSeg()}` })}
    ${client ? `<div class="callout info">${icon('client-view')}<span><b>You’re seeing what ${esc(o.short)} sees.</b> Fees, internal notes and anything not yet approved are hidden.</span></div>` : ''}
    ${o.stage === 'planning' ? `<section class="card"><div class="empty">${emptyArt}<h3>Lease reader isn’t connected yet</h3><p>In your own workspace, connecting a solution takes eight guided steps.</p><button type="button" class="btn primary" data-act="switch-mode">Try it in my workspace</button></div></section>` : `
    <section class="grid g-main">
      <div class="card"><p class="xs muted">The outcome they want</p><h2 style="max-width:56ch;margin:4px 0 16px">${esc(o.projects[0].objective)}</h2>
        ${tot ? `<div class="stat"><span class="label">Hours saved, ${rangeLabel().toLowerCase()} ${q('estimated')}</span><span class="value">${nf(tot.mid)}<small>h</small></span><span class="hint">Likely ${nf(tot.low)} to ${nf(tot.high)}</span></div>${isContoh ? '<div class="chart" id="ch-org" style="margin-top:12px"></div>' : ''}` : `<div class="stat"><span class="label">Hours saved</span><span class="value">${dash()}</span><span class="hint">Needs a baseline before it can be shown.</span></div>`}
      </div>
      <div class="card"><h3>How the totals are counted</h3><div style="margin-top:8px">${kv(isContoh ? [['Hours saved', 'Only Document workflow. Invoice triage touches the same work, so adding it would count hours twice.'], ['Documents', 'Added across solutions.'], ['People using it', 'Each person counted once.'], ['Rates', 'Worked out from the totals, never an average of averages.']] : [['Hours saved', rolled.length ? 'One solution, added up by day.' : 'Nothing yet: no approved baseline.']], 110)}</div></div>
    </section>
    ${narrative}
    ${sols.map((sid) => { const cs = cards.filter((c) => c.sol === sid); return cs.length ? `<section class="grid" style="gap:12px"><div class="card-head" style="margin:0"><h2>${esc(M.solutions[sid].name)}</h2><span class="head-actions">${statusPill(solStatus(sid))}<a class="btn sm" href="#solution-${sid}">Open${icon('chev', 'sm')}</a></span></div><div class="grid ${gridFor(cs.length)}">${cs.map(kpiCardHtml).join('')}</div></section>` : ''; }).join('')}`}
    ${client ? '' : `<section class="grid g2">
      <div class="card"><div class="card-head"><h2>Contract</h2><span class="pill idle">${icon('lock', 'sm')}REKA only</span></div>
        ${has('Commercial') ? `<div class="grid g2"><div class="stat"><span class="label">Monthly fee</span><span class="value" style="font-size:1.375rem">${money(o.contract.amount, o.contract.currency)}</span></div><div class="stat"><span class="label">Running cost, September</span><span class="value" style="font-size:1.375rem">${o.runCost ? money(o.runCost.amount, o.runCost.currency) : '–'}</span><span class="hint">From AX Frame</span></div><div class="stat"><span class="label">Renewal</span><span class="value" style="font-size:1.125rem">${o.renewal}</span><span class="hint">Risk: ${o.renewalRisk}</span></div></div>` : `<div class="callout info">${icon('lock')}<span>Only people with the commercial right see fees. Switch to Aisyah Rahman from your profile menu to try it.</span></div>`}</div>
      <div class="card"><div class="card-head"><h2>Notes</h2><span class="pill idle">${icon('lock', 'sm')}REKA only</span></div><p class="small">${isContoh ? 'Finance director asked for a split by document type from October. The new “reason” detail in the data makes that possible.' : 'No notes yet.'}</p></div>
    </section>`}`;
  };
  pages.organisation.after = (id) => {
    if (id !== 'contoh-logistik' || !$('#ch-org')) return;
    drawChart($('#ch-org'), bucket(impactDaily('doc-workflow', windowDays(state.range)), state.range > 30), { id: 'org', kind: 'band', label: 'Hours saved, Contoh Logistik', height: 200, tip: bandTip });
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
    const tabs = [['outcomes', 'Outcomes'], ['measures', 'Measures'], ['usage', 'Usage'], ['health', 'Health'], ['data', 'Data and connection']];
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
    ${head({ crumbs: crumbs(['Organisations', '#organisations'], [o.short, '#organisation-' + o.id], [s.name]), title: esc(s.name), meta: `${statusPill(st)}<span>${esc(o.projects[0].name)}</span><span>Live since ${day(s.live)}</span>`, actions: rangeSeg() })}
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
      const simTabs = `<div class="tabs" role="tablist">${[['outcomes', 'Overview'], ['measures', 'Measures']].map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${(state.solTab === 'measures' ? 'measures' : 'outcomes') === k}">${l}</button>`).join('')}</div>`;
      if (state.solTab === 'measures') body = `${banner}${simTabs}${measuresTab(projOfSim(s))}`;
      else body = `${banner}${simTabs}
        ${hasBase(s) && s.kpis.includes('impact') && r.vol ? breakdownHtml(s.base, r.machine, K.review, K.noun, ({ sample: `timed on ${s.base.n} ${K.nouns}`, history: 'from past records', estimate: 'the client’s estimate' })[s.base.method], '') : ''}
        <div class="grid ${gridFor(cards.length)}">${cards.map(kpiCardHtml).join('')}</div>
        <section class="card"><div class="card-head"><div><h2>${cap(K.nouns)} handled</h2><p class="sub">${state.range > 30 ? 'By week' : 'By day'} · measured · simulated</p></div></div><div class="chart" id="ch-sim"></div>
          <div class="legend"><span><i style="background:var(--s1)"></i>Measured</span><span><i style="box-shadow:inset 0 0 0 1.5px var(--warn)"></i>No data, not zero</span></div></section>
        ${!s.reportScheduled ? `<section class="card"><div class="row" style="border:0;padding:0"><span class="ico info">${icon('reports', 'sm')}</span><div><div class="what">Schedule the client report</div><div class="meta">${esc(s.project.cadence)} · drafted for you, sent only after you check it</div></div><button type="button" class="btn primary sm" data-act="schedule-report" data-sim="${s.id}">Schedule report</button></div></section>`
        : `<section class="card"><div class="row" style="border:0;padding:0"><span class="ico ${rs.st === 'ready' ? 'warn' : 'ok'}">${icon('reports', 'sm')}</span><div><div class="what">${rs.st === 'ready' ? `${monthName(rs.ym)} report is ready to review` : rs.st === 'approved' ? `${monthName(rs.ym)} report approved` : `${esc(s.project.cadence)} report scheduled`}</div><div class="meta">${rs.st === 'waiting' ? `First draft on ${nextMonthStart()}, once a full month of figures is in. Move the date forward in Demo studio to see it.` : 'Drafted from the figures above'}</div></div>${rs.st !== 'waiting' ? `<a class="btn sm ${rs.st === 'ready' ? 'primary' : ''}" href="#report-${s.id}">Open report</a>` : ''}</div></section>`}`;
    }
    return `${head({ crumbs: crumbs([o.name, '#org-' + o.id], [s.name]), title: esc(s.name), meta: `${statusPill(st)}<span>${esc(s.project.name)}</span><span>${K.label}</span>`, actions: s.stage === 'collecting' ? rangeSeg() : '' })}
      ${strip}${body}`;
  };
  pages.sim.after = (id) => {
    builderAfter();
    const el = $('#ch-sim'); if (!el) return;
    const s = simById(id);
    drawChart(el, bucket(simDaily(s, simWindow(state.range)).map((p) => p.gap ? Object.assign(p, { v: null }) : p), state.range > 30), { id: 'sim', kind: 'columns', label: `${kindOf(s).nouns} handled`, height: 210, tip: (p) => p.before ? '<div>Before collection started</div>' : p.gap ? '<div>No data. Not counted as zero.</div>' : `<div><span class="mono">${nf(p.v)}</span> ${kindOf(s).nouns}</div>` });
  };

  // ------------------------------------------------------------------ CONNECT WIZARD
  const WSTEPS = ['Solution', 'How it shares data', 'Developer setup', 'Connect and test', 'Check the data', 'Choose KPIs', 'Baseline', 'Review and send'];
  const foundFor = (K) => [
    [`${cap(K.nouns)} handled`, `${K.nouns}.processed`, 'Count, every day', 'ok'],
    [`Time to process a ${K.noun}`, `${K.nouns}.processing_duration`, 'Average seconds, every day', 'ok'],
    [`${cap(K.nouns)} ${K.qual.label}`, `${K.nouns}.flagged`, 'Count, every day', 'ok'],
    ['People reviewing', 'reviewers.active', 'Distinct people, every week · a code, never a name', 'ok'],
    ['Items extracted', 'items.extracted', 'Count, every day', 'warn', 'The unit “item” isn’t standard. Fine to use; ask the developer to rename it x.item when convenient.'],
    [`${cap(K.nouns)} by customer name`, `${K.nouns}.by_customer_name`, 'Count, split by customer', 'fault', 'Split by customer name, which could identify people. Held back unless an admin approves it.'],
  ];
  const wizSim = () => simById(state.focusSim);
  const devPrompt = (s) => { const K = kindOf(s); return `Add the REKA measurement link to ${state.wiz.solName || s.name}, following the integration pack (integrations/measure in antarax-ripple-monitoring).

- Add read-only endpoints under /internal/measure/v1: manifest, metrics, observations, health.
- Don't change the app's own data model or API.
- Share daily totals only: ${K.nouns} handled, processing time (sum and count), ${K.nouns} ${K.qual.label}, active reviewers (pseudonymous).
- No document text, customer names or personal data.
- Sign requests with the service key in REKA_MEASURE_KEY.
- Run the contract test before you finish: npx @reka/measure-test <url>
- If there's no baseline, say so. Don't guess one.`; };

  pages.connect = (id) => {
    if (id) state.focusSim = id;
    let s = wizSim();
    if (!s || s.stage !== 'draft') { s = state.sims.find((x) => x.stage === 'draft'); if (s) { state.focusSim = s.id; state.wiz = freshWizard(); } }
    if (!s) return `${head({ title: 'Connect a solution' })}<section class="card"><div class="empty">${emptyArt}<h3>${state.orgs.length ? 'Create a project first' : 'Add the organisation and project first'}</h3><p>A solution is measured against a project’s outcome, so we need both before connecting.</p><a class="btn primary" href="${state.orgs.length ? '#new-project' : '#new-organisation'}">${state.orgs.length ? 'Create project' : 'Add organisation'}</a></div></section>`;
    const w = state.wiz, o = orgOf(s), K = kindOf(s), solName = w.solName || s.name;
    if (!w.baseline) w.baseline = { method: 'sample', mid: K.base.mid, low: K.base.low, high: K.base.high, n: 20, period: `${day(M.addDays(today(), 5))} to ${day(M.addDays(today(), 9))}`, note: '' };
    const nav = `<ol class="wsteps">${WSTEPS.map((l, i) => `<li class="${i + 1 < w.step ? 'done' : i + 1 === w.step ? 'now' : ''}" ${i + 1 === w.step ? 'aria-current="step"' : ''}><b>${i + 1 < w.step ? '✓' : i + 1}</b><span>${l}</span></li>`).join('')}</ol>`;
    const foot = (label, disabled) => `<div class="wfoot">${w.step > 1 ? `<button type="button" class="btn ghost" data-act="w-back">${icon('back', 'sm')}Back</button>` : `<a class="btn ghost" href="#org-${o.id}">Cancel</a>`}<button type="button" class="btn primary lg" data-act="w-next" ${disabled ? 'disabled' : ''}>${label}</button></div>`;
    const props = kpiProposals(s);
    let panel = '';
    if (w.step === 1) panel = `<div><h2>Which solution are you connecting?</h2><p class="small muted" style="margin-top:4px">For ${esc(o.name)} · ${esc(s.project.name)}</p></div>
        <div class="form-grid"><div class="field full"><label for="w-sol">Solution name</label><input id="w-sol" value="${esc(solName)}"><span class="help">What your team calls it.</span></div>
        <div class="field"><label for="w-env">Environment</label><select id="w-env"><option>Production</option><option>Staging, for testing</option></select><span class="help">Only production feeds client reports.</span></div>
        <div class="field"><label for="w-ver">Version</label><input id="w-ver" value="1.0.0"></div></div>${foot('Continue')}`;
    if (w.step === 2) panel = `<div><h2>How will it share its figures?</h2><p class="small muted" style="margin-top:4px">Outcomes only reads daily totals. It never changes anything in the solution.</p></div>
        <div class="choice-grid">${[['link', 'link', 'Measurement link', 'The solution serves a small read-only link that we call each night. Best for anything REKA builds.', 'Recommended'], ['axle', 'box', 'An AntaraX product', 'Yara, Janka and others already share totals with AXLE. Nothing to build.', ''], ['sheet', 'sheet', 'Spreadsheet upload', 'For systems that can’t serve a link. Someone uploads a CSV each week.', '']].map(([k, ic, t, d, tag]) => `<button type="button" class="choice" data-method="${k}" aria-pressed="${w.method === k}"><span class="ic">${icon(ic)}</span><span><b>${t}</b><span class="d">${d}</span></span>${tag ? `<span class="pill info tag">${tag}</span>` : '<span class="radio"></span>'}</button>`).join('')}</div>
        ${w.method !== 'link' ? `<div class="callout info">${icon('insight')}<span>This mock follows the measurement link path. The other two work the same way from step 4.</span></div>` : ''}${foot('Continue')}`;
    if (w.step === 3) panel = `<div><h2>Ask the developer to add the link</h2><p class="small muted" style="margin-top:4px">About a day of work. Send them this brief. It works with Claude Code or Codex too.</p></div>
        <div class="grid" style="gap:8px"><div class="card-head" style="margin:0"><span class="small muted">Brief for the developer</span><button type="button" class="btn sm" data-act="copy-prompt">${icon('copy', 'sm')}Copy brief</button></div><div class="code-block" id="dev-prompt">${esc(devPrompt(s))}</div></div>
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
        <div class="list">${foundFor(K).map(([n, k, kind, st, note]) => `<div class="row"><span class="ico ${st}">${icon(st === 'ok' ? 'check' : st === 'warn' ? 'alerts' : 'lock', 'sm')}</span><div><div class="what">${esc(n)}</div><div class="meta"><span>${kind}</span><span class="mono">${k}</span></div>${note ? `<div class="small" style="margin-top:4px;color:var(--${st}-ink)">${esc(note)}</div>` : ''}</div><span class="pill ${st}">${st === 'ok' ? 'Ready' : st === 'warn' ? 'Note' : 'Held back'}</span></div>`).join('')}</div>
        ${foot('Suggest KPIs')}`;
    if (w.step === 6) panel = !w.proposals ? `<div class="thinking" style="padding:8px 0"><img src="${SPARK}" alt=""><span>Reading 4 figures and suggesting KPIs for ${esc(s.project.name)}…</span></div><div class="grid" style="gap:10px"><div class="skel" style="height:72px"></div><div class="skel" style="height:72px"></div><div class="skel" style="height:72px"></div></div>` : `
        <div class="card-head" style="margin:0"><div><h2>Choose what to measure</h2><p class="small muted" style="margin-top:4px">Suggested from what ${esc(solName)} shares and what the project is for.</p></div>${aiMark()}</div>
        ${props.map((p) => `<div class="pick ${w.keep[p.id] ? 'on' : 'off'}"><div class="top"><div><h3>${esc(p.name)}</h3><div class="meta-line" style="margin-top:6px"><span class="pill idle">${p.kind}</span>${q(p.quality)}</div></div><button type="button" class="switch" role="switch" aria-checked="${!!w.keep[p.id]}" aria-label="Measure ${esc(p.name)}" data-keep="${p.id}"></button></div><p class="why">${esc(p.why)}</p><details class="more"><summary>How it’s worked out</summary><div class="small">${esc(p.formula)}</div></details>${p.needsBaseline && w.keep[p.id] ? `<div class="callout warn" style="padding:10px 12px">${icon('target', 'sm')}<span>Needs a baseline. You’ll set it next.</span></div>` : ''}</div>`).join('')}
        <div class="callout ai">${icon('insight')}<span style="flex:1"><b>Accuracy</b> would be worth measuring, but the solution doesn’t count reviewer corrections yet.</span><button type="button" class="btn sm" data-act="add-gap">Ask the developer</button></div>
        ${foot(`Continue with ${Object.values(w.keep).filter(Boolean).length} KPIs`, !Object.values(w.keep).some(Boolean))}`;
    if (w.step === 7) {
      const b = w.baseline;
      panel = `<div><h2>How long does a ${K.noun} take by hand?</h2><p class="small muted" style="margin-top:4px">Hours saved compares today with before. Agree this with ${esc(o.name)}: it appears in every report.</p></div>
        ${w.keep.impact ? `<div class="grid g2" style="gap:10px">${[['sample', 'clock', 'Time a sample', `Someone times 20 or more ${K.nouns} by hand. Most trusted.`], ['history', 'documents', 'Use past records', 'From the client’s own system, if it logged the time.'], ['estimate', 'people', 'The client’s estimate', 'Quickest. Reports label it as an estimate.'], ['none', 'target', 'Not available yet', 'Hours saved shows “needs a baseline” until you add one.']].map(([k, ic, t, d]) => `<button type="button" class="choice" style="grid-template-columns:44px minmax(0,1fr)" data-bmethod="${k}" aria-pressed="${b.method === k}"><span class="ic">${icon(ic)}</span><span><b>${t}</b><span class="d">${d}</span></span></button>`).join('')}</div>
        ${b.method !== 'none' ? `<div class="form-grid">
          <div class="field"><label for="b-mid">Typical minutes per ${K.noun}</label><input id="b-mid" type="number" inputmode="decimal" value="${b.mid}"></div>
          <div class="field"><label for="b-low">Fastest and slowest</label><div class="with-btn"><input id="b-low" type="number" aria-label="Fastest, minutes" value="${b.low}"><input id="b-high" type="number" aria-label="Slowest, minutes" value="${b.high}"></div><span class="help">Reports show hours saved as a range from these.</span></div>
          ${b.method === 'sample' ? `<div class="field"><label for="b-n">${cap(K.nouns)} timed</label><input id="b-n" type="number" value="${b.n}"></div><div class="field"><label for="b-period">When</label><input id="b-period" value="${esc(b.period)}"><span class="help">Before go-live, so it reflects the old way.</span></div>` : ''}
          <div class="field full"><label for="b-note">Evidence</label><input id="b-note" placeholder="e.g. Timing sheet signed by Farah Idris" value="${esc(b.note)}"></div></div>` : ''}` : `<div class="callout info">${icon('check')}<span>None of the KPIs you chose need a baseline.</span></div>`}
        ${foot('Review')}`;
    }
    if (w.step === 8) {
      const kept = props.filter((p) => w.keep[p.id]), b = w.baseline;
      panel = `<div><h2>Review and send for approval</h2><p class="small muted" style="margin-top:4px">Someone other than you approves the KPIs and baseline. Collection starts once they do.</p></div>
        ${kv([['Solution', `${esc(solName)} · ${esc(o.name)}`], ['Shares by', 'Measurement link, read-only key'], ['Collects', 'Every night at 06:00 MYT · health every 15 minutes'], ['KPIs', kept.map((p) => esc(p.name)).join('<br>')], ['Baseline', w.keep.impact ? (b.method === 'none' ? 'Not available yet' : `${b.mid} min per ${K.noun}, ${b.low} to ${b.high} · ${({ sample: `timed sample of ${b.n} ${K.nouns}`, history: 'past records', estimate: 'client estimate' })[b.method]}`) : '–'], ['Held back', `${cap(K.nouns)} by customer name`]], 120)}
        <div class="field"><label for="w-appr">Who approves</label><select id="w-appr"><option>Aisyah Rahman · Admin</option></select><span class="help">You can’t approve what you set up yourself.</span></div>
        ${foot('Send for approval')}`;
    }
    return `${head({ crumbs: crumbs([o.name, '#org-' + o.id], ['Connect a solution']), title: 'Connect a solution', lead: `${esc(s.project.name)} · step ${w.step} of ${WSTEPS.length}` })}
      <div class="wizard">${nav}<div class="card wpanel" id="wpanel">${panel}</div></div>`;
  };
  pages.connect.after = () => {
    const w = state.wiz;
    const r = $('#w-ready'); if (r) r.addEventListener('change', () => { w.devReady = r.checked; render(); });
    const map = { 'b-mid': 'mid', 'b-low': 'low', 'b-high': 'high', 'b-n': 'n', 'b-period': 'period', 'b-note': 'note' };
    Object.keys(map).forEach((id) => { const el = $('#' + id); if (el) el.addEventListener('input', () => { w.baseline[map[id]] = el.type === 'number' ? +el.value : el.value; }); });
    const sol = $('#w-sol'); if (sol) sol.addEventListener('input', () => { w.solName = sol.value; });
    const url = $('#w-url'); if (url) url.addEventListener('input', () => { w.url = url.value; });
    if (w.step === 6 && !w.proposals) setTimeout(() => { w.proposals = true; if (/^#connect/.test(location.hash)) render(); }, reduceMotion ? 0 : 1500);
  };
  function runTests() {
    const w = state.wiz;
    const lines = ['Found the link', 'Secure connection', 'Signed request accepted', 'Read what it shares: 6 figures, daily', 'Health check: healthy', 'Read one day of figures'];
    w.tests = lines.map((t) => [t, 'wait']); render();
    lines.forEach((t, i) => setTimeout(() => { w.tests[i] = [t, 'ok']; if (i === lines.length - 1) w.tested = true; if (/^#connect/.test(location.hash)) render(); }, reduceMotion ? 0 : 320 * (i + 1)));
  }
  function wizardNext() {
    const w = state.wiz;
    if (w.step === 4 && !w.tested) { if (!/^https:\/\//.test(w.url)) { toast('The address must start with https.'); return; } runTests(); return; }
    if (w.step === 7 && w.keep.impact && w.baseline.method !== 'none' && !(w.baseline.low <= w.baseline.mid && w.baseline.mid <= w.baseline.high && w.baseline.mid > 0)) { toast('Check the minutes: fastest ≤ typical ≤ slowest.'); return; }
    if (w.step === 8) { finishWizard(); return; }
    w.step++; render(); window.scrollTo(0, 0);
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
    return `${head({ title: 'Approvals', lead: 'Nothing is measured or shown to a client until someone other than the proposer approves it.', meta: `<span>${list.filter((a) => a.status === 'waiting').length} waiting</span><span>${list.filter((a) => a.status === 'blocked').length} blocked</span>` })}
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
  pages.reports = () => {
    const lead = 'Each client gets a report on their schedule. It’s drafted for you and goes out only after you check it.';
    if (!demo()) {
      const live = state.sims.filter((s) => s.stage === 'collecting');
      if (!state.sims.length) return `${head({ title: 'Reports', lead })}<section class="card"><div class="empty">${emptyArt}<h3>No reports yet</h3><p>Once a solution is collecting data, you can schedule its report here.</p></div></section>`;
      return `${head({ title: 'Reports', lead })}<section class="card"><div class="table-wrap"><table><thead><tr><th>Report</th><th>Organisation</th><th>Period</th><th>Status</th><th></th></tr></thead><tbody>
        ${state.sims.map((s) => { const r = simReportState(s); return `<tr><td><span class="name">${esc(s.project.name)}</span><span class="sub">${esc(s.project.cadence)}</span></td><td>${esc(orgOf(s).name)}</td><td class="mono">${r.st === 'ready' || r.st === 'approved' ? monthName(r.ym) : '–'}</td><td>${({ none: s.stage === 'collecting' ? '<span class="pill idle">Not scheduled</span>' : '<span class="pill idle">Waiting for data</span>', waiting: `<span class="pill info">First draft ${nextMonthStart()}</span>`, ready: '<span class="pill warn"><span class="dot"></span>Ready to review</span>', approved: '<span class="pill ok"><span class="dot"></span>Approved</span>' })[r.st]}</td><td>${r.st === 'none' && s.stage === 'collecting' ? `<button type="button" class="btn sm" data-act="schedule-report" data-sim="${s.id}">Schedule</button>` : r.st === 'ready' || r.st === 'approved' ? `<a class="btn sm" href="#report-${s.id}">Open</a>` : ''}</td></tr>`; }).join('')}
      </tbody></table></div></section>${live.some((s) => simReportState(s).st === 'waiting') ? `<div class="demo-bar"><span class="tag">MOCK CONTROLS</span><span>Reports draft on the 1st of each month.</span><button type="button" class="btn sm" data-act="to-month-end">Jump to ${nextMonthStart()}</button></div>` : ''}`;
    }
    return `${head({ title: 'Reports', lead })}
    <section class="card"><div class="table-wrap"><table><thead><tr><th>Report</th><th>Organisation</th><th>Period</th><th>Status</th><th></th></tr></thead><tbody>
      <tr class="link" data-go="report" tabindex="0"><td><span class="name">Accounts payable automation</span><span class="sub">Monthly</span></td><td>Contoh Logistik</td><td class="mono">Sep 2026</td><td>${state.reportApproved ? '<span class="pill ok"><span class="dot"></span>Approved</span>' : '<span class="pill warn"><span class="dot"></span>Ready to review</span>'}</td><td><a class="btn sm" href="#report">Open</a></td></tr>
      <tr><td><span class="name">Production planning assistant</span><span class="sub">Monthly</span></td><td>Acme Plastics</td><td class="mono">Sep 2026</td><td><span class="pill ok"><span class="dot"></span>Sent 3 Oct</span></td><td></td></tr>
      <tr><td><span class="name">Quotation drafting</span><span class="sub">Quarterly</span></td><td>Bina Jaya</td><td class="mono">Q3 2026</td><td><span class="pill ok"><span class="dot"></span>Sent 7 Oct</span></td><td></td></tr>
      <tr><td><span class="name">Patient enquiry triage</span><span class="sub">Monthly</span></td><td>Sampel Medik</td><td class="mono">Oct 2026</td><td><span class="pill idle">Drafts 1 Nov</span></td><td></td></tr>
    </tbody></table></div></section>`;
  };
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
      notes: [`Counted by ${esc(s.name)}, collected nightly.${cur.missing ? ` ${cur.missing} missing day${cur.missing > 1 ? 's' : ''} not counted.` : ''}`, hasBase(s) ? `${cap(K.nouns)} × (${B.mid} minutes by hand − ${nf(cur.machine, 1)} machine minutes − ${K.review.mid} review minutes) ÷ 60. By-hand time: ${({ sample: `a timed sample of ${B.n} ${K.nouns}`, history: 'the client’s past records', estimate: 'the client’s estimate' })[B.method]}. The range uses the fastest and slowest times. Machine time is never counted as time saved.` : 'No baseline has been agreed, so hours freed are not reported.', `${cap(K.nouns)} ${K.qual.label} ÷ ${K.nouns} handled.`],
      caveat: 'These figures compare this month with the baseline. They don’t show what caused every change. Hours freed are an estimate, not hours removed from anyone’s week.',
      next: [`Re-time a fresh sample of ${K.nouns} to confirm the baseline.`, `Look at the ${K.nouns} ${K.qual.label} to see what the AI finds hard.`, 'Agree the next quarter’s target with the client.'] })}`;
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
    let html = `<section class="grid" style="gap:6px"><div class="card-head" style="margin:0"><div><h2>Measures</h2><p class="sub">Last 30 days · the same library for every project, worked out from the solution’s daily figures</p></div><span class="head-actions"><a class="btn sm" href="#analytics" data-an-proj="${proj.id}">Open in analytics</a><button type="button" class="btn sm primary" data-act="bld-open" data-proj="${proj.id}">${icon('plus', 'sm')}Add a measure</button></span></div></section>`;
    if (state.bld && state.bld.proj === proj.id) html += builderHtml(proj);
    const cms = proj.custom();
    html += `<section class="grid" style="gap:12px"><h3 class="muted" style="font-weight:500">Your measures</h3>${cms.length ? `<div class="grid ${gridFor(Math.min(3, cms.length))}">${cms.map((cm) => {
      const meta = customMeta(cm), v = evalCustom(proj, cm, days), pv = evalCustom(proj, cm, prevDays);
      const pill = cm.status === 'live' ? '' : `<div class="meta-line" style="margin:0">${cm.status === 'waiting' ? '<span class="pill warn"><span class="dot"></span>Waiting for approval</span>' : cm.status === 'changes' ? '<span class="pill info">Changes asked</span>' : '<span class="pill idle">Declined</span>'}${cm.status === 'waiting' && cm.by === state.role && cm.by !== 'aisyah' ? `<button type="button" class="btn sm ghost" data-act="cm-approve" data-proj="${proj.id}" data-cm="${cm.id}">Mock: Aisyah approves</button>` : ''}</div>`;
      return tile(cm.name, meta.quality, fmtM(meta, v), null, chgTxt(v, pv, 'up'), sparkline(weeksOf(aWindow(84)).map((w) => evalCustom(proj, cm, w))), `${customFormula(cm)} · ${cm.aud === 'client' ? 'team and client' : 'team only'}${cm.target ? ` · target ${cm.target}` : ''}`, pill);
    }).join('')}</div>` : `<div class="card"><div class="empty" style="padding:16px"><p>Add a measure of your own from the figures this solution shares, for example “hours saved per person”. It goes for approval like any KPI.</p></div></div>`}</section>`;
    DOMAINS.forEach((dm) => {
      const ms = MEASURES.filter((m) => m.domain === dm);
      if (dm === 'Commercial' && !has('Commercial')) { html += `<section class="grid" style="gap:12px"><h3 class="muted" style="font-weight:500">${dm}</h3><div class="callout info">${icon('lock')}<span>Running cost per item is REKA only, for people with the commercial right. Switch to Aisyah Rahman from your profile menu to see it.</span></div></section>`; return; }
      html += `<section class="grid" style="gap:12px"><h3 class="muted" style="font-weight:500">${dm}${dm === 'Commercial' ? ' · REKA only, never in client output' : ''}</h3><div class="grid ${ms.length === 1 ? 'g2' : gridFor(Math.min(4, ms.length))}">${ms.map((m) => {
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
        ${b.op === 'ratio' || b.op === 'per' ? `<div class="field"><label for="bld-b">${b.op === 'ratio' ? 'Out of' : 'Per'}</label><select id="bld-b">${fieldOpts(b.b)}</select></div>` : b.op === 'value' ? `<div class="field"><label for="bld-rate">Rate, RM each</label><input id="bld-rate" type="number" value="${esc(b.rate)}"><span class="help">Agree the rate with the client. Shown as an estimate.</span></div>` : '<div></div>'}
        <div class="field"><label for="bld-target">Target, optional</label><input id="bld-target" value="${esc(b.target)}" placeholder="e.g. 40"></div>
        <div class="field"><span class="lab">Who sees it</span><div class="seg"><button type="button" data-baud="team" aria-pressed="${b.aud !== 'client'}">Team only</button><button type="button" data-baud="client" aria-pressed="${b.aud === 'client'}">Team and client</button></div></div>
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

  // ------------------------------------------------------------------ ANALYTICS: standard views over any measure
  pages.analytics = () => {
    const ps = projects();
    if (!ps.length) return `${head({ title: 'Analytics', lead: 'Trends, comparisons and patterns for any measure, across one project or all of them.' })}<section class="card"><div class="empty">${emptyArt}<h3>Nothing to analyse yet</h3><p>Analytics appears once a solution is collecting figures. Connect one, or simulate a few in Demo studio.</p><div class="head-actions" style="justify-content:center"><button type="button" class="btn primary" data-act="studio">Open Demo studio</button><button type="button" class="btn" data-act="switch-mode">Example workspace</button></div></div></section>`;
    const a = state.an = state.an || { measure: 'hours', proj: 'all', range: 90 };
    if (a.proj !== 'all' && !ps.some((p) => p.id === a.proj)) a.proj = 'all';
    const sel = a.proj === 'all' ? ps : ps.filter((p) => p.id === a.proj);
    const visible = MEASURES.filter((m) => !m.reka || has('Commercial'));
    if (!visible.some((m) => m.key === a.measure)) a.measure = 'hours';
    const m = mByKey(a.measure);
    const days = aWindow(a.range), prevDays = windowDays(a.range, M.addDays(days[0], -1));
    const cur = mergeTotals(sel.map((p) => totals(p, days))), prv = mergeTotals(sel.map((p) => totals(p, prevDays)));
    const v = m.calc(cur), pv = m.calc(prv), rg = m.range ? m.range(cur) : null;
    const okCmp = comparable(cur, prv);
    const chg = okCmp && v !== null && pv ? 100 * (v - pv) / Math.abs(pv) : null;
    const rows = ps.map((p) => { const t = totals(p, days), tp = totals(p, prevDays); return { p, v: m.calc(t), pv: comparable(t, tp) ? m.calc(tp) : null }; }).sort((x, y) => (y.v === null ? -1e12 : y.v) - (x.v === null ? -1e12 : x.v));
    const maxV = Math.max(...rows.map((r) => r.v || 0), 1);
    const wd = [1, 2, 3, 4, 5, 6, 0].map((w) => { const dd = days.filter((d) => M.weekday(d) === w); const ts = sel.map((p) => totals(p, dd)); const t = mergeTotals(ts); const val = m.calc(t); const nd = Math.max(...ts.map((x) => x.n), 0); return [DAYS[w].slice(0, 3), val === null ? null : m.sum ? (nd ? val / nd : null) : val]; });
    const wdMax = Math.max(...wd.map(([, x]) => x || 0), 1);
    const good = chg === null ? null : (m.better === 'up' ? chg >= 0 : chg <= 0);
    const pctTxt = (c) => c === null ? '–' : (c >= 0 ? '+' : '−') + nf(Math.abs(c), 0) + '%';
    return `${head({ title: 'Analytics', lead: 'Trends, comparisons and patterns for any measure, across one project or all of them.', actions: `<button type="button" class="btn sm" data-act="an-ask"><img src="${SPARK}" alt="" style="width:16px">Ask about this</button><button type="button" class="btn sm" data-act="export">Export CSV</button>` })}
    <section class="card" style="padding:14px 18px"><div class="form-grid an-controls">
      <div class="field"><label for="an-m">Measure</label><select id="an-m">${DOMAINS.map((dm) => { const xs = visible.filter((x) => x.domain === dm); return xs.length ? `<optgroup label="${dm}">${xs.map((x) => `<option value="${x.key}" ${x.key === a.measure ? 'selected' : ''}>${x.name}</option>`).join('')}</optgroup>` : ''; }).join('')}</select></div>
      <div class="field"><label for="an-p">Projects</label><select id="an-p"><option value="all">All projects (${ps.length})</option>${ps.map((p) => `<option value="${p.id}" ${p.id === a.proj ? 'selected' : ''}>${esc(p.org)} · ${esc(p.name)}</option>`).join('')}</select></div>
      <div class="field"><span class="lab">Period</span><div class="seg">${[[30, '30 days'], [90, '90 days'], [365, '12 months']].map(([d, l]) => `<button type="button" data-anrange="${d}" aria-pressed="${a.range === d}">${l}</button>`).join('')}</div></div>
    </div></section>
    <section class="grid g4 stats">
      <div class="card stat"><span class="label">${esc(m.name)} ${q(m.quality)}</span><span class="value">${fmtM(m, v) || '–'}</span><span class="hint">${rg ? `Likely ${fmtM(m, rg[0])} to ${fmtM(m, rg[1])}` : esc(RANGES[a.range])}</span></div>
      <div class="card stat"><span class="label">The period before</span><span class="value">${fmtM(m, pv) || '–'}</span><span class="hint">${pv === null ? 'No figures then' : 'Same length, just before'}</span></div>
      <div class="card stat"><span class="label">Change</span><span class="value" style="color:var(--${good === null ? 'ink' : good ? 'ok-ink' : 'fault-ink'})">${pctTxt(chg)}</span><span class="hint">${chg === null ? (okCmp ? 'Needs two periods of figures' : 'Too few days of data before to compare fairly') : (good ? 'Better' : 'Worse') + (m.better === 'up' ? ', higher is better' : ', lower is better')}</span></div>
      <div class="card stat"><span class="label">Days with data</span><span class="value">${cur.expected ? nf(100 * cur.n / cur.expected, 0) + '%' : '–'}</span><span class="hint">${cur.missing} missing day${cur.missing === 1 ? '' : 's'}, never counted as zero</span></div>
    </section>
    <section class="card"><div class="card-head"><div><h2>${esc(m.name)} over time</h2><p class="sub">${a.range > 30 ? 'By week' : 'By day'} · ${a.proj === 'all' ? 'all projects' : esc(sel[0].name)} · against the period before</p></div></div>
      <div class="chart" id="ch-an"></div>
      <div class="legend"><span><i style="background:var(--s1)"></i>This period</span><span><i style="background:var(--baseline)"></i>The period before, dashed</span></div></section>
    <section class="grid g-main">
      <div class="card"><div class="card-head"><div><h2>By project</h2><p class="sub">${esc(RANGES[a.range])} · ${m.sum ? 'added up across projects' : 'each from its own totals, never averaged across projects'}</p></div></div>
        <div class="table-wrap"><table><thead><tr><th>Project</th><th class="num">${esc(m.name)}</th><th class="num">Change</th><th>12 weeks</th></tr></thead><tbody>
        ${rows.map((r) => { const c = r.v !== null && r.pv ? 100 * (r.v - r.pv) / Math.abs(r.pv) : null, gd = c === null ? null : (m.better === 'up' ? c >= 0 : c <= 0); return `<tr class="link" data-anpick="${r.p.id}" tabindex="0"><td><span class="name">${esc(r.p.name)}</span><span class="sub">${esc(r.p.org)} · ${STATUS[r.p.stat()][1].toLowerCase()}</span>${m.sum && r.v !== null ? `<div class="bar-track" style="margin-top:6px;height:6px"><div class="bar-fill" style="width:${100 * r.v / maxV}%"></div></div>` : ''}</td><td class="num">${fmtM(m, r.v) || '<span class="dash">–</span> <span class="needs">not shared</span>'}</td><td class="num" style="color:var(--${gd === null ? 'muted' : gd ? 'ok-ink' : 'fault-ink'})">${pctTxt(c)}</td><td>${sparkline(weeksOf(aWindow(84)).map((w) => m.calc(totals(r.p, w))), 90, 26)}</td></tr>`; }).join('')}
        </tbody></table></div></div>
      <div class="card"><div class="card-head"><div><h2>By weekday</h2><p class="sub">${m.sum ? 'Average a day' : 'From that weekday’s totals'}</p></div></div>
        <div class="impact">${wd.map(([l, x]) => `<div class="ib-row" style="grid-template-columns:40px minmax(0,1fr)"><span class="lab">${l}</span><div class="ib-bar" style="align-items:center;gap:8px;height:22px"><div class="ib-seg measured" style="width:${x === null ? 0 : Math.max(1, 72 * x / wdMax)}%"></div><span class="mono xs ink">${fmtM(m, x) || '–'}</span></div></div>`).join('')}</div>
        <p class="small muted" style="margin-top:12px">${esc(m.how)}</p></div>
    </section>`;
  };
  pages.analytics.after = () => {
    const el = $('#ch-an'); if (!el) return;
    const a = state.an, ps = projects(), sel = a.proj === 'all' ? ps : ps.filter((p) => p.id === a.proj), m = mByKey(a.measure);
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
  function askAnswer(raw) {
    const ql = raw.toLowerCase(), ps = projects();
    if (!ps.length) return { html: '<p>There are no figures to answer from yet. Connect a solution, or simulate one in Demo studio, and ask again.</p>' };
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
    if (/attention|needs? (me|you)|problem|wrong|issue|alert|broken|stuck/.test(ql)) {
      const list = demo() ? demoAtt() : needsYou();
      return { html: list.length ? `<p>${list.length} thing${list.length === 1 ? '' : 's'} need you, worst first:</p><ul>${list.slice(0, 6).map(([, , t, mm, h]) => `<li><a href="${h}">${esc(t)}</a> <span class="muted">· ${esc(mm)}</span></li>`).join('')}</ul>` : '<p>Nothing needs you. Every solution sent its figures on time.</p>' };
    }
    if (/how (is|are|do|does)|calculat|formula|worked out|what does .* mean|definition/.test(ql)) {
      return { html: `<p><b>${esc(m.name)}</b> ${q(m.quality)}</p><p>${esc(m.how)}</p>${m.key === 'hours' ? '<p>Minutes by hand come from the baseline the client agreed. Machine time is never counted as a person’s time. The likely range uses the fastest and slowest times in the baseline.</p>' : ''}<p class="xs muted">Every project uses the same definition, so they can be compared.</p>` };
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
    return [`How many hours did we save in ${monthName(lastFullMonth())}?`, 'What needs my attention?', p ? `Why did ${p.sol} change this week?` : null, 'Which project improved most this month?', 'Compare all projects', 'Show the trend of work handled', 'How is hours saved worked out?'].filter(Boolean);
  }
  pages.ask = () => {
    const chat = state.chat = state.chat || [];
    return `${head({ title: 'Ask', lead: 'Ask about your projects in plain words. Answers come only from the figures Outcomes collects, and show where each number came from.', actions: chat.length ? '<button type="button" class="btn sm ghost" data-act="ask-clear">New conversation</button>' : '' })}
    <section class="card" style="display:grid;gap:16px">
      ${chat.length ? `<div class="grid" style="gap:16px" id="chat">${chat.map((x, i) => x.role === 'user'
        ? `<div style="justify-self:end;max-width:min(75%,560px);background:var(--primary);color:var(--on-primary);padding:10px 14px;border-radius:16px 16px 4px 16px">${esc(x.text)}</div>`
        : `<div style="display:grid;grid-template-columns:32px minmax(0,1fr);gap:12px;align-items:start"><span class="ico ai" style="width:32px;height:32px;border-radius:10px;display:grid;place-items:center"><img src="${SPARK}" alt="" style="width:18px${x.thinking && !reduceMotion ? ';animation:breathe 1.2s infinite alternate' : ''}"></span><div class="narrative" style="font-size:.9375rem;max-width:none;min-width:0">${x.thinking ? '<p class="muted">Working it out from the figures…</p>' : x.html}${x.chart ? `<div class="chart" id="ask-ch-${i}"></div>` : ''}</div></div>`).join('')}</div>`
      : `<div class="empty" style="padding:12px"><span class="ico ai" style="width:52px;height:52px;border-radius:14px;display:grid;place-items:center"><img src="${SPARK}" alt="" style="width:28px"></span><h3>What do you want to know?</h3><p>For example, how much time a client saved last month, why a figure moved, or which project is improving fastest.</p></div>`}
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
    return [['fault', 'alerts', 'Quote drafter stopped answering', 'Bina Jaya · since 14 Oct, 22:00', '#solution-quote-drafter', 'Check'], ['warn', 'clock', 'Shift planner hasn’t sent data for 2 days', 'Acme Plastics · showing the last good figures', '#solution-shift-planner', 'Open'], ['warn', 'shield', `${waiting} item${waiting === 1 ? '' : 's'} waiting for approval`, has('Approve') ? 'Some are yours to decide' : 'A project manager decides', '#approvals', 'Review'], ['info', 'target', 'Front-desk hours saved needs a baseline', 'Sampel Medik · impact can’t be shown yet', '#approvals', 'Add'], ['info', 'reports', state.reportApproved ? 'September report approved' : 'September report is ready to review', 'Contoh Logistik · due 17 Oct', '#report', 'Open']];
  }

  // ------------------------------------------------------------------ SETTINGS and HELP
  pages.settings = () => `${head({ title: 'Settings', lead: `${esc(state.setup.workspace)} workspace` })}
    <div class="grid g2">
      <section class="card"><div class="card-head"><h2>Team</h2><button type="button" class="btn sm" data-act="invite">${icon('user-plus', 'sm')}Invite</button></div>
        <div class="list">${Object.values(M.staff).map((s) => `<div class="row"><span class="avatar">${s.initials}</span><div><div class="what">${s.name}</div><div class="meta">${s.note}</div></div><span class="pill idle">${s.rights.includes('Approve') ? 'Can approve' : 'Can suggest'}${s.rights.includes('Commercial') ? ' · sees fees' : ''}</span></div>`).join('')}</div>
        <p class="small muted" style="margin-top:12px">Analysts suggest KPIs. Project managers approve them. Only people with the commercial right see fees.</p></section>
      <section class="card"><div class="card-head"><h2>Collection and measures</h2></div>${kv([['Nightly figures', '06:00 MYT'], ['Health checks', 'Every 15 minutes'], ['Data kept in', 'Singapore'], ['Kept for', 'The contract plus 24 months, then monthly totals'], ['Hourly staff cost', 'RM45 an hour, for every client. Used for \u201cvalue of time freed\u201d, always shown as an estimate'], ['Demo workspaces', 'Simulated only, never send anything, cleared after 90 days unless kept']], 140)}</section>
      <section class="card"><div class="card-head"><h2>Audit trail</h2><span class="pill idle">${icon('lock', 'sm')}Can’t be edited</span></div>${activityList(10)}</section>
      <section class="card"><div class="card-head"><h2>Integration pack</h2></div><p class="small">Everything a developer needs to add a measurement link: the contract, examples and a test to run before handing over.</p><div class="code-block" style="margin-top:12px">npx @reka/measure-test https://your-solution/internal/measure/v1</div></section>
    </div>`;
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
        <section class="studio-sec"><h3>${icon('settings', 'sm')}This demo workspace</h3><div class="field"><label for="sb-name">Name</label><input id="sb-name" value="${esc(state.sandboxName)}"><span class="help">For example \u201cDemo for Harapan Foods\u201d before a sales call. Only REKA staff see it. It never sends anything to clients and is cleared after 90 days unless kept.</span></div></section>
        <section class="studio-sec"><h3>${icon('live', 'sm')}Guided demo</h3><p class="help">Plays a new client from nothing to its first report, then measures, analytics and Ask. It clears this demo workspace first.</p><button type="button" class="btn primary" data-act="tour-start">Start the guided demo</button></section>
        <section class="studio-sec"><h3>${icon('plus', 'sm')}Simulate a new project</h3><p class="help">Creates the client, project and solution, with daily figures already flowing. Every name and number is invented.</p>
          <div class="field"><label for="sf-name">Client</label><input id="sf-name" value="${esc(f.name)}"></div>
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
    { t: 'Meet Outcomes', d: 'REKA builds AI solutions for clients. Outcomes shows each client what their solution changed. Let’s take a new client from nothing to their first report.', go() { setWs('sandbox'); resetWorkspace(true); go('home'); } },
    { t: 'Add the client', d: 'Everything starts with the organisation and its signed data agreement. Nothing is collected until it’s signed.', mark: '#f-org', go() { state.draftOrg = 'Harapan Foods'; go('new-organisation'); } },
    { t: 'Client added', d: 'Harapan Foods is in. Next, the project REKA agreed with them.', go() { if (!T.orgId) { const o = newOrg('Harapan Foods', 'Food and beverage'); T.orgId = o.id; log('Added organisation Harapan Foods'); } go('org-' + T.orgId); } },
    { t: 'Create the project', d: 'Pick the kind of work: it steers which KPIs AI suggests. The outcome is written in the client’s own words.', mark: '#f-proj', go() { state.newKind = 'documents'; state.draftProj = 'Supplier invoices'; state.newProjOrg = T.orgId; go('new-project'); } },
    { t: 'Project created', d: 'The project is waiting for its solution to be connected.', go() { if (!T.simId) { const s = newSim(state.orgs.find((o) => o.id === T.orgId), { kind: 'documents', project: 'Supplier invoices', sol: 'Invoice reader', vol: 220, history: 14 }); T.simId = s.id; state.focusSim = s.id; state.wiz = freshWizard(); log('Created project Supplier invoices for Harapan Foods'); } go('org-' + T.orgId); } },
    { t: 'Brief the developer', d: 'The solution needs a small, read-only link. Outcomes writes the brief for the developer, or for Claude Code.', mark: '#wpanel', go() { wizTo(3); } },
    { t: 'Test the connection', d: 'Outcomes calls the link, checks the request is signed and reads one day of figures.', mark: '#wpanel', go() { wizTo(4); if (!state.wiz.tested) setTimeout(runTests, 300); } },
    { t: 'Check what it shares', d: 'Each figure is checked and explained in plain words. Anything that could identify people is held back.', mark: '#wpanel', go() { wizTo(5); } },
    { t: 'AI suggests the KPIs', d: 'AI reads the figures and the project, and suggests what to measure and why. People keep or drop each one.', mark: '#wpanel', go() { wizTo(6); } },
    { t: 'Agree the baseline', d: 'Hours saved needs how long the work took by hand. Here, a timed sample of 30 invoices.', mark: '#wpanel', go() { wizTo(7); Object.assign(state.wiz.baseline, { method: 'sample', mid: 16, low: 12, high: 21, n: 30 }); render(); } },
    { t: 'Send for approval', d: 'Someone other than the person who set it up approves every KPI and the baseline.', go() { if (tsim().stage === 'draft') { wizTo(8); finishWizard(); } else go('sim-' + T.simId); } },
    { t: 'Approved', d: 'Aisyah checks and approves. The first collection runs tonight.', go() { if (tsim().stage === 'review') approveSim(tsim()); go('sim-' + T.simId); } },
    { t: 'First figures', d: 'Overnight, Outcomes collects the last two weeks of figures. KPIs appear straight away, with estimates shown as a likely range.', go() { if (tsim().stage !== 'collecting') advance(1); go('sim-' + T.simId); } },
    { t: 'Five weeks later', d: 'Time moves on. Every night the KPIs update. Watch the trend build.', go() { if (!T.aged) { advance(35); T.aged = true; } state.range = 30; go('sim-' + T.simId); } },
    { t: 'Something breaks', d: 'The solution stops sending data. Figures fade and say why. Nothing turns into a zero, and the project owner is told.', go() { if (!T.broke) { applyEvent(tsim(), 'stale'); T.broke = true; } go('sim-' + T.simId); } },
    { t: 'Back on track', d: 'The developer fixes it. The missing days are collected again, so the record has no gap.', go() { if (!T.fixed) { applyEvent(tsim(), 'backfill'); T.fixed = true; } go('sim-' + T.simId); } },
    { t: 'The monthly report', d: 'Drafted for you from the figures, with how they were measured and the caveats. A person approves it before the client sees it.', go() { tsim().reportScheduled = true; go('report-' + T.simId); } },
    { t: 'Across every client', d: 'Three more clients, simulated with their own history. Home shows what needs you across all of them, worst first.', go() { if (!T.three) { addThree(); T.three = true; } state.range = 30; go('home'); } },
    { t: 'More than three numbers', d: 'Every project gets the same library of measures across health, usage, operations, impact and cost, so projects can be compared fairly.', go() { state.solTab = 'measures'; state.bld = null; go('sim-' + T.simId); } },
    { t: 'Add your own measure', d: 'Build a measure from the figures the solution shares, with a live preview. Here, hours saved per person. It goes for approval like any KPI.', mark: '#bld', go() { state.solTab = 'measures'; state.bld = { proj: T.simId, name: 'Hours saved per person', op: 'per', a: 'hours', b: 'people', rate: 2, target: '', aud: 'client' }; go('sim-' + T.simId); setTimeout(() => { const b = $('#bld'); if (b) b.scrollIntoView({ block: 'center' }); }, 60); } },
    { t: 'Standard analytics', d: 'Any measure over time against the period before, by project and by weekday. Rates are always worked out from totals, never averaged.', go() { state.bld = null; state.an = { measure: 'hours', proj: 'all', range: 90 }; go('analytics'); } },
    { t: 'Ask the data', d: 'Ask in plain words. Answers come only from the collected figures, show where each number came from, and never claim a cause.', go() { state.chat = []; go('ask'); askSubmit('Which project improved most this month?'); setTimeout(() => askSubmit('Why did Invoice reader change this week?'), reduceMotion ? 10 : 1000); } },
    { t: 'Your turn', d: 'Open Demo studio to create projects, move the date forward or cause problems. Everything updates as you go.', go() { state.studio = true; go('home'); } },
  ];
  function wizTo(n) {
    const s = tsim(); state.focusSim = s.id;
    const w = state.wiz;
    if (n >= 3) { w.devReady = n > 3 || w.devReady; }
    if (n >= 5) { w.tested = true; w.tests = ['Found the link', 'Secure connection', 'Signed request accepted', 'Read what it shares: 6 figures, daily', 'Health check: healthy', 'Read one day of figures'].map((t) => [t, 'ok']); }
    if (n >= 7) w.proposals = true;
    w.step = n; w.solName = 'Invoice reader';
    go('connect-' + s.id);
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
  function resetWorkspace(forTour) {
    if (state.playing) { clearInterval(state.playing); state.playing = null; }
    state.orgs = []; state.sims = []; state.myApprovals = []; state.myAudit = []; state.simReports = {}; state.focusSim = null; state.simDay = START_DAY; state.wiz = freshWizard(); state.sf = null; state.eventSim = null;
    Object.keys(T).forEach((k) => delete T[k]);
    if (!forTour) state.tour = null;
  }

  // ------------------------------------------------------------------ search palette
  function openPalette() {
    const el = $('#palette'); if (!el) return;
    const items = [['Home', '#home'], ['Organisations', '#organisations'], ['Approvals', '#approvals'], ['Reports', '#reports'], ['Settings', '#settings'], ['Connect a solution', '#connect'], ['Add organisation', '#new-organisation']]
      .concat(demo() ? M.orgs.map((o) => [o.name, '#organisation-' + o.id]).concat(Object.values(M.solutions).filter((s) => s.status !== 'not_connected').map((s) => [`${s.name} · ${orgById(s.org).short}`, '#solution-' + s.id])) : state.orgs.map((o) => [o.name, '#org-' + o.id]).concat(state.sims.map((s) => [`${s.name} · ${orgOf(s).name}`, '#sim-' + s.id])));
    el.hidden = false;
    el.innerHTML = `<div class="scrim" data-act="close-palette"></div><div class="card" role="dialog" aria-label="Search" style="position:fixed;z-index:60;top:12vh;left:50%;transform:translateX(-50%);width:min(560px,calc(100vw - 32px));padding:10px;box-shadow:var(--shadow-lg)"><div class="field"><input id="pal-q" placeholder="Search organisations, solutions, pages" aria-label="Search" autocomplete="off"></div><div id="pal-list" style="max-height:50vh;overflow:auto;margin-top:6px;display:grid;gap:2px"></div></div>`;
    const draw = (qv) => { $('#pal-list').innerHTML = items.filter(([l]) => l.toLowerCase().includes(qv.toLowerCase())).slice(0, 10).map(([l, h]) => `<a href="${h}" style="padding:10px 12px;border-radius:10px;color:var(--ink);text-decoration:none;display:block">${esc(l)}</a>`).join('') || '<p class="small muted" style="padding:10px">Nothing matches.</p>'; };
    draw(''); const inp = $('#pal-q'); inp.focus();
    inp.addEventListener('input', () => draw(inp.value));
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const a = $('#pal-list a'); if (a) { closePalette(); location.hash = a.getAttribute('href'); } } });
  }
  function closePalette() { const el = $('#palette'); if (el) { el.hidden = true; el.innerHTML = ''; } }

  // ------------------------------------------------------------------ router
  function parse() {
    const h = (location.hash || '').slice(1) || (state.signedIn ? 'home' : 'signin');
    for (const p of ['organisation', 'solution', 'org', 'sim', 'connect', 'report']) if (h.startsWith(p + '-')) return [p, h.slice(p.length + 1), h];
    return [h, null, h];
  }
  let last = '';
  const TITLES = { analytics: 'Analytics', ask: 'Ask', signin: 'Sign in', welcome: 'Welcome', home: 'Home', organisations: 'Organisations', 'new-organisation': 'Add organisation', 'new-project': 'New project', connect: 'Connect a solution', approvals: 'Approvals', reports: 'Reports', report: 'Report', settings: 'Settings', guide: 'Help' };
  function render() {
    let [page, arg, raw] = parse();
    if (!state.signedIn) { page = 'signin'; raw = 'signin'; } else if (!state.mode) { page = 'welcome'; raw = 'welcome'; } else if (page === 'signin' || page === 'welcome') { page = 'home'; raw = 'home'; }
    if (page === 'organisation' && (!demo() || !orgById(arg))) { page = 'organisations'; raw = page; }
    if (page === 'solution' && (!demo() || !M.solutions[arg] || M.solutions[arg].status === 'not_connected')) { page = 'home'; raw = page; }
    if ((page === 'org' && (demo() || !state.orgs.some((o) => o.id === arg))) || (page === 'sim' && (demo() || !simById(arg)))) { page = demo() ? 'home' : 'organisations'; raw = page; }
    if (page === 'report' && arg && (demo() || !simById(arg))) { page = 'reports'; raw = page; }
    if (page === 'connect' && demo()) { setWs('real'); }
    if (!pages[page]) { page = 'home'; raw = 'home'; }
    if (state.playing && /^(new-|connect)/.test(page)) { clearInterval(state.playing); state.playing = null; }
    const root = $('#root');
    const scroll = window.scrollY;
    root.innerHTML = (page === 'signin' || page === 'welcome') ? pages[page]() : appShell(raw, pages[page](arg));
    const name = page === 'org' ? state.orgs.find((o) => o.id === arg).name : page === 'sim' ? simById(arg).name : page === 'organisation' ? orgById(arg).short : page === 'solution' ? M.solutions[arg].name : TITLES[page];
    document.title = `${name || 'Outcomes'} · Outcomes`;
    if (pages[page].after) pages[page].after(arg);
    if (last !== raw) { window.scrollTo(0, 0); last = raw; } else window.scrollTo(0, scroll);
  }

  // ------------------------------------------------------------------ events
  const closePops = (except) => ['#new-pop', '#bell-pop', '#user-pop', '#ws-pop'].forEach((s) => { const p = $(s); if (p && s !== except) p.hidden = true; });
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
    'switch-mode': () => { setWs(demo() ? 'real' : 'example'); state.tour = null; location.hash = '#home'; render(); toast(demo() ? 'Example clients opened.' : 'Back to your workspace.'); },
    'ws-menu': () => toggle('#ws-pop'),
    'w-next': wizardNext,
    'w-back': () => { state.wiz.step--; render(); },
    'copy-prompt': () => {
      const fallback = () => { const r = document.createRange(); r.selectNodeContents($('#dev-prompt')); getSelection().removeAllRanges(); getSelection().addRange(r); toast('Selected. Press Ctrl C to copy.'); };
      try { navigator.clipboard.writeText($('#dev-prompt').textContent).then(() => toast('Copied. Send it to the developer.'), fallback); } catch (err) { fallback(); }
    },
    'add-gap': () => toast('Added to the developer’s list.'),
    'proj-for': (d) => { state.newProjOrg = d.org; go('new-project'); },
    'sim-approve': (d) => { approveSim(simById(d.sim)); render(); toast('Aisyah approved the KPIs.'); },
    'sim-pull': (d) => { collectNow(simById(d.sim)); render(); toast('First figures collected.'); },
    'schedule-report': (d) => { const s = simById(d.sim) || firstSim(); s.reportScheduled = true; log(`Scheduled the ${s.project.cadence.toLowerCase()} report for ${orgOf(s).name}`); render(); toast('Report scheduled.'); },
    'approve-sim-report': (d) => { const s = simById(d.sim), ym = lastFullMonth(); state.simReports[s.id + ym] = true; log(`Approved the ${monthName(ym)} report for ${orgOf(s).name}`); render(); toast('Report approved.', () => { delete state.simReports[s.id + ym]; render(); }); },
    'to-month-end': () => { const t = M.toDate(today()); const target = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 1)).toISOString().slice(0, 10); advance(Math.round((M.toDate(target) - t) / 864e5)); render(); toast(`Moved to ${day(today())}.`); },
    'approve-report': () => { state.reportApproved = true; const a = state.approvals.find((x) => x.report); if (a) a.status = 'approved'; log('Approved the September report for Contoh Logistik'); render(); toast('Report approved.', () => { state.reportApproved = false; if (a) a.status = 'waiting'; auditList().shift(); render(); }); },
    'send-report': () => toast(sandbox() ? 'Demo workspaces never send anything to clients.' : 'Email delivery comes in phase 2. The PDF is ready.'),
    'approve-narrative': () => { state.narrativeApproved = true; log('Approved the September summary for Contoh Logistik'); render(); toast('Summary approved.', () => { state.narrativeApproved = false; auditList().shift(); render(); }); },
    retry: () => toast('Retrying now.'),
    invite: () => toast('Invites come from your REKA account directory.'),
    studio: () => { if (!sandbox()) { setWs('sandbox'); state.studio = true; location.hash = '#home'; render(); toast('Opened the demo workspace. Your real workspace is unchanged.'); return; } state.studio = !state.studio; render(); },
    'studio-close': () => { readSf(); state.studio = false; render(); },
    'sf-create': () => { readSf(); const s = createSimProject(state.sf); state.sf = null; state.eventSim = s.stage === 'collecting' ? s.id : state.eventSim; go(s.stage === 'draft' ? 'org-' + s.orgId : 'sim-' + s.id); },
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
      pj.approvals().unshift({ id: 'a' + state.seq++, cmId: cm.id, projId: pj.id, projOrg: pj.org, type: 'Measure', title: cm.name, proposer: state.role, since: now(), status: 'waiting', summary: `A new measure for ${pj.sol}, built from the figures it already shares.`, fields: [['Worked out as', customFormula(cm)], ['Kind', customMeta(cm).quality], ['Who sees it', cm.aud === 'client' ? 'Team and client' : 'Team only']].concat(cm.target ? [['Target', cm.target]] : []), evidence: `Preview checked on ${day(M.addDays(endDay(), 1))}`, affects: `${pj.sol} measures${cm.aud === 'client' ? ' and the client report' : ''}` });
      log(`Proposed the measure \u201c${cm.name}\u201d for ${pj.sol}`);
      state.bld = null; render(); toast('Measure sent for approval.');
    },
    'cm-approve': (d) => { const pj = projById(d.proj), cm = pj.custom().find((x) => x.id === d.cm); cm.status = 'live'; const a = pj.approvals().find((x) => x.cmId === cm.id); if (a) a.status = 'approved'; log(`Approved the measure \u201c${cm.name}\u201d`, 'Aisyah Rahman'); render(); toast('Aisyah approved the measure.'); },
    'ask-clear': () => { state.chat = []; render(); },
    'an-ask': () => { const m = mByKey(state.an.measure); askSubmit(`Which project improved most on ${m.name.toLowerCase()} this month?`); },
    export: () => toast('Exports download in the real product. The mock can\u2019t save files.'),
    'tour-start': () => { tourGo(0); },
    'tour-next': () => { if (state.tour >= TOUR.length - 1) { state.tour = null; render(); toast('Demo finished. Demo studio is yours.'); return; } tourGo(state.tour + 1); },
    'tour-back': () => tourGo(state.tour - 1),
    'tour-end': () => { state.tour = null; render(); },
  };
  document.addEventListener('click', (e) => {
    if (e.target.id === 'scrim') { $('#sidebar').classList.remove('open'); e.target.hidden = true; return; }
    if (!e.target.closest('.rel')) closePops();
    if (e.target.closest('#pal-list a')) { closePalette(); return; }
    const t = e.target.closest('button, [data-go], [data-act]');
    if (!t) return;
    const d = t.dataset;
    if (d.range) { state.range = +d.range; render(); return; }
    if (d.anrange) { state.an.range = +d.anrange; render(); return; }
    if (d.anpick) { state.an.proj = d.anpick; render(); return; }
    if (d.anProj && t.tagName === 'A') { state.an = Object.assign(state.an || { measure: 'hours', range: 90 }, { proj: d.anProj }); return; }
    if (d.askq) { askSubmit(d.askq); return; }
    if (d.bop) { state.bld.op = d.bop; if ((d.bop === 'ratio' || d.bop === 'per') && !state.bld.b) state.bld.b = 'handled'; render(); return; }
    if (d.baud) { state.bld.aud = d.baud; render(); return; }
    if (d.aud) { state.audience = d.aud; render(); return; }
    if (d.tab) { state.solTab = d.tab; render(); return; }
    if (d.demo) { state.demoState = d.demo; render(); return; }
    if (d.go) { location.hash = '#' + d.go; return; }
    if (d.sel) { state.approvalSel = d.sel; render(); if (window.innerWidth < 1024) $('#ap-h').scrollIntoView(); return; }
    if (d.kind) { state.newKind = d.kind; render(); return; }
    if (d.method) { state.wiz.method = d.method; render(); return; }
    if (d.keep) { state.wiz.keep[d.keep] = !state.wiz.keep[d.keep]; render(); return; }
    if (d.bmethod) { state.wiz.baseline.method = d.bmethod; render(); return; }
    if (d.sfkind) { readSf(); state.sf.kind = d.sfkind; state.sf.vol = KINDS[d.sfkind].vol; state.sf.base = KINDS[d.sfkind].base.mid; render(); return; }
    if (d.sfhist) { readSf(); state.sf.history = +d.sfhist; render(); return; }
    if (d.sfappr) { readSf(); state.sf.approval = d.sfappr; render(); return; }
    if (d.adv) { readSf(); advance(+d.adv); render(); toast(`Moved to ${day(today())}.`); return; }
    if (d.ev) { const s = simById(($('#ev-sim') || {}).value || state.eventSim); if (!s) return; state.eventSim = s.id; applyEvent(s, d.ev); render(); toast(({ stale: 'Data stopped arriving.', down: 'Solution stopped answering.', spike: s.ev.spike ? 'Volume spike on.' : 'Volume spike off.', quality: s.ev.quality ? 'Quality drop on.' : 'Quality drop off.', manifest: 'New detail sent for approval.', recover: 'Recovered. The gap stays.', backfill: 'Recovered and filled in.' })[d.ev]); return; }
    if (d.start) { if (d.start === 'tour') { tourGo(0); return; } setWs(d.start === 'demo' ? 'example' : 'real'); location.hash = '#home'; render(); toast(d.start === 'demo' ? 'Example clients opened.' : 'Your workspace is ready.'); return; }
    if (d.ws) { const k = d.ws; closePops(); state.tour = null; setWs(k); location.hash = '#home'; render(); toast(k === 'sandbox' ? `${state.sandboxName} opened.` : k === 'example' ? 'Example clients opened.' : `${state.setup.workspace} opened.`); return; }
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
    if (e.target.id === 'f-ws') { e.preventDefault(); state.setup.workspace = $('#ws-name').value.trim() || 'REKA Inisiatif'; state.setup.step = 2; render(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closePops(); closePalette(); if (state.studio) { readSf(); state.studio = false; render(); } const sb = $('#sidebar'); if (sb) { sb.classList.remove('open'); $('#scrim').hidden = true; } }
    if (e.key === 'Enter' && e.target.matches('tr[data-go]')) location.hash = '#' + e.target.dataset.go;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && state.mode) { e.preventDefault(); openPalette(); }
  });
  window.addEventListener('hashchange', () => { closePalette(); render(); });
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { const [p, a] = parse(); if (['home', 'organisation', 'solution', 'sim'].includes(p) && pages[p].after && state.mode) pages[p].after(a); }, 150); });
  render();
})();
