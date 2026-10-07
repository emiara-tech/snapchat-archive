import { createRouter, createWebHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";
import { useArchiveStore } from "../stores/archive";
import { useWorkspaceStore } from "../stores/workspace";

const routes: RouteRecordRaw[] = [
	{
		path: "/account",
		component: () => import("../views/AccountView.vue"),
		meta: { title: "Account and AI allowance | Goodbye Chat" },
	},
	{
		path: "/request",
		component: () => import("../views/RequestView.vue"),
		meta: { title: "Request your archive | Goodbye Chat" },
	},
	{
		path: "/conversations",
		component: () => import("../views/ConversationsView.vue"),
		meta: { title: "Conversations | Goodbye Chat", requiresWorkspace: true },
	},
	{
		path: "/library",
		component: () => import("../views/LibraryView.vue"),
		meta: { title: "Your collection | Goodbye Chat", requiresWorkspace: true },
	},
	{
		path: "/observatory",
		component: () => import("../views/ObservatoryView.vue"),
		meta: { title: "The observatory | Goodbye Chat", requiresWorkspace: true },
	},
	{
		path: "/year-room",
		component: () => import("../views/YearRoomView.vue"),
		meta: {
			title: "An imagined past self | Goodbye Chat",
			requiresWorkspace: true,
		},
	},
	{
		path: "/assistant",
		component: () => import("../views/AssistantView.vue"),
		meta: {
			title: "Explore your archive | Goodbye Chat",
			requiresWorkspace: true,
		},
	},
	{
		path: "/export",
		component: () => import("../views/ExportView.vue"),
		meta: { title: "Take it with you | Goodbye Chat", requiresWorkspace: true },
	},
	{
		path: "/",
		name: "home",
		component: () => import("../views/HomeView.vue"), // stays
		meta: { title: "Goodbye Chat" },
	},
	{
		path: "/import",
		name: "import",
		component: () => import("../views/ImportView.vue"), // stays
		meta: { title: "Import Your Archive | Goodbye Chat" },
	},
	{
		path: "/processing",
		name: "processing",
		component: () => import("../views/ProcessingView.vue"), // stays
		meta: { title: "Building Your Recap | Goodbye Chat" },
	},
	{
		path: "/photos",
		name: "photos",
		component: () => import("../views/PhotosView.vue"),
		meta: { title: "Review Your Photos | Goodbye Chat", requiresArchive: true },
	},
	{
		path: "/privacy",
		name: "privacy",
		component: () => import("../views/PrivacyView.vue"), // stays
		meta: { title: "Privacy & Project Notes | Goodbye Chat" },
	},
	{
		path: "/welcome",
		name: "welcome",
		component: () => import("../views/WelcomeView.vue"),
		meta: { title: "Your archive | Goodbye Chat", requiresWorkspace: true },
	},
	{ path: "/:pathMatch(.*)*", redirect: "/" },
];

const router = createRouter({
	history: createWebHistory(),
	routes,
	scrollBehavior(_to, _from, savedPosition) {
		if (savedPosition) {
			return savedPosition;
		}
		return { top: 0 };
	},
});

router.beforeEach((to, _from, next) => {
	if (
		to.meta.requiresWorkspace &&
		!useArchiveStore().isImported &&
		!useWorkspaceStore().dataset
	) {
		next({ name: "import", replace: true });
		return;
	}
	if (to.meta.requiresArchive && !useArchiveStore().isImported) {
		next({ name: "import", replace: true });
		return;
	}
	document.title = (to.meta.title as string) || "Goodbye Chat";
	next();
});

export default router;
