<script setup lang="ts">
import { Analytics, type BeforeSendEvent } from "@vercel/analytics/vue";
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useArchiveStore } from "./stores/archive";
import { useWorkspaceStore } from "./stores/workspace";
import Layout from "./components/Layout.vue";
const route = useRoute();
const archive = useArchiveStore();
const workspace = useWorkspaceStore();
const publicPaths = new Set(["/", "/request", "/privacy", "/import"]);
function publicPage(url: URL) {
	return publicPaths.has(url.pathname) && !url.search && !url.hash;
}
const allowAnalytics = computed(() =>
	!archive.isImported && !workspace.dataset && !document.referrer &&
	publicPaths.has(route.path) && publicPage(new URL(window.location.href)),
);
function beforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
	if (!allowAnalytics.value || event.type !== "pageview") return null;
	try {
		const url = new URL(event.url);
		if (url.origin !== window.location.origin || !publicPage(url)) return null;
		return { type: "pageview", url: url.origin + url.pathname };
	} catch { return null; }
}
</script>

<template>
	<Analytics v-if="allowAnalytics" :before-send="beforeSend" mode="production" />
	<Layout>
		<router-view v-slot="{ Component }">
			<Transition name="fade" mode="out-in">
				<component :is="Component" />
			</Transition>
		</router-view>
	</Layout>
</template>