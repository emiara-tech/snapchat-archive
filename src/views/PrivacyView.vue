<template>
	<div class="page">
		<div class="container privacy-page">
			<header>
				<span class="eyebrow">Your archive, on your device</span>
				<h1>Your history<br />stays with you.</h1>
				<p>
					Local import, conversations, curation, statistics, and bundle
					downloads work without uploading your archive or creating an account.
				</p>
			</header>
			<section>
				<h2>Opening your archive</h2>
				<p>
					Your browser reads the ZIP files you select. It extracts supported
					records and media on your device. Expired Snapchat download links are
					not used to fetch photos. Your original files stay unchanged.
				</p>
				<p>
					The working archive is held for the current browser session. Closing
					or reloading the page requires you to select your files again. Start
					over clears the active archive and its media handles.
				</p>
			</section>
			<section>
				<h2>Choices saved on your device</h2>
				<p>
					The request guide can remember a non-sensitive checklist if you choose
					that option. Reset the checklist to remove it. A calendar reminder
					downloads a file for your own calendar; it does not subscribe you to
					email.
				</p>
				<p>
					When you explicitly save review decisions, the app stores them locally
					for the matching archive. You can remove that saved state. Browser
					storage can be cleared or become unavailable; it is not a backup of
					your archive.
				</p>
			</section>
			<section>
				<h2>Local downloads</h2>
				<p>
					A bundle downloads directly to your device. Its preview explains the
					selected collection, unavailable content, originals, and overlay
					policy. Original media can contain embedded location and other
					metadata. Share it deliberately.
				</p>
				<p>
					Complete and curated selections have different scopes. Review the
					preview before choosing to include previously excluded content.
				</p>
			</section>
			<section>
				<h2>Accounts, AI, and destination services</h2>
				<p>
					Signing in, connecting an AI allowance, scheduling email, and sending
					media to an external destination are separate permissions. The app
					shows which services are available. An unavailable integration cannot
					perform a transfer.
				</p>
				<p>
					Before an enabled external feature sends archive material, it must
					show the recipient, purpose, selected content, and funding source and
					ask for your consent. Ordinary local browsing does not authorize that
					processing. Account sign-in does not create a cloud archive backup.
				</p>
			</section>
			<section>
				<h2>Evidence and imagination</h2>
				<p>
					The export can have gaps. Media associations show their evidence, and
					uncertain associations remain uncertain. Year profiles use verified
					owner-authored messages. An imagined self is a fictional
					interpretation, not a recovered person or a record of missing
					memories.
				</p>
			</section>
			<section>
				<h2>Diagnostics and third parties</h2>
				<p>
					The app does not send archive text, media, private filenames,
					vocabulary, or locations to analytics or error reporting. Public fonts
					and application assets are served with the site. A diagnostic report
					should contain only application and browser capability information and
					should be reviewed before sharing.
				</p>
				<p>
					Goodbye Chat is an independent project, unaffiliated with Snap Inc.
					You can inspect the public source on
					<a
						href="https://github.com/emiara-tech/snapchat-archive"
						target="_blank"
						rel="noopener noreferrer"
						>GitHub</a
					>.
				</p>
			</section>
		</div>
	</div>
</template>
<style scoped>
.privacy-page {
	max-width: 760px;
}
.privacy-page header {
	margin-bottom: 50px;
}
.privacy-page h1 {
	font-size: 4.5rem;
	letter-spacing: -0.04em;
	line-height: 1.08;
	margin: 20px 0 28px;
}
.privacy-page p {
	font-size: 0.92rem;
	color: var(--text-soft);
	line-height: 1.85;
	margin: 15px 0;
}
.privacy-page section {
	border-top: 1px solid var(--border);
	padding: 28px 0;
}
.privacy-page h2 {
	font-family: var(--font-serif);
	font-size: 1.6rem;
	font-weight: 500;
}
.privacy-page a {
	color: var(--secondary);
	text-decoration: underline;
}
@media (max-width: 700px) {
	.privacy-page h1 {
		font-size: 3.3rem;
	}
}
</style>
