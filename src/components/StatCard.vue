<template>
	<div class="stat-card card">
		<div class="stat-icon" aria-hidden="true">{{ icon }}</div>
		<div class="stat-content">
			<div class="stat-value">{{ value }}</div>
			<div class="stat-label">{{ label }}</div>
		</div>
	</div>
</template>

<script setup lang="ts">
defineProps<{
	icon: string;
	value: string | number;
	label: string;
}>();
</script>

<style scoped>
.stat-card {
	display: flex;
	align-items: center;
	gap: var(--space-md);
	min-height: 116px;
}

.stat-icon {
	font-size: 1.7rem;
	width: 58px;
	height: 58px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: linear-gradient(
		145deg,
		rgba(243, 203, 69, 0.18),
		rgba(255, 255, 255, 0.72)
	);
	border-radius: 18px;
}

.stat-content {
	display: flex;
	flex-direction: column;
}

.stat-value {
	font-size: 1.75rem;
	font-weight: 700;
	color: var(--text-h);
	line-height: 1.2;
}

.stat-label {
	font-size: 0.875rem;
	color: var(--text-soft);
}
</style>