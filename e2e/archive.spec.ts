import { expect, test } from "@playwright/test";
import { BlobWriter, TextReader, Uint8ArrayReader, ZipWriter } from "@zip.js/zip.js";

test("direct pages serve the current JavaScript and stylesheets as assets", async ({ request }) => {
	let currentScript: string | undefined;
	let currentStyle: string | undefined;
	for (const path of ["/", "/import", "/welcome", "/photos", "/missing-page"]) {
		const response = await request.get(path);
		expect(response.ok(), `Page ${path} should be available`).toBe(true);
		const html = await response.text();
		const scriptPath = /<script[^>]*src="([^"]+)"/.exec(html)?.[1];
		const stylePath = /<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/.exec(html)?.[1];
		if (!scriptPath || !stylePath) throw new Error(`The entry assets are missing on ${path}`);
		currentScript ??= scriptPath;
		currentStyle ??= stylePath;
		expect(scriptPath, `Page ${path} should reference the current release`).toBe(currentScript);
		expect(stylePath, `Page ${path} should reference the current release`).toBe(currentStyle);
		const script = await request.get(scriptPath);
		expect(script.ok()).toBe(true);
		expect(script.headers()["content-type"]).toMatch(/(?:text|application)\/javascript/);
		const style = await request.get(stylePath);
		expect(style.ok()).toBe(true);
		expect(style.headers()["content-type"]).toMatch(/text\/css/);
	}
});

test("a failed import can recover, and removing files clears the import selection", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/import");
	await page.locator('input[type="file"]').setInputFiles({
		name: "broken.zip",
		mimeType: "application/zip",
		buffer: Buffer.from("This is not a ZIP archive."),
	});
	await page.getByRole("button", { name: "Open the box", exact: true }).click();
	await expect(page.getByRole("alert")).toContainText("Couldn't open your archive");
	await expect(page.locator(".spinner")).toHaveCount(0);
	await page.getByRole("button", { name: "Choose different ZIPs" }).click();
	await expect(page).toHaveURL(/\/import$/);

	const buffer = await zip({ "json/memories_history.json": '{"Saved Media":[]}' });
	await page.locator('input[type="file"]').setInputFiles({
		name: "archive.zip",
		mimeType: "application/zip",
		buffer,
	});
	await page.getByRole("button", { name: "Remove files", exact: true }).click();
	await expect(
		page.getByRole("button", { name: "Open the box", exact: true }),
	).toHaveCount(0);
	await page.locator('input[type="file"]').setInputFiles({
		name: "archive.zip",
		mimeType: "application/zip",
		buffer,
	});
	await page.getByRole("button", { name: "Open the box", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Your archive is ready" })).toBeVisible();
});

test("multipart archives display local images, filter by year, and reset the session", async ({ page }) => {
	const pageErrors: string[] = [];
	const requests: { url: string; method: string; archiveSelected: boolean }[] = [];
	let archiveSelected = false;
	page.on("pageerror", (error) => pageErrors.push(error.message));
	page.on("request", (request) => {
		const url = new URL(request.url());
		if (url.protocol === "http:" || url.protocol === "https:") {
			requests.push({ url: url.href, method: request.method(), archiveSelected });
		}
	});
	await page.goto("/import");
	await page.waitForLoadState("networkidle");
	const jpeg = await page.evaluate(() => {
		const canvas = document.createElement("canvas");
		canvas.width = 8;
		canvas.height = 8;
		const context = canvas.getContext("2d");
		if (!context) throw new Error("Canvas is unavailable");
		context.fillStyle = "#e9b950";
		context.fillRect(0, 0, 8, 8);
		return canvas.toDataURL("image/jpeg").split(",")[1];
	});
	const image = Buffer.from(jpeg, "base64");
	const metadata = await zip({
		"json/memories_history.json": JSON.stringify({
			"Saved Media": [
				{
					Date: "2026-01-01 12:00:00 UTC",
					"Media Type": "Image",
					"Download Link": "https://example.invalid/download?mid=recent",
				},
				{
					Date: "2025-01-01 12:00:00 UTC",
					"Media Type": "Image",
					"Download Link": "https://example.invalid/download?mid=older",
				},
			],
		}),
	});
	const media = await zip({
		"memories/2026-01-01_recent-main.jpg": image,
		"memories/2025-01-01_older-main.jpg": image,
	});
	archiveSelected = true;
	await page.locator('input[type="file"]').setInputFiles([
		{ name: "metadata.zip", mimeType: "application/zip", buffer: metadata },
		{ name: "media.zip", mimeType: "application/zip", buffer: media },
	]);
	await page.getByRole("button", { name: "Open the box", exact: true }).click();
	await page.getByRole("link", { name: "Browse memories", exact: true }).click();
	await expect(page.locator(".photos-grid > *")).toHaveCount(2);
	await expect
		.poll(() =>
			page.locator(".photos-grid img").first().evaluate(
				(image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
			),
		)
		.toBe(true);
	await page.getByLabel("Year", { exact: true }).selectOption("2025");
	await expect(page.locator(".photos-grid > *")).toHaveCount(1);
	await page.getByRole("link", { name: "Import", exact: true }).click();
	await page.locator('input[type="file"]').setInputFiles({
		name: "replacement.zip",
		mimeType: "application/zip",
		buffer: await zip({ "json/memories_history.json": '{"Saved Media":[]}' }),
	});
	await page.getByRole("button", { name: "Open the box", exact: true }).click();
	await page.getByRole("link", { name: "Browse memories", exact: true }).click();
	await expect(page.locator(".photos-grid > *")).toHaveCount(0);
	await page.getByRole("button", { name: "Start over", exact: true }).click();
	await expect(page).toHaveURL(/\/$/);
	archiveSelected = false;
	await page.goto("/photos");
	await expect(page).toHaveURL(/\/import$/);
	await expect(page.locator(".photos-grid")).toHaveCount(0);
	await page.waitForLoadState("networkidle");
	expect(pageErrors).toEqual([]);
	const origin = new URL(page.url()).origin;
	const unexpectedRequests = requests.filter((request) => {
		const url = new URL(request.url);
		if (url.origin === origin) return request.archiveSelected && request.method !== "GET";
		// Cloudflare may inject this public script while no archive is selected.
		return request.archiveSelected || request.method !== "GET"
			|| url.hostname !== "static.cloudflareinsights.com"
			|| !/^\/beacon\.min\.js(?:\/v[\da-z]+)?$/.test(url.pathname);
	});
	expect(unexpectedRequests).toEqual([]);
});

test("direct archive pages require an import, and mobile navigation works", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/welcome");
	await expect(page).toHaveURL(/\/import$/);
	await page.getByRole("button", { name: "Open menu", exact: true }).click();
	await page.getByRole("button", { name: "Privacy", exact: true }).click();
	await expect(
		page.getByRole("heading", { name: "Your archive stays in your browser." }),
	).toBeVisible();
	await page.goto("/missing-page");
	await expect(page).toHaveURL(/\/$/);
	await expect(page.getByRole("heading", { name: "Your data, your memories." })).toBeVisible();
});

async function zip(files: Record<string, string | Uint8Array>): Promise<Buffer> {
	const writer = new ZipWriter(new BlobWriter("application/zip"));
	for (const [path, content] of Object.entries(files)) {
		await writer.add(
			path,
			typeof content === "string"
				? new TextReader(content)
				: new Uint8ArrayReader(content),
		);
	}
	const blob = await writer.close();
	return Buffer.from(await blob.arrayBuffer());
}
