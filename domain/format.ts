// How numbers, days and states read on screen (brand kit 13): British English, grouped thousands, no false zeros.
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const nf = (n: number, dp = 0) => n.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });
export const dash = "–";
export const fmt = (n: number | null | undefined, dp = 0) => (n === null || n === undefined || !Number.isFinite(n) ? dash : nf(n, dp));

export function dayLabel(d: string, year = true): string {
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  return `${day} ${MON[(m ?? 1) - 1]}${year ? ` ${y}` : ""}`;
}
export const monthLabel = (d: string) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
export function momentLabel(at: Date | string | null | undefined, zone = "Asia/Kuala_Lumpur"): string {
  if (!at) return dash;
  const t = typeof at === "string" ? new Date(at) : at;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: zone, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(t);
  return `${parts.replace(",", "")} ${zone === "Asia/Kuala_Lumpur" ? "MYT" : zone}`;
}
/** The local day in a zone, YYYY-MM-DD. */
export const localDay = (ms: number, zone = "Asia/Kuala_Lumpur") => new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
export const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
export const monthStart = (d: string) => `${d.slice(0, 7)}-01`;
export const monthEnd = (d: string) => { const [y, m] = d.split("-").map(Number); return new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10); };
export const prevMonth = (d: string) => { const [y, m] = d.split("-").map(Number); return new Date(Date.UTC(y!, m! - 2, 1)).toISOString().slice(0, 10); };
export const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
export const plural = (w: string) => (/[^aeiou]y$/i.test(w) ? w.slice(0, -1) + "ies" : /(s|x|z|ch|sh)$/i.test(w) ? w + "es" : w + "s");
