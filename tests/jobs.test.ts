import { afterEach, describe, expect, it, vi } from "vitest";
import { createInferenceService, type FundingAuthority, type InferenceInput, type InferenceProvider } from "../server/inference";
import type { DurableStore } from "../server/store";
import { localStore } from "../server/localStore";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function fixture() {
	const records = new Map<string, string>();
	const store: DurableStore = {
		get: async (key) => records.get(key) ?? null,
		put: async (key, value) => { records.set(key, value); },
		remove: async (key) => { records.delete(key); },
		take: async (key, expected) => { if (records.get(key) !== expected) return false; records.delete(key); return true; },
		claim: async (key, value) => { if (records.has(key)) return false; records.set(key, value); return true; },
		replace: async (key, expected, value) => { if (records.get(key) !== expected) return false; records.set(key, value); return true; },
	};
	const authority: FundingAuthority = { ownerId: "owner-a", connectionId: "connection-a", connectionEpoch: "epoch-a", sessionId: "session-a",
		key: "sk-or-synthetic-user-only", remainingUsd: 1, workspaceId: "workspace-a", byokIncluded: true };
	const input: InferenceInput = { idempotencyKey: "intent-1", purpose: "archive-explanation", model: "synthetic/text", provider: "synthetic",
		budgetUsd: 0.01, maxOutputTokens: 100, scope: { datasetRevision: "dataset-v2", selectionRevision: "selection-1", year: 2019, timezone: "UTC", excludedIds: [] },
		question: "What does the selected evidence say?", evidence: [{ id: "own-1", text: "private-excerpt-canary café", timestamp: "2019-03-01T12:00:00Z", authorship: "owner" }] };
	const generate = vi.fn<InferenceProvider["generate"]>(async () => ({ text: JSON.stringify({ observations: [{ text: "A bounded observation", evidenceIds: ["own-1"], uncertainty: "Limited retained evidence" }] }),
		inputTokens: 20, outputTokens: 15, costUsd: 0.00005, isByok: false, provider: "Synthetic Provider" }));
	const provider: InferenceProvider = {
		quote: async () => ({ model: "synthetic/text", provider: "synthetic", providerName: "Synthetic Provider", inputPriceNano: 1000, outputPriceNano: 2000,
			requestPriceNano: 0, contextTokens: 100_000, maxOutputTokens: 512, tokenizer: "GPT", privacy: "zdr-no-collection" }),
		generate,
	};
	let active = true;
	const service = () => createInferenceService({ store, provider, active: async () => active });
	return { records, store, authority, input, provider, generate, service, setActive(value: boolean) { active = value; } };
}
afterEach(() => vi.restoreAllMocks());

