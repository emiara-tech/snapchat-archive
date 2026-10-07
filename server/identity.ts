import { WorkOS } from "@workos-inc/node";
import { errors, jwtVerify } from "jose";
export interface VerifiedAccount {
	id: string;
	email: string;
	name: string | null;
}
export interface IdentityProvider {
	start(
		callback: string,
	): Promise<{ url: string; state: string; verifier: string }>;
	exchange(
		code: string,
		verifier: string,
	): Promise<{ account: VerifiedAccount; sealed: string }>;
	verify(
		sealed: string,
	): Promise<{ account: VerifiedAccount; sealed: string } | null>;
	logout(sealed: string, returnTo: string): Promise<string>;
}
export function workosIdentity(
	apiKey: string,
	clientId: string,
	password: string,
): IdentityProvider {
	const sdk = new WorkOS(apiKey, {
		clientId,
		issuer: `https://api.workos.com/user_management/${clientId}`,
		maxRetries: 0,
		timeout: 15000,
	});
	return workosIdentityFromSdk(sdk, clientId, password);
}

/** The injected SDK boundary also permits real seal/JWT verification in synthetic tests. */
export function workosIdentityFromSdk(sdk: WorkOS, clientId: string, password: string): IdentityProvider {
	const issuer = `https://api.workos.com/user_management/${clientId}`;
	const account = (user: {
		id: string;
		email: string;
		firstName: string | null;
		lastName: string | null;
	}): VerifiedAccount => ({
		id: user.id,
		email: user.email,
		name: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
	});
	async function validate(sealed: string): Promise<{ state: "valid" | "expired"; account: VerifiedAccount } | null> {
		let session;
		try { session = await sdk.userManagement.getSessionFromCookie({ sessionData: sealed, cookiePassword: password }); }
		catch { return null; }
		if (!session?.accessToken || !session.user?.id || !session.user.email) return null;
		const jwks = await sdk.userManagement.getJWKS();
		if (!jwks) throw new Error("Identity verification unavailable");
		try {
			const { payload } = await jwtVerify(session.accessToken, jwks, { issuer, requiredClaims: ["exp", "sub", "sid"] });
			if (payload.sub !== session.user.id) return null;
			return { state: "valid", account: account(session.user) };
		} catch (error) {
			// Expiry is refreshable only after the signature and issuer have passed verification.
			if (error instanceof errors.JWTExpired && error.claim === "exp" && error.payload.sub === session.user.id)
				return { state: "expired", account: account(session.user) };
			if (error instanceof errors.JWTClaimValidationFailed || error instanceof errors.JWSSignatureVerificationFailed
				|| error instanceof errors.JWSInvalid || error instanceof errors.JWTInvalid || error instanceof errors.JWKSNoMatchingKey)
				return null;
			throw new Error("Identity verification temporarily unavailable");
		}
	}
	return {
		async start(callback) {
			const result = await sdk.userManagement.getAuthorizationUrlWithPKCE({
				provider: "authkit",
				clientId,
				redirectUri: callback,
			});
			return {
				url: result.url,
				state: result.state,
				verifier: result.codeVerifier,
			};
		},
		async exchange(code, verifier) {
			const result = await sdk.userManagement.authenticateWithCode({
				clientId,
				code,
				codeVerifier: verifier,
				session: { sealSession: true, cookiePassword: password },
			});
			if (!result.sealedSession) throw new Error("Session could not be sealed");
			const checked = await validate(result.sealedSession);
			if (checked?.state !== "valid" || checked.account.id !== result.user.id) throw new Error("Identity verification failed");
			return { account: checked.account, sealed: result.sealedSession };
		},
		async verify(sealed) {
			const original = await validate(sealed);
			if (!original) return null;
			if (original.state === "valid") return { account: original.account, sealed };
			const session = sdk.userManagement.loadSealedSession({
				sessionData: sealed,
				cookiePassword: password,
			});
			const refreshed = await session.refresh();
			if (!refreshed.authenticated && refreshed.retryable) throw new Error("Identity verification temporarily unavailable");
			if (!refreshed.authenticated || !refreshed.sealedSession) return null;
			const checked = await validate(refreshed.sealedSession);
			if (checked?.state !== "valid" || checked.account.id !== original.account.id) return null;
			return {
				account: checked.account,
				sealed: refreshed.sealedSession,
			};
		},
		logout(sealed, returnTo) {
			return sdk.userManagement
				.loadSealedSession({ sessionData: sealed, cookiePassword: password })
				.getLogoutUrl({ returnTo });
		},
	};
}
