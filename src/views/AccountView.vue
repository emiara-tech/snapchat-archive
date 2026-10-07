<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
interface Connection {
	state: string;
	limit?: number | null;
	remaining?: number | null;
	expiresAt?: string | null;
	settingsUrl?: string;
	provider: string;
	providerBinding?: { bindingState: string; workspaceId?: string | null; creatorUserId?: string | null; organizationId?: string | null; byokIncluded?: boolean | null };
}
interface AccountStatus {
	available: boolean;
	account: { id: string; email: string; name: string | null } | null;
	csrf?: string;
	connection?: Connection | null;
	aiAvailable?: boolean;
	chatgptAvailable?: boolean;
}
const status = ref<AccountStatus | null>(null);
const loading = ref(false);
const error = ref("");
const route = useRoute();
const outcome = computed(() => ({
	denied: "You canceled the connection. Your local archive is ready to use; retry whenever you choose.",
	failed: "The connection could not be verified. Sign in again or retry the allowance connection. No AI request was made.",
	connected: "Your allowance connection was saved. Check its current verification below before using account features.",
})[String(route.query.result)] ?? "");
async function refresh() {
	loading.value = true;
	error.value = "";
	status.value = null;
	try {
		const response = await fetch("/api/session", {
			credentials: "same-origin",
			headers: { Accept: "application/json" },
		});
		if (
			!response.ok ||
			!response.headers.get("content-type")?.includes("application/json")
		)
			throw new Error(
				"Account connections are not available here yet. Your local archive still works.",
			);
		status.value = (await response.json()) as AccountStatus;
	} catch (e) {
		error.value =
			e instanceof Error
				? e.message
				: "Could not check your account. Try again.";
	} finally {
		loading.value = false;
	}
}
async function change(path: string) {
	loading.value = true;
	error.value = "";
	try {
		const response = await fetch(path, {
			method: "POST",
			credentials: "same-origin",
			headers: {
				"X-CSRF-Token": status.value?.csrf ?? "",
				Accept: "application/json",
			},
		});
		if (!response.ok)
			throw new Error(
				"Your account change did not finish. Check the connection and try again.",
			);
		const result = (await response.json()) as { logoutUrl?: string | null; signedOut?: boolean; disconnected?: boolean };
		if (result.signedOut) status.value = { available: true, account: null, connection: null };
		else if (result.disconnected && status.value) status.value = { ...status.value, connection: null };
		if (result.logoutUrl) {
			window.location.assign(result.logoutUrl);
			return;
		}
		await refresh();
	} catch (e) {
		error.value = e instanceof Error ? e.message : "The account change failed.";
	} finally {
		loading.value = false;
	}
}
const stateLabel = (state: string) =>
	({
		usable: "Finite key allowance verified",
		cap_required: "Set a finite cap before AI use",
		depleted: "Key allowance depleted",
		expired: "Connection expired",
		invalid: "Connection cannot authorize AI",
		provider_unavailable: "Provider allowance could not be checked",
		metadata_required: "Provider funding identity has not been established",
		binding_mismatch: "The provider funding identity changed; reconnect to verify it",
	})[state] ?? "Connection unavailable";
