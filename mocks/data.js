/* Example data for the Outcomes console mock. Every organisation, person and figure here is invented.
   Raw observations are generated once from a fixed seed; every figure on screen is computed from them in app.js,
   the way the real compute service would (PRD §8.5), so the pages can never disagree with each other. */
(function () {
  'use strict';

  const LAST_DAY = '2026-10-14'; // the last whole day collected; "today" is 15 Oct 2026

  // ---- date helpers (dates are local MYT calendar days) ----
  const toDate = (s) => new Date(s + 'T00:00:00Z');
  const iso = (d) => d.toISOString().slice(0, 10);
  const addDays = (s, n) => { const d = toDate(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  const dayRange = (from, to) => { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; };
  const weekday = (s) => toDate(s).getUTCDay(); // 0 Sunday

  // ---- seeded random ----
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const jitter = (r, n) => (r() * 2 - 1) * n;

  // ---- people ----
  const staff = {
    nurul: { id: 'nurul', name: 'Nurul Aina', initials: 'NA', rung: 'Support', rights: ['Measurement'], note: 'Analyst' },
    daniel: { id: 'daniel', name: 'Daniel Lim', initials: 'DL', rung: 'Operator', rights: ['Approve'], note: 'Project manager' },
    aisyah: { id: 'aisyah', name: 'Aisyah Rahman', initials: 'AR', rung: 'Admin', rights: ['Approve', 'Commercial'], note: 'Platform admin, leadership' },
  };

  // ---- organisations, projects, solutions ----
  const orgs = [
    { id: 'contoh-logistik', name: 'Contoh Logistik Sdn Bhd', short: 'Contoh Logistik', stage: 'live', tz: 'Asia/Kuala_Lumpur',
      agreement: 'Signed 12 Jun 2026', renewal: '31 Mar 2027', contract: { amount: 18000, currency: 'MYR', per: 'month' }, runCost: { amount: 2140, currency: 'MYR' }, renewalRisk: 'Low',
      projects: [{ id: 'ap-automation', name: 'Accounts payable automation', objective: 'Free the accounts team from typing and chasing supplier documents, and pay suppliers on time.', solutions: ['doc-workflow', 'invoice-triage'] }] },
    { id: 'acme-plastics', name: 'Acme Plastics Sdn Bhd', short: 'Acme Plastics', stage: 'live', tz: 'Asia/Kuala_Lumpur',
      agreement: 'Signed 2 Aug 2026', renewal: '14 Aug 2027', contract: { amount: 9500, currency: 'MYR', per: 'month' }, runCost: { amount: 1320, currency: 'MYR' }, renewalRisk: 'Medium',
      projects: [{ id: 'production-planning', name: 'Production planning assistant', objective: 'Cut the time supervisors spend building shift plans.', solutions: ['shift-planner'] }] },
    { id: 'sampel-medik', name: 'Sampel Medik Group', short: 'Sampel Medik', stage: 'pilot', tz: 'Asia/Kuala_Lumpur',
      agreement: 'Signed 20 Aug 2026', renewal: '1 Dec 2026', contract: { amount: 4000, currency: 'USD', per: 'month' }, runCost: { amount: 610, currency: 'USD' }, renewalRisk: 'Unknown: pilot',
      projects: [{ id: 'enquiry-triage', name: 'Patient enquiry triage', objective: 'Answer routine patient enquiries faster, and route the rest to the right desk.', solutions: ['enquiry-triage'] }] },
    { id: 'bina-jaya', name: 'Bina Jaya Engineering', short: 'Bina Jaya', stage: 'live', tz: 'Asia/Kuala_Lumpur',
      agreement: 'Signed 18 Jul 2026', renewal: '31 Jan 2027', contract: { amount: 7200, currency: 'MYR', per: 'month' }, runCost: { amount: 880, currency: 'MYR' }, renewalRisk: 'Low',
      projects: [{ id: 'quotation', name: 'Quotation drafting', objective: 'Turn customer drawings into a first quotation the same day.', solutions: ['quote-drafter'] }] },
    { id: 'teladan-properties', name: 'Teladan Properties', short: 'Teladan Properties', stage: 'planning', tz: 'Asia/Kuala_Lumpur',
      agreement: 'Signed 2 Oct 2026', renewal: '–', contract: { amount: 6000, currency: 'MYR', per: 'month' }, runCost: null, renewalRisk: 'Not live yet',
      projects: [{ id: 'lease-abstraction', name: 'Lease abstraction', objective: 'Pull the key terms out of every lease without reading it end to end.', solutions: ['lease-reader'] }] },
  ];

  const solutions = {
    'doc-workflow': { id: 'doc-workflow', name: 'Document workflow', org: 'contoh-logistik', project: 'ap-automation', kind: 'Document automation',
      env: 'production', version: '2.4.1', live: '2026-07-01', status: 'fresh', lastPull: '15 Oct 2026, 06:00', nextPull: '16 Oct 2026, 06:00',
      base: 'https://ap.contoh.example/internal/measure/v1', auth: 'Signed service key', kpis: { approved: 4, total: 4 } },
    'invoice-triage': { id: 'invoice-triage', name: 'Invoice triage', org: 'contoh-logistik', project: 'ap-automation', kind: 'Triage',
      env: 'production', version: '1.3.0', live: '2026-08-01', status: 'fresh', lastPull: '15 Oct 2026, 06:00', nextPull: '16 Oct 2026, 06:00',
      base: 'https://ap.contoh.example/triage/internal/measure/v1', auth: 'Signed service key', kpis: { approved: 2, total: 3 } },
    'shift-planner': { id: 'shift-planner', name: 'Shift planner', org: 'acme-plastics', project: 'production-planning', kind: 'Planning assistant',
      env: 'production', version: '1.1.0', live: '2026-08-15', status: 'stale', lastPull: '13 Oct 2026, 09:00', since: '13 Oct 2026, 09:00', missed: 2,
      base: 'https://plan.acme.example/internal/measure/v1', auth: 'Signed service key', kpis: { approved: 3, total: 3 } },
    'enquiry-triage': { id: 'enquiry-triage', name: 'Enquiry triage', org: 'sampel-medik', project: 'enquiry-triage', kind: 'Triage',
      env: 'production', version: '0.9.2', live: '2026-09-01', status: 'fresh', lastPull: '15 Oct 2026, 06:00', nextPull: '16 Oct 2026, 06:00',
      base: 'https://care.sampel.example/internal/measure/v1', auth: 'Bearer token (third party host)', kpis: { approved: 1, total: 4 } },
    'quote-drafter': { id: 'quote-drafter', name: 'Quote drafter', org: 'bina-jaya', project: 'quotation', kind: 'Document automation',
      env: 'production', version: '1.0.4', live: '2026-08-01', status: 'failing', lastPull: '14 Oct 2026, 06:00', since: '14 Oct 2026, 22:00',
      error: '503 from /internal/measure/v1/health', base: 'https://quotes.binajaya.example/internal/measure/v1', auth: 'Signed service key', kpis: { approved: 2, total: 2 } },
    'lease-reader': { id: 'lease-reader', name: 'Lease reader', org: 'teladan-properties', project: 'lease-abstraction', kind: 'Document automation',
      env: 'production', version: '–', live: null, status: 'not_connected', kpis: { approved: 0, total: 0 } },
  };

  // ---- observations (generated) ----
  // series[solution][metric] = array of { d, v } where v === null is a missing period (a gap, never a zero)
  const series = {};
  const put = (sol, metric, d, v) => { ((series[sol] = series[sol] || {})[metric] = series[sol][metric] || []).push({ d, v }); };

  // Document workflow, Contoh Logistik
  (function () {
    const r = rng(7);
    const days = dayRange('2026-07-01', LAST_DAY);
    const gap = new Set(['2026-09-21', '2026-09-22']);
    days.forEach((d, i) => {
      const p = i / days.length;
      const wd = weekday(d);
      const weekend = wd === 0 || wd === 6;
      if (gap.has(d)) {
        ['documents.generated', 'documents.generated.invoice', 'documents.generated.statement', 'documents.generated.credit_note', 'documents.generation_duration', 'documents.returned_for_correction'].forEach((m) => put('doc-workflow', m, d, null));
        return;
      }
      const total = Math.max(0, Math.round(weekend ? 24 + jitter(r, 9) : 168 + 74 * p + jitter(r, 22)));
      const inv = Math.round(total * (0.58 + jitter(r, 0.03)));
      const st = Math.round(total * (0.27 + jitter(r, 0.02)));
      put('doc-workflow', 'documents.generated', d, total);
      put('doc-workflow', 'documents.generated.invoice', d, inv);
      put('doc-workflow', 'documents.generated.statement', d, st);
      put('doc-workflow', 'documents.generated.credit_note', d, total - inv - st);
      put('doc-workflow', 'documents.generation_duration', d, +(41 - 8 * p + jitter(r, 3)).toFixed(1)); // seconds, mean
      put('doc-workflow', 'documents.returned_for_correction', d, Math.round(total * (0.066 - 0.035 * p + jitter(r, 0.006))));
    });
    // weekly distinct operators (not summable)
    for (let w = '2026-07-06'; w <= LAST_DAY; w = addDays(w, 7)) {
      const p = (toDate(w) - toDate('2026-07-01')) / (toDate(LAST_DAY) - toDate('2026-07-01'));
      put('doc-workflow', 'operators.active', w, Math.round(8 + 6 * p + jitter(r, 1)));
    }
    // health, hourly for the last 7 days
    dayRange('2026-10-08', LAST_DAY).forEach((d) => {
      for (let h = 0; h < 24; h++) {
        const bad = (d === '2026-10-11' && (h === 3 || h === 4));
        put('doc-workflow', 'health', d + 'T' + String(h).padStart(2, '0'), bad ? 'degraded' : 'ok');
      }
    });
  })();

  // Invoice triage, Contoh Logistik: weekly median cycle time in days
  (function () {
    const r = rng(11);
    dayRange('2026-08-01', LAST_DAY).forEach((d) => {
      const wd = weekday(d);
      put('invoice-triage', 'invoices.triaged', d, (wd === 0 || wd === 6) ? Math.round(10 + jitter(r, 4)) : Math.round(132 + jitter(r, 18)));
    });
    const weeks = [];
    for (let w = '2026-08-03'; w <= LAST_DAY; w = addDays(w, 7)) weeks.push(w);
    weeks.forEach((w, i) => put('invoice-triage', 'invoices.cycle_time_median', w, +(3.9 - 2.1 * (i / (weeks.length - 1)) + jitter(r, 0.15)).toFixed(1)));
  })();

  // Shift planner, Acme Plastics: stale since 13 Oct, last period 12 Oct
  (function () {
    const r = rng(23);
    dayRange('2026-08-15', '2026-10-12').forEach((d) => {
      put('shift-planner', 'plans.generated', d, r() < 0.12 ? 2 : 3);
      put('shift-planner', 'plans.review_minutes', d, +(20 + jitter(r, 3)).toFixed(1));
    });
  })();

  // Enquiry triage, Sampel Medik: pilot, impact KPI has no baseline yet
  (function () {
    const r = rng(31);
    dayRange('2026-09-01', LAST_DAY).forEach((d, i) => {
      const wd = weekday(d);
      put('enquiry-triage', 'enquiries.received', d, Math.round(((wd === 0 || wd === 6) ? 118 : 284) + jitter(r, 30)));
      put('enquiry-triage', 'enquiries.first_response_hours', d, +(1.9 - 0.8 * (i / 44) + jitter(r, 0.2)).toFixed(2));
    });
  })();

  // Quote drafter, Bina Jaya: failing since 14 Oct 22:00, so the last whole day collected is 13 Oct. Closed at weekends: a true zero.
  (function () {
    const r = rng(43);
    dayRange('2026-08-01', '2026-10-13').forEach((d) => {
      const wd = weekday(d);
      put('quote-drafter', 'quotes.drafted', d, (wd === 0 || wd === 6) ? 0 : Math.round(12 + jitter(r, 3)));
    });
  })();

  // ---- approved KPIs and their baselines (the measurement plans) ----
  // impact per item = baseline minutes - current minutes; ranges come from the baseline and sample ranges (PRD §10.3)
  const impact = {
    'doc-workflow': {
      kpi: 'kpi_7Hq2', name: 'Hours saved on document preparation', volume: 'documents.generated', unitWord: 'document',
      baseline: { mid: 18, low: 14, high: 22, method: 'Time-and-motion sample of 40 documents, 2 to 6 Jun 2026, approved by the client’s accounts payable lead', version: 2 },
      machine: { metric: 'documents.generation_duration', note: 'Measured: mean machine time' },
      review: { mid: 4, low: 3, high: 6, method: 'Sample of 30 reviewed documents, 1 to 3 Oct 2026' },
      overlap: 'contoh-ap-workflow',
    },
    'shift-planner': {
      kpi: 'kpi_3Pa9', name: 'Supervisor hours saved on shift plans', volume: 'plans.generated', unitWord: 'plan',
      baseline: { mid: 95, low: 80, high: 110, method: 'Supervisor estimates, 6 supervisors, Jul 2026' },
      reviewMetric: 'plans.review_minutes',
    },
    'quote-drafter': {
      kpi: 'kpi_9Qd1', name: 'Estimator hours saved on quotations', volume: 'quotes.drafted', unitWord: 'quote',
      baseline: { mid: 45, low: 35, high: 55, method: 'Sample of 25 quotations, Jun 2026' },
      review: { mid: 12, low: 10, high: 15, method: 'Estimator estimate, Aug 2026' },
    },
  };

  // ---- the measurement catalog for the document workflow ----
  const catalog = [
    { key: 'documents.generated', type: 'counter', unit: 'document', agg: 'sum', dims: 'document_type', privacy: 'aggregate', feeds: 'K1, K2, K4' },
    { key: 'documents.generation_duration', type: 'duration', unit: 'second', agg: 'mean', dims: '–', privacy: 'aggregate', feeds: 'K1' },
    { key: 'documents.generation_duration_sum', type: 'duration', unit: 'second', agg: 'sum', dims: '–', privacy: 'aggregate', feeds: 'K1 (weighting)' },
    { key: 'documents.returned_for_correction', type: 'counter', unit: 'document', agg: 'sum', dims: 'document_type, reason', privacy: 'aggregate', feeds: 'K3', changed: true },
    { key: 'operators.active', type: 'distinct', unit: 'operator', agg: 'distinct (weekly)', dims: '–', privacy: 'pseudonymous id', feeds: 'Usage' },
    { key: 'queue.depth', type: 'gauge', unit: 'document', agg: 'last', dims: '–', privacy: 'aggregate', feeds: '–' },
  ];

  const pulls = [
    { at: '15 Oct 2026, 06:00', ep: '/observations', status: 'ok', read: 412, rejected: 0, ms: 1840, req: 'req_8fK2mQ' },
    { at: '15 Oct 2026, 06:00', ep: '/manifest', status: 'changed', read: 1, rejected: 0, ms: 210, req: 'req_8fK2mP' },
    { at: '15 Oct 2026, 05:45', ep: '/health', status: 'ok', read: 1, rejected: 0, ms: 95, req: 'req_8fJx2a' },
    { at: '14 Oct 2026, 06:00', ep: '/observations', status: 'ok', read: 398, rejected: 2, ms: 1760, req: 'req_7Rb1Qe', note: '2 rows had document_type "test": excluded by K1 rule' },
    { at: '23 Sep 2026, 06:00', ep: '/observations', status: 'late', read: 0, rejected: 0, ms: 30000, req: 'req_5Tq8Lw', note: 'not_ready: aggregates for 21 to 22 Sep never arrived; left as gaps' },
  ];

  // ---- approvals queue ----
  const approvals = [
    { id: 'apr_41', type: 'KPI', title: 'Time to first response', org: 'sampel-medik', solution: 'enquiry-triage', proposer: 'ai', editedBy: 'nurul', since: '14 Oct 2026, 16:20', status: 'waiting',
      summary: 'A new outcome KPI for Enquiry triage, using a baseline from the clinic’s helpdesk export.',
      fields: [
        ['Business question', 'How quickly does a patient get a first useful answer?'],
        ['Formula', 'median(enquiries.first_response_hours) by day', 'mono'],
        ['Unit', 'hour'], ['Domain', 'Operational performance'], ['Window', 'month'],
        ['Baseline', '6.2 h median, Jan to Jun 2026, historical system data (helpdesk export), 8,412 enquiries'],
        ['Quality', 'derived'], ['Target', '2 h (target, not a result)'], ['Exclusions', 'Enquiries marked spam'],
        ['Aggregation', 'Non-additive: not rolled up to client or portfolio'], ['Audience', 'REKA and client'], ['Owner', 'Daniel Lim'],
      ],
      evidence: 'Helpdesk export, 8,412 enquiries, attached by Nurul Aina on 14 Oct 2026', affects: 'October report for Sampel Medik; Enquiry triage outcomes' },
    { id: 'apr_42', type: 'KPI', title: 'Enquiries answered without a person', org: 'sampel-medik', solution: 'enquiry-triage', proposer: 'nurul', since: '14 Oct 2026, 16:31', status: 'waiting',
      summary: 'Share of enquiries closed by the assistant with no hand-off.',
      fields: [
        ['Business question', 'How much routine work does the assistant take off the front desk?'],
        ['Formula', 'sum(enquiries.closed_automatically) / sum(enquiries.received) × 100', 'mono'],
        ['Unit', 'percent'], ['Domain', 'Operational performance'], ['Window', 'month'], ['Baseline', 'Not applicable: new capability'],
        ['Quality', 'derived'], ['Aggregation', 'Weighted ratio: recomputed from numerator and denominator'], ['Audience', 'REKA and client'], ['Owner', 'Daniel Lim'],
      ],
      evidence: 'Metric enquiries.closed_automatically validated on 14 Oct 2026', affects: 'Enquiry triage outcomes' },
    { id: 'apr_43', type: 'KPI', title: 'Front-desk hours saved', org: 'sampel-medik', solution: 'enquiry-triage', proposer: 'ai', since: '14 Oct 2026, 16:20', status: 'blocked',
      summary: 'Impact KPI proposed by AI. It needs a baseline before anyone can approve it.',
      blocker: 'No baseline yet. Approve a baseline for manual minutes per enquiry, or record that none is available, first.',
      fields: [
        ['Business question', 'How much front-desk time does triage free each month?'],
        ['Formula', 'sum(enquiries.closed_automatically) × baseline.manual_minutes / 60', 'mono'],
        ['Unit', 'hour'], ['Domain', 'Business impact'], ['Baseline', '– none recorded'], ['Quality', 'estimated, once a baseline exists'],
      ],
      evidence: 'None yet', affects: 'Organisation and portfolio hours saved' },
    { id: 'apr_44', type: 'Baseline', title: 'Manual minutes per document, version 2', org: 'contoh-logistik', solution: 'doc-workflow', proposer: 'daniel', since: '13 Oct 2026, 11:05', status: 'waiting',
      summary: 'Replaces the client’s estimate with a sampled baseline and a range.',
      diff: [
        ['Value', '18 min', '18 min (range 14 to 22)'],
        ['Method', 'Client process-owner estimate', 'Time-and-motion sample, 40 documents'],
        ['Period', '–', '2 to 6 Jun 2026'],
        ['Quality', 'estimated', 'estimated (sampled)'],
      ],
      evidence: 'Sampling sheet signed by the client’s accounts payable lead, 7 Jun 2026', affects: 'Hours saved (K1) for September and October; Contoh Logistik client total; portfolio total' },
    { id: 'apr_45', type: 'Mapping', title: 'Manifest change: a new reason dimension', org: 'contoh-logistik', solution: 'doc-workflow', proposer: 'collector', since: '15 Oct 2026, 06:00', status: 'waiting',
      summary: 'documents.returned_for_correction now reports a reason dimension with 6 values. K3 keeps its formula; the reasons become available for segmenting.',
      diff: [['Dimensions', 'document_type', 'document_type, reason'], ['Catalog version', '2026-09-01', '2026-10-15']],
      evidence: 'Manifest 2026-10-15 validated: 6 reason values, under the 20-value limit; no personal data', affects: 'K3 Return-for-correction rate (unchanged); new segment available' },
    { id: 'apr_46', type: 'Report', title: 'September 2026 report', org: 'contoh-logistik', solution: null, proposer: 'ai', editedBy: 'nurul', since: '14 Oct 2026, 09:12', status: 'waiting', report: true,
      summary: 'The monthly report for Contoh Logistik, drafted by AI, edited by Nurul Aina. It goes to the client once approved.',
      fields: [['Audience', 'Contoh Logistik finance director, accounts payable lead'], ['Format', 'PDF, light layout'], ['Numbers checked', 'Every figure matches a computed value'], ['Commercial data', 'None (checked)']],
      evidence: 'Open the draft to review it', affects: 'Delivered to the client by e-mail' },
  ];

  const audit = [
    ['15 Oct 2026, 06:00', 'Collector', 'Received a new manifest for Document workflow (catalog 2026-10-15) and opened a mapping review'],
    ['14 Oct 2026, 22:00', 'Collector', 'Marked Quote drafter failing: 503 from /health, 3 attempts'],
    ['14 Oct 2026, 16:31', 'Nurul Aina · Support', 'Proposed KPI “Enquiries answered without a person” for Sampel Medik'],
    ['14 Oct 2026, 16:20', 'AI proposals', 'Proposed 3 KPIs for Enquiry triage from 9 metrics'],
    ['13 Oct 2026, 11:05', 'Daniel Lim · Operator', 'Proposed baseline version 2 for manual minutes per document: sampled, replaces estimate'],
    ['13 Oct 2026, 09:00', 'Collector', 'Marked Shift planner stale: 2 pulls missed'],
  ];

  window.MOCK = { LAST_DAY, toDate, iso, addDays, dayRange, weekday, staff, orgs, solutions, series, impact, catalog, pulls, approvals, audit };
})();
