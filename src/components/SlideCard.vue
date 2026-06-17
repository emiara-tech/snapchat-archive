<script setup lang="ts">
	const props = withDefaults(defineProps<{
		title?: string,
		content?: string,
	}
	>(), {
			title: "Title",
			content: "content",
	});
</script>


<template>
	<div class="highlight-card" >
		<h1>{{ content }}</h1>
	</div>
</template>


<style lang="css" scoped>

.highlight-card {
	background-color: var(--accent-strong);
}
</style>
