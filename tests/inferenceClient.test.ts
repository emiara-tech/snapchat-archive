import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { createInferenceClient } from "../src/lib/inferenceClient";
import type { InferenceInput, InferencePreview, InferenceSubmission } from "../src/types/inference";

const input = (): InferenceInput => ({
	idempotencyKey: "intent-1", purpose: "profile-enrichment", model: "model-1", provider: "provider-1", budgetUsd: 0.2, maxOutputTokens: 128,
	scope: { datasetRevision: "dataset-1", selectionRevision: "selection-1", year: 2020, timezone: "UTC", excludedIds: ["excluded-1"] },
	question: "Describe recorded language.", evidence: [{ id: "event-1", text: "Synthetic owner evidence.", timestamp: "2020-03-01T10:00:00Z", authorship: "owner" }],
});
function previewResponse(packet: InferenceInput): InferencePreview {
	return { jobId: "a".repeat(64), consentToken: "synthetic-consent", packetDigest: createHash("sha256").update(JSON.stringify(packet)).digest("hex"), expiresAt: Date.now() + 60_000,
		request: { model: "model-1", max_tokens: 128, stream: false, response_format: { type: "json_object" }, messages: [{ role: "system", content: "Use quoted evidence." }, { role: "user", content: JSON.stringify({ purpose: packet.purpose, year: packet.scope.year, timezone: packet.scope.timezone, question: packet.question, evidence: packet.evidence }) }],
			provider: { only: ["provider-1"], order: ["provider-1"], allow_fallbacks: false, require_parameters: true, data_collection: "deny", zdr: true, max_price: { prompt: 1, completion: 1, request: 0 } } },
		disclosure: { purpose: "profile-enrichment", year: 2020, gateway: "https://openrouter.ai", upstream: "Synthetic provider", workspaceId: "synthetic-workspace", byokIncluded: true,
			billing: "Connected account pays.", budgetUsd: 0.2, estimatedMaxUsd: 0.05, requestCount: 1, maxOutputTokens: 128, timeoutMs: 20_000, evidenceCount: 1,
			privacy: "Gateway settings and sampled categorization may affect data use.", privacySettingsUrl: "https://openrouter.ai/workspaces/default/settings", observabilitySettingsUrl: "https://openrouter.ai/workspaces/default/observability" } };
}
const completed = (): InferenceSubmission => ({ jobId: "a".repeat(64), state: "completed", budgetUsd: 0.2, reservedUsd: 0.05, costUsd: 0.01,
	usage: { inputTokens: 30, outputTokens: 20, isByok: false }, cancelRequested: false, resultAvailable: true, possibleBilled: false, reconciliationRequired: false,
	result: { observations: [{ text: "Recorded language is brief.", evidenceIds: ["event-1"], uncertainty: "Only selected evidence is represented." }] } });
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
afterEach(() => vi.restoreAllMocks());

