import { expect, test } from "@playwright/test";
import { importSyntheticArchive } from "./fixtures/archive";

test("the observatory keeps actual evidence available without a GPU", async ({ page }) => {
	const pageErrors: string[] = [];
	page.on("pageerror", (error) => pageErrors.push(error.message));
	await page.addInitScript(() => {
		const original = HTMLCanvasElement.prototype.getContext;
		HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
			if (type === "webgl2" || type === "webgl") return null;
			return Reflect.apply(original, this, [type, ...args]);
		};
	});
	await importSyntheticArchive(page, "/observatory");
	await expect(page.getByText("Your history still works without 3D.")).toBeVisible();
	await expect(page.locator(".evidence-buttons button").first()).toBeVisible();
	await page.getByRole("button", { name: "People", exact: true }).click();
	await page.locator(".evidence-buttons button").first().click();
	await expect(page.locator(".evidence-card .source-list article").first()).toBeVisible();
	await expect(page.locator(".evidence-card").getByRole("link", { name: "Open conversation →" }).first()).toBeVisible();
	await page.getByRole("button", { name: "Reading mode", exact: true }).click();
	await expect(page.locator(".reading-world")).toBeVisible();
	await expect(page.locator(".evidence-card .source-list article").first()).toBeVisible();
	await page.getByRole("button", { name: "Places", exact: true }).click();
	await expect(page.locator(".scene-legend")).toContainText("No external map or geocoder receives your location");
	expect(pageErrors).toEqual([]);
});

test("the year room measures imported owner evidence without offering a simulated conversation", async ({ page }) => {
	const paidRequests: string[] = [];
	page.on("request", (request) => {
		if (request.method() !== "GET" && /^https?:/.test(request.url())) paidRequests.push(request.url());
	});
	await importSyntheticArchive(page, "/year-room");
	await expect(page).toHaveURL(/\/year-room$/);
	await expect(page.getByText("Live AI is not connected.")).toBeVisible();
	await expect(page.getByText("Proven owner messages", { exact: true })).toBeVisible();
	await expect(page.getByRole("checkbox", { name: /scripted fictional preview/ })).toHaveCount(0);
	await page.getByRole("button", { name: "Inspect local evidence packet", exact: true }).click();
	await expect(page.getByRole("button", { name: "Approve and send unavailable", exact: true })).toBeDisabled();
	await expect(page.locator(".packet-section pre")).toContainText("we made it to the sea");
	expect(paidRequests).toEqual([]);
});

test("local command reviews need an explicit apply and can be undone", async ({ page }) => {
	await importSyntheticArchive(page, "/conversations");
	await expect(page).toHaveURL(/\/conversations$/);
	await page.getByRole("link", { name: "Guide", exact: true }).click();
	await expect(page).toHaveURL(/\/assistant$/);
	await page.getByLabel("Your archive request").fill("Mark photos from 2020 for later");
	await page.getByRole("button", { name: "Prepare a preview", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Preview marking matches for later", exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: /^Apply later to \d+ items$/ })).toBeEnabled();
	await expect(page.locator(".result-message")).toHaveCount(0);
	await page.getByRole("button", { name: /^Apply later to \d+ items$/ }).click();
	await expect(page.locator(".result-message")).toContainText(/Marked \d+ matching items for later/);
	await page.getByRole("button", { name: "Undo last review change", exact: true }).click();
	await expect(page.locator(".result-message")).toContainText("Restored the previous review decisions.");
	await page.getByLabel("Your archive request").fill("Upload my archive to another account");
	await page.getByRole("button", { name: "Prepare a preview", exact: true }).click();
	await expect(page.getByRole("alert")).toContainText("cannot authorize transfers");
});
