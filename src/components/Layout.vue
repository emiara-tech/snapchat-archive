<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useArchiveStore } from "../stores/archive";

const route = useRoute();
route.fullPath;
const router = useRouter();
const store = useArchiveStore();

const isMobileMenuOpen = ref(false);

// Only active after archive upload
const archiveNavItems = [
	{ path: "/dashboard", label: "Recap" },
	{ path: "/photos", label: "Review" },
	{ path: "/summary", label: "Story" },
	{ path: "/export", label: "Export" },
	{ path: "/privacy", label: "Privacy" },
];

const publicNavItems = [{ path: "/privacy", label: "Privacy" }];

const currentYear = new Date().getFullYear();
const isLandingPage = computed(() => route.path === "/" && !store.isImported);
const activeNavItems = computed(() =>
	store.isImported ? archiveNavItems : publicNavItems,
);

function navigateTo(path: string) {
	router.push(path);
	isMobileMenuOpen.value = false;
}

function resetArchive() {
	store.resetArchive();
	navigateTo("/");
}
</script>

<template>
	<div class="layout">
		<header class="header" :class="{ transparent: isLandingPage }">
			<div class="header-inner">
				<router-link to="/" class="logo">
					<span class="logo-mark" aria-hidden="true">GS</span>
					<span class="logo-text">
						<strong>Goodbye Chat</strong>
						<small>Local takeout recap</small>
					</span>
				</router-link>

				<nav class="nav-desktop">
					<button
						v-for="item in activeNavItems"
						:key="item.path"
						class="nav-link"
						:class="{ active: route.path === item.path }"
						@click="navigateTo(item.path)"
					>
						{{ item.label }}
					</button>
				</nav>

				<div class="header-actions">
					<button
						v-if="!store.isImported"
						class="btn btn-primary btn-sm"
						@click="navigateTo('/import')"
					>
						Load a zip
					</button>
					<button v-else class="btn btn-secondary btn-sm" @click="resetArchive">
						Start over
					</button>
				</div>

				<button
					class="mobile-menu-btn"
					@click="isMobileMenuOpen = !isMobileMenuOpen"
					:aria-label="isMobileMenuOpen ? 'Close menu' : 'Open menu'"
				>
					<span class="hamburger" :class="{ open: isMobileMenuOpen }"></span>
				</button>
			</div>

			<Transition name="slide">
				<nav class="nav-mobile" v-if="isMobileMenuOpen">
					<button
						v-for="item in activeNavItems"
						:key="item.path"
						class="nav-link"
						:class="{ active: route.path === item.path }"
						@click="navigateTo(item.path)"
					>
						{{ item.label }}
					</button>
					<button
						v-if="!store.isImported"
						class="btn btn-primary"
						@click="navigateTo('/import')"
					>
						Open import
					</button>
				</nav>
			</Transition>
		</header>

		<main class="main">
			<slot />
		</main>

		<footer class="footer">
			<div class="footer-inner">
				<div class="footer-brand">
					<span class="footer-eyebrow">Goodbye Chat</span>
					<p class="footer-tagline">
						Review your takeout locally, inspect detected metadata, and export a
						JSON record you control.
					</p>
					<p class="footer-disclaimer">
						Independent tool. Not affiliated with, endorsed by, or sponsored by
						the platform that produced the archive.
					</p>
				</div>
				<nav class="footer-nav">
					<router-link to="/privacy">Privacy</router-link>
					<router-link to="/import">Import</router-link>
					<router-link to="/export">Export</router-link>
				</nav>
				<p class="footer-copy">
					{{ currentYear }} · Browser-only archive metadata review
				</p>
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
	background: color-mix(in srgb, var(--bg) 86%, transparent);
	border-bottom: 1px solid var(--border);
}

.header.transparent {
	position: absolute;
	width: 100%;
	background: transparent;
	border-bottom-color: transparent;
	backdrop-filter: none;
}

.header-inner {
	max-width: 1200px;
	margin: 0 auto;
	padding: 18px var(--space-lg);
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--space-md);
}

.logo {
	display: flex;
	align-items: center;
	gap: 12px;
	color: var(--text-h);
}

