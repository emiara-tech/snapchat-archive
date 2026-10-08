import { describe, it, expect, vi } from "vitest";
import { createAccountService } from "../server/accountService";
import {
	decrypt,
	digest,
	encrypt,
	keyAllowance,
	accountOrigin,
	returnPath,
} from "../server/security";
import type { DurableStore } from "../server/store";
import type { IdentityProvider } from "../server/identity";
import type { AccountServiceOptions } from "../server/accountService";
const password = "a synthetic secret password of more than 32 chars";
function fixture() {
	const records = new Map<string, string>();
	const store: DurableStore = {
		get: async (key) => records.get(key) ?? null,
		put: async (key, value) => {
			records.set(key, value);
		},
		remove: async (key) => {
			records.delete(key);
		},
		take: async (key, value) => {
			if (records.get(key) !== value) return false;
			records.delete(key);
			return true;
		},
		claim: async (key, value) => {
			if (records.has(key)) return false;
			records.set(key, value);
			return true;
		},
		replace: async (key, expected, value) => {
			if (records.get(key) !== expected) return false;
			records.set(key, value);
			return true;
		},
	};
	const identity: IdentityProvider = {
		start: async (callback) => ({
			url: `https://identity.example/authorize?callback=${encodeURIComponent(callback)}&state=synthetic-state`,
			state: "synthetic-state",
			verifier: "synthetic-verifier",
		}),
		exchange: async (code) => {
			if (code !== "valid") throw new Error("Rejected");
			return {
				account: { id: "owner-a", email: "demo@example.invalid", name: "Demo" },
				sealed: "sealed-account-a",
			};
		},
		verify: async (sealed) =>
			sealed === "sealed-account-a"
				? {
						account: {
							id: "owner-a",
							email: "demo@example.invalid",
							name: "Demo",
						},
						sealed,
					}
				: null,
		logout: async (_sealed, returnTo) =>
			`https://identity.example/logout?returnTo=${encodeURIComponent(returnTo)}`,
	};
	let providerData: Record<string, unknown> = { is_management_key: false, is_provisioning_key: false, include_byok_in_limit: true,
		limit: 5, limit_remaining: 4, expires_at: null, workspace_id: "synthetic-workspace", creator_user_id: "synthetic-provider-owner", organization_id: null };
	let providerUnavailable = false;
	const service = (overrides: Partial<AccountServiceOptions> = {}) =>
		createAccountService({
			origin: "https://goodbye.example",
			password,
			store,
			identity,
			fetch: async (url) => {
				if (providerUnavailable) throw new Error("Synthetic provider outage");
				return String(url).endsWith("/auth/keys") ? Response.json({ key: "sk-or-synthetic-only" }) : Response.json({ data: providerData });
			},
			...overrides,
		});
	const request = (path: string, options: RequestInit = {}) =>
		new Request("https://goodbye.example" + path, options);
	const cookieFrom = (response: Response) =>
		response.headers
			.getSetCookie()
			.map((value) => value.split(";")[0])
			.join("; ");
	async function login() {
		const start = await service().handle(request("/auth/login"));
		const bound = cookieFrom(start);
		const result = await service().handle(
			request("/auth/callback?code=valid&state=synthetic-state", {
				headers: { cookie: bound },
			}),
		);
		const cookie = cookieFrom(result);
		const info = await service().handle(
			request("/api/session", { headers: { cookie } }),
		);
		return { start, bound, result, cookie, info: await info.json() };
	}
	async function grant(cookie: string) {
		const start = await service().handle(request("/connections/openrouter/start", { headers: { cookie } }));
		const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
		const bound = cookie + "; " + cookieFrom(start);
		return { state, bound, path: `/connections/openrouter/callback?code=synthetic&state=${encodeURIComponent(state)}` };
	}
	return { records, store, identity, service, request, cookieFrom, login, grant,
		providerData, setProviderData(value: Record<string, unknown>) { providerData = value; }, setProviderUnavailable(value: boolean) { providerUnavailable = value; } };
}
describe("account permission boundaries", () => {
	it("uses encrypted, authenticated records and rejects tampering", () => {
		const protectedValue = encrypt({ key: "a-private-user-key" }, password);
		expect(protectedValue).not.toContain("a-private-user-key");
		expect(decrypt(protectedValue, password)).toEqual({
			key: "a-private-user-key",
		});
		expect(() => decrypt(protectedValue, "wrong password")).toThrow();
	});
	it("requires finite, current, non-management allowance and safe return paths", () => {
		expect(
			keyAllowance({
				is_management_key: false,
				is_provisioning_key: false,
				limit: null,
				limit_remaining: 12,
			}).state,
		).toBe("cap_required");
		expect(
			keyAllowance({ is_management_key: true, limit: 10, limit_remaining: 10 })
				.state,
		).toBe("invalid");
		expect(
			keyAllowance({ is_management_key: false, is_provisioning_key: false, limit: 10, limit_remaining: 0 })
				.state,
		).toBe("depleted");
		expect(
			keyAllowance({
				is_management_key: false,
				is_provisioning_key: false,
				limit: 10,
				limit_remaining: 10,
				expires_at: "2020-01-01",
			}).state,
		).toBe("expired");
		expect(returnPath("https://evil.example")).toBe("/account");
		expect(returnPath("//evil.example")).toBe("/account");
	});
	it("signs in across service instances, consumes a callback once, and exposes no credentials", async () => {
		const f = fixture();
		const result = await f.login();
		expect(result.result.status).toBe(303);
		expect(result.result.headers.getSetCookie().join(";")).toMatch(/HttpOnly/);
		expect(result.result.headers.getSetCookie().join(";")).toMatch(/Secure/);
		expect(result.info.account.id).toBe("owner-a");
		expect(JSON.stringify(result.info)).not.toContain("sealed-account");
		expect(
			await (
				await f
					.service()
					.handle(
						f.request("/auth/callback?code=valid&state=synthetic-state", {
							headers: { cookie: result.bound },
						}),
					)
			).json(),
		).toMatchObject({ error: "expired_or_replayed_transaction" });
	});
	it("rejects a wrong browser, wrong state, forged session and unsafe logout", async () => {
		const f = fixture();
		const start = await f.service().handle(f.request("/auth/login"));
		const bound = f.cookieFrom(start);
		expect(
			(
				await f
					.service()
					.handle(f.request("/auth/callback?code=valid&state=synthetic-state"))
			).status,
		).toBe(400);
		expect(
			(
				await f
					.service()
					.handle(
						f.request("/auth/callback?code=valid&state=wrong", {
							headers: { cookie: bound },
						}),
					)
			).status,
		).toBe(400);
		const result = await f.login();
		expect(
			(
				await f
					.service()
					.handle(
						f.request("/auth/logout", {
							method: "POST",
							headers: {
								cookie: result.cookie,
								origin: "https://evil.example",
								"x-csrf-token": result.info.csrf,
							},
						}),
					)
			).status,
		).toBe(403);
		expect(
			(
				await f
					.service()
					.handle(
						f.request("/auth/logout", {
							method: "POST",
							headers: {
								cookie: "__Host-gc_session=forged",
								origin: "https://goodbye.example",
							},
						}),
					)
			).status,
		).toBe(401);
	});
	it("invalidates the app session on logout and prevents it being reused", async () => {
		const f = fixture();
		const result = await f.login();
		const logout = await f
			.service()
			.handle(
				f.request("/auth/logout", {
					method: "POST",
					headers: {
						cookie: result.cookie,
						origin: "https://goodbye.example",
						"x-csrf-token": result.info.csrf,
					},
				}),
			);
		expect(logout.status).toBe(200);
		expect(logout.headers.getSetCookie().join(";")).toContain("Max-Age=0");
		const after = await f
			.service()
			.handle(
				f.request("/api/session", { headers: { cookie: result.cookie } }),
			);
		expect((await after.json()).account).toBe(null);
		expect(
			f.records.has("session:" + digest(result.cookie.split("=")[1] ?? "")),
		).toBe(false);
	});
	it("cannot begin an AI grant without verified identity or expose an owner-funded fallback", async () => {
		const f = fixture();
		expect(
			(await f.service().handle(f.request("/connections/openrouter/start")))
				.status,
		).toBe(401);
		expect(
			(await (await f.service().handle(f.request("/api/session"))).json())
				.aiAvailable,
		).toBe(false);
		expect(
			(await f.service().handle(f.request("/api/ai/jobs", { method: "POST" })))
				.status,
		).toBe(404);
	});
});

