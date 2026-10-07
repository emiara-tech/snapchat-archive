import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInferenceClient } from "../src/lib/inferenceClient";
import { createAccountService } from "../server/accountService";
import { handleNodeAccountRequest } from "../server/nodeAccountAdapter";
import { localStore } from "../server/localStore";
import { digest, encrypt } from "../server/security";
import type { InferenceInput, InferenceProvider } from "../server/inference";

const input: InferenceInput = {
	idempotencyKey: "contract-request",
	purpose: "archive-explanation",
	model: "synthetic/text",
	provider: "synthetic",
	budgetUsd: 0.01,
	maxOutputTokens: 100,
	scope: { datasetRevision: "dataset-1", selectionRevision: "selection-1", year: 2019, timezone: "UTC", excludedIds: ["excluded-1"] },
	question: "Explain only these selected owner records",
	evidence: [{ id: "own-1", text: "contract-private-archive-canary", timestamp: "2019-01-01T00:00:00Z", authorship: "owner" }],
};

async function fixture(interrupted: boolean) {
	const directory = mkdtempSync(join(tmpdir(), "goodbye-inference-contract-"));
	const store = localStore(join(directory, "accounts.sqlite"));
	const password = "synthetic-contract-encryption-more-than-32-characters";
	const credential = "sk-or-synthetic-contract-credential";
	await store.put("session:" + digest("session-a"), encrypt({ ownerId: "owner-a", sealed: "sealed-a", csrf: "csrf-a", expiresAt: Date.now() + 60_000 }, password), 60);
	await store.put("connection:owner-a", encrypt({ ownerId: "owner-a", key: credential, connectedAt: "2019-01-01T00:00:00Z", expiresAt: null,
		providerBinding: { workspaceId: "workspace-a", creatorUserId: "creator-a", organizationId: null, byokIncluded: true, bindingState: "known" } }, password), 60);
	const generate = vi.fn<InferenceProvider["generate"]>(async () => {
		if (interrupted) throw new Error("private-provider-diagnostic-canary");
		return { text: JSON.stringify({ observations: [{ text: "contract-private-result-canary", evidenceIds: ["own-1"], uncertainty: "Only this retained source" }] }),
			inputTokens: 20, outputTokens: 15, costUsd: 0.00004, isByok: false, provider: "Synthetic Provider" };
	});
	const provider: InferenceProvider = { generate, quote: async () => ({ model: "synthetic/text", provider: "synthetic", providerName: "Synthetic Provider",
		inputPriceNano: 1000, outputPriceNano: 2000, requestPriceNano: 0, contextTokens: 8192, maxOutputTokens: 512, tokenizer: "GPT", privacy: "zdr-no-collection" }) };
	const backend = createAccountService({ origin: "https://app.invalid", password, store, inferenceProvider: provider,
		identity: { start: async () => { throw new Error("Unused identity start"); }, exchange: async () => { throw new Error("Unused identity exchange"); }, logout: async () => "https://identity.invalid",
			verify: async sealed => sealed === "sealed-a" ? { sealed, account: { id: "owner-a", email: "synthetic-owner@invalid.test", name: "Synthetic owner" } } : null },
		fetch: async () => Response.json({ data: { is_management_key: false, is_provisioning_key: false, limit: 1, limit_remaining: 1, include_byok_in_limit: true,
			workspace_id: "workspace-a", creator_user_id: "creator-a", organization_id: null, expires_at: null } }) });
	const http = createServer((request, response) => { void handleNodeAccountRequest(request, response, { origin: () => "https://app.invalid", handle: backend.handle }); });
	await new Promise<void>(resolve => http.listen(0, "127.0.0.1", resolve));
	const address = http.address();
	if (!address || typeof address === "string") throw new Error("Test HTTP address unavailable");
	const paths: string[] = [];
	const transport: typeof fetch = async (path, options) => {
		paths.push(String(path));
		const headers = new Headers(options?.headers);
		headers.set("Cookie", "__Host-gc_session=session-a");
		headers.set("Origin", "https://app.invalid");
		return fetch(`http://127.0.0.1:${address.port}${String(path)}`, { ...options, headers });
	};
	const client = createInferenceClient({ fetch: transport, authority: () => ({ csrfToken: "csrf-a", sessionRevision: "session-a" }), currentScope: () => input.scope });
	return { client, generate, paths, credential,
		persistedBytes: () => Buffer.concat(readdirSync(directory).map(name => readFileSync(join(directory, name)))),
		async close() {
			await new Promise<void>((resolve, reject) => http.close(error => error ? reject(error) : resolve()));
			store.close();
			rmSync(directory, { recursive: true, force: true });
		} };
}

