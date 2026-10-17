// A link's state, in words (V-13): on time, late, not answering, not connected. Never a zero for a missing day.
export type LinkState = "not_connected" | "on_time" | "late" | "not_answering";

export const STATE_WORD: Record<LinkState, string> = { not_connected: "Not connected", on_time: "On time", late: "Late", not_answering: "Not answering" };
export const STATE_TONE: Record<LinkState, "idle" | "ok" | "warn" | "fault"> = { not_connected: "idle", on_time: "ok", late: "warn", not_answering: "fault" };

export interface StateInput {
  connected: boolean;
  /** The health answer: ok, degraded, down; null when the call failed outright. */
  health: "ok" | "degraded" | "down" | null;
  /** The last finished local day the application has figures for. */
  lastDay: string | null;
  /** Yesterday in the application's zone: the newest day that should be there. */
  yesterday: string;
  /** Problems the health answer named. */
  problems?: string[];
}

export function linkState(i: StateInput): { state: LinkState; why: string } {
  if (!i.connected) return { state: "not_connected", why: "No address yet, or the connection test hasn't passed" };
  if (i.health === null) return { state: "not_answering", why: "The application didn't answer its health check" };
  if (i.health === "down") return { state: "not_answering", why: `It says it is down${i.problems?.length ? `: ${i.problems.join(", ")}` : ""}` };
  const behind = i.lastDay ? Math.round((Date.parse(i.yesterday) - Date.parse(i.lastDay)) / 86_400_000) : null;
  if (behind === null) return { state: "late", why: "No complete day of figures yet" };
  if (behind >= 2) return { state: "late", why: `No new figures for ${behind} days` };
  if (i.health === "degraded") return { state: "late", why: `It says it is degraded${i.problems?.length ? `: ${i.problems.join(", ")}` : ""}` };
  return { state: "on_time", why: "Figures arrived for every finished day" };
}
