<template>
	<div class="page">
		<div class="container">
			<section class="card welcome-card">
				<span class="eyebrow">Your browser only</span>
				<h1>Your archive is ready</h1>
				<p>Revisit the photos and videos saved in your Snapchat Memories.</p>
				<router-link to="/photos" class="btn btn-primary">Browse memories</router-link>
			</section>
		</div>
	</div>
</template>

<style scoped>
.welcome-card {
	max-width: 700px;
	margin: 0 auto;
	display: grid;
	gap: var(--space-lg);
	justify-items: start;
}

.welcome-card p {
	color: var(--text-soft);
}
</style>
