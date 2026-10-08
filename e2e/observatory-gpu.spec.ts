import { expect, test } from "@playwright/test";
import { importSyntheticArchive } from "./fixtures/archive";

test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
	args: ["--enable-unsafe-webgpu", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] } });

test("runtime GPU errors recover to an accurately labelled WebGL renderer", async ({ page }) => {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.addInitScript(() => {
		const original = GPUAdapter.prototype.requestDevice;
		GPUAdapter.prototype.requestDevice = async function (...args) {
			const device = await Reflect.apply(original, this, args);
			(window as Window & { failOwnedGPU?: () => void }).failOwnedGPU = () => device.dispatchEvent(new GPUUncapturedErrorEvent("uncapturederror", { error: new GPUValidationError("Synthetic owned GPU failure") }));
			return device;
		};
	});
	await importSyntheticArchive(page);
	await page.getByRole("link", { name: "Observatory", exact: true }).click();
	await expect.poll(() => page.evaluate(() => typeof (window as Window & { failOwnedGPU?: unknown }).failOwnedGPU)).toBe("function");
	await page.getByRole("button", { name: "People", exact: true }).click();
	await page.locator(".evidence-buttons button").last().click();
	const selected = await page.locator(".evidence-buttons button[aria-pressed=true]").innerText();
	await page.evaluate(() => (window as Window & { failOwnedGPU: () => void }).failOwnedGPU());
	await expect(page.locator(".world-footer")).toContainText("Three.js · WebGL 2");
	await expect(page.locator(".archive-scene canvas")).toHaveCount(1);
	await expect(page.locator(".evidence-buttons button[aria-pressed=true]")).toHaveText(selected);
	await page.getByRole("link", { name: "Library", exact: true }).click();
	await expect(page.locator(".memory-card").first()).toBeVisible();
	await expect(page.locator(".archive-scene canvas")).toHaveCount(0);
	expect(errors).toEqual([]);
});

test("owned WebGPU device loss tries WebGL and preserves evidence on the available backend", async ({ page }) => {
	const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
	await page.addInitScript(() => {
		const attempts = { webgl: 0, holdFirstDraw: false }; (window as Window & { lostGPUAttempts?: unknown }).lostGPUAttempts = attempts;
		// Hidden rooms postpone drawing. Hold this public visibility boundary so software
		// adapter rendering errors cannot consume the recovery before device loss is injected.
		Object.defineProperty(document, "hidden", { configurable: true, get: () => attempts.holdFirstDraw });
		const getContext = HTMLCanvasElement.prototype.getContext;
		HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
			if (type === "webgl2") attempts.webgl++;
			return Reflect.apply(getContext, this, [type, ...args]);
		};
		const requestDevice = GPUAdapter.prototype.requestDevice;
		GPUAdapter.prototype.requestDevice = async function (...args) {
			const device = await Reflect.apply(requestDevice, this, args);
			const lost = new Promise<GPUDeviceLostInfo>((resolve) => {
				(window as Window & { loseOwnedDevice?: () => void }).loseOwnedDevice = () => resolve({ reason: "unknown", message: "Synthetic owned device loss" });
			});
			Object.defineProperty(device, "lost", { value: lost });
			return device;
		};
	});
	await importSyntheticArchive(page);
	await page.evaluate(() => { (window as Window & { lostGPUAttempts: { holdFirstDraw: boolean } }).lostGPUAttempts.holdFirstDraw = true; });
	await page.getByRole("link", { name: "Observatory", exact: true }).click();
	await expect(page.locator(".world-footer")).toContainText("Three.js · WebGPU");
	const selected = await page.locator(".evidence-buttons button[aria-pressed=true]").innerText();
	const attemptsBeforeLoss = await page.evaluate(() => (window as Window & { lostGPUAttempts: { webgl: number } }).lostGPUAttempts.webgl);
	await page.locator(".archive-scene canvas").evaluate((canvas) => { canvas.dataset.gpuSource = "1"; });
	await page.evaluate(() => (window as Window & { loseOwnedDevice: () => void }).loseOwnedDevice());
	await expect(page.locator(".world-footer")).toContainText(/Three.js · WebGL 2|Reading mode/);
	await expect.poll(() => page.evaluate(() => (window as Window & { lostGPUAttempts: { webgl: number } }).lostGPUAttempts.webgl)).toBeGreaterThan(attemptsBeforeLoss);
	await expect(page.locator(".archive-scene canvas[data-gpu-source='1']")).toHaveCount(0);
	await page.evaluate(() => {
		(window as Window & { lostGPUAttempts: { holdFirstDraw: boolean } }).lostGPUAttempts.holdFirstDraw = false;
		document.dispatchEvent(new Event("visibilitychange"));
	});
	const reading = (await page.locator(".world-footer").innerText()).includes("Reading mode");
	await expect(page.locator(".archive-scene canvas")).toHaveCount(reading ? 0 : 1);
	await expect(page.locator(".evidence-buttons button[aria-pressed=true]")).toHaveText(selected);
	expect(errors).toEqual([]);
});

test("a rejected GPU initialization after leaving the room creates no replacement renderer", async ({ page }) => {
	const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
	await page.addInitScript(() => {
		const state = { contexts: 0, settled: false };
		(window as Window & { lateGPUState?: unknown }).lateGPUState = state;
		GPUAdapter.prototype.requestDevice = () => new Promise((_resolve, reject) => {
			(window as Window & { rejectOwnedGPU?: () => void }).rejectOwnedGPU = () => { state.settled = true; reject(new Error("Synthetic unavailable device")); };
		});
		const getContext = HTMLCanvasElement.prototype.getContext;
		HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
			if (type === "webgl2") state.contexts++;
			return Reflect.apply(getContext, this, [type, ...args]);
		};
	});
	await importSyntheticArchive(page);
	await page.getByRole("link", { name: "Observatory", exact: true }).click();
	await expect.poll(() => page.evaluate(() => typeof (window as Window & { rejectOwnedGPU?: unknown }).rejectOwnedGPU)).toBe("function");
	await page.getByRole("link", { name: "Library", exact: true }).click();
	await expect(page.locator(".memory-card").first()).toBeVisible();
	const initialContexts = await page.evaluate(() => (window as Window & { lateGPUState: { contexts: number } }).lateGPUState.contexts);
	await page.evaluate(async () => {
		(window as Window & { rejectOwnedGPU: () => void }).rejectOwnedGPU();
		await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
	});
	expect(await page.evaluate(() => (window as Window & { lateGPUState: { contexts: number } }).lateGPUState.contexts)).toBe(initialContexts);
	await expect(page.locator(".archive-scene canvas")).toHaveCount(0);
	expect(errors).toEqual([]);
});
