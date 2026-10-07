<script setup lang="ts">
import { Analytics } from "@vercel/analytics/vue";
import Layout from "./components/Layout.vue";
</script>

<template>
	<Analytics />
	<Layout>
		<router-view v-slot="{ Component }">
			<Transition name="fade" mode="out-in">
				<component :is="Component" />
			</Transition>
		</router-view>
	</Layout>
</template>