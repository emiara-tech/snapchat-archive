import { expect, test } from "@playwright/test";
import { BlobReader, BlobWriter, TextReader, Uint8ArrayReader, Uint8ArrayWriter, ZipReader, ZipWriter } from "@zip.js/zip.js";
import { readFile, mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { pathToFileURL } from "node:url";

test("an oversized image stays downloadable without entering the preview decoder", async ({ page }) => {
	await page.goto("/import");
	const jpeg = await page.evaluate(() => {
		const canvas = document.createElement("canvas"); canvas.width = 8; canvas.height = 8;
		canvas.getContext("2d")!.fillRect(0, 0, 8, 8);
		return canvas.toDataURL("image/jpeg").split(",")[1]!;
	});
	const source = Buffer.concat([Buffer.from(jpeg, "base64"), Buffer.alloc(16 * 1024 * 1024)]);
	const writer = new ZipWriter(new BlobWriter("application/zip"), { useWebWorkers: false, level: 0 });
	await writer.add("json/account.json", new TextReader('{"Basic Information":{"Username":"synthetic-owner"}}'));
	await writer.add("json/memories_history.json", new TextReader(JSON.stringify({ "Saved Media": [{ Date: "2020-01-01 12:00:00 UTC", "Media Type": "Image", "Download Link": "https://example.invalid/?mid=oversized-fixture" }] })));
	await writer.add("memories/2020-01-01_oversized-fixture-main.jpg", new Uint8ArrayReader(source));
	await page.locator('input[type="file"]').setInputFiles({ name: "synthetic-oversized.zip", mimeType: "application/zip", buffer: Buffer.from(await (await writer.close()).arrayBuffer()) });
	await page.getByRole("button", { name: "Open the box", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Your archive is ready", exact: true })).toBeVisible();
	await page.getByRole("link", { name: "Library", exact: true }).click();
	await page.locator(".open-asset").first().click();
	const dialog = page.getByRole("dialog");
	await expect(dialog.getByText(/source byte budget/)).toBeVisible();
	await expect(dialog.locator("img.original")).toHaveCount(0);
	const saved = page.waitForEvent("download");
	await dialog.getByRole("link", { name: "Download original", exact: true }).click();
	const output = await saved;
	expect(await readFile((await output.path())!)).toEqual(source);
});

test("full-size composed preview and portable PNG agree with independently expected pixels", async ({ page }) => {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.goto("/import");
	const images = await page.evaluate(() => {
		const canvas = document.createElement("canvas"); canvas.width = 8; canvas.height = 8;
		const context = canvas.getContext("2d")!;
		context.fillStyle = "rgb(255,0,0)"; context.fillRect(0, 0, 8, 8);
		const original = canvas.toDataURL("image/jpeg", 1).split(",")[1]!;
		context.clearRect(0, 0, 8, 8); context.fillStyle = "rgba(0,0,255,0.5)"; context.fillRect(0, 0, 4, 8);
		return { original, overlay: canvas.toDataURL("image/png").split(",")[1]! };
	});
	const writer = new ZipWriter(new BlobWriter("application/zip"), { useWebWorkers: false });
	await writer.add("json/account.json", new TextReader('{"Basic Information":{"Username":"synthetic-owner"}}'));
	await writer.add("json/memories_history.json", new TextReader(JSON.stringify({ "Saved Media": [{ Date: "2020-01-01 12:00:00 UTC", "Media Type": "Image", "Download Link": "https://example.invalid/?mid=composed-fixture" }] })));
	await writer.add("memories/2020-01-01_composed-fixture-main.jpg", new Uint8ArrayReader(Buffer.from(images.original, "base64")));
	await writer.add("memories/2020-01-01_composed-fixture-overlay.png", new Uint8ArrayReader(Buffer.from(images.overlay, "base64")));
	await page.locator('input[type="file"]').setInputFiles({ name: "synthetic-layers.zip", mimeType: "application/zip", buffer: Buffer.from(await (await writer.close()).arrayBuffer()) });
	await page.getByRole("button", { name: "Open the box", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Your archive is ready", exact: true })).toBeVisible();
	await page.getByRole("link", { name: "Library", exact: true }).click();
	const layeredCard = page.locator(".memory-card").filter({ has: page.getByAltText("Recorded overlay layer", { exact: true }) });
	await expect(layeredCard).toHaveCount(1);
	await layeredCard.locator(".open-asset").click();
	await page.getByRole("button", { name: "Preview flattened PNG", exact: true }).click();
	const composed = page.getByAltText("Flattened PNG preview from the original and recorded overlay", { exact: true });
	await expect(composed).toBeVisible();
	const pixels = await composed.evaluate((image: HTMLImageElement) => {
		const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
		const context = canvas.getContext("2d")!; context.drawImage(image, 0, 0);
		return { width: canvas.width, height: canvas.height, left: [...context.getImageData(1, 4, 1, 1).data], right: [...context.getImageData(6, 4, 1, 1).data] };
	});
	expect(pixels.width).toBe(8); expect(pixels.height).toBe(8);
	expect(pixels.left[0]).toBeGreaterThanOrEqual(124); expect(pixels.left[0]).toBeLessThanOrEqual(130);
	expect(pixels.left[2]).toBeGreaterThanOrEqual(124); expect(pixels.left[2]).toBeLessThanOrEqual(130);
	expect(pixels.left[3]).toBe(255); expect(pixels.right[0]).toBeGreaterThanOrEqual(250); expect(pixels.right[2]).toBeLessThanOrEqual(2);
	const previewBytes = await composed.evaluate(async (image: HTMLImageElement) => [...new Uint8Array(await (await fetch(image.src)).arrayBuffer())]);
	await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
	await page.getByRole("link", { name: "Export", exact: true }).click();
	await page.getByLabel(/Also create supported flattened PNG images/).check();
	await page.getByRole("button", { name: "Preview this collection", exact: true }).click();
	await page.getByLabel(/I reviewed this scope/).check();
	const downloaded = page.waitForEvent("download");
	await page.getByRole("button", { name: "Download readable ZIP", exact: true }).click();
	const download = await downloaded;
	const downloadPath = await download.path(); expect(downloadPath).not.toBeNull();
	const output = await readFile(downloadPath!);
	const reader = new ZipReader(new BlobReader(new Blob([output])), { useWebWorkers: false });
	const folder = await mkdtemp(join(tmpdir(), "goodbye-synthetic-composition-"));
	try {
		const entries = await reader.getEntries();
		const payloads = new Map<string, Uint8Array>();
		for (const entry of entries) if (!entry.directory) {
			const bytes = await entry.getData(new Uint8ArrayWriter()); payloads.set(entry.filename, bytes);
			const path = join(folder, entry.filename); await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes);
		}
		const manifest = JSON.parse(new TextDecoder().decode(payloads.get("manifest.json")));
		const asset = manifest.assets.find((item: { composed: string | null }) => item.composed);
		expect(asset).toBeDefined();
		expect(asset.composed).toMatch(/^composed\/.+\.png$/);
		expect(asset.file).toMatch(/^media\/.+\.jpg$/); expect(asset.overlay).toMatch(/^overlays\/.+\.png$/);
		expect(payloads.get(asset.file)).toEqual(new Uint8Array(Buffer.from(images.original, "base64")));
		expect(payloads.get(asset.overlay)).toEqual(new Uint8Array(Buffer.from(images.overlay, "base64")));
		expect(asset.composition.recipe.canvas).toEqual({ width: 8, height: 8 });
		expect(asset.composition.recipe.transform).toEqual({ x: 0, y: 0, width: 8, height: 8, rotation: 0, opacity: 1 });
		expect(payloads.get(asset.composed)).toEqual(new Uint8Array(previewBytes));
		for (const payload of manifest.payloads) expect(Buffer.from(await crypto.subtle.digest("SHA-256", Uint8Array.from(payloads.get(payload.path)!).buffer)).toString("hex")).toBe(payload.sha256);
		await page.goto(pathToFileURL(join(folder, "index.html")).href);
		const image = page.locator(`img[src="${asset.composed}"]`);
		await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth)).toBe(8);
		await expect(image).toHaveAttribute("src", asset.composed);
	} finally { await reader.close(); await rm(folder, { recursive: true, force: true }); }
	expect(errors).toEqual([]);
});

test("a differently sized overlay stays separate and cannot silently become a flattened image", async ({ page }) => {
	await page.goto("/import");
	const images = await page.evaluate(() => {
		const canvas = document.createElement("canvas"); canvas.width = 8; canvas.height = 8;
		const context = canvas.getContext("2d")!; context.fillStyle = "red"; context.fillRect(0, 0, 8, 8);
		const original = canvas.toDataURL("image/jpeg", 1).split(",")[1]!;
		canvas.width = 4; canvas.height = 4; context.fillStyle = "blue"; context.fillRect(0, 0, 4, 4);
		return { original, overlay: canvas.toDataURL("image/png").split(",")[1]! };
	});
	const writer = new ZipWriter(new BlobWriter("application/zip"), { useWebWorkers: false });
	await writer.add("json/account.json", new TextReader('{"Basic Information":{"Username":"synthetic-owner"}}'));
	await writer.add("json/memories_history.json", new TextReader(JSON.stringify({ "Saved Media": [{ Date: "2020-01-01 12:00:00 UTC", "Media Type": "Image", "Download Link": "https://example.invalid/?mid=mismatched-fixture" }] })));
	await writer.add("memories/2020-01-01_mismatched-fixture-main.jpg", new Uint8ArrayReader(Buffer.from(images.original, "base64")));
	await writer.add("memories/2020-01-01_mismatched-fixture-overlay.png", new Uint8ArrayReader(Buffer.from(images.overlay, "base64")));
	await page.locator('input[type="file"]').setInputFiles({ name: "synthetic-mismatch.zip", mimeType: "application/zip", buffer: Buffer.from(await (await writer.close()).arrayBuffer()) });
	await page.getByRole("button", { name: "Open the box", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Your archive is ready", exact: true })).toBeVisible();
	await page.getByRole("link", { name: "Library", exact: true }).click();
	const layeredCard = page.locator(".memory-card").filter({ has: page.getByAltText("Recorded overlay layer", { exact: true }) });
	await expect(layeredCard).toHaveCount(1); await layeredCard.locator(".open-asset").click();
	const dialog = page.getByRole("dialog");
	await expect(dialog.getByText(/source and overlay dimensions differ/)).toBeVisible();
	await expect(dialog.getByAltText("Recorded overlay layer", { exact: true })).toBeHidden();
	await dialog.getByRole("button", { name: "Preview flattened PNG", exact: true }).click();
	await expect(dialog.getByText(/does not establish an unchanged same-canvas layer/)).toBeVisible();
	await expect(dialog.getByAltText("Flattened PNG preview from the original and recorded overlay", { exact: true })).toHaveCount(0);
});
