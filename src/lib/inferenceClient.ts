import { INFERENCE_ROUTES, type InferenceInput, type InferencePreview, type InferenceSubmission, type InferenceJobSummary } from "../types/inference";

export interface InferenceAuthority { csrfToken: string; sessionRevision: string }
export interface InferenceScope { datasetRevision: string; selectionRevision: string }
type DeepReadonly<T> = T extends object ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> } : T;
export interface PreparedInference { readonly input: DeepReadonly<InferenceInput>; readonly preview: DeepReadonly<InferencePreview> }
export interface InferenceClientOptions { fetch?: typeof fetch; authority(): InferenceAuthority | null; currentScope(): InferenceScope | null }
export class InferenceClientError extends Error {
	readonly code: string;
	readonly status: number | null;
	readonly possibleBilled: boolean;
	constructor(code: string, status: number | null = null, possibleBilled = false) {
		super(code); this.name = code === "request_aborted" ? "AbortError" : "InferenceClientError"; this.code = code; this.status = status; this.possibleBilled = possibleBilled;
	}
}
function freeze<T>(value: T): DeepReadonly<T> {
	if (value && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
	return value as DeepReadonly<T>;
}
function assertNotAborted(signal?: AbortSignal) { if (signal?.aborted) throw new InferenceClientError("request_aborted"); }
const SAFE_FAILURE_CODES = new Set([
	"sign_in_required", "csrf_failed", "account_not_configured", "account_service_unavailable", "funding_not_bounded", "insufficient_allowance",
	"job_budget_too_small", "budget_busy", "another_job_or_unknown_usage", "consent_required", "consent_or_packet_changed", "preview_expired_or_authority_changed",
	"connection_or_session_changed", "pricing_or_recipient_changed", "consent_revoked", "job_unavailable", "job_busy", "job_changed", "intent_already_exists",
	"invalid_packet", "unsupported_packet_field", "invalid_evidence_scope", "invalid_timezone", "invalid_evidence", "invalid_or_excluded_evidence", "cross_year_evidence",
	"packet_too_large", "body_too_large", "unsupported_content_type", "unbounded_capability", "context_limit", "inference_unavailable",
]);
function object(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function exact(value: unknown, fields: string[]) { return object(value) && Object.keys(value).length === fields.length && fields.every((key) => Object.hasOwn(value, key)); }
const identifier = (value: unknown, max = 160): value is string => typeof value === "string" && value.length > 0 && value.length <= max && /^[A-Za-z0-9_:./-]+$/.test(value);
function packetSnapshot(value: InferenceInput) {
	let encoded: string;
	try { encoded = JSON.stringify(value); } catch { throw new InferenceClientError("invalid_packet"); }
	if (typeof encoded !== "string") throw new InferenceClientError("invalid_packet");
	if (new TextEncoder().encode(encoded).byteLength > 16 * 1024) throw new InferenceClientError("packet_too_large");
	if (!exact(value, ["idempotencyKey", "purpose", "model", "provider", "budgetUsd", "maxOutputTokens", "scope", "question", "evidence"])
		|| !identifier(value.idempotencyKey, 128) || !identifier(value.model) || !identifier(value.provider)
		|| !["profile-enrichment", "archive-explanation", "conversation-turn"].includes(value.purpose)
		|| !Number.isFinite(value.budgetUsd) || value.budgetUsd <= 0 || value.budgetUsd > 1 || !Number.isInteger(value.maxOutputTokens) || value.maxOutputTokens < 1 || value.maxOutputTokens > 512
		|| typeof value.question !== "string" || new TextEncoder().encode(value.question).byteLength > 1000
		|| !exact(value.scope, ["datasetRevision", "selectionRevision", "year", "timezone", "excludedIds"]) || !Array.isArray(value.evidence) || value.evidence.length < 1 || value.evidence.length > 24)
		throw new InferenceClientError("invalid_packet");
	const scope = value.scope;
	if (!identifier(scope.datasetRevision) || !identifier(scope.selectionRevision) || (scope.year !== null && (!Number.isInteger(scope.year) || scope.year < 1900 || scope.year > 2100))
		|| typeof scope.timezone !== "string" || scope.timezone.length > 80 || !Array.isArray(scope.excludedIds) || scope.excludedIds.length > 500 || !scope.excludedIds.every((id) => identifier(id)))
		throw new InferenceClientError("invalid_packet");
	let formatter: Intl.DateTimeFormat;
	try { formatter = new Intl.DateTimeFormat("en", { timeZone: scope.timezone, year: "numeric" }); } catch { throw new InferenceClientError("invalid_packet"); }
	const excluded = new Set(scope.excludedIds), ids = new Set<string>();
	for (const entry of value.evidence) {
		if (!exact(entry, ["id", "text", "timestamp", "authorship"]) || !identifier(entry.id) || excluded.has(entry.id) || ids.has(entry.id) || entry.authorship !== "owner"
			|| typeof entry.text !== "string" || !entry.text.trim() || [...entry.text].length > 500 || typeof entry.timestamp !== "string"
			|| !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(entry.timestamp)
			|| !Number.isFinite(new Date(entry.timestamp).getTime()) || (scope.year !== null && formatter.format(new Date(entry.timestamp)) !== String(scope.year)))
			throw new InferenceClientError("invalid_packet");
		ids.add(entry.id);
	}
	// Match server normalization exactly, including field order and deduplicated exclusions.
	const input: InferenceInput = { idempotencyKey: value.idempotencyKey, purpose: value.purpose, model: value.model, provider: value.provider, budgetUsd: value.budgetUsd, maxOutputTokens: value.maxOutputTokens,
		scope: { datasetRevision: scope.datasetRevision, selectionRevision: scope.selectionRevision, year: scope.year, timezone: scope.timezone, excludedIds: [...excluded].sort() }, question: value.question,
		evidence: value.evidence.map((entry) => ({ id: entry.id, text: entry.text, timestamp: entry.timestamp, authorship: "owner" })) };
	return { input, body: JSON.stringify(input) };
}
async function readJson(response: Response, signal?: AbortSignal): Promise<unknown> {
	const limit = response.ok ? 64 * 1024 : 4 * 1024;
	const length = Number(response.headers.get("content-length"));
	if (Number.isFinite(length) && length > limit) {
		await response.body?.cancel().catch(() => {});
		throw new InferenceClientError("response_too_large", response.status);
	}
	if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "") || !response.body) {
		await response.body?.cancel().catch(() => {});
		throw new InferenceClientError("invalid_response", response.status);
	}
	const reader = response.body.getReader();
	const abort = () => { void reader.cancel().catch(() => {}); };
	signal?.addEventListener("abort", abort, { once: true });
	let finished = false, size = 0;
	const chunks: Uint8Array[] = [];
	try {
		while (true) {
			assertNotAborted(signal);
			const next = await reader.read();
			assertNotAborted(signal);
			if (next.done) { finished = true; break; }
			size += next.value.byteLength;
			if (size > limit) throw new InferenceClientError("response_too_large", response.status);
			chunks.push(next.value);
		}
		const bytes = new Uint8Array(size); let offset = 0;
		for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
		try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
		catch { throw new InferenceClientError("invalid_response", response.status); }
	} finally {
		signal?.removeEventListener("abort", abort);
		if (!finished) await reader.cancel().catch(() => {});
		reader.releaseLock();
	}
}
const text = (value: unknown, max = 8000): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const money = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const hash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
async function validatedPreview(value: unknown, input: InferenceInput, body: string): Promise<InferencePreview> {
	const invalid = () => { throw new InferenceClientError("invalid_response"); };
	if (!exact(value, ["jobId", "consentToken", "packetDigest", "expiresAt", "request", "disclosure"])) invalid();
	const preview = value as InferencePreview;
	if (!hash(preview.jobId) || !hash(preview.packetDigest) || !identifier(preview.consentToken, 128) || !Number.isSafeInteger(preview.expiresAt) || preview.expiresAt <= Date.now()
		|| !exact(preview.request, ["model", "messages", "max_tokens", "stream", "response_format", "provider"])
		|| !exact(preview.disclosure, ["purpose", "year", "gateway", "upstream", "workspaceId", "byokIncluded", "billing", "budgetUsd", "estimatedMaxUsd", "requestCount", "maxOutputTokens", "timeoutMs", "evidenceCount", "privacy", "privacySettingsUrl", "observabilitySettingsUrl"])) invalid();
	const request = preview.request, disclosure = preview.disclosure;
	if (request.model !== input.model || request.max_tokens !== input.maxOutputTokens || request.stream !== false || !exact(request.response_format, ["type"]) || request.response_format.type !== "json_object"
		|| !exact(request.provider, ["only", "order", "allow_fallbacks", "require_parameters", "data_collection", "zdr", "max_price"])
		|| !Array.isArray(request.messages) || request.messages.length !== 2 || request.messages.some((message) => !exact(message, ["role", "content"]))
		|| request.messages[0]?.role !== "system" || !text(request.messages[0].content) || request.messages[1]?.role !== "user"
		|| request.messages[1].content !== JSON.stringify({ purpose: input.purpose, year: input.scope.year, timezone: input.scope.timezone, question: input.question, evidence: input.evidence })) invalid();
	const provider = request.provider;
	if (JSON.stringify(provider.only) !== JSON.stringify([input.provider]) || JSON.stringify(provider.order) !== JSON.stringify([input.provider]) || provider.allow_fallbacks !== false
		|| provider.require_parameters !== true || provider.data_collection !== "deny" || provider.zdr !== true || !exact(provider.max_price, ["prompt", "completion", "request"])
		|| !Object.values(provider.max_price).every(money) || disclosure.purpose !== input.purpose || disclosure.year !== input.scope.year || disclosure.gateway !== "https://openrouter.ai"
		|| !text(disclosure.upstream, 160) || !text(disclosure.workspaceId, 160) || disclosure.byokIncluded !== true || !text(disclosure.billing) || !text(disclosure.privacy)
		|| disclosure.budgetUsd !== input.budgetUsd || !money(disclosure.estimatedMaxUsd) || disclosure.estimatedMaxUsd <= 0 || disclosure.estimatedMaxUsd > input.budgetUsd
		|| disclosure.requestCount !== 1 || disclosure.maxOutputTokens !== input.maxOutputTokens || disclosure.evidenceCount !== input.evidence.length || !Number.isInteger(disclosure.timeoutMs) || disclosure.timeoutMs < 1 || disclosure.timeoutMs > 20_000
		|| disclosure.privacySettingsUrl !== "https://openrouter.ai/workspaces/default/settings" || disclosure.observabilitySettingsUrl !== "https://openrouter.ai/workspaces/default/observability") invalid();
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
	if ([...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("") !== preview.packetDigest) invalid();
	return preview;
}
function validatedJob(value: unknown, expectedId: string, input?: InferenceInput): InferenceSubmission {
	const invalid = () => { throw new InferenceClientError("invalid_response", null, Boolean(input)); };
	const fields = ["jobId", "state", "budgetUsd", "reservedUsd", "costUsd", "usage", "cancelRequested", "resultAvailable", "possibleBilled", "reconciliationRequired"];
	if (object(value) && input && Object.hasOwn(value, "result")) fields.push("result");
	if (object(value) && Object.hasOwn(value, "recovery")) fields.push("recovery");
	if (!exact(value, fields)) invalid();
	const summary = value as InferenceSubmission;
	if (summary.jobId !== expectedId || !["preview", "reserved", "running", "completed", "rejected", "canceled", "unknown"].includes(summary.state)
		|| !money(summary.budgetUsd) || summary.budgetUsd <= 0 || summary.budgetUsd > 1 || !money(summary.reservedUsd) || summary.reservedUsd > summary.budgetUsd || (summary.costUsd !== null && !money(summary.costUsd))
		|| [summary.cancelRequested, summary.resultAvailable, summary.possibleBilled, summary.reconciliationRequired].some((flag) => typeof flag !== "boolean")
		|| (input && summary.budgetUsd !== input.budgetUsd) || (summary.state === "unknown" && (!summary.possibleBilled || !summary.reconciliationRequired))
		|| (summary.state === "running" && !summary.possibleBilled)
		|| (Object.hasOwn(summary, "recovery") && (!text(summary.recovery, 1000) || /[\u0000-\u001f\u007f<>]/.test(summary.recovery)))) invalid();
	if (summary.usage !== null && (!exact(summary.usage, ["inputTokens", "outputTokens", "isByok"]) || !Number.isSafeInteger(summary.usage.inputTokens) || summary.usage.inputTokens < 0
		|| !Number.isSafeInteger(summary.usage.outputTokens) || summary.usage.outputTokens < 0 || typeof summary.usage.isByok !== "boolean")) invalid();
	if (summary.resultAvailable) {
		if (!input || summary.state !== "completed" || !exact(summary.result, ["observations"]) || !Array.isArray(summary.result?.observations)
			|| summary.result.observations.length < 1 || summary.result.observations.length > 8) invalid();
		const allowed = new Set(input!.evidence.map((entry) => entry.id));
		for (const observation of summary.result!.observations) {
			if (!exact(observation, ["text", "evidenceIds", "uncertainty"]) || !text(observation.text, 2000) || !text(observation.uncertainty, 500) || !Array.isArray(observation.evidenceIds)
				|| observation.evidenceIds.length < 1 || observation.evidenceIds.length > allowed.size || !observation.evidenceIds.every((id) => typeof id === "string" && allowed.has(id))) invalid();
		}
	} else if (summary.result !== undefined && summary.result !== null) invalid();
	return summary;
}

/** Browser-only transport; cookies carry server authority and no provider key enters this interface. */
export function createInferenceClient(options: InferenceClientOptions) {
	const transport = options.fetch ?? globalThis.fetch;
	const preparations = new WeakMap<PreparedInference, { input: InferenceInput; preview: InferencePreview; authority: InferenceAuthority; submitted: boolean }>();
	function currentAuthority() {
		const current = options.authority();
		if (!current?.csrfToken || !current.sessionRevision) throw new InferenceClientError("sign_in_required");
		return { ...current };
	}
	function assertAuthority(expected: InferenceAuthority, possibleBilled = false) {
		const current = options.authority();
		if (!current || current.sessionRevision !== expected.sessionRevision || current.csrfToken !== expected.csrfToken)
			throw new InferenceClientError("authority_changed", null, possibleBilled);
	}
	function assertScope(expected: InferenceScope, possibleBilled = false) {
		const current = options.currentScope();
		if (!current || current.datasetRevision !== expected.datasetRevision || current.selectionRevision !== expected.selectionRevision)
			throw new InferenceClientError("scope_changed", null, possibleBilled);
	}
	async function request(path: string, body: string | undefined, authority: InferenceAuthority, signal?: AbortSignal, method = "POST", scope?: InferenceScope) {
		assertNotAborted(signal);
		if (scope) assertScope(scope);
		const possibleBilled = path === INFERENCE_ROUTES.submit;
		try {
			const response = await transport(path, {
				method, credentials: "same-origin", mode: "same-origin", redirect: "error", cache: "no-store", signal,
				headers: { Accept: "application/json", ...(method === "POST" ? { "Content-Type": "application/json", "X-CSRF-Token": authority.csrfToken } : {}) }, body,
			});
			const value = await readJson(response, signal);
			if (!response.ok) {
				const code = object(value) && typeof value.error === "string" && SAFE_FAILURE_CODES.has(value.error) ? value.error : "request_failed";
				throw new InferenceClientError(code, response.status);
			}
			assertAuthority(authority, possibleBilled);
			if (scope) assertScope(scope, possibleBilled);
			return value;
		} catch (error) {
			if (error instanceof InferenceClientError) throw new InferenceClientError(error.code, error.status, error.possibleBilled || possibleBilled);
			const aborted = signal?.aborted || (error instanceof Error && error.name === "AbortError");
			throw new InferenceClientError(aborted ? "request_aborted" : "transport_failed", null, possibleBilled);
		}
	}
	/** Calling preview transfers owner excerpts to the app backend; it needs its own explicit approval. */
	async function preview(input: InferenceInput, operation: { backendTransferApproved: true; signal?: AbortSignal }): Promise<PreparedInference> {
		if (operation?.backendTransferApproved !== true) throw new InferenceClientError("backend_transfer_consent_required");
		const authority = currentAuthority();
		const { body, input: snapshot } = packetSnapshot(input);
		const response = await validatedPreview(await request(INFERENCE_ROUTES.preview, body, authority, operation.signal, "POST", snapshot.scope), snapshot, body);
		assertNotAborted(operation.signal); assertAuthority(authority); assertScope(snapshot.scope);
		const prepared = freeze({ input: snapshot, preview: response });
		preparations.set(prepared, { input: snapshot, preview: response, authority, submitted: false });
		return prepared;
	}
	async function approveSubmit(prepared: PreparedInference, operation: { approved: true; signal?: AbortSignal }): Promise<InferenceSubmission> {
		if (operation?.approved !== true) throw new InferenceClientError("consent_required");
		const record = preparations.get(prepared);
		if (!record) throw new InferenceClientError("preview_unavailable");
		if (record.submitted) throw new InferenceClientError("already_submitted");
		assertAuthority(record.authority);
		assertScope(record.input.scope);
		if (record.preview.expiresAt <= Date.now()) throw new InferenceClientError("preview_expired");
		assertNotAborted(operation.signal);
		record.submitted = true;
		const body = JSON.stringify({ jobId: record.preview.jobId, consentToken: record.preview.consentToken, approved: true, input: record.input });
		return validatedJob(await request(INFERENCE_ROUTES.submit, body, record.authority, operation.signal, "POST", record.input.scope), record.preview.jobId, record.input);
	}
	function jobId(id: string) { if (!/^[a-f0-9]{64}$/.test(id)) throw new InferenceClientError("invalid_job_id"); return id; }
	async function status(id: string, operation: { signal?: AbortSignal } = {}): Promise<InferenceJobSummary> {
		return validatedJob(await request(`${INFERENCE_ROUTES.status}?job=${jobId(id)}`, undefined, currentAuthority(), operation.signal, "GET"), id);
	}
	async function cancel(id: string, operation: { signal?: AbortSignal } = {}): Promise<InferenceJobSummary> {
		return validatedJob(await request(INFERENCE_ROUTES.cancel, JSON.stringify({ jobId: jobId(id) }), currentAuthority(), operation.signal), id);
	}
	return { preview, approveSubmit, status, cancel };
}
