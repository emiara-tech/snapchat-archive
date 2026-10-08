import { handleNodeAccountRequest } from "../server/nodeAccountAdapter.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createAccountService } from "../server/accountService.js";
import { redisStore } from "../server/store.js";
import { workosIdentity } from "../server/identity.js";
import { localStore } from "../server/localStore.js";
import type { DurableStore } from "../server/store.js";
interface LocalAccountResources {
	current: { path: string; store: ReturnType<typeof localStore> } | null;
	servers: Set<symbol>;
}
const resourceKey = Symbol.for("goodbye-chat.local-account-resources.v1");
const runtime = globalThis as typeof globalThis & { [resourceKey]?: LocalAccountResources };
// Vite can replace this module while requests continue. Native resources have process ownership.
const localAccounts = runtime[resourceKey] ??= { current: null, servers: new Set() };
export function closeLocalAccountStore() {
	const current = localAccounts.current;
	localAccounts.current = null;
	current?.store.close();
}
export function acquireLocalAccountStoreOwner(): () => void {
	const owner = Symbol();
	localAccounts.servers.add(owner);
	return () => {
		if (!localAccounts.servers.delete(owner)) return;
		if (localAccounts.servers.size === 0) closeLocalAccountStore();
	};
}
// Funding and quote may each take 10s, generation 20s. Retain time for auth, durable settlement and response.
export const config = { maxDuration: 60 };
export async function accountRequest(request: Request): Promise<Response> {
	const {
		APP_ORIGIN,
		WORKOS_API_KEY,
		WORKOS_CLIENT_ID,
		WORKOS_COOKIE_PASSWORD,
		UPSTASH_REDIS_REST_URL,
		UPSTASH_REDIS_REST_TOKEN,
		LOCAL_AUTH_STORE,
	} = process.env;
	if (
		!APP_ORIGIN ||
		!WORKOS_API_KEY ||
		!WORKOS_CLIENT_ID ||
		!WORKOS_COOKIE_PASSWORD ||
		WORKOS_COOKIE_PASSWORD.length < 32 ||
		(!LOCAL_AUTH_STORE &&
			(!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN)) ||
		(Boolean(process.env.VERCEL) &&
			(!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN))
	) {
		const status = new URL(request.url).pathname === "/api/session" ? 200 : 503;
		return new Response(
			JSON.stringify({
				available: false,
				account: null,
				aiAvailable: false,
				chatgptAvailable: false,
				error: "account_not_configured",
			}),
			{
				status,
				headers: {
					"Content-Type": "application/json",
					"Cache-Control": "no-store",
					"Referrer-Policy": "no-referrer",
				},
			},
		);
	}
	try {
		let accounts: DurableStore;
		if (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN)
			accounts = redisStore(UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN);
		else {
			if (!LOCAL_AUTH_STORE || process.env.VERCEL)
				throw new Error("Shared accounts are required for deployment");
			if (!localAccounts.current || localAccounts.current.path !== LOCAL_AUTH_STORE)
			{
				closeLocalAccountStore();
				localAccounts.current = {
					path: LOCAL_AUTH_STORE,
					store: localStore(LOCAL_AUTH_STORE),
				};
			}
			accounts = localAccounts.current.store;
		}
		return await createAccountService({
			origin: APP_ORIGIN,
			allowLoopbackHttp: Boolean(LOCAL_AUTH_STORE) && !process.env.VERCEL,
			password: WORKOS_COOKIE_PASSWORD,
			store: accounts,
			identity: workosIdentity(
				WORKOS_API_KEY,
				WORKOS_CLIENT_ID,
				WORKOS_COOKIE_PASSWORD,
			),
		}).handle(request);
	} catch {
		return new Response(
			JSON.stringify({ error: "account_service_unavailable" }),
			{
				status: 503,
				headers: {
					"Content-Type": "application/json",
					"Cache-Control": "no-store",
					"Referrer-Policy": "no-referrer",
				},
			},
		);
	}
}
export default async function service(request: IncomingMessage, response: ServerResponse) {
	return handleNodeAccountRequest(request, response, { origin: () => process.env.APP_ORIGIN || "http://localhost:5173", handle: accountRequest });
}
