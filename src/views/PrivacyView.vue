<template>
	<div class="page">
		<div class="container container-narrow">
			<header class="page-header">
				<span class="eyebrow">Your data • No servers</span>
				<h1>Nothing you load here is sent anywhere.</h1>
				<p class="page-subtitle">
					This is the privacy policy for Goodbye Chat. It is short because
					there is not much to say: the app runs entirely in your browser and
					your archive never touches a server.
				</p>
			</header>

			<section class="privacy-section">
				<h2>What we collect</h2>
				<p>
					<strong>Nothing.</strong> Goodbye Chat has no accounts, no analytics,
					no crash reporting, and no telemetry of any kind. There is no backend
					to send data to.
				</p>
			</section>

			<section class="privacy-section">
				<h2>How your archive is processed</h2>
				<p>
					When you drop a zip, your browser reads it directly using local file
					APIs. The archive is parsed in-memory and never uploaded. All
					analysis — summaries, chat counts, media stats — runs client-side
					against the parsed JSON.
				</p>
				<ul>
					<li>No account required to use the app</li>
					<li>No server receives your takeout file</li>
					<li>No data is written outside your browser session</li>
					<li>Closing the tab ends the session completely</li>
				</ul>
			</section>

			<section class="privacy-section">
				<h2>Data retention</h2>
				<p>
					Nothing persists after you close the tab. Goodbye Chat does not write
					to localStorage, does not set cookies, and does not cache your archive
					anywhere outside the active browser window.
				</p>
			</section>

			<section class="privacy-section">
				<h2>Third parties</h2>
				<p>
					No third-party analytics SDKs, tracking pixels, or advertising
					scripts are loaded by this app.
				</p>
				<p>
					Goodbye Chat is an independent tool. It is not affiliated with,
					endorsed by, or sponsored by Snapchat or Snap Inc.
				</p>
			</section>

			<section class="privacy-section">
				<h2>Exports</h2>
				<p>
					If you use the export feature, your archive data is saved directly
					to your machine. Nothing is sent anywhere in the process. Goodbye
					Chat does not receive a copy.
				</p>
			</section>

			<section class="contact-section card">
				<h2>Questions</h2>
				<p>
					If something here does not add up or you want to read the source,
					reach out at
					<a href="mailto:hello@goodbye.chat">hello@goodbye.chat</a>.
				</p>
			</section>
		</div>
	</div>
</template>

<style scoped>
.container-narrow {
	max-width: 700px;
}

.page-header {
	text-align: center;
	margin-bottom: var(--space-2xl);
}

.page-header h1 {
	margin: 16px 0 12px;
}

.page-subtitle {
	color: var(--text-soft);
}

.privacy-section {
	margin-bottom: var(--space-xl);
	padding-bottom: var(--space-xl);
	border-bottom: 1px solid var(--border);
}

.privacy-section h2 {
	font-size: 1.25rem;
	margin-bottom: var(--space-md);
}

.privacy-section p {
	color: var(--text-soft);
	line-height: 1.7;
	margin-bottom: var(--space-md);
}

.privacy-section ul {
	list-style: none;
	padding: 0;
	margin: 0;
}

.privacy-section li {
	color: var(--text-soft);
	padding: var(--space-sm) 0;
	padding-left: var(--space-lg);
	position: relative;
}

.privacy-section li::before {
	content: "✓";
	position: absolute;
	left: 0;
	color: var(--success);
}

.privacy-section li strong {
	color: var(--text-h);
}

.contact-section h2 {
	font-size: 1.25rem;
	margin-bottom: var(--space-md);
}

.contact-section p {
	color: var(--text-soft);
	line-height: 1.7;
}

.contact-section a {
	color: var(--text-h);
}
</style>
