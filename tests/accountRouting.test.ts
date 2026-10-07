import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync, readdirSync, readlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import accountHandler, { closeLocalAccountStore } from "../api/service";
import { createServer as createViteServer, preview as previewVite } from "vite";
import { accountServicePlugin } from "../server/accountRouting";

const environmentFields = ["APP_ORIGIN", "WORKOS_API_KEY", "WORKOS_CLIENT_ID", "WORKOS_COOKIE_PASSWORD", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "LOCAL_AUTH_STORE", "VERCEL"];
const servers: Server[] = [];
const directories: string[] = [];
beforeEach(() => { for (const name of environmentFields) vi.stubEnv(name, ""); });
afterEach(async () => {
    await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    closeLocalAccountStore();
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});
async function browserRequest(path: string) {
    const server = createServer((request, response) => {
        void accountHandler(request, response).catch(() => { response.statusCode = 500; response.end("Adapter rejected the request"); });
    });
    servers.push(server);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No HTTP test listener");
    return fetch(`http://127.0.0.1:${address.port}${path}`, { redirect: "manual" });
}
function lifecycleFixture() {
    const directory = mkdtempSync(join(tmpdir(), "goodbye-account-vite-lifecycle-")); directories.push(directory);
    const database = join(directory, "accounts.sqlite");
    for (const name of environmentFields) vi.stubEnv(name, "");
    vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:5173");
    vi.stubEnv("WORKOS_API_KEY", "sk_test_synthetic");
    vi.stubEnv("WORKOS_CLIENT_ID", "client_synthetic");
    vi.stubEnv("WORKOS_COOKIE_PASSWORD", "synthetic-password-longer-than-thirty-two-characters");
    vi.stubEnv("LOCAL_AUTH_STORE", database);
    const nativeFetch = globalThis.fetch;
    vi.stubGlobal("fetch", async (input: Parameters<typeof fetch>[0], options: Parameters<typeof fetch>[1]) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) throw new Error("Unexpected external request during lifecycle test");
        return nativeFetch(input, options);
    });
    const handles = () => readdirSync("/proc/self/fd").filter((entry) => {
        try { return readlinkSync(`/proc/self/fd/${entry}`) === database; } catch { return false; }
    }).length;
    return { directory, handles };
}
async function loginAt(server: { address(): ReturnType<Server["address"]> }) {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test listener");
    return fetch(`http://127.0.0.1:${address.port}/auth/login`, { redirect: "manual" });
}

