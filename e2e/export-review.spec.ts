import { expect, test, type Download } from "@playwright/test";
import { BlobReader, TextWriter, ZipReader } from "@zip.js/zip.js";
import { readFile } from "node:fs/promises";
import { importSyntheticArchive } from "./fixtures/archive";

async function observeZipLeases(page: import("@playwright/test").Page) {
	await page.addInitScript(() => {
		const active = new Set<string>();
		const tracker = { active: 0, peak: 0 };
		Reflect.set(window, "zipSourceLeases", tracker);
		const create = URL.createObjectURL.bind(URL);
		const revoke = URL.revokeObjectURL.bind(URL);
		URL.createObjectURL = (blob) => {
			const url = create(blob);
			if (blob instanceof Blob && blob.type === "application/zip") { active.add(url); tracker.active = active.size; tracker.peak = Math.max(tracker.peak, active.size); }
			return url;
		};
		URL.revokeObjectURL = (url) => { active.delete(url); tracker.active = active.size; revoke(url); };
	});
}

test("browser ZIP parts release each source before the catalogue and save independently verified output", async ({ page }) => {
	test.setTimeout(50_000);
	await observeZipLeases(page);
	await importSyntheticArchive(page, "/export");
	await page.getByLabel(/Allow bounded ZIP parts/).check();
	await page.getByRole("button", { name: "Preview this collection", exact: true }).click();
	await page.getByLabel(/I reviewed this scope/).check();
	const downloads: Download[] = [];
	page.on("download", (download) => downloads.push(download));
	await page.getByRole("button", { name: "Download readable ZIP parts", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Your bundle is ready.", exact: true })).toBeVisible({ timeout: 30_000 });
	expect(downloads).toHaveLength(2);
	const part = downloads.find((download) => download.suggestedFilename().includes("part-0001"))!;
	const catalogue = downloads.find((download) => download.suggestedFilename().includes("catalogue"))!;
	const partBytes = await readFile((await part.path())!);
	const reader = new ZipReader(new BlobReader(new Blob([await readFile((await catalogue.path())!)])), { useWebWorkers: false });
	try {
		const manifestEntry = (await reader.getEntries()).find((entry) => entry.filename === "manifest.json")!;
		const manifest = JSON.parse(await manifestEntry.getData(new TextWriter()));
		expect(manifest.volumes[0].byteSize).toBe(partBytes.byteLength);
		expect(manifest.volumes[0].sha256).toBe(Buffer.from(await crypto.subtle.digest("SHA-256", Uint8Array.from(partBytes).buffer)).toString("hex"));
		const payloadReader = new ZipReader(new BlobReader(new Blob([partBytes])), { useWebWorkers: false });
		try {
			const payloadEntries = await payloadReader.getEntries();
			expect(manifest.volumes[0].payloadPaths.every((path: string) => payloadEntries.some((entry) => entry.filename === path))).toBe(true);
			expect(payloadEntries.filter((entry) => entry.filename.startsWith("media/"))).toHaveLength(3);
		} finally { await payloadReader.close(); }
	} finally { await reader.close(); }
	expect(await page.evaluate(() => Reflect.get(window, "zipSourceLeases"))).toEqual({ active: 0, peak: 1 });
});

test("cancellation during a browser part handoff releases it without producing a complete catalogue", async ({ page }) => {
	await observeZipLeases(page);
	await importSyntheticArchive(page, "/export");
	await page.getByLabel(/Allow bounded ZIP parts/).check();
	await page.getByRole("button", { name: "Preview this collection", exact: true }).click();
	await page.getByLabel(/I reviewed this scope/).check();
	const downloads: Download[] = [];
	page.on("download", (download) => downloads.push(download));
	const first = page.waitForEvent("download");
	await page.getByRole("button", { name: "Download readable ZIP parts", exact: true }).click();
	await first;
	await page.getByRole("button", { name: "Cancel export", exact: true }).click();
	await expect(page.getByRole("alert")).toContainText(/canceled during a download|incomplete/);
	await expect(page.locator(".export-receipt")).toHaveCount(0);
	expect(downloads).toHaveLength(1);
	expect(await page.evaluate(() => Reflect.get(window, "zipSourceLeases"))).toEqual({ active: 0, peak: 1 });
});
