import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { EventEmitter } from "node:events";
import accountService, { acquireLocalAccountStoreOwner } from "../api/service";

type AccountHandler = (request: IncomingMessage, response: ServerResponse) => Promise<void>;

/** Same-origin Node adapter used by both development and preview servers. */
export function accountServicePlugin(): Plugin {
	const owners = new Set<() => void>();
	const ownResources = (server: Pick<EventEmitter, "once"> | null) => {
		const release = acquireLocalAccountStoreOwner();
		const close = () => { owners.delete(close); release(); };
		owners.add(close);
		server?.once("close", close);
	};
	const route = (loadHandler: () => Promise<AccountHandler>) => async (request: IncomingMessage, response: ServerResponse, next: () => void) => {
		if (!/^\/(?:api\/|auth\/|connections\/)/.test(request.url ?? "")) return next();
		try {
			await (await loadHandler())(request, response);
		} catch {
			response.statusCode = 503;
			response.setHeader("Content-Type", "application/json");
			response.setHeader("Cache-Control", "no-store");
			response.setHeader("Referrer-Policy", "no-referrer");
			response.end('{"error":"account_service_unavailable"}');
		}
	};
	return {
		name: "same-origin-account-service",
		closeBundle() { for (const release of [...owners]) release(); },
		configurePreviewServer(server) {
			ownResources(server.httpServer);
			server.middlewares.use(route(async () => accountService));
		},
		configureServer(server) {
			ownResources(server.httpServer);
			server.middlewares.use(route(async () => (await server.ssrLoadModule("/api/service.ts")).default));
		},
	};
}
