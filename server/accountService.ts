import {
	accountOrigin,
	cookies,
	decrypt,
	digest,
	encrypt,
	keyAllowance,
	returnPath,
	sameSecret,
	token,
} from "./security";
import type { KeyAllowance } from "./security";
import type { DurableStore } from "./store";
import type { IdentityProvider, VerifiedAccount } from "./identity";
import { createInferenceService, InferenceError, MAX_INFERENCE_BODY_BYTES, type FundingAuthority, type InferenceProvider } from "./inference";
import { openRouterInferenceProvider } from "./openRouterInference";
import { readBoundedJson } from "./boundedJson";
export interface AccountServiceOptions {
	origin: string;
	password: string;
	store: DurableStore;
	identity: IdentityProvider;
	fetch?: typeof globalThis.fetch;
	allowLoopbackHttp?: boolean;
	inferenceProvider?: InferenceProvider;
}
interface AuthTransaction {
	provider: "identity" | "openrouter";
	binding: string;
	state: string;
	verifier: string;
	ownerId: string | null;
	connectionEpoch: string | null;
	returnTo: string;
	expiresAt: number;
}
interface StoredSession {
	ownerId: string;
	sealed: string;
	csrf: string;
	expiresAt: number;
}
interface StoredConnection {
	ownerId: string;
	key: string;
	connectedAt: string;
	providerBinding: Pick<KeyAllowance, "workspaceId" | "creatorUserId" | "organizationId" | "byokIncluded" | "bindingState">;
	validatedAt: string;
	expiresAt: string | null;
}
const SESSION_SECONDS = 60 * 60 * 24 * 7;
// Covers bounded SDK/JWKS calls and every store round trip, including cleanup.
const AUTH_LOCK_SECONDS = 120;
export function createAccountService(options: AccountServiceOptions) {
	const { store, identity, password } = options;
	const origin = accountOrigin(options.origin, options.allowLoopbackHttp);
	const secure = origin.startsWith("https:");
	const upstream = options.fetch ?? globalThis.fetch;
	const sessionCookie = secure ? "__Host-gc_session" : "gc_session";
	const transactionCookie = (provider: string) =>
		secure ? `__Host-gc_${provider}` : `gc_${provider}`;
	const cookie = (name: string, value: string, seconds: number) =>
		`${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${secure ? "; Secure" : ""}`;
	const json = (status: number, data: unknown) =>
		new Response(JSON.stringify(data), {
			status,
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": "no-store",
				"Referrer-Policy": "no-referrer",
			},
		});
	function redirect(path: string, setCookies: string[] = []) {
		const response = new Response(null, {
			status: 303,
			headers: {
				Location: path,
				"Cache-Control": "no-store",
				"Referrer-Policy": "no-referrer",
			},
		});
		for (const value of setCookies)
			response.headers.append("Set-Cookie", value);
		return response;
	}
	async function session(request: Request): Promise<{
		id: string;
		record: StoredSession;
		account: VerifiedAccount;
	} | null> {
		const id = cookies(request)[sessionCookie];
		if (!id) return null;
		const key = "session:" + digest(id);
		if (!(await store.get(key))) return null;
		const lease = token();
		const lock = "verify:" + digest(id);
		if (!(await store.claim(lock, lease, AUTH_LOCK_SECONDS)))
			throw new Error("Session verification busy");
		try {
			const stored = await store.get(key);
			if (!stored) return null;
			const record = decrypt<StoredSession>(stored, password);
			if (record.expiresAt <= Date.now()) {
				await store.take(key, stored);
				return null;
			}
			const verified = await identity.verify(record.sealed);
			if ((await store.get(lock)) !== lease) throw new Error("Session verification lease expired");
			if (!verified || verified.account.id !== record.ownerId) {
				await store.take(key, stored);
				return null;
			}
			if (verified.sealed !== record.sealed) {
				record.sealed = verified.sealed;
				const remaining = Math.max(
					1,
					Math.ceil((record.expiresAt - Date.now()) / 1000),
				);
				if (
					!(await store.replace(
						key,
						stored,
						encrypt(record, password),
						remaining,
					))
				)
					return null;
			}
			return { id, record, account: verified.account };
		} finally {
			await store.take(lock, lease);
		}
	}
	function csrf(request: Request, record: StoredSession) {
		return (
			request.headers.get("origin") === origin &&
			sameSecret(request.headers.get("x-csrf-token") ?? "", record.csrf)
		);
	}
	async function begin(
		request: Request,
		provider: AuthTransaction["provider"],
	) {
		const current = provider === "openrouter" ? await session(request) : null;
		if (provider === "openrouter" && !current)
			return json(401, { error: "sign_in_required" });
		const id = token();
		const binding = token();
		const callback =
			origin +
			(provider === "identity"
				? "/auth/callback"
				: "/connections/openrouter/callback");
		let state: string;
		let verifier: string;
		let url: string;
		if (provider === "identity") {
			const result = await identity.start(callback);
			state = result.state;
			verifier = result.verifier;
			url = result.url;
		} else {
			state = token();
			verifier = token();
			const authorize = new URL("https://openrouter.ai/auth");
			authorize.searchParams.set("callback_url", callback);
			authorize.searchParams.set(
				"code_challenge",
				Buffer.from(digest(verifier), "hex").toString("base64url"),
			);
			authorize.searchParams.set("code_challenge_method", "S256");
			authorize.searchParams.set("state", state);
			authorize.searchParams.set("key_label", "Goodbye Chat");
			url = authorize.href;
		}
		const transaction: AuthTransaction = {
			provider,
			binding: digest(binding),
			state: digest(state),
			verifier,
			ownerId: current?.account.id ?? null,
			connectionEpoch: current
				? await store.get("connection-epoch:" + current.account.id)
				: null,
			returnTo: returnPath(new URL(request.url).searchParams.get("returnTo")),
			expiresAt: Date.now() + 10 * 60 * 1000,
		};
		await store.put("transaction:" + id, encrypt(transaction, password), 600);
		return redirect(url, [
			cookie(transactionCookie(provider), id + "." + binding, 600),
		]);
	}
	async function callback(
		request: Request,
		provider: AuthTransaction["provider"],
	) {
		const url = new URL(request.url);
		const bound = cookies(request)[transactionCookie(provider)] ?? "";
		const [id, binding] = bound.split(".");
		if (!id || !binding) return json(400, { error: "invalid_transaction" });
		const stored = await store.get("transaction:" + id);
		if (!stored) return json(400, { error: "expired_or_replayed_transaction" });
		const transaction = decrypt<AuthTransaction>(stored, password);
		if (
			transaction.provider !== provider ||
			transaction.expiresAt <= Date.now() ||
			!sameSecret(transaction.binding, digest(binding))
		)
			return json(400, { error: "invalid_transaction" });
		const clear = cookie(transactionCookie(provider), "", 0);
		if (url.searchParams.has("error")) {
			if (await store.take("transaction:" + id, stored))
				return redirect("/account?result=denied", [clear]);
			return json(400, { error: "replayed_transaction" });
		}
		const code = url.searchParams.get("code");
		const state = url.searchParams.get("state");
		if (!code || !state || !sameSecret(transaction.state, digest(state)))
			return json(400, { error: "invalid_callback" });
		const current = provider === "openrouter" ? await session(request) : null;
		if (
			provider === "openrouter" &&
			(!current || current.account.id !== transaction.ownerId)
		)
			return json(401, { error: "account_changed" });
		if (!(await store.take("transaction:" + id, stored)))
			return json(400, { error: "replayed_transaction" });
		try {
			if (provider === "identity") {
				const result = await identity.exchange(code, transaction.verifier);
				const sessionId = token();
				const record: StoredSession = {
					ownerId: result.account.id,
					sealed: result.sealed,
					csrf: token(),
					expiresAt: Date.now() + SESSION_SECONDS * 1000,
				};
				await store.put(
					"session:" + digest(sessionId),
					encrypt(record, password),
					SESSION_SECONDS,
				);
				const previous = cookies(request)[sessionCookie];
				if (previous) await store.remove("session:" + digest(previous));
				return redirect(transaction.returnTo, [
					clear,
					cookie(sessionCookie, sessionId, SESSION_SECONDS),
				]);
			}
			const response = await upstream(
				"https://openrouter.ai/api/v1/auth/keys",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						code,
						code_verifier: transaction.verifier,
						code_challenge_method: "S256",
					}),
					signal: AbortSignal.timeout(15000),
					redirect: "error",
				},
			);
			if (!response.ok) throw new Error("Connection exchange failed");
			const grant = (await response.json()) as { key?: unknown };
			if (typeof grant.key !== "string" || !grant.key.startsWith("sk-or-"))
				throw new Error("Invalid connection grant");
			const info = await allowance(grant.key);
			if (info.state === "invalid" || info.state === "expired")
				throw new Error("Invalid connection");
			const confirmed = await session(request);
			if (!confirmed || confirmed.account.id !== transaction.ownerId)
				throw new Error("Account changed");
			const record: StoredConnection = {
				ownerId: confirmed.account.id,
				key: grant.key,
				connectedAt: new Date().toISOString(),
				validatedAt: new Date().toISOString(),
				expiresAt: info.expiresAt,
				providerBinding: { workspaceId: info.workspaceId, creatorUserId: info.creatorUserId,
					organizationId: info.organizationId, byokIncluded: info.byokIncluded, bindingState: info.bindingState },
			};
			const lock = "connection-lock:" + record.ownerId;
			const lease = token();
			if (!(await store.claim(lock, lease, AUTH_LOCK_SECONDS)))
				throw new Error("Connection changed");
			try {
				if (
					(await store.get("connection-epoch:" + record.ownerId)) !==
					transaction.connectionEpoch
				)
					throw new Error("Connection cancelled");
				await store.put(
					"connection:" + record.ownerId,
					encrypt(record, password),
					SESSION_SECONDS,
				);
			} finally {
				await store.take(lock, lease);
			}
			return redirect("/account?result=connected", [clear]);
		} catch {
			return redirect("/account?result=failed", [clear]);
		}
	}
	async function allowance(key: string) {
		const response = await upstream("https://openrouter.ai/api/v1/key", {
			headers: { Authorization: `Bearer ${key}` },
			signal: AbortSignal.timeout(10000),
			redirect: "error",
		});
		if (!response.ok) throw new Error("Allowance unavailable");
		const result = (await response.json()) as { data?: unknown };
		return keyAllowance(result.data);
	}
	function matchesBinding(record: StoredConnection, info: KeyAllowance) {
		const binding = record.providerBinding;
		return binding?.bindingState === "known" && info.bindingState === "known"
			&& binding.workspaceId === info.workspaceId && binding.creatorUserId === info.creatorUserId
			&& binding.organizationId === info.organizationId
			// A dedicated key can become more restrictive in provider settings after OAuth.
			&& (binding.byokIncluded === info.byokIncluded || (binding.byokIncluded === false && info.byokIncluded === true));
	}
	async function funding(current: NonNullable<Awaited<ReturnType<typeof session>>>): Promise<FundingAuthority> {
		const ownerId = current.account.id;
		const stored = await store.get("connection:" + ownerId);
		if (!stored) throw new InferenceError(402, "connection_required");
		const connection = decrypt<StoredConnection>(stored, password);
		if (connection.ownerId !== ownerId) throw new InferenceError(403, "connection_owner_mismatch");
		const info = await allowance(connection.key);
		if (!matchesBinding(connection, info)) throw new InferenceError(409, "funding_binding_changed");
		if (info.state !== "usable" || info.byokIncluded !== true || info.remaining === null || info.limit === null || info.remaining > info.limit || !info.workspaceId) throw new InferenceError(402, "funding_not_bounded");
		return { ownerId, sessionId: current.id, connectionId: digest(stored), connectionEpoch: await store.get("connection-epoch:" + ownerId),
			key: connection.key, remainingUsd: info.remaining, workspaceId: info.workspaceId, byokIncluded: true };
	}
	const inference = createInferenceService({ store, provider: options.inferenceProvider ?? openRouterInferenceProvider(upstream),
		async active(authority) {
			const [storedSession, storedConnection, epoch] = await Promise.all([store.get("session:" + digest(authority.sessionId)),
				store.get("connection:" + authority.ownerId), store.get("connection-epoch:" + authority.ownerId)]);
			if (!storedSession || !storedConnection || digest(storedConnection) !== authority.connectionId || epoch !== authority.connectionEpoch) return false;
			const current = decrypt<StoredSession>(storedSession, password);
			return current.ownerId === authority.ownerId && current.expiresAt > Date.now();
		} });
	async function handle(request: Request): Promise<Response> {
		const path = new URL(request.url).pathname;
		const method = request.method;
		try {
			if (path.startsWith("/api/inference/")) {
				const current = await session(request);
				if (!current) return json(401, { error: "sign_in_required" });
				if (method === "GET" && path === "/api/inference/status") return json(200, await inference.status(current.account.id, new URL(request.url).searchParams.get("job") ?? ""));
				if (method !== "POST" || !["/api/inference/preview", "/api/inference/submit", "/api/inference/cancel"].includes(path)) return json(404, { error: "route_unavailable" });
				if (!csrf(request, current.record)) return json(403, { error: "csrf_rejected" });
				if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") return json(415, { error: "json_required" });
				const body = await readBoundedJson(request, MAX_INFERENCE_BODY_BYTES);
				if (path.endsWith("/cancel")) {
					if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 || !("jobId" in body) || typeof body.jobId !== "string") throw new InferenceError(400, "invalid_job");
					return json(200, await inference.cancel(current.account.id, body.jobId));
				}
				const authority = await funding(current);
				return json(200, path.endsWith("/preview") ? await inference.preview(authority, body) : await inference.submit(authority, body));
			}
			if (method === "GET" && path === "/auth/login")
				return begin(request, "identity");
			if (method === "GET" && path === "/auth/callback")
				return callback(request, "identity");
			if (method === "GET" && path === "/connections/openrouter/start")
				return begin(request, "openrouter");
			if (method === "GET" && path === "/connections/openrouter/callback")
				return callback(request, "openrouter");
			if (method === "GET" && path === "/api/session") {
				const current = await session(request);
				if (!current)
					return json(200, {
						account: null,
						available: true,
						aiAvailable: false,
						chatgptAvailable: false,
					});
				let connection: unknown = null;
				const stored = await store.get("connection:" + current.account.id);
				if (stored) {
					const record = decrypt<StoredConnection>(stored, password);
					if (record.ownerId !== current.account.id)
						return json(403, { error: "connection_owner_mismatch" });
					try {
						const info = await allowance(record.key);
						const binding = record.providerBinding;
						const matches = matchesBinding(record, info);
						connection = {
							provider: "OpenRouter",
							...info,
							state: info.state === "usable" ? matches ? "usable" : binding?.bindingState === "known" ? "binding_mismatch" : "metadata_required" : info.state,
							providerBinding: binding ?? { bindingState: "unknown" },
							validatedAt: record.validatedAt ?? null,
							settingsUrl: "https://openrouter.ai/keys/" + digest(record.key),
							connectedAt: record.connectedAt,
						};
					} catch {
						connection = {
							provider: "OpenRouter",
							state: "provider_unavailable",
						};
					}
				}
				return json(200, {
					account: current.account,
					csrf: current.record.csrf,
					available: true,
					connection,
					aiAvailable: false,
					chatgptAvailable: false,
				});
			}
			if (
				method === "POST" &&
				(path === "/auth/logout" ||
					path === "/connections/openrouter/disconnect")
			) {
				const current = await session(request);
				if (!current) return json(401, { error: "sign_in_required" });
				if (!csrf(request, current.record))
					return json(403, { error: "csrf_rejected" });
				if (path.endsWith("/disconnect")) {
					const lock = "connection-lock:" + current.account.id;
					const lease = token();
					if (!(await store.claim(lock, lease, AUTH_LOCK_SECONDS)))
						throw new Error("Connection busy");
					try {
						await store.put(
							"connection-epoch:" + current.account.id,
							token(),
							SESSION_SECONDS,
						);
						await store.remove("connection:" + current.account.id);
					} finally {
						await store.take(lock, lease);
					}
					return json(200, { disconnected: true, remoteRevocation: false });
				}
				await store.remove("session:" + digest(current.id));
				let logoutUrl: string | null = null;
				try {
					logoutUrl = await identity.logout(
						current.record.sealed,
						origin + "/account",
					);
				} catch {
					/* Local logout still invalidates the app session. */
				}
				const response = json(200, { signedOut: true, logoutUrl });
				response.headers.append("Set-Cookie", cookie(sessionCookie, "", 0));
				return response;
			}
			return json(404, { error: "route_unavailable" });
		} catch (error) {
			if (error instanceof InferenceError) return json(error.status, { error: error.code });
			return json(503, { error: "account_service_unavailable" });
		}
	}
	return { handle };
}
