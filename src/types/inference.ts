/** Same-origin text inference contract. It contains no provider credential or account authority. */
export const INFERENCE_ROUTES = { preview: "/api/inference/preview", submit: "/api/inference/submit", status: "/api/inference/status", cancel: "/api/inference/cancel" } as const;
export type InferencePurpose = "profile-enrichment" | "archive-explanation" | "conversation-turn";
export interface InferenceInput {
	idempotencyKey: string;
	purpose: InferencePurpose;
	model: string;
	provider: string;
	budgetUsd: number;
	maxOutputTokens: number;
	scope: { datasetRevision: string; selectionRevision: string; year: number | null; timezone: string; excludedIds: string[] };
	question: string;
	evidence: { id: string; text: string; timestamp: string; authorship: "owner" }[];
}
export interface InferenceRequest {
	model: string;
	messages: { role: "system" | "user"; content: string }[];
	max_tokens: number;
	stream: false;
	response_format: { type: "json_object" };
	provider: { only: string[]; order: string[]; allow_fallbacks: false; require_parameters: true; data_collection: "deny"; zdr: true; max_price: { prompt: number; completion: number; request: number } };
}
export type JobState = "preview" | "reserved" | "running" | "completed" | "rejected" | "canceled" | "unknown";
export interface InferenceOutput { observations: { text: string; evidenceIds: string[]; uncertainty: string }[] }
export interface InferenceSubmit { jobId: string; consentToken: string; approved: true; input: InferenceInput }
export interface InferencePreview {
	jobId: string; consentToken: string; packetDigest: string; expiresAt: number; request: InferenceRequest;
	disclosure: { purpose: InferencePurpose; year: number | null; gateway: string; upstream: string; workspaceId: string; byokIncluded: true;
		billing: string; budgetUsd: number; estimatedMaxUsd: number; requestCount: 1; maxOutputTokens: number; timeoutMs: number; evidenceCount: number;
		privacy: string; privacySettingsUrl: string; observabilitySettingsUrl: string };
}
export interface InferenceJobSummary {
	jobId: string; state: JobState; budgetUsd: number; reservedUsd: number; costUsd: number | null;
	usage: { inputTokens: number; outputTokens: number; isByok: boolean } | null;
	cancelRequested: boolean; resultAvailable: boolean; possibleBilled: boolean; reconciliationRequired: boolean;
	recovery?: string;
}
export interface InferenceSubmission extends InferenceJobSummary { result?: InferenceOutput | null }
export interface InferenceFailure { error: string }