describe("same-origin inference client", () => {
	it("previews only the bounded packet with request-scoped session credentials and never submits automatically", async () => {
		const packet = input();
		const transport = vi.fn<typeof fetch>().mockResolvedValue(json(previewResponse(packet)));
		const client = createInferenceClient({ fetch: transport, currentScope: () => ({ datasetRevision: "dataset-1", selectionRevision: "selection-1" }), authority: () => ({ csrfToken: "synthetic-csrf", sessionRevision: "session-1" }) });
		const prepared = await client.preview(packet, { backendTransferApproved: true });
		expect(transport).toHaveBeenCalledTimes(1);
		const [path, options] = transport.mock.calls[0]!;
		expect(path).toBe("/api/inference/preview");
		expect(options).toMatchObject({ method: "POST", credentials: "same-origin", mode: "same-origin", redirect: "error", cache: "no-store" });
		expect(new Headers(options?.headers).get("X-CSRF-Token")).toBe("synthetic-csrf");
		expect(JSON.parse(String(options?.body))).toEqual(packet);
		expect(prepared.input.evidence[0]?.text).toBe("Synthetic owner evidence.");
		expect(prepared.preview.disclosure.billing).toBe("Connected account pays.");
	});
	it("rejects stale or cleared scope before preview and while backend preparation is pending", async () => {
		let scope: { datasetRevision: string; selectionRevision: string } | null = null;
		let deliver!: (response: Response) => void;
		const transport = vi.fn<typeof fetch>().mockImplementation(() => new Promise(resolve => { deliver = resolve; }));
		const client = createInferenceClient({ fetch: transport, currentScope: () => scope, authority: () => ({ csrfToken: "synthetic-csrf", sessionRevision: "session-1" }) });
		await expect(client.preview(input(), { backendTransferApproved: true })).rejects.toMatchObject({ code: "scope_changed", possibleBilled: false });
		expect(transport).not.toHaveBeenCalled();
		scope = { datasetRevision: "dataset-1", selectionRevision: "selection-1" };
		const pending = client.preview(input(), { backendTransferApproved: true });
		scope = { datasetRevision: "dataset-1", selectionRevision: "query-changed" };
		deliver(json(previewResponse(input())));
		await expect(pending).rejects.toMatchObject({ code: "scope_changed", possibleBilled: false });
		expect(transport).toHaveBeenCalledTimes(1);
	});
	it("can abandon before transfer and later deliberately submit, while aborting a response read never cancels the server job", async () => {
		const bodyCanceled = vi.fn();
		const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(json(previewResponse(input()))).mockResolvedValueOnce(new Response(new ReadableStream({ cancel: bodyCanceled }), { headers: { "Content-Type": "application/json" } }));
		const client = createInferenceClient({ fetch: transport, currentScope: () => ({ datasetRevision: "dataset-1", selectionRevision: "selection-1" }), authority: () => ({ csrfToken: "synthetic-csrf", sessionRevision: "session-1" }) });
		const prepared = await client.preview(input(), { backendTransferApproved: true });
		const beforeTransfer = new AbortController(); beforeTransfer.abort();
		await expect(client.approveSubmit(prepared, { approved: true, signal: beforeTransfer.signal })).rejects.toMatchObject({ code: "request_aborted", possibleBilled: false });
		expect(transport).toHaveBeenCalledTimes(1);
		const reading = new AbortController();
		const pending = client.approveSubmit(prepared, { approved: true, signal: reading.signal });
		await Promise.resolve();
		reading.abort();
		await expect(pending).rejects.toMatchObject({ code: "request_aborted", possibleBilled: true });
		expect(bodyCanceled).toHaveBeenCalledTimes(1);
		expect(transport.mock.calls.map(([path]) => path)).toEqual(["/api/inference/preview", "/api/inference/submit"]);
	});
	it("withholds malformed or unapproved returned evidence and reports possible billing", async () => {
		const result = completed(); result.result!.observations[0]!.evidenceIds = ["excluded-1"];
		const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(json(previewResponse(input()))).mockResolvedValueOnce(json(result));
		const client = createInferenceClient({ fetch: transport, currentScope: () => ({ datasetRevision: "dataset-1", selectionRevision: "selection-1" }), authority: () => ({ csrfToken: "synthetic-csrf", sessionRevision: "session-1" }) });
		const prepared = await client.preview(input(), { backendTransferApproved: true });
		await expect(client.approveSubmit(prepared, { approved: true })).rejects.toMatchObject({ code: "invalid_response", possibleBilled: true });
		expect(transport).toHaveBeenCalledTimes(2);
	});
	it("rejects malformed or changed provider disclosures instead of creating consent for a different packet", async () => {
		const digestChanged = previewResponse(input()); digestChanged.packetDigest = "b".repeat(64);
		const providerChanged = previewResponse(input()); Reflect.set(providerChanged.request.provider, "allow_fallbacks", true);
		const packetChanged = previewResponse(input()); packetChanged.request.messages[1]!.content = "Different unapproved context.";
		const noBilling = previewResponse(input()); Reflect.deleteProperty(noBilling.disclosure, "billing");
		const transport = vi.fn<typeof fetch>();
		const client = createInferenceClient({ fetch: transport, currentScope: () => ({ datasetRevision: "dataset-1", selectionRevision: "selection-1" }), authority: () => ({ csrfToken: "synthetic-csrf", sessionRevision: "session-1" }) });
		for (const malformed of [digestChanged, providerChanged, packetChanged, noBilling]) {
			transport.mockResolvedValueOnce(json(malformed));
			await expect(client.preview(input(), { backendTransferApproved: true })).rejects.toMatchObject({ code: "invalid_response", possibleBilled: false });
		}
		expect(transport.mock.calls.every(([path]) => path === "/api/inference/preview")).toBe(true);
	});
	it("prevents spending after local scope changes and hides stale returned results while preserving status and cancel", async () => {
		let scope: { datasetRevision: string; selectionRevision: string } | null = { datasetRevision: "dataset-1", selectionRevision: "selection-1" };
		const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(json(previewResponse(input())));
		const client = createInferenceClient({ fetch: transport, currentScope: () => scope, authority: () => ({ csrfToken: "synthetic-csrf", sessionRevision: "session-1" }) });
		const prepared = await client.preview(input(), { backendTransferApproved: true });
		scope = { datasetRevision: "dataset-1", selectionRevision: "changed-curation" };
		await expect(client.approveSubmit(prepared, { approved: true })).rejects.toMatchObject({ code: "scope_changed", possibleBilled: false });
		expect(transport).toHaveBeenCalledTimes(1);
		scope = { datasetRevision: "dataset-1", selectionRevision: "selection-1" };
		let deliver!: (response: Response) => void;
		transport.mockImplementationOnce(() => new Promise(resolve => { deliver = resolve; }));
		const pending = client.approveSubmit(prepared, { approved: true });
		scope = { datasetRevision: "replacement-archive", selectionRevision: "selection-1" };
		deliver(json(completed()));
		await expect(pending).rejects.toMatchObject({ code: "scope_changed", possibleBilled: true });
		scope = null;
		const summary = completed(); delete summary.result; summary.resultAvailable = false;
		transport.mockImplementation(async () => json(summary));
		await client.status("a".repeat(64)); await client.cancel("a".repeat(64));
		expect(transport).toHaveBeenCalledTimes(4);
	});
	it("rejects unsupported authority fields, excluded or non-owner evidence, and oversized packets before browser transfer", async () => {
		const transport = vi.fn<typeof fetch>().mockImplementation(async () => json(previewResponse(input())));
		const client = createInferenceClient({ fetch: transport, currentScope: () => ({ datasetRevision: "dataset-1", selectionRevision: "selection-1" }), authority: () => ({ csrfToken: "synthetic-csrf", sessionRevision: "session-1" }) });
		const authorityPacket = input(); Reflect.set(authorityPacket, "ownerId", "another-account");
		const excludedPacket = input(); excludedPacket.scope.excludedIds.push("event-1");
		const participantPacket = input(); Reflect.set(participantPacket.evidence[0]!, "authorship", "participant");
		for (const packet of [authorityPacket, excludedPacket, participantPacket]) {
			await expect(client.preview(packet, { backendTransferApproved: true })).rejects.toMatchObject({ code: "invalid_packet" });
		}
		const oversized = input(); oversized.question = "x".repeat(17 * 1024);
		await expect(client.preview(oversized, { backendTransferApproved: true })).rejects.toMatchObject({ code: "packet_too_large" });
		expect(transport).not.toHaveBeenCalled();
	});
	it("uses bounded safe error codes without returning server details or reading an oversized response", async () => {
		const canceled = vi.fn();
		const transport = vi.fn<typeof fetch>()
			.mockResolvedValueOnce(json({ error: "funding_not_bounded", details: "Synthetic private diagnostic" }, 402))
			.mockResolvedValueOnce(json({ error: "synthetic_private_credential", details: "Synthetic private diagnostic" }, 503))
			.mockResolvedValueOnce(new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(" ".repeat(70 * 1024))); }, cancel: canceled }), { headers: { "Content-Type": "application/json" } }));
		const client = createInferenceClient({ fetch: transport, currentScope: () => ({ datasetRevision: "dataset-1", selectionRevision: "selection-1" }), authority: () => ({ csrfToken: "synthetic-csrf", sessionRevision: "session-1" }) });
		await expect(client.preview(input(), { backendTransferApproved: true })).rejects.toMatchObject({ code: "funding_not_bounded", status: 402, message: "funding_not_bounded" });
		await expect(client.preview(input(), { backendTransferApproved: true })).rejects.toMatchObject({ code: "request_failed", status: 503, message: "request_failed" });
		await expect(client.preview(input(), { backendTransferApproved: true })).rejects.toMatchObject({ code: "response_too_large", possibleBilled: false });
		expect(canceled).toHaveBeenCalledTimes(1);
	});
	it("marks an interrupted submit as potentially billed without automatically canceling or retrying it", async () => {
		const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(json(previewResponse(input())));
		transport.mockImplementationOnce((_path, options) => new Promise((_resolve, reject) => {
			options?.signal?.addEventListener("abort", () => reject(new DOMException("Synthetic transport stopped with private details", "AbortError")), { once: true });
		}));
		const client = createInferenceClient({ fetch: transport, currentScope: () => ({ datasetRevision: "dataset-1", selectionRevision: "selection-1" }), authority: () => ({ csrfToken: "synthetic-csrf", sessionRevision: "session-1" }) });
		const prepared = await client.preview(input(), { backendTransferApproved: true });
		const controller = new AbortController();
		const pending = client.approveSubmit(prepared, { approved: true, signal: controller.signal });
		controller.abort();
		await expect(pending).rejects.toMatchObject({ name: "AbortError", code: "request_aborted", possibleBilled: true, message: "request_aborted" });
		await expect(client.approveSubmit(prepared, { approved: true })).rejects.toMatchObject({ code: "already_submitted" });
		expect(transport).toHaveBeenCalledTimes(2);
		expect(transport.mock.calls[1]?.[1]?.signal).toBe(controller.signal);
		expect(transport.mock.calls.map(([path]) => path)).toEqual(["/api/inference/preview", "/api/inference/submit"]);
	});
	it("retrieves minimal status and cancels only when explicitly asked, using current session authority", async () => {
		const status = { ...completed(), state: "unknown", resultAvailable: false, possibleBilled: true, reconciliationRequired: true };
		delete status.result;
		const transport = vi.fn<typeof fetch>().mockImplementation(async () => json(status));
		const client = createInferenceClient({ fetch: transport, currentScope: () => ({ datasetRevision: "dataset-1", selectionRevision: "selection-1" }), authority: () => ({ csrfToken: "synthetic-csrf", sessionRevision: "session-1" }) });
		expect((await client.status("a".repeat(64))).reconciliationRequired).toBe(true);
		expect(transport.mock.calls[0]?.[0]).toBe(`/api/inference/status?job=${"a".repeat(64)}`);
		expect(transport.mock.calls[0]?.[1]).toMatchObject({ method: "GET", credentials: "same-origin" });
		expect(transport).toHaveBeenCalledTimes(1);
		await client.cancel("a".repeat(64));
		expect(transport.mock.calls[1]?.[0]).toBe("/api/inference/cancel");
		expect(JSON.parse(String(transport.mock.calls[1]?.[1]?.body))).toEqual({ jobId: "a".repeat(64) });
		expect(new Headers(transport.mock.calls[1]?.[1]?.headers).get("X-CSRF-Token")).toBe("synthetic-csrf");
		await expect(client.status("../other-owner")).rejects.toMatchObject({ code: "invalid_job_id" });
		expect(transport).toHaveBeenCalledTimes(2);
	});
	it("accepts bounded plain recovery guidance while rejecting malformed guidance and private diagnostic fields", async () => {
		const status: InferenceSubmission = { ...completed(), state: "unknown", costUsd: null, resultAvailable: false, possibleBilled: true, reconciliationRequired: true };
		delete status.result;
		const transport = vi.fn<typeof fetch>();
		const client = createInferenceClient({ fetch: transport, currentScope: () => null, authority: () => ({ csrfToken: "synthetic-csrf", sessionRevision: "session-1" }) });
		transport.mockResolvedValueOnce(json({ ...status, recovery: "x".repeat(1000) }));
		expect((await client.status(status.jobId)).recovery).toHaveLength(1000);
		for (const recovery of [null, { message: "private-diagnostic-canary" }, "", " ", "x".repeat(1001), "Inspect\u0000private-diagnostic-canary", "<script>private-diagnostic-canary</script>"]) {
			transport.mockResolvedValueOnce(json({ ...status, recovery }));
			await expect(client.status(status.jobId)).rejects.toMatchObject({ code: "invalid_response", message: "invalid_response" });
		}
		transport.mockResolvedValueOnce(json({ ...status, recovery: "Inspect your provider activity before reconciling.", providerDiagnostic: "private-diagnostic-canary", credential: "sk-or-private-diagnostic-canary" }));
		await expect(client.status(status.jobId)).rejects.toMatchObject({ code: "invalid_response", message: "invalid_response" });
	});
	it("refuses expired or foreign previews and requires a separate final approval", async () => {
		const response = previewResponse(input());
		const transport = vi.fn<typeof fetch>().mockResolvedValue(json(response));
		const options = { fetch: transport, currentScope: () => ({ datasetRevision: "dataset-1", selectionRevision: "selection-1" }), authority: () => ({ csrfToken: "synthetic-csrf", sessionRevision: "session-1" }) };
		const client = createInferenceClient(options);
		const prepared = await client.preview(input(), { backendTransferApproved: true });
		await expect(Reflect.apply(client.approveSubmit, client, [prepared, { approved: false }])).rejects.toMatchObject({ code: "consent_required" });
		await expect(createInferenceClient(options).approveSubmit(prepared, { approved: true })).rejects.toMatchObject({ code: "preview_unavailable" });
		vi.spyOn(Date, "now").mockReturnValue(response.expiresAt + 1);
		await expect(client.approveSubmit(prepared, { approved: true })).rejects.toMatchObject({ code: "preview_expired", possibleBilled: false });
		expect(transport).toHaveBeenCalledTimes(1);
	});
	it("invalidates reviewed consent when the signed-in session changes before or during an HTTP request", async () => {
		let authority: { csrfToken: string; sessionRevision: string } | null = { csrfToken: "synthetic-csrf", sessionRevision: "session-1" };
		const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(json(previewResponse(input())));
		const client = createInferenceClient({ fetch: transport, currentScope: () => ({ datasetRevision: "dataset-1", selectionRevision: "selection-1" }), authority: () => authority });
		const prepared = await client.preview(input(), { backendTransferApproved: true });
		authority = { csrfToken: "other-csrf", sessionRevision: "session-2" };
		await expect(client.approveSubmit(prepared, { approved: true })).rejects.toMatchObject({ code: "authority_changed", possibleBilled: false });
		expect(transport).toHaveBeenCalledTimes(1);
		let deliver!: (response: Response) => void;
		transport.mockImplementationOnce(() => new Promise(resolve => { deliver = resolve; }));
		const pending = client.preview(input(), { backendTransferApproved: true });
		authority = null;
		deliver(json(previewResponse(input())));
		await expect(pending).rejects.toMatchObject({ code: "authority_changed", possibleBilled: false });
	});
	it("submits the immutable reviewed packet once, even if the source selection is edited while previewing", async () => {
		const packet = input();
		const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(json(previewResponse(packet))).mockResolvedValueOnce(json(completed()));
		const client = createInferenceClient({ fetch: transport, currentScope: () => ({ datasetRevision: "dataset-1", selectionRevision: "selection-1" }), authority: () => ({ csrfToken: "synthetic-csrf", sessionRevision: "session-1" }) });
		const pending = client.preview(packet, { backendTransferApproved: true });
		packet.evidence[0]!.text = "Later source edit.";
		packet.scope.excludedIds.push("later-exclusion");
		const prepared = await pending;
		expect(Reflect.set(prepared.input.evidence[0]!, "text", "Unapproved edit.")).toBe(false);
		expect(Reflect.set(prepared.preview.disclosure, "upstream", "Another provider")).toBe(false);
		const result = await client.approveSubmit(prepared, { approved: true });
		expect(result.result?.observations[0]?.evidenceIds).toEqual(["event-1"]);
		const [path, options] = transport.mock.calls[1]!;
		expect(path).toBe("/api/inference/submit");
		expect(JSON.parse(String(options?.body))).toEqual({ jobId: "a".repeat(64), consentToken: "synthetic-consent", approved: true, input: input() });
		await expect(client.approveSubmit(prepared, { approved: true })).rejects.toMatchObject({ code: "already_submitted", possibleBilled: false });
		expect(transport).toHaveBeenCalledTimes(2);
	});
	it("requires separate consent before transferring archive excerpts to backend preview", async () => {
		const transport = vi.fn<typeof fetch>().mockResolvedValue(json(previewResponse(input())));
		const client = createInferenceClient({ fetch: transport, currentScope: () => ({ datasetRevision: "dataset-1", selectionRevision: "selection-1" }), authority: () => ({ csrfToken: "synthetic-csrf", sessionRevision: "session-1" }) });
		await expect(Reflect.apply(client.preview, client, [input(), { backendTransferApproved: false }])).rejects.toMatchObject({ code: "backend_transfer_consent_required", possibleBilled: false });
		expect(transport).not.toHaveBeenCalled();
	});
});