describe("account recovery and funding verification", () => {
	it("requires an exact secure origin, with explicit loopback-only development HTTP", () => {
		expect(accountOrigin("https://goodbye.example/")).toBe("https://goodbye.example");
		for (const value of ["http://public.example", "http://100.75.73.10:5173", "http://localhost:5173", "https://user:password@example.invalid", "https://goodbye.example/path", "https://goodbye.example/?query=1", "ftp://localhost"])
			expect(() => accountOrigin(value)).toThrow();
		expect(accountOrigin("http://127.0.0.1:5173", true)).toBe("http://127.0.0.1:5173");
		expect(() => accountOrigin("http://public.example", true)).toThrow();
		const f = fixture();
		expect(() => f.service({ origin: "http://public.example" })).toThrow();
	});

	it("rejects malformed provider expiry, permission and payer fields, and preserves unknown metadata", () => {
		const base = fixture().providerData;
		for (const malformed of [{ expires_at: 123 }, { expires_at: "not a date" }, { is_provisioning_key: "false" }, { include_byok_in_limit: null }, { workspace_id: 7 }, { creator_user_id: [] }, { limit_remaining: "4" }])
			expect(keyAllowance({ ...base, ...malformed }).state).toBe("invalid");
		expect(keyAllowance(base).state).toBe("usable");
		expect(keyAllowance({ ...base, workspace_id: null })).toMatchObject({ state: "metadata_required", bindingState: "unknown" });
	});

	it("consumes concurrent identity callbacks once and handles canceled/expired transactions", async () => {
		const f = fixture();
		const start = await f.service().handle(f.request("/auth/login"));
		const bound = f.cookieFrom(start);
		const exchange = vi.spyOn(f.identity, "exchange");
		const responses = await Promise.all([f.service(), f.service()].map((service) => service.handle(f.request("/auth/callback?code=valid&state=synthetic-state", { headers: { cookie: bound } }))));
		expect(responses.map((response) => response.status).sort()).toEqual([303, 400]);
		expect(exchange).toHaveBeenCalledTimes(1);
		const denied = await f.service().handle(f.request("/auth/login"));
		const denial = await f.service().handle(f.request("/auth/callback?error=access_denied", { headers: { cookie: f.cookieFrom(denied) } }));
		expect(denial.headers.get("location")).toBe("/account?result=denied");
		const old = await f.service().handle(f.request("/auth/login"));
		const transaction = [...f.records.entries()].find(([key]) => key.startsWith("transaction:"))!;
		const data = decrypt<Record<string, unknown>>(transaction[1], password);
		f.records.set(transaction[0], encrypt({ ...data, expiresAt: Date.now() - 1 }, password));
		expect((await f.service().handle(f.request("/auth/callback?code=valid&state=synthetic-state", { headers: { cookie: f.cookieFrom(old) } }))).status).toBe(400);
	});

	it("serializes concurrent refresh, persists its seal and retains the original app expiry", async () => {
		const f = fixture(); const login = await f.login();
		const key = [...f.records.keys()].find((value) => value.startsWith("session:"))!;
		const original = decrypt<{ sealed: string; expiresAt: number }>(f.records.get(key)!, password);
		let enter!: () => void; let finish!: () => void;
		const entered = new Promise<void>((resolve) => { enter = resolve; });
		const gate = new Promise<void>((resolve) => { finish = resolve; });
		const verify = vi.spyOn(f.identity, "verify").mockImplementation(async (sealed) => {
			enter(); await gate;
			return { account: login.info.account, sealed: sealed === "sealed-account-a" ? "sealed-refreshed" : sealed };
		});
		const first = f.service().handle(f.request("/api/session", { headers: { cookie: login.cookie } }));
		await entered;
		const competing = await f.service().handle(f.request("/api/session", { headers: { cookie: login.cookie } }));
		expect(competing.status).toBe(503); expect(verify).toHaveBeenCalledTimes(1);
		finish(); expect((await first).status).toBe(200);
		expect(decrypt(f.records.get(key)!, password)).toMatchObject({ sealed: "sealed-refreshed", expiresAt: original.expiresAt });
		await f.service().handle(f.request("/api/session", { headers: { cookie: login.cookie } }));
		expect(verify).toHaveBeenLastCalledWith("sealed-refreshed");
	});

	it("retains app state on a transient identity outage, but rejects terminal or changed-owner authority", async () => {
		const f = fixture(); const login = await f.login();
		const verify = vi.spyOn(f.identity, "verify");
		verify.mockRejectedValueOnce(new Error("JWKS unavailable"));
		expect((await f.service().handle(f.request("/api/session", { headers: { cookie: login.cookie } }))).status).toBe(503);
		expect([...f.records.keys()].some((key) => key.startsWith("session:"))).toBe(true);
		verify.mockResolvedValueOnce({ account: { ...login.info.account, id: "other-owner" }, sealed: "other-seal" });
		expect((await (await f.service().handle(f.request("/api/session", { headers: { cookie: login.cookie } }))).json()).account).toBeNull();
		expect([...f.records.keys()].some((key) => key.startsWith("session:"))).toBe(false);
	});

	it("does not accept verification after its distributed lease was lost", async () => {
		const f = fixture(); const login = await f.login();
		vi.spyOn(f.identity, "verify").mockImplementation(async (sealed) => {
			for (const key of f.records.keys()) if (key.startsWith("verify:")) f.records.delete(key);
			return { account: login.info.account, sealed };
		});
		expect((await f.service().handle(f.request("/api/session", { headers: { cookie: login.cookie } }))).status).toBe(503);
	});

	it("records provider funding identity and rejects later workspace or billing changes", async () => {
		const f = fixture(); const login = await f.login(); const grant = await f.grant(login.cookie);
		const connected = await f.service().handle(f.request(grant.path, { headers: { cookie: grant.bound } }));
		expect(connected.headers.get("location")).toBe("/account?result=connected");
		const stored = f.records.get("connection:owner-a")!;
		expect(stored).not.toContain("sk-or-synthetic-only");
		expect(decrypt(stored, password)).toMatchObject({ providerBinding: { workspaceId: "synthetic-workspace", creatorUserId: "synthetic-provider-owner", organizationId: null, byokIncluded: true, bindingState: "known" } });
		const info = async () => (await (await f.service().handle(f.request("/api/session", { headers: { cookie: login.cookie } }))).json()).connection;
		expect((await info()).state).toBe("usable");
		f.setProviderData({ ...f.providerData, workspace_id: "different-workspace" });
		expect((await info()).state).toBe("binding_mismatch");
		f.setProviderUnavailable(true);
		expect(await info()).toEqual({ provider: "OpenRouter", state: "provider_unavailable" });
		f.setProviderUnavailable(false);
		f.setProviderData({ ...f.providerData, include_byok_in_limit: false });
		expect((await info()).state).toBe("binding_mismatch");
	});

	it("disconnect invalidates a pending grant and account switching cannot attach it", async () => {
		const f = fixture(); const login = await f.login(); const grant = await f.grant(login.cookie);
		const disconnected = await f.service().handle(f.request("/connections/openrouter/disconnect", { method: "POST", headers: { cookie: login.cookie, origin: "https://goodbye.example", "x-csrf-token": login.info.csrf } }));
		expect(disconnected.status).toBe(200);
		expect((await f.service().handle(f.request(grant.path, { headers: { cookie: grant.bound } }))).headers.get("location")).toBe("/account?result=failed");
		expect(f.records.has("connection:owner-a")).toBe(false);
		const later = await f.grant(login.cookie);
		const other = await f.login();
		const switchedCookie = other.cookie + "; " + later.bound.split("; ").filter((value) => value.startsWith("__Host-gc_openrouter=")).join("; ");
		// A replacement session for a different owner is rejected before provider exchange.
		vi.spyOn(f.identity, "verify").mockResolvedValue({ account: { ...login.info.account, id: "owner-b" }, sealed: "sealed-account-a" });
		expect((await f.service().handle(f.request(later.path, { headers: { cookie: switchedCookie } }))).status).toBe(401);
		expect(f.records.has("connection:owner-a")).toBe(false);
	});
});
