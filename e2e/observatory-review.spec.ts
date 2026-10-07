import { expect, test } from "@playwright/test";
import { BlobWriter, TextReader, Uint8ArrayReader, ZipWriter } from "@zip.js/zip.js";
import { importSyntheticArchive } from "./fixtures/archive";

test("returning from a source retains its observatory room and selected evidence", async ({ page }) => {
	await importSyntheticArchive(page);
	await page.getByRole("link", { name: "Observatory", exact: true }).click();
	await expect(page).toHaveURL(/\/observatory$/);
	await page.getByRole("button", { name: "Language", exact: true }).click();
	const evidence = page.locator(".evidence-buttons button").nth(1);
	await expect(evidence).toBeVisible();
	const label = await evidence.innerText();
	await evidence.click();
	await expect(evidence).toHaveAttribute("aria-pressed", "true");
	await page.locator(".evidence-card").getByRole("link", { name: "Open conversation →", exact: true }).first().click();
	await expect(page).toHaveURL(/\/conversations\?/);
	await expect(page.locator(".thread-heading h2")).toBeVisible();
	await page.goBack();
	await expect(page.getByRole("button", { name: "Language", exact: true })).toHaveAttribute("aria-pressed", "true");
	await expect(page.locator(".evidence-buttons button[aria-pressed=true]")).toHaveText(label);
});

test("the mixed relationship collection uses conversation-scope units", async ({ page }) => {
	await importSyntheticArchive(page);
	await page.getByRole("link", { name: "Observatory", exact: true }).click();
	await page.getByRole("button", { name: "People", exact: true }).click();
	await expect(page.locator(".world-heading p")).toContainText("2 conversation scopes");
});

test("renderer context loss rebuilds once without losing selected evidence or leaving a failed canvas", async ({ page }) => {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.addInitScript(() => Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined }));
	await importSyntheticArchive(page);
	await page.getByRole("link", { name: "Observatory", exact: true }).click();
	await expect(page.locator(".world-footer")).toContainText("Three.js · WebGL 2");
	await page.getByRole("button", { name: "People", exact: true }).click();
	const selected = page.locator(".evidence-buttons button").nth(1);
	await selected.click();
	const evidence = await selected.innerText();
	await page.locator(".archive-scene canvas").evaluate((canvas: HTMLCanvasElement) => {
		canvas.dataset.lost = "1";
		canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
	});
	await expect(page.locator(".world-footer")).toContainText("Three.js · WebGL 2");
	await expect(page.locator(".archive-scene canvas[data-lost='1']")).toHaveCount(0);
	await expect(page.locator(".archive-scene canvas")).toHaveCount(1);
	await expect(page.locator(".evidence-buttons button[aria-pressed=true]")).toHaveText(evidence);
	await page.locator(".archive-scene canvas").evaluate((canvas) => canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true })));
	await expect(page.getByText("Your history still works without 3D.", { exact: true })).toBeVisible();
	await expect(page.locator(".archive-scene canvas")).toHaveCount(0);
	await expect(page.locator(".evidence-buttons button[aria-pressed=true]")).toHaveText(evidence);
	expect(errors).toEqual([]);
});

test("excluded-record review reaches the reversible library controls", async ({ page }) => {
	await importSyntheticArchive(page);
	await page.getByRole("link", { name: "Library", exact: true }).click();
	const first = page.locator(".memory-card").first();
	await expect(first).toBeVisible();
	const assetId = await first.getAttribute("data-asset-id");
	await first.getByRole("button", { name: "Exclude", exact: true }).click();
	await page.getByRole("link", { name: "Observatory", exact: true }).click();
	await page.getByRole("button", { name: "What is missing, and what did I exclude?", exact: true }).click();
	await page.getByRole("button", { name: "Review excluded records →", exact: true }).click();
	await expect(page).toHaveURL(/\/library(?:\?|$)/);
	await expect(page.getByLabel("Review status", { exact: true })).toHaveValue("exclude");
	const excluded = page.locator(`[data-asset-id="${assetId}"]`);
	await expect(excluded).toBeVisible();
	await excluded.getByRole("button", { name: "Keep", exact: true }).click();
	await page.getByLabel("Review status", { exact: true }).selectOption("active");
	await expect(page.locator(`[data-asset-id="${assetId}"] .status-tag`)).toHaveText("keep");
});