describe("same-origin account HTTP routes", () => {
    it.skipIf(process.platform !== "linux")("keeps one SQLite handle across real SSR invalidations and closes it with the development server", async () => {
        const { handles } = lifecycleFixture();
        const server = await createViteServer({ configFile: false, plugins: [accountServicePlugin()], mode: "test", envFile: false, logLevel: "silent", server: { host: "127.0.0.1", port: 0 } });
        const adapters: Array<{ closeLocalAccountStore(): void }> = [];
        try {
            await server.listen();
            const address = server.httpServer?.address();
            if (!address || typeof address === "string") throw new Error("No development listener");
            for (let revision = 0; revision < 3; revision++) {
                const response = await fetch(`http://127.0.0.1:${address.port}/auth/login`, { redirect: "manual" });
                expect(response.status).toBe(303);
                adapters.push(await server.ssrLoadModule("/api/service.ts"));
                expect(handles()).toBe(1);
                server.moduleGraph.invalidateAll();
            }
            await server.close();
            expect(handles()).toBe(0);
        } finally {
            await server.close();
            for (const adapter of adapters) adapter.closeLocalAccountStore();
        }
    }, 30_000);
    it.skipIf(process.platform !== "linux")("closes preview resources and reopens the same persistent file on restart", async () => {
        const { directory, handles } = lifecycleFixture();
        writeFileSync(join(directory, "index.html"), "<!doctype html><title>Synthetic lifecycle fixture</title>");
        for (let restart = 0; restart < 2; restart++) {
            const server = await previewVite({ configFile: false, plugins: [accountServicePlugin()], envFile: false, logLevel: "silent", build: { outDir: directory }, preview: { host: "127.0.0.1", port: 0 } });
            try {
                expect((await loginAt(server.httpServer)).status).toBe(303);
                expect(handles()).toBe(1);
            } finally {
                await new Promise<void>((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
            }
            expect(handles()).toBe(0);
        }
    }, 30_000);
    it.skipIf(process.platform !== "linux")("retains a shared connection until the last live development server closes", async () => {
        const { handles } = lifecycleFixture();
        const first = await createViteServer({ configFile: false, plugins: [accountServicePlugin()], envFile: false, logLevel: "silent", server: { host: "127.0.0.1", port: 0 } });
        const second = await createViteServer({ configFile: false, plugins: [accountServicePlugin()], envFile: false, logLevel: "silent", server: { host: "127.0.0.1", port: 0 } });
        try {
            await first.listen(); await second.listen();
            if (!first.httpServer || !second.httpServer) throw new Error("No development listener");
            expect((await loginAt(first.httpServer)).status).toBe(303);
            expect((await loginAt(second.httpServer)).status).toBe(303);
            expect(handles()).toBe(1);
            await first.close();
            expect(handles()).toBe(1);
            second.moduleGraph.invalidateAll();
            expect((await loginAt(second.httpServer)).status).toBe(303);
            expect(handles()).toBe(1);
            await second.close();
            expect(handles()).toBe(0);
        } finally {
            await first.close(); await second.close();
        }
    }, 30_000);
    it("returns a private backend failure when the configured origin is malformed", async () => {
        vi.stubEnv("APP_ORIGIN", "invalid-origin");
        const response = await browserRequest("/api/session");
        expect(response.status).toBe(503);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(response.headers.get("content-type")).toBe("application/json");
        expect(response.headers.get("referrer-policy")).toBe("no-referrer");
        expect(await response.json()).toEqual({ error: "account_service_unavailable" });
    });
    it("reports missing account configuration while leaving local routes available", async () => {
        const response = await browserRequest("/api/service?route=/api/session");
        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(await response.json()).toEqual({ available: false, account: null, aiAvailable: false, chatgptAvailable: false, error: "account_not_configured" });
    });
    it("permits explicit local sign-in and gives the provider the configured callback", async () => {
        const directory = mkdtempSync(join(tmpdir(), "goodbye-account-http-")); directories.push(directory);
        vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:5173");
        vi.stubEnv("WORKOS_API_KEY", "sk_test_synthetic");
        vi.stubEnv("WORKOS_CLIENT_ID", "client_synthetic");
        vi.stubEnv("WORKOS_COOKIE_PASSWORD", "synthetic-password-longer-than-thirty-two-characters");
        vi.stubEnv("LOCAL_AUTH_STORE", join(directory, "accounts.sqlite"));
        const status = await browserRequest("/api/session");
        expect(status.status).toBe(200);
        expect(await status.json()).toMatchObject({ available: true, account: null, aiAvailable: false, chatgptAvailable: false });
        const login = await browserRequest("/auth/login");
        expect(login.status).toBe(303);
        const destination = new URL(login.headers.get("location")!);
        expect(destination.origin).toBe("https://api.workos.com");
        expect(destination.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:5173/auth/callback");
        expect(destination.searchParams.get("code_challenge_method")).toBe("S256");
    });
    it("rejects a deployed local-only store before starting a sign-in", async () => {
        vi.stubEnv("APP_ORIGIN", "https://synthetic-app.invalid");
        vi.stubEnv("WORKOS_API_KEY", "sk_test_synthetic");
        vi.stubEnv("WORKOS_CLIENT_ID", "client_synthetic");
        vi.stubEnv("WORKOS_COOKIE_PASSWORD", "synthetic-password-longer-than-thirty-two-characters");
        vi.stubEnv("LOCAL_AUTH_STORE", "/invalid/synthetic-only/accounts.sqlite");
        vi.stubEnv("VERCEL", "1");
        const response = await browserRequest("/auth/login");
        expect(response.status).toBe(503);
        expect(response.headers.get("location")).toBeNull();
        expect(response.headers.get("set-cookie")).toBeNull();
        expect(await response.json()).toMatchObject({ available: false, error: "account_not_configured" });
    });
    it("uses the shared store in deployment even when a local path is present", async () => {
        vi.stubEnv("APP_ORIGIN", "https://synthetic-app.invalid");
        vi.stubEnv("WORKOS_API_KEY", "sk_test_synthetic");
        vi.stubEnv("WORKOS_CLIENT_ID", "client_synthetic");
        vi.stubEnv("WORKOS_COOKIE_PASSWORD", "synthetic-password-longer-than-thirty-two-characters");
        vi.stubEnv("LOCAL_AUTH_STORE", "/invalid/synthetic-only/accounts.sqlite");
        vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://synthetic-store.invalid");
        vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "synthetic-store-token");
        vi.stubEnv("VERCEL", "1");
        const nativeFetch = globalThis.fetch;
        let sharedWrites = 0;
        vi.stubGlobal("fetch", async (input: Parameters<typeof fetch>[0], options: Parameters<typeof fetch>[1]) => {
            const url = new URL(input instanceof Request ? input.url : String(input));
            if (url.origin !== "https://synthetic-store.invalid") return nativeFetch(input, options);
            expect(options?.method).toBe("POST");
            expect(new Headers(options?.headers).get("authorization")).toBe("Bearer synthetic-store-token");
            sharedWrites++;
            return new Response(JSON.stringify({ result: "OK" }), { headers: { "Content-Type": "application/json" } });
        });
        const login = await browserRequest("/api/service?route=/auth/login");
        expect(login.status).toBe(303);
        expect(sharedWrites).toBeGreaterThan(0);
        expect(login.headers.get("set-cookie")).toContain("Secure");
        expect(new URL(login.headers.get("location")!).searchParams.get("redirect_uri")).toBe("https://synthetic-app.invalid/auth/callback");
    });
});