describe("owner-funded transient inference jobs", () => {
	it("reconciles known money without inventing token counts or publishing unbounded output", async () => {
		const f = fixture(); const service = f.service(); const preview = await service.preview(f.authority, f.input);
		f.generate.mockResolvedValue({ text: JSON.stringify({ observations: [{ text: "A bounded observation", evidenceIds: ["own-1"], uncertainty: "Limited" }] }),
			inputTokens: null, outputTokens: null, costUsd: 0.00005, isByok: false, provider: "Synthetic Provider" });
		expect(await service.submit(f.authority, { jobId: preview.jobId, consentToken: preview.consentToken, approved: true, input: f.input }))
			.toMatchObject({ state: "rejected", costUsd: 0.00005, usage: null, result: null, resultAvailable: false, reconciliationRequired: false });
		expect(await f.service().status(f.authority.ownerId, preview.jobId)).toMatchObject({ state: "rejected", costUsd: 0.00005, usage: null });
		expect(f.generate).toHaveBeenCalledOnce();
	});
	it("recovers known usage when a final write commits but its acknowledgement is interrupted", async () => {
		const f = fixture(); const service = f.service(); const preview = await service.preview(f.authority, f.input);
		const replace = f.store.replace; let interrupted = false;
		f.store.replace = async (key, expected, value, ttl) => {
			const committed = await replace(key, expected, value, ttl);
			if (!interrupted && committed && key.startsWith("inference:job:") && JSON.parse(value).state === "completed") {
				interrupted = true; throw new Error("Synthetic lost commit acknowledgement");
			}
			return committed;
		};
		expect(await service.submit(f.authority, { jobId: preview.jobId, consentToken: preview.consentToken, approved: true, input: f.input }))
			.toMatchObject({ state: "completed", costUsd: 0.00005, resultAvailable: false, possibleBilled: false, reconciliationRequired: false });
		expect(await f.service().status(f.authority.ownerId, preview.jobId)).toMatchObject({ state: "completed", costUsd: 0.00005, reconciliationRequired: false });
		const nextInput = { ...f.input, idempotencyKey: "after-lost-acknowledgement" }; const next = await f.service().preview(f.authority, nextInput);
		expect(await f.service().submit(f.authority, { jobId: next.jobId, consentToken: next.consentToken, approved: true, input: nextInput })).toMatchObject({ state: "completed" });
		expect(f.generate).toHaveBeenCalledTimes(2);
	});
	it("suppresses output after acknowledged cancel races the final durable completion commit", async () => {
		const f = fixture(); const first = f.service(); const fresh = f.service();
		const preview = await first.preview(f.authority, f.input);
		let release!: () => void; let paused!: () => void;
		const gate = new Promise<void>((resolve) => { release = resolve; });
		const boundary = new Promise<void>((resolve) => { paused = resolve; });
		const replace = f.store.replace; let suspended = false;
		f.store.replace = async (key, expected, value, ttl) => {
			if (!suspended && key.startsWith("inference:job:") && JSON.parse(value).state === "completed") { suspended = true; paused(); await gate; }
			return replace(key, expected, value, ttl);
		};
		const pending = first.submit(f.authority, { jobId: preview.jobId, consentToken: preview.consentToken, approved: true, input: f.input });
		await boundary;
		expect(await fresh.cancel(f.authority.ownerId, preview.jobId)).toMatchObject({ cancelRequested: true });
		release();
		expect(await pending).toMatchObject({ state: "canceled", cancelRequested: true, resultAvailable: false, result: null, costUsd: 0.00005 });
		expect(await fresh.status(f.authority.ownerId, preview.jobId)).toMatchObject({ state: "canceled", costUsd: 0.00005, resultAvailable: false });
		expect(f.generate).toHaveBeenCalledOnce();
	});
	it("recovers a stale reserved turn before dispatch and fences it when its lost write resumes", async () => {
		const f = fixture(); const first = f.service(); const fresh = f.service();
		const preview = await first.preview(f.authority, f.input);
		let release!: () => void; let committed!: () => void;
		const gate = new Promise<void>((resolve) => { release = resolve; });
		const boundary = new Promise<void>((resolve) => { committed = resolve; });
		const claim = f.store.claim;
		let suspended = false;
		f.store.claim = async (key, value, ttl) => {
			const result = await claim(key, value, ttl);
			if (!suspended && result && key.startsWith("inference:fund:")) { suspended = true; committed(); await gate; }
			return result;
		};
		const pending = first.submit(f.authority, { jobId: preview.jobId, consentToken: preview.consentToken, approved: true, input: f.input }).catch((error: unknown) => error);
		await boundary;
		const now = Date.now(); vi.spyOn(Date, "now").mockReturnValue(now + 15_000);
		expect(await fresh.status(f.authority.ownerId, preview.jobId)).toMatchObject({ state: "canceled", possibleBilled: false, costUsd: 0 });
		release(); await pending;
		expect(f.generate).not.toHaveBeenCalled();
		const nextInput = { ...f.input, idempotencyKey: "after-stale-reservation" }; const next = await fresh.preview(f.authority, nextInput);
		expect(await fresh.submit(f.authority, { jobId: next.jobId, consentToken: next.consentToken, approved: true, input: nextInput })).toMatchObject({ state: "completed" });
		expect(f.generate).toHaveBeenCalledOnce();
	});
	it("keeps known completion durable before releasing the lock and repairs interrupted settlement through status", async () => {
		const f = fixture(); const service = f.service(); const preview = await service.preview(f.authority, f.input);
		const take = f.store.take; let interrupted = false;
		f.store.take = async (key, value) => {
			if (!interrupted && key.startsWith("inference:active:")) { interrupted = true; throw new Error("Synthetic store interruption"); }
			return take(key, value);
		};
		expect(await service.submit(f.authority, { jobId: preview.jobId, consentToken: preview.consentToken, approved: true, input: f.input }))
			.toMatchObject({ state: "completed", costUsd: 0.00005, resultAvailable: false, possibleBilled: false });
		expect(await f.service().status(f.authority.ownerId, preview.jobId)).toMatchObject({ state: "completed", costUsd: 0.00005 });
		const nextInput = { ...f.input, idempotencyKey: "after-repaired-settlement" }; const next = await f.service().preview(f.authority, nextInput);
		expect(await f.service().submit(f.authority, { jobId: next.jobId, consentToken: next.consentToken, approved: true, input: nextInput })).toMatchObject({ state: "completed" });
		expect(f.generate).toHaveBeenCalledTimes(2);
	});
	it.each(["active", "fund"])("fences a lost pre-dispatch %s write so cancel permits a fresh job and the old turn cannot send", async (stage) => {
		const f = fixture(); const first = f.service(); const fresh = f.service();
		const preview = await first.preview(f.authority, f.input);
		let release!: () => void; let committed!: () => void;
		const gate = new Promise<void>((resolve) => { release = resolve; });
		const boundary = new Promise<void>((resolve) => { committed = resolve; });
		const claim = f.store.claim;
		let suspended = false;
		f.store.claim = async (key, value, ttl) => {
			const result = await claim(key, value, ttl);
			if (!suspended && result && key.startsWith(`inference:${stage}:`)) { suspended = true; committed(); await gate; }
			return result;
		};
		const pending = first.submit(f.authority, { jobId: preview.jobId, consentToken: preview.consentToken, approved: true, input: f.input }).catch((error: unknown) => error);
		await boundary;
		expect(f.generate).not.toHaveBeenCalled();
		expect(await fresh.cancel(f.authority.ownerId, preview.jobId)).toMatchObject({ state: "canceled", possibleBilled: false, costUsd: 0 });
		const nextInput = { ...f.input, idempotencyKey: "fresh-after-cancel" };
		const next = await fresh.preview(f.authority, nextInput);
		expect(await fresh.submit(f.authority, { jobId: next.jobId, consentToken: next.consentToken, approved: true, input: nextInput })).toMatchObject({ state: "completed" });
		release(); await pending;
		expect(f.generate).toHaveBeenCalledOnce();
		expect(await fresh.status(f.authority.ownerId, preview.jobId)).toMatchObject({ state: "canceled", possibleBilled: false, costUsd: 0 });
	});
	it("previews an exact bounded request and recipient/billing disclosure without storing archive text or generating", async () => {
		const f = fixture(); const preview = await f.service().preview(f.authority, f.input);
		expect(preview.disclosure).toMatchObject({ gateway: "https://openrouter.ai", upstream: "Synthetic Provider", workspaceId: "workspace-a", byokIncluded: true, requestCount: 1, maxOutputTokens: 100 });
		expect(preview.disclosure.billing).toContain("BYOK");
		expect(preview.request.messages[1]?.content).toContain("private-excerpt-canary café");
		expect(preview.request.provider).toMatchObject({ only: ["synthetic"], allow_fallbacks: false, require_parameters: true, data_collection: "deny", zdr: true });
		expect(preview.disclosure.estimatedMaxUsd).toBeGreaterThan(0);
		expect(preview.disclosure.estimatedMaxUsd).toBeLessThan(f.input.budgetUsd);
		expect(preview.request.max_tokens).toBe(100);
		expect(f.generate).not.toHaveBeenCalled();
		expect([...f.records.values()].join("\n")).not.toContain("private-excerpt-canary");
		expect([...f.records.values()].join("\n")).not.toContain(f.authority.key);
	});
	it("rejects altered consent, excluded/other-author/cross-year evidence and ambiguous source time before transfer", async () => {
		const f = fixture(); const service = f.service(); const preview = await service.preview(f.authority, f.input);
		await expect(service.submit(f.authority, { jobId: preview.jobId, consentToken: preview.consentToken, approved: true,
			input: { ...f.input, scope: { ...f.input.scope, selectionRevision: "changed" } } })).rejects.toMatchObject({ code: "consent_or_packet_changed" });
		for (const evidence of [{ ...f.input.evidence[0], authorship: "other" }, { ...f.input.evidence[0], timestamp: "2020-01-01T00:00:00Z" }, { ...f.input.evidence[0], timestamp: "2019-03-01" }])
			await expect(service.preview(f.authority, { ...f.input, evidence: [evidence] })).rejects.toMatchObject({ status: 400 });
		await expect(service.preview(f.authority, { ...f.input, scope: { ...f.input.scope, excludedIds: ["own-1"] } })).rejects.toMatchObject({ code: "invalid_or_excluded_evidence" });
		expect(f.generate).not.toHaveBeenCalled();
	});
	it("requires inspected consent, sends once, reconciles usage, and keeps result text transient", async () => {
		const f = fixture(); const service = f.service(); const preview = await service.preview(f.authority, f.input);
		await expect(service.submit(f.authority, { jobId: preview.jobId, consentToken: preview.consentToken, approved: false, input: f.input })).rejects.toMatchObject({ code: "consent_required" });
		expect(f.generate).not.toHaveBeenCalled();
		const completed = await service.submit(f.authority, { jobId: preview.jobId, consentToken: preview.consentToken, approved: true, input: f.input });
		expect(completed).toMatchObject({ state: "completed", costUsd: 0.00005, result: { observations: [{ evidenceIds: ["own-1"] }] } });
		const duplicate = await f.service().submit(f.authority, { jobId: preview.jobId, consentToken: preview.consentToken, approved: true, input: f.input });
		expect(duplicate).toMatchObject({ state: "completed", resultAvailable: false });
		expect(f.generate).toHaveBeenCalledOnce();
		expect(f.generate.mock.calls[0]?.[0]).toBe(f.authority.key);
		expect([...f.records.values()].join("\n")).not.toContain("private-excerpt-canary");
		expect([...f.records.values()].join("\n")).not.toContain("A bounded observation");
	});
	it("discards a response after disconnect even when usage is known and releases only the reconciled reservation", async () => {
		const f = fixture(); const service = f.service(); const preview = await service.preview(f.authority, f.input);
		const response = await f.generate(f.authority.key, preview.request, new AbortController().signal);
		f.generate.mockClear();
		f.generate.mockImplementation(async () => { f.setActive(false); return response; });
		const result = await service.submit(f.authority, { jobId: preview.jobId, consentToken: preview.consentToken, approved: true, input: f.input });
		expect(result).toMatchObject({ state: "canceled", resultAvailable: false, costUsd: 0.00005, result: null });
		expect(f.generate).toHaveBeenCalledOnce();
		expect([...f.records.keys()].some((key) => key.startsWith("inference:active:"))).toBe(false);
	});
	it("serializes an owner's distinct jobs and duplicate consent across instances", async () => {
		const f = fixture(); const first = f.service(); const second = f.service();
		const a = await first.preview(f.authority, f.input); const otherInput = { ...f.input, idempotencyKey: "intent-2" };
		const b = await second.preview(f.authority, otherInput);
		const response = await f.generate(f.authority.key, a.request, new AbortController().signal); f.generate.mockClear();
		let release!: () => void; const gate = new Promise<void>((resolve) => { release = resolve; });
		f.generate.mockImplementation(async () => { await gate; return response; });
		const requestA = { jobId: a.jobId, consentToken: a.consentToken, approved: true, input: f.input };
		const running = first.submit(f.authority, requestA); await vi.waitFor(() => expect(f.generate).toHaveBeenCalledOnce());
		expect(await second.submit(f.authority, requestA)).toMatchObject({ state: "running", resultAvailable: false });
		await expect(second.submit(f.authority, { jobId: b.jobId, consentToken: b.consentToken, approved: true, input: otherInput })).rejects.toMatchObject({ code: "another_job_or_unknown_usage" });
		release(); expect(await running).toMatchObject({ state: "completed" }); expect(f.generate).toHaveBeenCalledOnce();
		await expect(second.status("owner-b", a.jobId)).rejects.toMatchObject({ status: 404 });
	});
	it("holds uncertain billed usage and never retries after timeout or interrupted transport", async () => {
		const f = fixture(); const service = createInferenceService({ store: f.store, provider: f.provider, active: async () => true, timeoutMs: 5 });
		const preview = await service.preview(f.authority, f.input); f.generate.mockImplementation(async () => new Promise(() => {}));
		const request = { jobId: preview.jobId, consentToken: preview.consentToken, approved: true, input: f.input };
		expect(await service.submit(f.authority, request)).toMatchObject({ state: "unknown", costUsd: null, possibleBilled: true, reconciliationRequired: true });
		expect(await f.service().submit(f.authority, request)).toMatchObject({ state: "unknown" });
		expect(f.generate).toHaveBeenCalledOnce();
		const nextInput = { ...f.input, idempotencyKey: "after-timeout" }; const next = await f.service().preview(f.authority, nextInput);
		await expect(f.service().submit(f.authority, { jobId: next.jobId, consentToken: next.consentToken, approved: true, input: nextInput })).rejects.toMatchObject({ code: "another_job_or_unknown_usage" });
	});
	it("rejects stale authority, missing BYOK cap, depleted allowance and changed runtime prices", async () => {
		const f = fixture(); const service = f.service(); const preview = await service.preview(f.authority, f.input);
		for (const change of [{ remainingUsd: 0 }, { remainingUsd: Number.POSITIVE_INFINITY }, { byokIncluded: false }])
			await expect(service.preview({ ...f.authority, ...change }, f.input)).rejects.toMatchObject({ code: "funding_not_bounded" });
		const request = { jobId: preview.jobId, consentToken: preview.consentToken, approved: true, input: f.input };
		await expect(service.submit({ ...f.authority, sessionId: "session-switched" }, request)).rejects.toMatchObject({ code: "preview_expired_or_authority_changed" });
		const quote = await f.provider.quote(f.authority.key, f.input.model, f.input.provider, new AbortController().signal);
		f.provider.quote = async () => ({ ...quote, inputPriceNano: quote.inputPriceNano + 1 });
		await expect(service.submit(f.authority, request)).rejects.toMatchObject({ code: "pricing_or_recipient_changed" });
		expect(f.generate).not.toHaveBeenCalled();
	});
	it("invalidates preparation if the connection disappears while runtime pricing is loading", async () => {
		const f = fixture(); const quote = await f.provider.quote(f.authority.key, f.input.model, f.input.provider, new AbortController().signal);
		f.provider.quote = async () => { f.setActive(false); return quote; };
		await expect(f.service().preview(f.authority, f.input)).rejects.toMatchObject({ code: "connection_or_session_changed" });
		expect(f.records.size).toBe(0); expect(f.generate).not.toHaveBeenCalled();
	});
	it("rejects fabricated evidence in output but reconciles the actual known cost", async () => {
		const f = fixture(); const service = f.service(); const preview = await service.preview(f.authority, f.input);
		const response = await f.generate(f.authority.key, preview.request, new AbortController().signal); f.generate.mockClear();
		f.generate.mockResolvedValue({ ...response, text: JSON.stringify({ observations: [{ text: "Fabricated", evidenceIds: ["not-approved"], uncertainty: "Unknown" }] }) });
		expect(await service.submit(f.authority, { jobId: preview.jobId, consentToken: preview.consentToken, approved: true, input: f.input })).toMatchObject({ state: "rejected", costUsd: 0.00005, result: null });
		expect([...f.records.keys()].some((key) => key.startsWith("inference:active:"))).toBe(false);
	});
	it("withholds output from an unproved returned route while reconciling independently known usage", async () => {
		const f = fixture(); const service = f.service(); const preview = await service.preview(f.authority, f.input);
		f.generate.mockResolvedValue({ text: JSON.stringify({ observations: [{ text: "A bounded observation", evidenceIds: ["own-1"], uncertainty: "Limited" }] }),
			inputTokens: 20, outputTokens: 15, costUsd: 0.00005, isByok: false, provider: null });
		expect(await service.submit(f.authority, { jobId: preview.jobId, consentToken: preview.consentToken, approved: true, input: f.input }))
			.toMatchObject({ state: "rejected", costUsd: 0.00005, result: null, possibleBilled: false });
		expect(f.generate).toHaveBeenCalledOnce();
		const nextInput = { ...f.input, idempotencyKey: "after-proven-settlement" };
		const next = await f.service().preview(f.authority, nextInput);
		expect(await f.service().submit(f.authority, { jobId: next.jobId, consentToken: next.consentToken, approved: true, input: nextInput })).toMatchObject({ state: "rejected" });
	});
	it("consumes paid consent once through two independent durable SQLite connections", async () => {
		const directory = mkdtempSync(join(tmpdir(), "goodbye-inference-atomic-"));
		const firstStore = localStore(join(directory, "jobs.sqlite")); const secondStore = localStore(join(directory, "jobs.sqlite"));
		try {
			const f = fixture(); const first = createInferenceService({ store: firstStore, provider: f.provider, active: async () => true });
			const second = createInferenceService({ store: secondStore, provider: f.provider, active: async () => true });
			const preview = await first.preview(f.authority, f.input);
			const request = { jobId: preview.jobId, consentToken: preview.consentToken, approved: true, input: f.input };
			const results = await Promise.all([first.submit(f.authority, request), second.submit(f.authority, request)]);
			expect(results.some((result) => result.state === "completed")).toBe(true); expect(f.generate).toHaveBeenCalledOnce();
			expect(await second.status(f.authority.ownerId, preview.jobId)).toMatchObject({ state: "completed", resultAvailable: false });
			const stored = await secondStore.get("inference:job:" + preview.jobId);
			expect(stored).not.toContain("private-excerpt-canary"); expect(stored).not.toContain(f.authority.key); expect(stored).not.toContain("A bounded observation");
		} finally { firstStore.close(); secondStore.close(); rmSync(directory, { recursive: true, force: true }); }
	});
});
