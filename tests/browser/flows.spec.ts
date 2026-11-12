import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("official cash flows, award search, NJ filters, and bill lookup work without an account", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Follow the money." }),
  ).toBeVisible();
  await page
    .getByLabel("Federal fiscal year", { exact: true })
    .selectOption("2025");
  await expect(page.getByText("Money collected", { exact: true })).toBeVisible({
    timeout: 60000,
  });
  await expect(
    page.getByText("Categories reconcile to the reported totals."),
  ).toBeVisible();
  const overviewA11y = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(overviewA11y.violations).toEqual([]);
  await page.getByRole("button", { name: "Federal awards" }).click();
  await expect(page.getByRole("table")).toBeVisible({ timeout: 60000 });
  await page.getByLabel("Recipient", { exact: true }).fill("HUMANA");
  await page.getByRole("button", { name: "Search records" }).click();
  await expect(
    page
      .getByRole("table")
      .getByText(/HUMANA/)
      .first(),
  ).toBeVisible({ timeout: 60000 });
  await page.getByRole("button", { name: "New Jersey", exact: false }).click();
  await expect(page.getByRole("table")).toBeVisible({ timeout: 60000 });
  await page.getByRole("button", { name: "Complete-year summaries" }).click();
  await expect(page.getByText(/2024-07-01 through 2025-06-30/)).toBeVisible({
    timeout: 60000,
  });
  await page.getByLabel("Search agency or program").fill("health");
  await page.getByRole("button", { name: "Search records" }).click();
  await expect(
    page
      .getByRole("table")
      .getByText(/HEALTH/)
      .first(),
  ).toBeVisible({ timeout: 60000 });
  await page.getByRole("button", { name: "Revenue", exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible({ timeout: 60000 });
  await page.getByRole("button", { name: "Decisions & votes" }).click();
  await page.getByLabel("Bill number").fill("1");
  await page.getByRole("button", { name: "Look up official bill" }).click();
  await expect(
    page.getByText("Became Public Law No: 119-21.", { exact: true }).first(),
  ).toBeVisible({ timeout: 60000 });
  await expect(
    page.getByRole("heading", { name: "Recorded votes", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /House · roll call 190/ }),
  ).toBeVisible();
  const recorded = page
    .getByRole("link", { name: /House · roll call 190/ })
    .locator("..");
  await recorded
    .getByRole("button", { name: "View totals and individual votes" })
    .click();
  await expect(recorded.getByText(/Yea 218 · Nay 214/)).toBeVisible({
    timeout: 60000,
  });
  await recorded.getByLabel("Filter voters by state").selectOption("NJ");
  await expect(
    recorded.getByRole("table").getByText("NJ · D").first(),
  ).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  expect(errors).toEqual([]);
});
test("mobile layout and source errors remain accessible", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/treasury/fiscal*", (r) =>
    r.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Official source could not be reached." }),
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("alert").filter({ hasText: "No substitute figures" }),
  ).toContainText("No substitute figures");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Sources", exact: false })
    .first()
    .click();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByText("requires key", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("current NJ records, procurement, fiscal documents, and private tax illustration work", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New Jersey", exact: false }).click();
  await expect(
    page.getByText("Reported expended", { exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("button", { name: "Vendor purchasing" }).click();
  await page.getByLabel("Vendor name").fill("GRAINGER");
  await page.getByRole("button", { name: "Search vendors" }).click();
  await expect(
    page.getByRole("table").getByText("GRAINGER", { exact: true }).first(),
  ).toBeVisible({ timeout: 60000 });
  await page.getByRole("button", { name: "Decisions & votes" }).click();
  await page.getByLabel("Search NJ bills").fill("A425");
  await page.getByRole("button", { name: "Search NJ legislation" }).click();
  await page
    .getByRole("button", { name: /A425 .*Increases penalties/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Original text and fiscal documents" }),
  ).toBeVisible({ timeout: 60000 });
  const fiscal = page
    .getByRole("link", { name: /FE · 8\/7\/26; as introduced/ })
    .locator("..");
  await fiscal
    .getByRole("button", { name: "Read original document text" })
    .click();
  await expect(
    fiscal.getByRole("region", { name: "Extracted source page text" }),
  ).toContainText("Indeterminate", { timeout: 60000 });
  await page.getByRole("button", { name: "Your context" }).click();
  const sent: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/")) sent.push(r.postData() ?? r.url());
  });
  await page.getByLabel("Annual ordinary income in USD").fill("66500");
  await page.getByRole("button", { name: "Calculate illustration" }).click();
  await expect(page.getByText("$5,800", { exact: true })).toBeVisible();
  expect(sent).toEqual([]);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});
