import { createRouter, createWebHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
	{
		path: "/",
		name: "home",
		component: () => import("../views/HomeView.vue"),
		meta: { title: "Goodbye Chat" },
	},
	{
		path: "/import",
		name: "import",
		component: () => import("../views/ImportView.vue"),
		meta: { title: "Import Your Archive | Goodbye Chat" },
	},
	{
		path: "/processing",
		name: "processing",
		component: () => import("../views/ProcessingView.vue"),
		meta: { title: "Building Your Recap | Goodbye Chat" },
	},
	{
		path: "/dashboard",
		name: "dashboard",
		component: () => import("../views/DashboardView.vue"),
		meta: { title: "Your Archive Recap | Goodbye Chat" },
	},
	{
		path: "/photos",
		name: "photos",
		component: () => import("../views/PhotosView.vue"),
		meta: { title: "Review Your Photos | Goodbye Chat" },
	},
	{
		path: "/summary",
		name: "summary",
		component: () => import("../views/SummaryView.vue"),
		meta: { title: "Your Story Recap | Goodbye Chat" },
	},
	{
		path: "/export",
		name: "export",
		component: () => import("../views/ExportView.vue"),
		meta: { title: "Export Photos | Goodbye Chat" },
	},
	{
		path: "/privacy",
		name: "privacy",
		component: () => import("../views/PrivacyView.vue"),
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