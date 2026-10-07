import { defineConfig, loadEnv } from "vite";
import { varlockVitePlugin } from "@varlock/vite-integration";
import vue from "@vitejs/plugin-vue";
import vueDevTools from "vite-plugin-vue-devtools";
import { accountServicePlugin } from "./server/accountRouting";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const origin = loadEnv(mode, process.cwd(), "APP_").APP_ORIGIN;
	let allowedHosts: string[] = [];
	try { if (origin) allowedHosts = [new URL(origin).hostname]; } catch { /* Invalid config is rejected by the account service. */ }
	return {
	server: { allowedHosts },
	preview: { allowedHosts },
	plugins: [
		varlockVitePlugin(),
		vue(),
		...(process.env.ENABLE_VUE_DEVTOOLS === "1" ? [vueDevTools()] : []),
		accountServicePlugin(),
	],
	};
});
