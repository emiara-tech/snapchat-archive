import { readBoundedJson } from "./boundedJson.js";
import { InferenceError, type InferenceProvider, type InferenceQuote, type InferenceResult } from "./inference.js";

function object(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function deny(): never { throw new InferenceError(503, "provider_capability_unavailable"); }
function positiveInteger(value: unknown): value is number { return Number.isSafeInteger(value) && Number(value) > 0; }
function tokenCount(value: unknown): number | null { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null; }
function returnedProvider(body: Record<string, unknown>, requestModel: string): string | null {
	const routing = body.openrouter_metadata;
	if (body.model !== requestModel || !object(routing) || routing.requested !== requestModel
		|| !object(routing.endpoints) || !Array.isArray(routing.endpoints.available)) return null;
	const selected = routing.endpoints.available.filter((entry) => object(entry) && entry.selected === true);
	const endpoint = selected[0];
	if (selected.length !== 1 || !object(endpoint) || endpoint.model !== requestModel || typeof endpoint.provider !== "string"
		|| !endpoint.provider.trim() || endpoint.provider.length > 100
		|| (body.provider !== undefined && body.provider !== endpoint.provider)) return null;
	if (routing.attempts !== undefined && (!Array.isArray(routing.attempts)
		|| routing.attempts.some((entry) => !object(entry) || entry.model !== requestModel || entry.provider !== endpoint.provider))) return null;
	return endpoint.provider;
}
function price(value: unknown) {
	if (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value)) deny();
	const number = Number(value) * 1_000_000_000;
	if (!Number.isFinite(number) || number < 0 || !Number.isSafeInteger(Math.ceil(number))) deny();
	return Math.ceil(number);
}
function quoteFor(endpoint: Record<string, unknown>, model: string, provider: string): InferenceQuote {
	if (endpoint.model_id !== model || endpoint.tag !== provider || endpoint.status !== 0 || typeof endpoint.provider_name !== "string"
		|| !endpoint.provider_name || endpoint.provider_name.length > 100 || !positiveInteger(endpoint.context_length)
		|| !positiveInteger(endpoint.max_completion_tokens) || !positiveInteger(endpoint.max_prompt_tokens)
		|| !Array.isArray(endpoint.supported_parameters) || !endpoint.supported_parameters.includes("max_tokens") || !endpoint.supported_parameters.includes("response_format")
		|| !object(endpoint.pricing)) deny();
	const pricing = endpoint.pricing;
	// Conditional/context/timed rates need their own evaluator before admission.
	const allowedPrices = ["prompt", "completion", "request", "discount", "overrides", "internal_reasoning", "input_cache_read", "input_cache_write", "input_cache_write_1h", "audio", "audio_output", "image", "image_output", "image_token", "input_audio_cache", "web_search"];
	if (Object.keys(pricing).some((key) => !allowedPrices.includes(key)) || (pricing.overrides !== undefined && (!Array.isArray(pricing.overrides) || pricing.overrides.length > 0))
		|| (pricing.internal_reasoning !== undefined && price(pricing.internal_reasoning) > 0)) deny();
	const cachePrice = Math.max(...["input_cache_read", "input_cache_write", "input_cache_write_1h"].map((key) => pricing[key] === undefined ? 0 : price(pricing[key])));
	const inputPriceNano = price(pricing.prompt) + cachePrice;
	return { model, provider, providerName: endpoint.provider_name, inputPriceNano, outputPriceNano: price(pricing.completion), requestPriceNano: price(pricing.request ?? "0"),
		contextTokens: Math.min(endpoint.context_length, endpoint.max_prompt_tokens), maxOutputTokens: endpoint.max_completion_tokens, tokenizer: "GPT", privacy: "zdr-no-collection" };
}
export function openRouterInferenceProvider(wire: typeof fetch = globalThis.fetch): InferenceProvider {
	async function metadata(path: string, key: string, signal: AbortSignal) {
		const response = await wire("https://openrouter.ai/api/v1/" + path, { headers: { Authorization: `Bearer ${key}` }, signal, redirect: "error" });
		if (!response.ok) deny();
		return readBoundedJson(response, 4 * 1024 * 1024);
	}
	return {
		async quote(key, model, provider, signal) {
			if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(model) || !/^[a-z0-9-]+(?:\/[a-z0-9._-]+)*$/.test(provider)) deny();
			const [catalog, privacy] = await Promise.all([metadata(`models/${model}/endpoints`, key, signal), metadata("endpoints/zdr", key, signal)]);
			if (!object(catalog) || !object(catalog.data) || catalog.data.id !== model || !object(catalog.data.architecture)
				|| catalog.data.architecture.tokenizer !== "GPT" || !Array.isArray(catalog.data.architecture.input_modalities) || !catalog.data.architecture.input_modalities.includes("text")
				|| !Array.isArray(catalog.data.architecture.output_modalities) || !catalog.data.architecture.output_modalities.includes("text")
				|| !Array.isArray(catalog.data.endpoints) || !object(privacy) || !Array.isArray(privacy.data)) deny();
			const matching = catalog.data.endpoints.filter((entry) => object(entry) && entry.tag === provider);
			const eligible = privacy.data.filter((entry) => object(entry) && entry.tag === provider && entry.model_id === model);
			if (matching.length !== 1 || eligible.length !== 1 || !object(matching[0]) || !object(eligible[0])) deny();
			const quote = quoteFor(matching[0], model, provider);
			if (JSON.stringify(quoteFor(eligible[0], model, provider)) !== JSON.stringify(quote)) deny();
			return quote;
		},
		async generate(key, request, signal): Promise<InferenceResult> {
			const response = await wire("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-OpenRouter-Metadata": "enabled" },
				body: JSON.stringify(request), signal, redirect: "error" });
			if (!response.ok) throw new InferenceError(502, "provider_request_interrupted");
			const body = await readBoundedJson(response, 64 * 1024);
			if (!object(body) || body.error || !Array.isArray(body.choices) || body.choices.length !== 1 || !object(body.choices[0])
				|| !object(body.choices[0].message) || typeof body.choices[0].message.content !== "string" || body.choices[0].message.tool_calls
				|| !object(body.usage) || typeof body.usage.is_byok !== "boolean") throw new InferenceError(502, "unknown_provider_usage");
			const usage = body.usage; const details = object(usage.cost_details) ? usage.cost_details : null;
			let cost: number | null = typeof usage.cost === "number" && Number.isFinite(usage.cost) && usage.cost >= 0 ? usage.cost : null;
			if (usage.is_byok) {
				const upstream = details?.upstream_inference_cost;
				const prompt = details?.upstream_inference_prompt_cost; const completion = details?.upstream_inference_completions_cost;
				const external = typeof upstream === "number" && Number.isFinite(upstream) && upstream >= 0 ? upstream
					: typeof prompt === "number" && typeof completion === "number" && Number.isFinite(prompt + completion) && prompt >= 0 && completion >= 0 ? prompt + completion : null;
				cost = cost !== null && external !== null ? cost + external : null;
			}
			// Missing metadata includes cache replays. Withhold their output while preserving known billed usage.
			return { text: body.choices[0].message.content, inputTokens: tokenCount(usage.prompt_tokens), outputTokens: tokenCount(usage.completion_tokens), costUsd: cost, isByok: usage.is_byok === true, provider: returnedProvider(body, request.model) };
		},
	};
}