onMounted(refresh);
</script>
<template>
	<div class="page">
		<div class="container account-page">
			<header>
				<span class="eyebrow">Separate permissions, clear choices</span>
				<h1>Your account.<br />Your allowance.</h1>
				<p>
					Local archive tools work without signing in. Account identity and
					permission to fund AI are separate connections.
				</p>
			</header>
			<p v-if="loading" role="status">Checking your account connection…</p>
			<p v-if="outcome" role="status" class="availability">{{ outcome }}</p>
			<p v-if="error" role="alert" class="account-error">{{ error }}</p>
			<div class="account-grid">
				<section class="card">
					<span class="account-number">01 / IDENTITY</span>
					<h2>
						{{
							status?.account
								? "You are signed in"
								: "A place for account features"
						}}
					</h2>
					<p v-if="status?.account">
						{{ status.account.name || status.account.email }}
					</p>
					<p v-else>
						Sign-in identifies your account. Your imported ZIPs stay on this
						device.
					</p>
					<a
						v-if="status?.available && !status.account"
						href="/auth/login"
						class="btn btn-primary"
						>Sign in securely ↗</a
					><button
						v-if="status?.account"
						@click="change('/auth/logout')"
						:disabled="loading"
						class="btn btn-secondary"
					>
						Sign out
					</button>
					<p v-if="status && !status.available" class="availability">
						Account connections aren't available in this environment yet.
					</p>
				</section>
				<section class="card">
					<span class="account-number">02 / AI ALLOWANCE</span>
					<h2>You choose who pays.</h2>
					<template v-if="status?.connection"
						><p class="connection-label">
							{{ status.connection.provider }} ·
							{{ stateLabel(status.connection.state) }}
						</p>
						<div
							class="allowance-values"
							v-if="status.connection.limit != null"
						>
							<div>
								<strong>${{ status.connection.limit.toFixed(2) }}</strong
								><span>Provider key cap</span>
							</div>
							<div>
								<strong>{{
									status.connection.remaining != null
										? "$" + status.connection.remaining.toFixed(2)
										: "Unknown"
								}}</strong
								><span>Reported remaining key allowance</span>
							</div>
						</div>
						<p>
							This is your dedicated key's allowance, not your whole account
							balance. App budgets do not change the provider's cap.
						</p>
						<p v-if="status.connection.providerBinding?.bindingState === 'known'">
							Recorded OpenRouter workspace: {{ status.connection.providerBinding.workspaceId }}.
							This provider connection has its own funding identity.
						</p>
						<p v-if="status.connection.expiresAt">Connection expiry: {{ status.connection.expiresAt }}.</p>
						<a
							v-if="status.connection.settingsUrl"
							:href="status.connection.settingsUrl"
							target="_blank"
							rel="noopener noreferrer"
							>Review your key cap on OpenRouter ↗</a
						><button
							@click="change('/connections/openrouter/disconnect')"
							:disabled="loading"
							class="btn btn-secondary"
						>
							Disconnect this allowance</button
						><small
							>Disconnect removes the app's stored credential. Revoke the key on
							the provider to remove its remote access.</small
						></template
					><template v-else
						><p>
							Connect your own OpenRouter allowance after signing in. AI
							requests require a finite provider cap, a bounded budget, and your
							approval of the content sent.
						</p>
						<a
							v-if="status?.available && status.account"
							href="/connections/openrouter/start"
							class="btn btn-primary"
							>Connect my OpenRouter account ↗</a
						>
						<p v-else class="availability">
							{{
								status?.available
									? "Sign in to connect your allowance."
									: "Funded AI connections are not available here yet."
							}}
						</p></template
					>
				</section>
			</div>
			<section class="permission-note">
				<h3>Your archive has its own permissions.</h3>
				<p>
					Signing in or connecting an allowance does not send your archive to
					AI. Enabled AI features show their evidence packet and recipients
					before asking for permission. There is no shared production AI key or
					automatic paid fallback.
				</p>
				<p>
					Live dialogue and genuine ChatGPT website sign-in remain unavailable
					until their access and verification gates pass.
				</p>
				<router-link to="/import"
					>Open an archive without an account ↗</router-link
				>
			</section>
			<button @click="refresh" :disabled="loading" class="btn btn-ghost">
				Check account status again
			</button>
		</div>
	</div>
</template>
<style scoped>
.account-page {
	max-width: 1100px;
}
.account-page header {
	margin-bottom: 38px;
}
.account-page h1 {
	font-size: 4.5rem;
	letter-spacing: -0.04em;
	line-height: 1.08;
	margin: 18px 0 25px;
}
.account-page header p {
	max-width: 580px;
	color: var(--text-soft);
}
.account-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 24px;
}
.account-grid .card {
	padding: 32px;
	display: grid;
	align-content: start;
	justify-items: start;
	gap: 20px;
}
.account-number {
	font-size: 0.65rem;
	letter-spacing: 0.1em;
	color: var(--secondary);
}
.account-grid h2 {
	font: 500 2rem/1.15 var(--font-serif);
}
.account-grid p {
	font-size: 0.85rem;
	color: var(--text-soft);
	line-height: 1.8;
}
.account-grid .btn {
	font-size: 0.8rem;
}
.availability {
	background: #eee7d6;
	padding: 14px;
	border-radius: 5px;
}
.account-grid a:not(.btn) {
	font-size: 0.75rem;
	color: var(--secondary);
}
.account-grid small {
	font-size: 0.7rem;
	color: var(--text-soft);
}
.allowance-values {
	display: flex;
	gap: 25px;
}
.allowance-values div {
	display: grid;
	gap: 5px;
}
.allowance-values strong {
	font: 500 2rem var(--font-serif);
	color: var(--secondary);
}
.allowance-values span {
	font-size: 0.7rem;
	color: var(--text-soft);
}
.permission-note {
	margin-top: 30px;
	padding: 30px;
	border: 1px solid var(--border);
	border-radius: 6px;
}
.permission-note h3 {
	font-family: var(--font-serif);
	font-size: 1.5rem;
}
.permission-note p {
	margin-top: 16px;
	font-size: 0.85rem;
	color: var(--text-soft);
	line-height: 1.8;
}
.permission-note a {
	display: inline-block;
	color: var(--secondary);
	font-size: 0.78rem;
	margin-top: 20px;
}
.account-error {
	color: var(--danger);
	padding-bottom: 20px;
}
@media (max-width: 850px) {
	.account-grid {
		grid-template-columns: 1fr;
	}
	.account-page h1 {
		font-size: 3.4rem;
	}
}
</style>
