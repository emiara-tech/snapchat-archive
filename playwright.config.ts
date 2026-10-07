import { defineConfig } from "@playwright/test";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const localBaseURL = "http://127.0.0.1:4173";

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: 0,
	timeout: 30_000,
	expect: { timeout: 5_000 },
	reporter: "list",
	use: {
		baseURL: externalBaseURL ?? localBaseURL,
		viewport: { width: 1280, height: 800 },
		launchOptions: {
			executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
		},
	},
	webServer: externalBaseURL
		? undefined
		: {
				command:
					"pnpm run build && pnpm run preview --host 127.0.0.1 --port 4173 --strictPort",
				url: localBaseURL,
				reuseExistingServer: false,
				timeout: 60_000,
			},
});
