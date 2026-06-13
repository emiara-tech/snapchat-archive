import { createRouter, createWebHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
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
		meta: { title: "Review Your Photos | Goodbye Chat" },
	},
	{
		path: "/privacy",
		name: "privacy",
		component: () => import("../views/PrivacyView.vue"), // stays
		meta: { title: "Privacy & Project Notes | Goodbye Chat" },
	},
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
	document.title = (to.meta.title as string) || "Goodbye Chat";
	next();
});

export default router;