test("gallery decodes at most three bounded thumbnails and releases their original URLs", async ({ page }) => {
	const external: string[] = [];
	page.on("request", (request) => { if (/^https?:/.test(request.url()) && !request.url().startsWith(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173")) external.push(request.url()); });
	await page.addInitScript(() => {
		Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined });
		const state = { active: 0, peak: 0, decodes: 0, originals: new Set<string>() };
		(window as Window & { thumbnailProbe?: unknown }).thumbnailProbe = state;
		const decode = window.createImageBitmap;
		window.createImageBitmap = async (...args: Parameters<typeof createImageBitmap>) => {
			state.active++; state.decodes++; state.peak = Math.max(state.peak, state.active);
			try { return await Reflect.apply(decode, window, args); } finally { state.active--; }
		};
		const create = URL.createObjectURL, revoke = URL.revokeObjectURL;
		URL.createObjectURL = (blob) => { const url = create(blob); if (blob instanceof Blob && blob.type === "image/jpeg") state.originals.add(url); return url; };
		URL.revokeObjectURL = (url) => { state.originals.delete(url); revoke(url); };
	});
	await page.goto("/import");
	const base64 = await page.evaluate(() => {
		const canvas = document.createElement("canvas"); canvas.width = 1536; canvas.height = 768;
		const context = canvas.getContext("2d")!; context.fillStyle = "#b66b42"; context.fillRect(0, 0, canvas.width, canvas.height);
		return canvas.toDataURL("image/jpeg", .8).split(",")[1]!;
	});
	const writer = new ZipWriter(new BlobWriter("application/zip"), { useWebWorkers: false });
	await writer.add("json/account.json", new TextReader('{"Basic Information":{"Username":"synthetic-owner"}}'));
	await writer.add("json/memories_history.json", new TextReader(JSON.stringify({ "Saved Media": Array.from({ length: 6 }, (_, index) => ({ Date: "2020-01-01 12:00:00 UTC", "Media Type": "Image", "Download Link": `https://example.invalid/?mid=thumbnail-${index}` })) })));
	for (let index = 0; index < 6; index++) await writer.add(`memories/2020-01-01_thumbnail-${index}-main.jpg`, new Uint8ArrayReader(Buffer.from(base64, "base64")));
	await page.locator('input[type="file"]').setInputFiles({ name: "synthetic-thumbnails.zip", mimeType: "application/zip", buffer: Buffer.from(await (await writer.close()).arrayBuffer()) });
	await page.getByRole("button", { name: "Open the box", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Your archive is ready", exact: true })).toBeVisible();
	await page.getByRole("link", { name: "Observatory", exact: true }).click();
	await page.getByRole("button", { name: "Memories", exact: true }).click();
	const thumbnail = page.getByAltText("Selected archive memory", { exact: true });
	await expect(thumbnail).toBeVisible();
	await expect.poll(() => thumbnail.evaluate((image: HTMLImageElement) => [image.naturalWidth, image.naturalHeight])).toEqual([384, 192]);
	await expect.poll(() => page.evaluate(() => {
		const probe = (window as Window & { thumbnailProbe: { originals: Set<string>; active: number; decodes: number; peak: number } }).thumbnailProbe;
		return { originals: probe.originals.size, active: probe.active, decodes: probe.decodes };
	})).toEqual({ originals: 0, active: 0, decodes: 6 });
	const peak = await page.evaluate(() => (window as Window & { thumbnailProbe: { peak: number } }).thumbnailProbe.peak);
	expect(peak).toBeGreaterThan(0); expect(peak).toBeLessThanOrEqual(3);
	await page.getByRole("button", { name: "Time", exact: true }).click();
	await expect(thumbnail).toHaveCount(0);
	expect(external).toEqual([]);
});

test("a rapid room change keeps old and new thumbnail generations under one decoder budget", async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined });
		const probe = { active: 0, peak: 0, release: [] as Array<() => void> };
		(window as Window & { delayedThumbnails?: unknown }).delayedThumbnails = probe;
		const decode = window.createImageBitmap;
		window.createImageBitmap = async (...args: Parameters<typeof createImageBitmap>) => {
			probe.active++; probe.peak = Math.max(probe.peak, probe.active);
			try {
				const bitmap = await Reflect.apply(decode, window, args);
				await new Promise<void>((resolve) => probe.release.push(resolve));
				return bitmap;
			} finally { probe.active--; }
		};
	});
	await importSyntheticArchive(page);
	await page.getByRole("link", { name: "Observatory", exact: true }).click();
	await page.getByRole("button", { name: "Memories", exact: true }).click();
	await expect.poll(() => page.evaluate(() => (window as Window & { delayedThumbnails: { active: number } }).delayedThumbnails.active)).toBe(3);
	await page.getByRole("button", { name: "Time", exact: true }).click();
	await page.getByRole("button", { name: "Memories", exact: true }).click();
	await page.evaluate(async () => { await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); });
	await expect(page.getByRole("button", { name: "Memories", exact: true })).toHaveAttribute("aria-pressed", "true");
	expect(await page.evaluate(() => (window as Window & { delayedThumbnails: { peak: number } }).delayedThumbnails.peak)).toBeLessThanOrEqual(3);
	await page.getByRole("button", { name: "Time", exact: true }).click();
	await page.evaluate(() => (window as Window & { delayedThumbnails: { release: Array<() => void> } }).delayedThumbnails.release.forEach((release) => release()));
	await expect.poll(() => page.evaluate(() => (window as Window & { delayedThumbnails: { active: number } }).delayedThumbnails.active)).toBe(0);
	await expect(page.getByAltText("Selected archive memory", { exact: true })).toHaveCount(0);
});
