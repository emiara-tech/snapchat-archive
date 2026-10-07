import { describe, expect, it, vi } from "vitest";
import { WorkOS } from "@workos-inc/node";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { workosIdentityFromSdk } from "../server/identity";

const clientId = "client_synthetic";
const issuer = `https://api.workos.com/user_management/${clientId}`;
const password = "synthetic identity cookie password over 32 characters";

async function fixture() {
	const pair = await generateKeyPair("RS256");
	const wrongPair = await generateKeyPair("RS256");
	const jwk = await exportJWK(pair.publicKey);
	const sdk = new WorkOS("sk_test_synthetic", { clientId, issuer, maxRetries: 0 });
	vi.spyOn(sdk.userManagement, "getJWKS").mockResolvedValue(createLocalJWKSet({ keys: [jwk] }));
	let nextToken = "";
	const post = vi.spyOn(sdk, "post").mockImplementation(async () => ({
		data: {
			user: { object: "user", id: "user_synthetic", email: "owner@example.invalid", email_verified: true,
				first_name: "Synthetic", last_name: "Owner", profile_picture_url: null, created_at: "2020-01-01T00:00:00Z", updated_at: "2020-01-01T00:00:00Z" },
			access_token: nextToken, refresh_token: "synthetic-refresh", authentication_method: "Password",
		},
	}));
	const identity = workosIdentityFromSdk(sdk, clientId, password);
	async function jwt(options: { expired?: boolean; wrongIssuer?: boolean; wrongSignature?: boolean; wrongOwner?: boolean } = {}) {
		return new SignJWT({ sid: "session_synthetic" }).setProtectedHeader({ alg: "RS256" })
			.setIssuer(options.wrongIssuer ? "https://different.example/issuer" : issuer)
			.setSubject(options.wrongOwner ? "different-user" : "user_synthetic")
			.setIssuedAt().setExpirationTime(Math.floor(Date.now() / 1000) + (options.expired ? -60 : 600))
			.sign(options.wrongSignature ? wrongPair.privateKey : pair.privateKey);
	}
	async function seal(options: Parameters<typeof jwt>[0] = {}) {
		nextToken = await jwt(options);
		// Run actual SDK serialization/sealing. No HTTP or paid provider is called.
		const result = await sdk.userManagement.authenticateWithCode({ clientId, code: "synthetic", session: { sealSession: true, cookiePassword: password } });
		return result.sealedSession!;
	}
	return { sdk, identity, jwt, seal, post, replace: async (options: Parameters<typeof jwt>[0] = {}) => { nextToken = await jwt(options); } };
}

describe("actual WorkOS adapter seal verification", () => {
	it("verifies a newly exchanged seal and refuses wrong issuer, signature and owner", async () => {
		const f = await fixture();
		await f.replace();
		expect((await f.identity.exchange("synthetic", "verifier")).account.id).toBe("user_synthetic");
		for (const invalid of [{ wrongIssuer: true }, { wrongSignature: true }, { wrongOwner: true }, { expired: true }]) {
			await f.replace(invalid);
			await expect(f.identity.exchange("synthetic", "verifier")).rejects.toThrow("verification failed");
		}
	});

	it("never refreshes a wrong issuer or invalid signature", async () => {
		const f = await fixture();
		for (const invalid of [{ wrongIssuer: true }, { wrongSignature: true }]) {
			const sealed = await f.seal(invalid);
			const calls = f.post.mock.calls.length;
			expect(await f.identity.verify(sealed)).toBeNull();
			expect(f.post.mock.calls).toHaveLength(calls);
		}
	});

	it("refreshes genuine expiry and verifies the replacement before returning identity", async () => {
		const f = await fixture();
		const expired = await f.seal({ expired: true });
		await f.replace();
		const fresh = await f.identity.verify(expired);
		expect(fresh?.account.id).toBe("user_synthetic");
		expect(fresh?.sealed).not.toBe(expired);
		expect(await f.identity.verify(fresh!.sealed)).toEqual(fresh);
		for (const invalid of [{ wrongIssuer: true }, { wrongSignature: true }, { wrongOwner: true }, { expired: true }]) {
			await f.replace(invalid);
			expect(await f.identity.verify(expired)).toBeNull();
		}
	});

	it("distinguishes temporary JWKS failure from invalid sealed authority", async () => {
		const f = await fixture();
		const sealed = await f.seal();
		vi.mocked(f.sdk.userManagement.getJWKS).mockRejectedValue(new Error("synthetic outage"));
		await expect(f.identity.verify(sealed)).rejects.toThrow();
		expect(await f.identity.verify("forged encrypted cookie")).toBeNull();
	});
});
