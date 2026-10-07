import type { IncomingMessage, ServerResponse } from "node:http";
import { InferenceError, MAX_INFERENCE_BODY_BYTES } from "./inference";

function requestBody(request: IncomingMessage): Promise<Uint8Array> {
	const length = request.headers["content-length"];
	if (length && (!/^\d+$/.test(length) || Number(length) > MAX_INFERENCE_BODY_BYTES)) {
		request.pause(); return Promise.reject(new InferenceError(413, "body_too_large"));
	}
	return new Promise((resolve, reject) => {
		const chunks: Uint8Array[] = []; let size = 0;
		const timer = setTimeout(() => finish(new InferenceError(408, "body_timeout")), 5000);
		function cleanup() { clearTimeout(timer); request.off("data", data); request.off("end", end); request.off("error", error); request.off("aborted", aborted); }
		function finish(reason?: InferenceError) {
			cleanup();
			if (reason) { request.pause(); reject(reason); return; }
			const bytes = new Uint8Array(size); let offset = 0;
			for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
			resolve(bytes);
		}
		function data(chunk: Buffer) { size += chunk.byteLength; if (size > MAX_INFERENCE_BODY_BYTES) finish(new InferenceError(413, "body_too_large")); else chunks.push(chunk); }
		function end() { finish(); }
		function error() { finish(new InferenceError(400, "body_unavailable")); }
		function aborted() { finish(new InferenceError(400, "body_unavailable")); }
		request.on("data", data); request.once("end", end); request.once("error", error); request.once("aborted", aborted);
	});
}
/** Transport boundary shared by Vercel, Vite, and actual HTTP integration fixtures. */
export async function handleNodeAccountRequest(request: IncomingMessage, response: ServerResponse, application: { origin(): string; handle(request: Request): Promise<Response> }) {
	let result: Response;
	try {
		const url = new URL(request.url ?? "/", application.origin());
		const routed = url.searchParams.get("route");
		if (routed) { url.pathname = routed; url.searchParams.delete("route"); }
		const headers = new Headers();
		for (const [name, value] of Object.entries(request.headers)) {
			if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
			else if (value) headers.set(name, value);
		}
		const method = request.method ?? "GET";
		const body = method === "GET" || method === "HEAD" ? undefined : await requestBody(request);
		result = await application.handle(new Request(url, { method, headers, body }));
	} catch (error) {
		const status = error instanceof InferenceError ? error.status : 503;
		const code = error instanceof InferenceError ? error.code : "account_service_unavailable";
		result = new Response(JSON.stringify({ error: code }), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
		response.setHeader("Connection", "close");
	}
	response.statusCode = result.status;
	for (const [name, value] of result.headers) if (name !== "set-cookie") response.setHeader(name, value);
	const setCookies = result.headers.getSetCookie(); if (setCookies.length) response.setHeader("Set-Cookie", setCookies);
	response.end(await result.text());
}
