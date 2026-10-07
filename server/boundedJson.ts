import { InferenceError } from "./inference";

// Bounds decoded JSON before allocation/parsing; private upstream errors are never surfaced.
export async function readBoundedJson(source: Request | Response, maxBytes: number): Promise<unknown> {
	const length = source.headers.get("Content-Length");
	if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) throw new InferenceError(413, "body_too_large");
	if (!source.body) throw new InferenceError(400, "invalid_json");
	const reader = source.body.getReader();
	const chunks: Uint8Array[] = []; let bytes = 0;
	try {
		for (;;) {
			const chunk = await reader.read(); if (chunk.done) break;
			bytes += chunk.value.byteLength;
			if (bytes > maxBytes) throw new InferenceError(413, "body_too_large");
			chunks.push(chunk.value);
		}
		const content = new Uint8Array(bytes); let offset = 0;
		for (const chunk of chunks) { content.set(chunk, offset); offset += chunk.byteLength; }
		return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(content));
	} catch (error) {
		await reader.cancel().catch(() => {});
		if (error instanceof InferenceError) throw error;
		throw new InferenceError(400, "invalid_json");
	} finally { reader.releaseLock(); }
}
