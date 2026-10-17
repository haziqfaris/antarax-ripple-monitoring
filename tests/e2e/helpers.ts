import { expect, type Page } from "@playwright/test";
import { totpAt } from "../../lib/auth/totp";

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

// Two-step keys read from the page at first sign-in, shared between test projects (they run in separate workers).
const FILE = "test-results/.two-step-keys.json";
const load = (): Record<string, string> => { try { return JSON.parse(readFileSync(FILE, "utf8")); } catch { return {}; } };
const secrets = { get: (e: string) => load()[e], set: (e: string, v: string) => { mkdirSync("test-results", { recursive: true }); writeFileSync(FILE, JSON.stringify({ ...load(), [e]: v })); } };

/** Sign in, setting up two-step the first time (the key is read from the page, as a person would). */
export async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/two-step/);
  const shown = page.getByTestId("totp-secret");
  if (await shown.count()) secrets.set(email, (await shown.textContent())!.replace(/\s/g, ""));
  const secret = secrets.get(email);
  if (!secret) throw new Error(`No two-step key known for ${email}`);
  // A code is accepted once per window; wait for a fresh one if the last step was close to its end.
  const now = Math.floor(Date.now() / 1000);
  if (now % 30 > 27) await page.waitForTimeout((31 - (now % 30)) * 1000);
  await page.getByLabel("Six-digit code").fill(await totpAt(secret, Math.floor(Date.now() / 1000)));
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/applications/);
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/sign-in/);
}

/** Choose in a drawn dropdown by its label. */
export async function choose(page: Page, label: string | RegExp, option: string | RegExp): Promise<void> {
  await page.getByRole("button", { name: label }).first().click();
  await page.getByRole("option", { name: option }).first().click();
}

export async function noBrowserControls(page: Page): Promise<void> {
  // react-aria keeps a visually hidden <select> inside an aria-hidden wrapper so forms submit; only a select a person can see counts.
  const visibleNative = await page.$$eval("select, input[type=date]", (els) => els.filter((e) => {
    if (e.closest('[aria-hidden="true"]')) return false;
    for (let n: Element | null = e; n; n = n.parentElement) { const s = getComputedStyle(n); if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0" || (s.overflow === "hidden" && n.getBoundingClientRect().width <= 2)) return false; }
    const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2;
  }).length);
  expect(visibleNative, "no browser-drawn select or date field").toBe(0);
}

export async function noOverflow(page: Page): Promise<void> {
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const who = wide > 0 ? await page.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 40)} → ${Math.round(e.getBoundingClientRect().right)}`).slice(0, 8)) : [];
  expect(wide, `wider than the screen: ${who.join(", ")}`).toBeLessThanOrEqual(0);
}
