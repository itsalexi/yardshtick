import { expect, test } from "@playwright/test";

test("loads seeded fixtures and opens the canonical scene without browser errors", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  const failedResponses: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location();
      browserErrors.push(
        `${message.text()} @ ${location.url}:${location.lineNumber}:${location.columnNumber}`,
      );
    }
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("requestfailed", (request) => {
    failedResponses.push(`${request.failure()?.errorText ?? "failed"} ${request.url()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto("/");
  await expect(page.getByText("Pipeline Lab")).toBeVisible();
  const phoneFixture = page.getByRole("button", { name: /phone-single/i });
  await expect(phoneFixture).toBeVisible();
  await phoneFixture.click();

  await expect(page.getByRole("heading", { name: "phone-single" })).toBeVisible();
  const canonicalImage = page.getByAltText("Canonical scene for phone-single");
  await expect(canonicalImage).toBeVisible();
  await canonicalImage.evaluate((image: HTMLImageElement) => image.decode());
  await expect.poll(() => canonicalImage.evaluate((image: HTMLImageElement) => image.complete)).toBe(
    true,
  );
  await expect(page.getByRole("button", { name: "Run scan" })).toBeEnabled();
  expect({ browserErrors, failedResponses }).toEqual({
    browserErrors: [],
    failedResponses: [],
  });
});

test("collapses the lab to one column on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText("Pipeline Lab")).toBeVisible();

  const gridColumns = await page.locator(".lab-grid").evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns,
  );
  expect(gridColumns.trim().split(/\s+/)).toHaveLength(1);
});
