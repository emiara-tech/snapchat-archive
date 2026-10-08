import { expect, test } from "@playwright/test";
import { importSyntheticArchive } from "./fixtures/archive";

// Observe the SDK boundary without sending test data to Vercel.
test("analytics admits only clean public page views", async ({ page }) => {
	await page.route("**/*insights/script*.js", route => route.fulfill({
		contentType: "application/javascript",
		body: `window.analyticsAccepted = [];
		let filter;
		window.va = (kind, value) => {
			if (kind === 'beforeSend') filter = value;
			if (kind === 'pageview') {
				const result = filter ? filter({ type: 'pageview', url: new URL(value.path, location.origin).href }) : value;
				if (result) window.analyticsAccepted.push(result);
			}
		};
		for (const args of window.vaq || []) window.va(...args);`,
	}));
	await page.goto("/");
	await expect.poll(() => page.evaluate(() => (window as any).analyticsAccepted?.length)).toBeGreaterThanOrEqual(1);
	const initialViews = await page.evaluate(() => (window as any).analyticsAccepted);
	await page.getByRole("link", { name: "Account", exact: true }).click();
	await expect(page).toHaveURL(/\/account$/);
	await page.waitForTimeout(150);
	const views = await page.evaluate(() => (window as any).analyticsAccepted);
	expect(views).toEqual(initialViews);
	expect(views.every((view: { url: string }) => view.url === new URL("/", page.url()).href)).toBe(true);
	await page.goto("/import?code=private-callback#private-fragment");
	await expect(page.getByRole("heading", { name: "Drop the zips from Snapchat here to start exploring the past." })).toBeVisible();
	expect(await page.locator('script[src*="insights/script"]').count()).toBe(0);
	await importSyntheticArchive(page);
	const importedViews = await page.evaluate(() => (window as any).analyticsAccepted);
	await page.getByRole("navigation", { name: "Footer", exact: true }).getByRole("link", { name: "Privacy", exact: true }).click();
	await expect(page).toHaveURL(/\/privacy$/);
	await page.waitForTimeout(150);
	expect(await page.evaluate(() => (window as any).analyticsAccepted)).toEqual(importedViews);
});

test("direct private pages and referrer visits never load analytics", async ({ page }) => {
	for (const path of ["/account", "/import?code=private-callback", "/import#private-fragment"]) {
		await page.goto(path);
		await expect(page.locator(".layout")).toBeVisible();
		expect(await page.locator('script[src*="insights/script"]').count()).toBe(0);
	}
	await page.goto("/", { referer: "https://example.test/account?code=private-referrer" });
	await expect(page.locator(".layout")).toBeVisible();
	expect(await page.locator('script[src*="insights/script"]').count()).toBe(0);
});
