// Every version 1 page at 390px (AXLE §13): nothing hidden or wider than the screen; the menu opens as a drawer.
import { test, expect } from "@playwright/test";
import { noBrowserControls, noOverflow, signIn } from "./helpers";

test("pages fit a phone", async ({ page }) => {
  await signIn(page, "nurul@reka.example");
  const app = await page.locator("table a.name").first().getAttribute("href");
  for (const path of ["/applications", "/applications/new", app!, "/organisations", "/approvals", "/reports", "/jobs"]) {
    await page.goto(path);
    await noOverflow(page);
    await noBrowserControls(page);
  }
  await page.goto("/applications");
  const side = page.locator("aside.side");
  expect((await side.boundingBox())!.x).toBeLessThan(0);
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("link", { name: "Approvals" })).toBeInViewport();
});
