// The spreadsheet source (V-15): the template's first column is the local day, then one column per figure.
// Only finished days are accepted; an empty cell is a gap, never a zero.
export interface CsvRow { day: string; metric: string; value: number }
export interface CsvResult { rows: CsvRow[]; problems: string[] }

export function csvTemplate(metrics: string[], example: string): string {
  return `date,${metrics.join(",")}\n${example},${metrics.map(() => "").join(",")}\n`;
}

function splitLine(line: string): string[] {
  const out: string[] = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseCsv(text: string, known: Set<string>, today: string, maxRows = 5000): CsvResult {
  const problems: string[] = [];
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!lines.length) return { rows: [], problems: ["The file is empty."] };
  const head = splitLine(lines[0]!).map((h) => h.toLowerCase());
  if (head[0] !== "date") problems.push("The first column must be called date.");
  const cols = head.slice(1);
  cols.forEach((c, i) => { if (!known.has(c)) problems.push(`Column ${i + 2}, ${c}: not a figure this application shares.`); });
  if (problems.length) return { rows: [], problems };
  if (lines.length - 1 > maxRows) return { rows: [], problems: [`At most ${maxRows} rows in one file.`] };
  const rows: CsvRow[] = [];
  const seen = new Set<string>();
  lines.slice(1).forEach((line, n) => {
    const cells = splitLine(line), at = `Row ${n + 2}`;
    const day = cells[0] ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) { problems.push(`${at}: the date must look like 2026-10-14.`); return; }
    if (day >= today) { problems.push(`${at}: ${day} isn't finished yet. Only past days count.`); return; }
    if (seen.has(day)) { problems.push(`${at}: ${day} appears twice.`); return; }
    seen.add(day);
    cols.forEach((c, i) => {
      const raw = (cells[i + 1] ?? "").replace(/,/g, "");
      if (raw === "") return;
      const v = Number(raw);
      if (!Number.isFinite(v) || v < 0) { problems.push(`${at}, ${c}: "${cells[i + 1]}" isn't a number of zero or more.`); return; }
      rows.push({ day, metric: c, value: v });
    });
  });
  return { rows: problems.length ? [] : rows, problems };
}