.logo-mark {
	width: 42px;
	height: 42px;
	border-radius: 14px;
	display: grid;
	place-items: center;
	font-size: 0.82rem;
	font-weight: 700;
	letter-spacing: 0.08em;
	background: linear-gradient(
		145deg,
		var(--accent) 0%,
		var(--accent-strong) 100%
	);
	color: #1c150d;
	box-shadow: var(--shadow-md);
}

.logo-text {
	display: flex;
	flex-direction: column;
	line-height: 1.05;
}

.logo-text strong {
	font-size: 1rem;
}

.logo-text small {
	color: var(--text-soft);
	font-size: 0.75rem;
}

.nav-desktop {
	display: flex;
	align-items: center;
	gap: 6px;
	margin-left: auto;
}

.header-actions {
	display: flex;
	align-items: center;
	gap: 10px;
}

.btn-sm {
	padding: 10px 16px;
	font-size: 0.88rem;
}

.mobile-menu-btn {
	display: none;
	width: 40px;
	height: 40px;
	background: none;
	border: none;
	align-items: center;
	justify-content: center;
}

.hamburger {
	position: relative;
	width: 20px;
	height: 2px;
	background: var(--text-h);
	transition: all var(--transition-fast);
}

.hamburger::before,
.hamburger::after {
	content: "";
	position: absolute;
	left: 0;
	width: 100%;
	height: 2px;
	background: var(--text-h);
	transition: all var(--transition-fast);
}

.hamburger::before {
	top: -6px;
}

.hamburger::after {
	bottom: -6px;
}

.hamburger.open {
	background: transparent;
}

.hamburger.open::before {
	top: 0;
	transform: rotate(45deg);
}

.hamburger.open::after {
	bottom: 0;
	transform: rotate(-45deg);
}

.nav-mobile {
	display: flex;
	flex-direction: column;
	gap: 6px;
	padding: 0 var(--space-lg) var(--space-lg);
}

.nav-mobile .nav-link {
	width: 100%;
	justify-content: flex-start;
	padding: 12px 14px;
	font-size: 1rem;
}

.main {
	flex: 1;
	display: flex;
	flex-direction: column;
}

.footer {
	border-top: 1px solid var(--border);
	background:
		radial-gradient(
			circle at top left,
			rgba(243, 203, 69, 0.16),
			transparent 28%
		),
		linear-gradient(180deg, rgba(30, 33, 27, 0.02), rgba(30, 33, 27, 0.08));
}

.footer-inner {
	max-width: 1200px;
	margin: 0 auto;
	padding: 28px var(--space-lg) 42px;
	display: grid;
	grid-template-columns: 1.4fr auto auto;
	gap: var(--space-lg);
	align-items: end;
}

.footer-eyebrow {
	display: inline-block;
	margin-bottom: 10px;
	font-size: 0.8rem;
	font-weight: 700;
	letter-spacing: 0.1em;
	text-transform: uppercase;
	color: var(--text-soft);
}

.footer-tagline {
	max-width: 520px;
	color: var(--text);
}

.footer-disclaimer {
	max-width: 560px;
	margin-top: 10px;
	color: var(--text-soft);
	font-size: 0.84rem;
	line-height: 1.5;
}

.footer-nav {
	display: flex;
	gap: 14px;
	flex-wrap: wrap;
}

.footer-copy {
	margin: 0;
	color: var(--text-soft);
	font-size: 0.9rem;
	text-align: right;
}

@media (max-width: 900px) {
	.nav-desktop,
	.header-actions {
		display: none;
	}

	.mobile-menu-btn {
		display: inline-flex;
	}

	.footer-inner {
		grid-template-columns: 1fr;
		align-items: start;
	}

	.footer-copy {
		text-align: left;
	}
}

@media (max-width: 640px) {
	.header-inner {
		padding: 16px var(--space-md);
	}

	.nav-mobile {
		padding: 0 var(--space-md) var(--space-md);
	}

	.logo-text small {
		display: none;
	}

	.footer-inner {
		padding: 24px var(--space-md) 36px;
	}
}
</style>