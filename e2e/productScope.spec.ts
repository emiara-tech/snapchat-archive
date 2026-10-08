import { expect, test } from "@playwright/test";

test("arrival offers real archive import and request without public demo controls", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Open my archive", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Request my archive", exact: true })).toBeVisible();
    await expect(page.locator('a[href^="/demo"]')).toHaveCount(0);
    await expect(page.getByText(/scripted fictional preview/i)).toHaveCount(0);
    await page.getByRole("link", { name: "Open my archive", exact: true }).click();
    await expect(page).toHaveURL(/\/import$/);
});

test("the request checklist and account page contain no fictional product path", async ({ page }) => {
    await page.goto("/request");
    await expect(page.getByRole("link", { name: "Open my downloaded files", exact: true })).toBeVisible();
    await expect(page.locator('a[href^="/demo"]')).toHaveCount(0);
    await page.goto("/account");
    await expect(page.getByText(/scripted preview/i)).toHaveCount(0);
});
