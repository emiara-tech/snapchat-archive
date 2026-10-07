import { afterEach, describe, expect, it, vi } from "vitest";
import { createAccountService } from "../server/accountService";
import { digest, encrypt } from "../server/security";
import type { DurableStore } from "../server/store";
import type { InferenceInput, InferenceProvider } from "../server/inference";
import { createServer } from "node:http";
import { handleNodeAccountRequest } from "../server/nodeAccountAdapter";
import { config as hostingConfig } from "../api/service";
import { readFileSync } from "node:fs";

function fixture(initialByokIncluded = true) {
	const records = new Map<string, string>(); const password = "synthetic-only-secret-more-than-thirty-two-characters";
	const store: DurableStore = { get: async (key) => records.get(key) ?? null, put: async (key, value) => { records.set(key, value); }, remove: async (key) => { records.delete(key); },
		claim: async (key, value) => { if (records.has(key)) return false; records.set(key, value); return true; },
		take: async (key, expected) => { if (records.get(key) !== expected) return false; records.delete(key); return true; },
		replace: async (key, expected, value) => { if (records.get(key) !== expected) return false; records.set(key, value); return true; } };
	const session = { ownerId: "owner-a", sealed: "sealed-a", csrf: "csrf-a", expiresAt: Date.now() + 60_000 };
	records.set("session:" + digest("session-a"), encrypt(session, password));
	const binding = { workspaceId: "workspace-a", creatorUserId: "creator-a", organizationId: null, byokIncluded: initialByokIncluded, bindingState: "known" };
	records.set("connection:owner-a", encrypt({ ownerId: "owner-a", key: "sk-or-connected-synthetic", providerBinding: binding, connectedAt: new Date().toISOString(), expiresAt: null }, password));
	let allowance = { is_management_key: false, is_provisioning_key: false, limit: 1, limit_remaining: 1, include_byok_in_limit: initialByokIncluded,
		workspace_id: "workspace-a", creator_user_id: "creator-a", organization_id: null, expires_at: null };
	let allowanceDelayMs = 0;
	const generate = vi.fn<InferenceProvider["generate"]>(async () => ({ text: JSON.stringify({ observations: [{ text: "Only the source", evidenceIds: ["own-1"], uncertainty: "Limited retained history" }] }),
		inputTokens: 20, outputTokens: 20, costUsd: 0.00004, isByok: false, provider: "Synthetic Provider" }));
	const provider: InferenceProvider = { generate, quote: async () => ({ model: "synthetic/text", provider: "synthetic", providerName: "Synthetic Provider", inputPriceNano: 1000, outputPriceNano: 2000,
		requestPriceNano: 0, contextTokens: 8192, maxOutputTokens: 512, tokenizer: "GPT", privacy: "zdr-no-collection" }) };
	const service = () => createAccountService({ origin: "https://app.invalid", password, store, inferenceProvider: provider,
		identity: { start: async () => { throw new Error("Unused"); }, exchange: async () => { throw new Error("Unused"); }, logout: async () => "https://identity.invalid",
			verify: async (sealed) => ["sealed-a", "sealed-b"].includes(sealed) ? { sealed, account: { id: sealed === "sealed-a" ? "owner-a" : "owner-b", email: "synthetic-owner@synthetic.invalid", name: "Synthetic owner" } } : null },
		fetch: async () => { if (allowanceDelayMs) await new Promise<void>((resolve) => setTimeout(resolve, allowanceDelayMs)); return Response.json({ data: allowance }); } });
	const input: InferenceInput = { idempotencyKey: "one-request", purpose: "archive-explanation", model: "synthetic/text", provider: "synthetic", budgetUsd: 0.01, maxOutputTokens: 100,
		scope: { datasetRevision: "dataset-v2", selectionRevision: "query-1", year: 2019, timezone: "UTC", excludedIds: [] }, question: "Explain this selected source", evidence: [{ id: "own-1", text: "archive-server-canary", authorship: "owner", timestamp: "2019-01-01T00:00:00Z" }] };
	function request(path: string, body?: unknown, headers: Record<string, string> = {}) { return new Request("https://app.invalid" + path, { method: body === undefined ? "GET" : "POST",
		headers: { Cookie: "__Host-gc_session=session-a", Origin: "https://app.invalid", "X-CSRF-Token": "csrf-a", "Content-Type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }); }
	return { service, request, input, provider, generate, records, store, password, setAllowanceDelay(ms: number) { allowanceDelayMs = ms; }, setAllowance(change: Partial<typeof allowance>) { allowance = { ...allowance, ...change }; } };
}
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
describe("authenticated public inference endpoints", () => {
	it("routes all four deployed inference URLs to real backend JSON before the SPA fallback", async () => {
		const manifest: { rewrites: { source: string; destination: string }[] } = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
		const f = fixture(); const server = createServer((request, response) => { void handleNodeAccountRequest(request, response, { origin: () => "https://app.invalid", handle: (input) => f.service().handle(input) }); });
		await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
		try {
			const address = server.address(); if (!address || typeof address === "string") throw new Error("Missing listener");
			const endpoint = (operation: string) => {
				const path = "/api/inference/" + operation;
				const index = manifest.rewrites.findIndex((rule) => rule.source === path);
				expect(index).toBeGreaterThanOrEqual(0);
				expect(index).toBeLessThan(manifest.rewrites.findIndex((rule) => rule.destination === "/index.html"));
				return new URL(manifest.rewrites[index]!.destination, `http://127.0.0.1:${address.port}`);
			};
			const headers = { Cookie: "__Host-gc_session=session-a", Origin: "https://app.invalid", "X-CSRF-Token": "csrf-a", "Content-Type": "application/json" };
			const call = (url: URL, body?: unknown) => fetch(url, { method: body === undefined ? "GET" : "POST", headers, body: body === undefined ? undefined : JSON.stringify(body) });
			const prepared = await call(endpoint("preview"), f.input);
			expect(prepared.headers.get("content-type")).toContain("application/json");
			expect(prepared.status).toBe(200); const preview = await prepared.json();
			expect(await (await call(endpoint("submit"), { jobId: preview.jobId, consentToken: preview.consentToken, approved: true, input: f.input })).json()).toMatchObject({ state: "completed" });
			const statusUrl = endpoint("status"); statusUrl.searchParams.set("job", preview.jobId);
			expect(await (await call(statusUrl)).json()).toMatchObject({ state: "completed", resultAvailable: false });
			expect(await (await call(endpoint("cancel"), { jobId: preview.jobId })).json()).toMatchObject({ state: "completed" });
			expect(f.generate).toHaveBeenCalledOnce();
		} finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
	});
	it("allows bounded funding, quote and generation stages to settle with hosting cleanup headroom", async () => {
		vi.useFakeTimers();
		const f = fixture(); const service = f.service(); const preview = await (await service.handle(f.request("/api/inference/preview", f.input))).json();
		const quote = await f.provider.quote("synthetic", f.input.model, f.input.provider, new AbortController().signal);
		const response = await f.generate("synthetic", preview.request, new AbortController().signal); f.generate.mockClear();
		f.setAllowanceDelay(9000);
		f.provider.quote = async () => { await new Promise<void>((resolve) => setTimeout(resolve, 9000)); return quote; };
		f.generate.mockImplementation(async () => { await new Promise<void>((resolve) => setTimeout(resolve, 19_000)); return response; });
		const startedAt = Date.now();
		const pending = service.handle(f.request("/api/inference/submit", { jobId: preview.jobId, consentToken: preview.consentToken, approved: true, input: f.input }));
		await vi.advanceTimersByTimeAsync(37_000);
		expect(await (await pending).json()).toMatchObject({ state: "completed", costUsd: 0.00004, possibleBilled: false });
		expect(Date.now() - startedAt).toBe(37_000);
		expect(Date.now() - startedAt + 5000).toBeLessThanOrEqual(hostingConfig.maxDuration * 1000);
		expect(f.generate).toHaveBeenCalledOnce();
		f.setAllowanceDelay(0);
		expect(await (await f.service().handle(f.request("/api/inference/status?job=" + preview.jobId))).json()).toMatchObject({ state: "completed", costUsd: 0.00004 });
	});
	it("requires a real verified session and CSRF before reading or transferring a paid packet", async () => {
		const f = fixture();
		expect((await f.service().handle(f.request("/api/inference/preview", f.input, { Cookie: "" }))).status).toBe(401);
		expect((await f.service().handle(f.request("/api/inference/preview", f.input, { "X-CSRF-Token": "wrong" }))).status).toBe(403);
		expect(f.generate).not.toHaveBeenCalled();
	});
	it("uses only the encrypted owner's connection through preview/consent/status/cancel and rejects browser authority", async () => {
		const f = fixture(); const previewResponse = await f.service().handle(f.request("/api/inference/preview", f.input));
		expect(previewResponse.status).toBe(200); expect(previewResponse.headers.get("cache-control")).toBe("no-store");
		const preview = await previewResponse.json(); expect(preview.request.messages[1].content).toContain("archive-server-canary");
		expect(preview.disclosure.privacy).toContain("Broadcast"); expect(preview.disclosure.privacy).toContain("cannot inspect");
		const rejected = await f.service().handle(f.request("/api/inference/preview", { ...f.input, ownerId: "owner-b" }));
		expect(rejected.status).toBe(400); expect(f.generate).not.toHaveBeenCalled();
		const response = await f.service().handle(f.request("/api/inference/submit", { jobId: preview.jobId, consentToken: preview.consentToken, approved: true, input: f.input }));
		expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ state: "completed", costUsd: 0.00004, result: { observations: [{ evidenceIds: ["own-1"] }] } });
		expect(f.generate).toHaveBeenCalledOnce(); expect(f.generate.mock.calls[0]?.[0]).toBe("sk-or-connected-synthetic");
		expect(await (await f.service().handle(f.request("/api/inference/status?job=" + preview.jobId))).json()).toMatchObject({ state: "completed", resultAvailable: false });
		expect([...f.records.values()].join("\n")).not.toContain("archive-server-canary");
		expect([...f.records.values()].join("\n")).not.toContain("Only the source");
	});
	it("blocks provider binding drift and disconnect before a pending consent can send", async () => {
		const f = fixture(); const preview = await (await f.service().handle(f.request("/api/inference/preview", f.input))).json();
		const body = { jobId: preview.jobId, consentToken: preview.consentToken, approved: true, input: f.input };
		for (const change of [{ workspace_id: "other-workspace" }, { creator_user_id: "other-creator" }, { include_byok_in_limit: false }]) {
			const next = fixture(); const inspection = await (await next.service().handle(next.request("/api/inference/preview", next.input))).json(); next.setAllowance(change);
			const response = await next.service().handle(next.request("/api/inference/submit", { ...body, jobId: inspection.jobId, consentToken: inspection.consentToken }));
			expect(response.status).toBe(409); expect(await response.json()).toEqual({ error: "funding_binding_changed" }); expect(next.generate).not.toHaveBeenCalled();
		}
		expect((await f.service().handle(f.request("/connections/openrouter/disconnect", {}))).status).toBe(200);
		expect(await (await f.service().handle(f.request("/api/inference/submit", body))).json()).toEqual({ error: "connection_required" });
		expect(f.generate).not.toHaveBeenCalled();
		expect(await (await f.service().handle(f.request("/api/inference/cancel", { jobId: preview.jobId }))).json()).toMatchObject({ state: "canceled" });
	});
	it("rejects inconsistent cap/remaining metadata before admitting a paid job", async () => {
		const f = fixture(); f.setAllowance({ limit: 0.001, limit_remaining: 1 });
		const response = await f.service().handle(f.request("/api/inference/preview", f.input));
		expect(response.status).toBe(402); expect(await response.json()).toEqual({ error: "funding_not_bounded" }); expect(f.generate).not.toHaveBeenCalled();
	});
	it("allows the owner to tighten the dedicated key's BYOK cap after connecting without changing payer", async () => {
		const f = fixture(false);
		expect((await f.service().handle(f.request("/api/inference/preview", f.input))).status).toBe(402);
		f.setAllowance({ include_byok_in_limit: true });
		const response = await f.service().handle(f.request("/api/inference/preview", f.input));
		expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ disclosure: { byokIncluded: true, workspaceId: "workspace-a" } });
		expect(await (await f.service().handle(f.request("/api/session"))).json()).toMatchObject({ connection: { state: "usable", byokIncluded: true }, aiAvailable: false });
		expect(f.generate).not.toHaveBeenCalled();
	});
	it("bounds incoming JSON and returns safe errors without reflecting canaries", async () => {
		const f = fixture(); const request = f.request("/api/inference/preview", { question: "archive-server-canary".repeat(2000) });
		const response = await f.service().handle(request); expect(response.status).toBe(413); expect(await response.json()).toEqual({ error: "body_too_large" });
		expect((await f.service().handle(f.request("/api/inference/preview", f.input, { "Content-Type": "text/plain" }))).status).toBe(415);
		expect(f.generate).not.toHaveBeenCalled();
	});
	it("hides another owner's jobs and never charges their connection after an account switch", async () => {
		const f = fixture(); const preview = await (await f.service().handle(f.request("/api/inference/preview", f.input))).json();
		f.records.set("session:" + digest("session-b"), encrypt({ ownerId: "owner-b", sealed: "sealed-b", csrf: "csrf-b", expiresAt: Date.now() + 60_000 }, f.password));
		const switched = { Cookie: "__Host-gc_session=session-b", "X-CSRF-Token": "csrf-b" };
		expect((await f.service().handle(f.request("/api/inference/status?job=" + preview.jobId, undefined, switched))).status).toBe(404);
		expect((await f.service().handle(f.request("/api/inference/cancel", { jobId: preview.jobId }, switched))).status).toBe(404);
		expect(await (await f.service().handle(f.request("/api/inference/submit", { jobId: preview.jobId, consentToken: preview.consentToken, approved: true, input: f.input }, switched))).json()).toEqual({ error: "connection_required" });
		expect(f.generate).not.toHaveBeenCalled();
	});
	it("aborts an active request after owner cancel and preserves an honestly unknown billed outcome", async () => {
		const f = fixture(); const preview = await (await f.service().handle(f.request("/api/inference/preview", f.input))).json();
		f.generate.mockImplementation(async (_key, _packet, signal) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("Canceled synthetic transport")), { once: true })));
		const submit = f.service().handle(f.request("/api/inference/submit", { jobId: preview.jobId, consentToken: preview.consentToken, approved: true, input: f.input }));
		await vi.waitFor(() => expect(f.generate).toHaveBeenCalledOnce());
		expect(await (await f.service().handle(f.request("/api/inference/cancel", { jobId: preview.jobId }))).json()).toMatchObject({ cancelRequested: true });
		expect(await (await submit).json()).toMatchObject({ state: "unknown", possibleBilled: true, reconciliationRequired: true, costUsd: null });
		expect(f.generate).toHaveBeenCalledOnce();
	});
	it("accepts bounded JSON through the actual Node HTTP transport and rejects oversized streaming bodies", async () => {
		const f = fixture(); const server = createServer((request, response) => { void handleNodeAccountRequest(request, response, { origin: () => "https://app.invalid", handle: (input) => f.service().handle(input) }); });
		await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
		try {
			const address = server.address(); if (!address || typeof address === "string") throw new Error("Missing listener");
			const url = `http://127.0.0.1:${address.port}/api/inference/preview`;
			const headers = { Cookie: "__Host-gc_session=session-a", Origin: "https://app.invalid", "X-CSRF-Token": "csrf-a", "Content-Type": "application/json" };
			const preview = await fetch(url, { method: "POST", headers, body: JSON.stringify(f.input) });
			expect(preview.status).toBe(200); const approved = await preview.json(); expect(approved).toMatchObject({ disclosure: { workspaceId: "workspace-a" } });
			const submit = await fetch(url.replace("preview", "submit"), { method: "POST", headers, body: JSON.stringify({ jobId: approved.jobId, consentToken: approved.consentToken, approved: true, input: f.input }) });
			expect(submit.status).toBe(200); expect(await submit.json()).toMatchObject({ state: "completed", costUsd: 0.00004 });
			const status = await fetch(url.replace("preview", "status") + "?job=" + approved.jobId, { headers });
			expect(await status.json()).toMatchObject({ state: "completed", resultAvailable: false });
			const cancel = await fetch(url.replace("preview", "cancel"), { method: "POST", headers, body: JSON.stringify({ jobId: approved.jobId }) });
			expect(await cancel.json()).toMatchObject({ state: "completed" });
			const bytes = new TextEncoder().encode("private-stream-canary".repeat(2000));
			const stream = new ReadableStream({ start(controller) { controller.enqueue(bytes.slice(0, 16_384)); controller.enqueue(bytes.slice(16_384)); controller.close(); } });
			const options = { method: "POST", headers, body: stream, duplex: "half" as const };
			const denied = await fetch(url, options); expect(denied.status).toBe(413); expect(denied.headers.get("referrer-policy")).toBe("no-referrer");
			expect(await denied.json()).toEqual({ error: "body_too_large" }); expect(f.generate).toHaveBeenCalledOnce();
		} finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
	});
});
