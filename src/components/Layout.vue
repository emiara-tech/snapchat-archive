<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useArchiveStore } from "../stores/archive";
import { useWorkspaceStore } from "../stores/workspace";
const route = useRoute();
const router = useRouter();
const archive = useArchiveStore();
const workspace = useWorkspaceStore();
const menuOpen = ref(false);
const hasWorkspace = computed(
	() => archive.isImported || Boolean(workspace.dataset),
);
const isLandingPage = computed(() => route.path === "/" && !hasWorkspace.value);
const archiveNav = [
	{ path: "/welcome", label: "Overview" },
	{ path: "/conversations", label: "Conversations" },
	{ path: "/library", label: "Library" },
	{ path: "/observatory", label: "Observatory" },
	{ path: "/year-room", label: "Past self" },
	{ path: "/assistant", label: "Guide" },
	{ path: "/export", label: "Export" },
];
const nav = computed(() =>
	hasWorkspace.value
		? archiveNav
		: [
				{ path: "/request", label: "Get your archive" },
				{ path: "/privacy", label: "Privacy" },
				{ path: "/account", label: "Account" },
			],
);
watch(
	() => archive.isImported,
	(current, previous) => {
		if (previous && !current) workspace.reset();
	},
);
function navigate(path: string) {
	menuOpen.value = false;
	void router.push(path);
}
function reset() {
	workspace.reset();
	archive.resetArchive();
	navigate("/");
}
</script>
<template>
	<div class="layout" :class="{ 'in-workspace': hasWorkspace }">
		<header class="header" :class="{ transparent: isLandingPage }">
			<div class="header-inner">
				<router-link to="/" class="logo" aria-label="Goodbye Chat home"
					><span class="logo-mark" aria-hidden="true">✳</span
					><span class="logo-text"
						><strong>goodbye<span>chat</span></strong
						><small>Your life. Still yours.</small></span
					></router-link
				>
				<nav class="nav-desktop" aria-label="Main navigation">
					<router-link
						v-for="item in nav"
						:key="item.path"
						:to="item.path"
						class="nav-link"
						:class="{ active: route.path === item.path }"
						:aria-current="route.path === item.path ? 'page' : undefined"
						>{{ item.label }}</router-link
					>
				</nav>
				<div class="header-actions">
					<button v-if="hasWorkspace" class="reset-btn" @click="reset">
						Start over <span aria-hidden="true">↗</span></button
					><router-link v-else to="/import" class="btn btn-secondary btn-sm"
						>Open my archive ↗</router-link
					>
				</div>
				<button
					class="mobile-menu-btn"
					@click="menuOpen = !menuOpen"
					:aria-label="menuOpen ? 'Close menu' : 'Open menu'"
					:aria-expanded="menuOpen"
				>
					<span aria-hidden="true">{{ menuOpen ? "×" : "☰" }}</span>
				</button>
			</div>
			<nav v-if="menuOpen" class="nav-mobile" aria-label="Compact navigation">
				<button
					v-for="item in nav"
					:key="item.path"
					@click="navigate(item.path)"
					class="nav-link"
				>
					{{ item.label }}</button
				><button v-if="hasWorkspace" @click="navigate('/privacy')" class="nav-link">Privacy</button
				><button @click="navigate('/import')" class="nav-link">
					Open import
				</button>
			</nav>
		</header>
		<main id="main" class="main"><slot /></main>
		<footer class="footer">
			<div class="footer-inner">
				<div>
					<strong>goodbyechat</strong>
					<p>Keep your history. Choose what comes with you.</p>
					<small>Independent project. Not affiliated with Snap Inc.</small>
				</div>
				<nav aria-label="Footer">
					<router-link to="/privacy">Privacy</router-link
					><router-link to="/request">Get your archive</router-link
					><router-link to="/import">Import</router-link>
				</nav>
				<span>Made for a proper goodbye.</span>
			</div>
		</footer>
	</div>
