import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
	timingSafeEqual,
} from "node:crypto";
export function token(): string {
	return randomBytes(32).toString("base64url");
}
export function digest(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}
export function sameSecret(a: string, b: string): boolean {
	const left = Buffer.from(a);
	const right = Buffer.from(b);
	return left.length === right.length && timingSafeEqual(left, right);
}
export function encrypt(value: unknown, password: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv(
		"aes-256-gcm",
		createHash("sha256").update(password).digest(),
		iv,
	);
	const encrypted = Buffer.concat([
		cipher.update(JSON.stringify(value), "utf8"),
		cipher.final(),
	]);
	return [iv, cipher.getAuthTag(), encrypted]
		.map((v) => v.toString("base64url"))
		.join(".");
}
export function decrypt<T>(value: string, password: string): T {
	const [iv, tag, payload] = value
		.split(".")
		.map((v) => Buffer.from(v, "base64url"));
	if (!iv || !tag || !payload) throw new Error("Invalid protected record");
	const cipher = createDecipheriv(
		"aes-256-gcm",
		createHash("sha256").update(password).digest(),
		iv,
	);
	cipher.setAuthTag(tag);
	return JSON.parse(
		Buffer.concat([cipher.update(payload), cipher.final()]).toString("utf8"),
	) as T;
}
export function cookies(request: Request): Record<string, string> {
	const result: Record<string, string> = Object.create(null);
	for (const pair of (request.headers.get("cookie") ?? "").split(";")) {
		const position = pair.indexOf("=");
		if (position < 1) continue;
		try {
			result[pair.slice(0, position).trim()] = decodeURIComponent(
				pair.slice(position + 1),
			);
		} catch {
			/* Invalid cookies cannot establish authority. */
		}
	}
	return result;
}
export function returnPath(value: string | null): string {
	const allowed = [
		"/welcome",
		"/year-room",
		"/assistant",
		"/account",
		"/request",
	];
	return value && allowed.includes(value) ? value : "/account";
}
export function accountOrigin(value: string, allowLoopbackHttp = false): string {
	const url = new URL(value);
	const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
	if (url.username || url.password || url.pathname !== "/" || url.search || url.hash
		|| (url.protocol !== "https:" && !(allowLoopbackHttp && loopback && url.protocol === "http:")))
		throw new Error("Account origin requires HTTPS, or explicitly enabled loopback development HTTP");
	return url.origin;
}
export interface KeyAllowance {
	limit: number | null;
	remaining: number | null;
	expiresAt: string | null;
	management: boolean;
	provisioning: boolean;
	byokIncluded: boolean | null;
	workspaceId: string | null;
	creatorUserId: string | null;
	organizationId: string | null;
	bindingState: "known" | "unknown";
	state: "usable" | "cap_required" | "depleted" | "expired" | "invalid" | "metadata_required";
}
export function keyAllowance(input: unknown, now = Date.now()): KeyAllowance {
	const raw =
		input && typeof input === "object" && !Array.isArray(input)
			? (input as Record<string, unknown>)
			: {};
	const finite = (value: unknown) =>
		typeof value === "number" && Number.isFinite(value) && value >= 0
			? value
			: null;
	const limit = finite(raw.limit);
	const remaining = finite(raw.limit_remaining);
	const expiresAt = typeof raw.expires_at === "string" ? raw.expires_at : null;
	const expiry = expiresAt ? Date.parse(expiresAt) : null;
	const management = raw.is_management_key !== false;
	const provisioning = raw.is_provisioning_key === true;
	const identifier = (value: unknown) => typeof value === "string" && value.trim() && value.length <= 200 ? value : null;
	const workspaceId = identifier(raw.workspace_id);
	const creatorUserId = identifier(raw.creator_user_id);
	const organizationId = identifier(raw.organization_id);
	const byokIncluded = typeof raw.include_byok_in_limit === "boolean" ? raw.include_byok_in_limit : null;
	const suppliedInvalid = (key: string, valid: (value: unknown) => boolean) => raw[key] !== undefined && raw[key] !== null && !valid(raw[key]);
	const bindingState = workspaceId && creatorUserId && byokIncluded !== null && raw.organization_id !== undefined ? "known" : "unknown";
	let state: KeyAllowance["state"] = "usable";
	if (
		management ||
		provisioning ||
		typeof raw.is_provisioning_key !== "boolean" ||
		(expiry !== null && !Number.isFinite(expiry)) ||
		suppliedInvalid("expires_at", (value) => typeof value === "string" && Boolean(value.trim()) && Number.isFinite(Date.parse(value))) ||
		["is_management_key", "is_provisioning_key", "include_byok_in_limit", "is_free_tier"].some((key) => raw[key] !== undefined && typeof raw[key] !== "boolean") ||
		["workspace_id", "creator_user_id", "organization_id"].some((key) => suppliedInvalid(key, (value) => identifier(value) !== null)) ||
		["limit", "limit_remaining"].some((key) => suppliedInvalid(key, (value) => finite(value) !== null))
	)
		state = "invalid";
	else if (expiry !== null && expiry <= now) state = "expired";
	else if (limit === null || remaining === null) state = "cap_required";
	else if (limit === 0 || remaining === 0) state = "depleted";
	else if (bindingState === "unknown") state = "metadata_required";
	return {
		limit,
		remaining,
		expiresAt,
		management,
		provisioning,
		byokIncluded,
		workspaceId,
		creatorUserId,
		organizationId,
		bindingState,
		state,
	};
}
