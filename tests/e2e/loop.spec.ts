// V-30: the version 1 loop in a browser, against the example application on :4010.
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createHash } from "node:crypto";
import { choose, noBrowserControls, signIn, signOut } from "./helpers";

test.describe.configure({ mode: "serial" });

const BASE = "http://localhost:4010/internal/measure/v1";
let appUrl = "";

async function axe(page: import("@playwright/test").Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  const serious = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.length} (${v.help})`)).toEqual([]);
}

test("an operator tracks an application and connects it", async ({ page, request }) => {
  await signIn(page, "nurul@reka.example", "operator password 1");
  await expect(page.getByRole("heading", { level: 1, name: "Applications", exact: true })).toBeVisible();
  await noBrowserControls(page);
  await axe(page);

  await page.getByRole("link", { name: "+ Track an application" }).first().click();
  await page.getByLabel("Name", { exact: true }).fill("Contoh Logistik Sdn Bhd");
  await page.getByLabel("Short name").fill("Contoh Logistik");
  await page.getByRole("checkbox", { name: /data agreement is signed/ }).check();
  await page.getByRole("button", { name: "Add the organisation" }).click();
  await expect(page.getByText("Organisation added")).toBeVisible();
  await noBrowserControls(page);
  await axe(page);

  await page.getByLabel("Application name").fill("Document workflow");
  await page.getByLabel("Project").fill("Accounts payable automation");
  await page.getByLabel("One piece of its work is a…").fill("document");
  await page.getByRole("button", { name: "Start tracking" }).click();
  await page.waitForURL(/\/applications\/[0-9a-f-]{36}$/);
  appUrl = page.url();

  const key = (await page.getByTestId("new-key").textContent())!.trim();
  expect(key).toMatch(/^ax_msr_/);
  await expect(page.getByTestId("dev-link")).toContainText("/dev/");
  const set = await request.post("http://localhost:4010/__set-key", { data: key });
  expect(set.status()).toBe(204);
  await page.getByRole("button", { name: "I’ve copied it, hide it" }).click();
  await expect(page.getByTestId("new-key")).toHaveCount(0);

  await page.getByLabel("The application’s address").fill(BASE);
  await page.getByRole("button", { name: "Test the connection" }).click();
  await expect(page.getByText(/^Connected\./)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("test-result")).toContainText("The connection test passed");

  await choose(page, /Which counts the documents handled/, /documents\.generated\)/);
  await choose(page, /Which counts those sent back/, /documents\.returned_for_correction/);
  await choose(page, /Which is the machine/, /documents\.generation_duration/);
  await page.getByRole("button", { name: "Use these figures" }).click();
  await expect(page.getByText("Figures chosen")).toBeVisible();

  await page.getByRole("button", { name: "Send the KPIs for approval" }).click();
  await expect(page.getByText("KPIs sent for approval")).toBeVisible();

  for (const [id, v] of [["low", "14"], ["mid", "18"], ["high", "22"], ["rlow", "3"], ["rmid", "4"], ["rhigh", "6"], ["sample", "40"]]) await page.locator(`#${id}`).fill(v!);
  await page.getByLabel("Evidence, in a sentence or two").fill("40 documents timed by the accounts team before go-live, agreed with the process owner.");
  await page.getByRole("button", { name: "Send the baseline for approval" }).click();
  await expect(page.getByText("Baseline sent for approval")).toBeVisible();
  await expect(page.getByText("Waiting for approval").first()).toBeVisible();
  await noBrowserControls(page);
  await axe(page);
  await signOut(page);
});

test("someone else approves, and the figures count", async ({ page }) => {
  await signIn(page, "aisyah@reka.example", "approver password 1");
  await page.getByRole("link", { name: /Approvals/ }).click();
  for (let n = 0; n < 2; n++) {
    await page.getByLabel("Your reason").fill("Checked against the timed sample and the figures.");
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Approved.")).toBeVisible();
  }
  await axe(page);
  await page.goto(appUrl);
  await expect(page.getByText("Collecting").first()).toBeVisible();
  await expect(page.getByText("Hours saved").first()).toBeVisible();
  await expect(page.getByText(/Likely [\d,]+ to [\d,]+ h/)).toBeVisible();
  await expect(page.getByText("Not approved yet: a preview")).toHaveCount(0);
});

test("a monthly report is written, approved by a third person, and frozen", async ({ page, browser }) => {
  // Aisyah is still signed in from the last test's page context? Each test has its own page: sign in again.
  await signIn(page, "aisyah@reka.example", "approver password 1");
  await page.goto(appUrl + "#reports");
  await page.getByRole("button", { name: "Draft it" }).click();
  await page.waitForURL(/\/reports\/[0-9a-f-]{36}/);
  const reportUrl = page.url().split("?")[0]!;
  await page.getByLabel("Summary").fill("Contoh Logistik's accounts team handled more documents last month, with fewer sent back for correction.");
  await page.getByLabel("Caveats").fill("Hours saved is an estimate from the approved baseline.");
  await page.getByRole("button", { name: "Save and send for approval" }).click();
  await expect(page.getByText("Sent for approval")).toBeVisible();
  await page.getByRole("link", { name: "Its approval" }).click();
  await expect(page.getByText("You proposed or edited this")).toBeVisible();
  await signOut(page);

  const ctx = await browser.newContext();
  const p2 = await ctx.newPage();
  await signIn(p2, "daniel@reka.example", "approver password 2");
  await p2.goto("/approvals");
  await p2.getByLabel("Your reason").fill("Figures match the console.");
  await p2.getByRole("button", { name: "Approve" }).click();
  await expect(p2.getByText("Approved.")).toBeVisible();
  await p2.goto(reportUrl);
  const state = (await p2.locator(".state-line").textContent())!;
  const hash = state.match(/SHA-256 ([0-9a-f]{64})/)![1]!;
  const res = await p2.request.get(reportUrl + "/print");
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(createHash("sha256").update(html).digest("hex")).toBe(hash);
  expect(html).toContain("Run by REKA as part of Managed AI.");
  await ctx.close();
});

test("the scheduled jobs refuse a call without the secret, and run with it", async ({ request }) => {
  expect((await request.get("/api/cron/health")).status()).toBe(404);
  const r = await request.get("/api/cron/health", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  expect(r.status()).toBe(200);
  expect((await r.json()).ok).toBe(1);
});

test("the developer link shows the prompt and never the key", async ({ page }) => {
  await signIn(page, "nurul@reka.example", "operator password 1");
  await page.goto(appUrl);
  await page.getByText("Connection, figures, KPIs and baseline").click();
  await page.getByRole("button", { name: "Make a new developer link" }).click();
  const link = (await page.getByTestId("dev-link").textContent())!.trim();
  await signOut(page);
  await page.goto(link);
  await expect(page.getByRole("heading", { name: /Measurement Link for Document workflow/ })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("ax_msr_A");
  expect(await page.locator("body").textContent()).not.toMatch(/ax_msr_[A-Za-z0-9]{32}/);
  await axe(page);
});