</template>
<style scoped>
.layout {
	min-height: 100vh;
	display: flex;
	flex-direction: column;
}
.header {
	position: sticky;
	top: 0;
	z-index: 40;
	backdrop-filter: blur(18px);
	background: color-mix(in srgb, var(--bg) 94%, transparent);
	border-bottom: 1px solid var(--border);
}
.header.transparent {
	position: absolute;
	width: 100%;
	background: transparent;
	border-color: transparent;
	backdrop-filter: none;
}
.header-inner {
	max-width: 1440px;
	margin: 0 auto;
	padding: 22px 42px;
	display: flex;
	align-items: center;
	gap: 20px;
	justify-content: space-between;
}
.logo {
	display: flex;
	align-items: center;
	gap: 10px;
	flex-shrink: 0;
}
.logo-mark {
	font-size: 2.5rem;
	color: var(--secondary);
	line-height: 1;
}
.logo-text {
	display: grid;
	gap: 2px;
	line-height: 1.2;
}
.logo-text strong {
	font-size: 1.22rem;
	letter-spacing: -0.065em;
	font-weight: 700;
}
.logo-text strong span {
	font-weight: 400;
}
.logo-text small {
	color: var(--text-soft);
	font-size: 0.63rem;
	letter-spacing: 0.02em;
}
.nav-desktop {
	display: flex;
	gap: 3px;
	margin-left: auto;
	align-items: center;
}
.nav-desktop .nav-link {
	font-size: 0.72rem;
	border-radius: 4px;
	padding: 8px 11px;
}
.nav-link.active {
	background: var(--secondary-soft);
	color: var(--secondary);
}
.header-actions {
	display: flex;
}
.btn-sm {
	padding: 10px 17px;
	font-size: 0.75rem;
}
.reset-btn {
	border: 0;
	background: none;
	display: flex;
	align-items: center;
	gap: 12px;
	font-size: 0.72rem;
	color: var(--text-soft);
	white-space: nowrap;
}
.reset-btn:hover {
	color: var(--secondary);
}
.mobile-menu-btn {
	display: none;
	background: none;
	border: 0;
	color: var(--text);
	font-size: 1.5rem;
}
.nav-mobile {
	display: grid;
	padding: 8px 24px 18px;
}
.nav-mobile .nav-link {
	text-align: left;
}
.main {
	flex: 1;
	display: flex;
	flex-direction: column;
}




.footer {
	border-top: 1px solid var(--border);
	background: #eee9dd;
}
.footer-inner {
	max-width: 1200px;
	margin: auto;
	padding: 35px 24px;
	display: flex;
	gap: 35px;
	align-items: center;
	justify-content: space-between;
	color: var(--text-soft);
	font-size: 0.74rem;
}
.footer-inner strong {
	color: var(--text);
	font-size: 1rem;
	letter-spacing: -0.04em;
}
.footer-inner p {
	margin-top: 8px;
}
.footer-inner small {
	display: block;
	margin-top: 10px;
	font-size: 0.67rem;
}
.footer-inner nav {
	display: flex;
	gap: 20px;
}
.footer-inner > span {
	font-family: var(--font-serif);
	font-style: italic;
	font-size: 1rem;
}
.in-workspace :deep(.page) {
	padding-top: 54px;
}
@media (max-width: 1100px) {
	.header-inner {
		padding-inline: 24px;
		gap: 10px;
	}
	.nav-desktop .nav-link {
		padding-inline: 8px;
		font-size: 0.68rem;
	}
	.logo-text small {
		display: none;
	}
	.header-actions {
		display: none;
	}
}
@media (max-width: 900px) {
	.nav-desktop,
	.header-actions {
		display: none;
	}
	.mobile-menu-btn {
		display: block;
	}
	.header-inner {
		padding: 18px 24px;
	}
	.footer-inner {
		align-items: flex-start;
		flex-direction: column;
		gap: 18px;
	}

}
</style>
