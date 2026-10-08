import { describe, expect, it, vi } from "vitest";
import { openRouterInferenceProvider } from "../server/openRouterInference";
import type { InferenceRequest } from "../server/inference";

const endpoint = { model_id: "openai/test-text", tag: "openai", provider_name: "OpenAI", status: 0, context_length: 8192,
	max_prompt_tokens: 8192, max_completion_tokens: 512, supported_parameters: ["max_tokens", "response_format"],
	pricing: { prompt: "0.000001", completion: "0.000002", request: "0", image: "0" } };
const metadata = { data: { id: "openai/test-text", architecture: { tokenizer: "GPT", input_modalities: ["text"], output_modalities: ["text"] }, endpoints: [endpoint] } };
const request: InferenceRequest = { model: "openai/test-text", messages: [{ role: "system", content: "json" }, { role: "user", content: "private-only-wire-canary" }],
	max_tokens: 100, stream: false, response_format: { type: "json_object" }, provider: { only: ["openai"], order: ["openai"], allow_fallbacks: false, require_parameters: true,
		data_collection: "deny", zdr: true, max_price: { prompt: 1, completion: 2, request: 0 } } };
function fixture() {
	const wire = vi.fn<typeof fetch>(async (url) => {
		if (String(url).endsWith("/endpoints/zdr")) return Response.json({ data: [endpoint] });
		if (String(url).endsWith("/endpoints")) return Response.json(metadata);
		return Response.json({ model: request.model, provider: "OpenAI", choices: [{ finish_reason: "stop", message: { role: "assistant", content: "{\"observations\":[]}" } }],
			openrouter_metadata: { requested: request.model, endpoints: { available: [{ provider: "OpenAI", model: request.model, selected: true }] } },
			usage: { prompt_tokens: 20, completion_tokens: 15, cost: 0.000001, is_byok: true, cost_details: { upstream_inference_cost: 0.00005 } } });
	});
	return { wire, provider: openRouterInferenceProvider(wire) };
}
describe("real provider wire contract using injected network", () => {
	it.each([null, false, "20", -1, 0.5, Number.MAX_SAFE_INTEGER + 1])("keeps invalid token usage %s unknown rather than coercing reported counts", async (count) => {
		const wire = vi.fn<typeof fetch>(async () => Response.json({ model: request.model,
			choices: [{ message: { role: "assistant", content: "{\"observations\":[]}" } }],
			usage: { prompt_tokens: count, completion_tokens: count, cost: 0.00005, is_byok: false },
			openrouter_metadata: { requested: request.model, endpoints: { available: [{ provider: "OpenAI", model: request.model, selected: true }] } } }));
		expect(await openRouterInferenceProvider(wire).generate("connected-key", request, new AbortController().signal))
			.toMatchObject({ provider: "OpenAI", inputTokens: null, outputTokens: null, costUsd: 0.00005 });
	});
	it("accepts the documented selected route metadata without requiring a top-level provider", async () => {
		const wire = vi.fn<typeof fetch>(async () => Response.json({ model: request.model,
			choices: [{ message: { role: "assistant", content: "{\"observations\":[]}" } }],
			usage: { prompt_tokens: 20, completion_tokens: 15, cost: 0.00005, is_byok: false },
			openrouter_metadata: { requested: request.model, endpoints: { available: [{ provider: "OpenAI", model: request.model, selected: true }] } } }));
		expect(await openRouterInferenceProvider(wire).generate("connected-key", request, new AbortController().signal))
			.toMatchObject({ provider: "OpenAI", inputTokens: 20, outputTokens: 15, costUsd: 0.00005 });
		expect(wire).toHaveBeenCalledOnce();
	});
	it("quotes a supported runtime ZDR endpoint then sends one exact text request using only the connected key", async () => {
		const f = fixture(); const signal = new AbortController().signal;
		expect(await f.provider.quote("connected-key", request.model, "openai", signal)).toMatchObject({ model: request.model, provider: "openai", providerName: "OpenAI", inputPriceNano: 1000, outputPriceNano: 2000, privacy: "zdr-no-collection" });
		expect(f.wire.mock.calls.every(([, init]) => !init?.body)).toBe(true);
		const result = await f.provider.generate("connected-key", request, signal);
		expect(result).toMatchObject({ inputTokens: 20, outputTokens: 15, costUsd: 0.000051, isByok: true, provider: "OpenAI" });
		const paid = f.wire.mock.calls.filter(([url]) => String(url).endsWith("/chat/completions"));
		expect(paid).toHaveLength(1);
		expect(paid[0]?.[1]).toMatchObject({ method: "POST", redirect: "error", signal, body: JSON.stringify(request) });
		expect(new Headers(paid[0]?.[1]?.headers).get("Authorization")).toBe("Bearer connected-key");
	});
	it("fails closed on conditional pricing, unidentified ZDR recipients, and unbounded hidden reasoning prices", async () => {
		for (const change of [{ pricing: { ...endpoint.pricing, overrides: [{ min_prompt_tokens: 1, prompt: "5" }] } },
			{ pricing: { ...endpoint.pricing, internal_reasoning: "1" } }]) {
			const changed = { ...endpoint, ...change };
			const wire = vi.fn<typeof fetch>(async (url) => Response.json(String(url).endsWith("/endpoints/zdr") ? { data: [changed] } : { data: { ...metadata.data, endpoints: [changed] } }));
			await expect(openRouterInferenceProvider(wire).quote("connected-key", request.model, "openai", new AbortController().signal)).rejects.toMatchObject({ code: "provider_capability_unavailable" });
		}
		const wire = vi.fn<typeof fetch>(async (url) => Response.json(String(url).endsWith("/endpoints/zdr") ? { data: [] } : metadata));
		await expect(openRouterInferenceProvider(wire).quote("connected-key", request.model, "openai", new AbortController().signal)).rejects.toMatchObject({ code: "provider_capability_unavailable" });
	});
	it("preserves known billed usage but withholds contradictory, missing and cached route evidence", async () => {
		const body = { model: request.model, provider: "OpenAI", choices: [{ message: { role: "assistant", content: "{\"observations\":[]}" } }],
			usage: { prompt_tokens: 20, completion_tokens: 15, cost: 0.00005, is_byok: false },
			openrouter_metadata: { requested: request.model, endpoints: { available: [{ provider: "OpenAI", model: request.model, selected: true }] } } };
		for (const changed of [
			{ ...body, model: "openai/unapproved-model" },
			{ ...body, provider: "Unapproved provider" },
			{ ...body, openrouter_metadata: undefined },
			{ ...body, openrouter_metadata: { ...body.openrouter_metadata, endpoints: { available: [{ provider: "OpenAI", model: "openai/other", selected: true }] } } },
			{ ...body, openrouter_metadata: { ...body.openrouter_metadata, endpoints: { available: [...body.openrouter_metadata.endpoints.available, ...body.openrouter_metadata.endpoints.available] } } },
			{ ...body, openrouter_metadata: { ...body.openrouter_metadata, attempts: [{ model: request.model, provider: "Unapproved provider", status: 200 }] } },
		]) {
			const wire = vi.fn<typeof fetch>(async () => Response.json(changed));
			expect(await openRouterInferenceProvider(wire).generate("connected-key", request, new AbortController().signal))
				.toMatchObject({ provider: null, inputTokens: 20, outputTokens: 15, costUsd: 0.00005 });
			expect(wire).toHaveBeenCalledOnce();
		}
	});
});
