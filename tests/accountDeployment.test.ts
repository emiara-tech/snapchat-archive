import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import ts from "typescript";

const execFileAsync = promisify(execFile);
const repository = fileURLToPath(new URL("../", import.meta.url));

describe("deployed account service cold start", () => {
	it("loads emitted ESM and reports unavailable accounts without blocking the archive session", async () => {
		const directory = mkdtempSync(join(tmpdir(), "goodbye-account-deployment-"));
		try {
			writeFileSync(join(directory, "package.json"), JSON.stringify({ type: "module" }));
			symlinkSync(join(repository, "node_modules"), join(directory, "node_modules"), "dir");
			for (const sourceDirectory of ["api", "server"]) {
				mkdirSync(join(directory, sourceDirectory));
				for (const filename of readdirSync(join(repository, sourceDirectory))) {
					if (!filename.endsWith(".ts")) continue;
					const source = readFileSync(join(repository, sourceDirectory, filename), "utf8");
					const emitted = ts.transpileModule(source, {
						fileName: filename,
						compilerOptions: {
							target: ts.ScriptTarget.ES2023,
							module: ts.ModuleKind.ESNext,
							verbatimModuleSyntax: true,
						},
					});
					writeFileSync(join(directory, sourceDirectory, filename.replace(/\.ts$/, ".js")), emitted.outputText);
				}
			}
			const { stdout } = await execFileAsync(process.execPath, ["--input-type=module", "--eval", `
				import { accountRequest } from "./api/service.js";
				const results = {};
				for (const path of ["/api/session", "/auth/login"]) {
					const response = await accountRequest(new Request("https://synthetic-app.invalid" + path));
					results[path] = {
						status: response.status,
						body: await response.json(),
						contentType: response.headers.get("content-type"),
						cacheControl: response.headers.get("cache-control"),
						referrerPolicy: response.headers.get("referrer-policy"),
						location: response.headers.get("location"),
						cookie: response.headers.get("set-cookie"),
					};
				}
				process.stdout.write(JSON.stringify(results));
			`], {
				cwd: directory,
				// Do not inherit account credentials or Node loaders from the test runner.
				env: { VERCEL: "1" },
				timeout: 10_000,
			});
			const unavailable = {
				body: { available: false, account: null, aiAvailable: false, chatgptAvailable: false, error: "account_not_configured" },
				contentType: "application/json",
				cacheControl: "no-store",
				referrerPolicy: "no-referrer",
				location: null,
				cookie: null,
			};
			expect(JSON.parse(stdout)).toEqual({
				"/api/session": { ...unavailable, status: 200 },
				"/auth/login": { ...unavailable, status: 503 },
			});
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	}, 15_000);
});