afterEach(() => vi.restoreAllMocks());

describe("browser client and actual paid backend contract", () => {
	it("preserves interrupted-job recovery through submit, status and explicit cancel without retrying", async () => {
		const f = await fixture(true);
		try {
			const prepared = await f.client.preview(input, { backendTransferApproved: true });
			const submission = await f.client.approveSubmit(prepared, { approved: true });
			expect(submission).toMatchObject({ state: "unknown", resultAvailable: false, possibleBilled: true, reconciliationRequired: true });
			expect(submission.recovery).toMatch(/may have been billed/);
			expect(submission.recovery).not.toContain("private-provider-diagnostic-canary");
			const status = await f.client.status(prepared.preview.jobId);
			expect(status).toMatchObject({ state: "unknown", recovery: submission.recovery, costUsd: null });
			expect(f.paths).toHaveLength(3);
			const canceled = await f.client.cancel(prepared.preview.jobId);
			expect(canceled).toMatchObject({ state: "unknown", recovery: submission.recovery, possibleBilled: true });
			await expect(f.client.approveSubmit(prepared, { approved: true })).rejects.toMatchObject({ code: "already_submitted" });
			expect(f.paths).toEqual(["/api/inference/preview", "/api/inference/submit", `/api/inference/status?job=${prepared.preview.jobId}`, "/api/inference/cancel"]);
			expect(f.generate).toHaveBeenCalledOnce();
			for (const canary of [input.evidence[0]!.text, "private-provider-diagnostic-canary", "contract-private-result-canary", f.credential]) expect(f.persistedBytes().includes(Buffer.from(canary))).toBe(false);
		} finally { await f.close(); }
	});
	it("uses the inspected backend preview and separate final consent for a successful transient result", async () => {
		const f = await fixture(false);
		try {
			await expect(Reflect.apply(f.client.preview, f.client, [input, { backendTransferApproved: false }])).rejects.toMatchObject({ code: "backend_transfer_consent_required" });
			expect(f.paths).toHaveLength(0);
			const prepared = await f.client.preview(input, { backendTransferApproved: true });
			expect(prepared.input).toEqual(input);
			expect(prepared.preview.request).toMatchObject({ model: "synthetic/text", max_tokens: 100, provider: { only: ["synthetic"], allow_fallbacks: false, zdr: true } });
			expect(prepared.preview.disclosure).toMatchObject({ workspaceId: "workspace-a", evidenceCount: 1, requestCount: 1, budgetUsd: 0.01, upstream: "Synthetic Provider" });
			await expect(Reflect.apply(f.client.approveSubmit, f.client, [prepared, { approved: false }])).rejects.toMatchObject({ code: "consent_required" });
			expect(f.generate).not.toHaveBeenCalled();
			const submission = await f.client.approveSubmit(prepared, { approved: true });
			expect(submission).toMatchObject({ state: "completed", costUsd: 0.00004, resultAvailable: true,
				result: { observations: [{ text: "contract-private-result-canary", evidenceIds: ["own-1"], uncertainty: "Only this retained source" }] } });
			expect(submission.recovery).toBeUndefined();
			expect(await f.client.status(prepared.preview.jobId)).toMatchObject({ state: "completed", resultAvailable: false, costUsd: 0.00004 });
			expect(f.generate).toHaveBeenCalledOnce();
			for (const canary of [input.evidence[0]!.text, "contract-private-result-canary", f.credential]) expect(f.persistedBytes().includes(Buffer.from(canary))).toBe(false);
		} finally { await f.close(); }
	});
});
