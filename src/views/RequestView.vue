<script setup lang="ts">
import { ref, watch } from "vue";
import {
	calendarReminder,
	readJourney,
	saveJourney,
	type JourneyState,
} from "../lib/onboarding";
const journey = ref<JourneyState>(readJourney());
const remember = ref(journey.value !== "not_requested");
const error = ref("");
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
const localDate = new Date(
	tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60 * 1000,
)
	.toISOString()
	.slice(0, 16);
const reminderDate = ref(localDate);
watch([journey, remember], () => {
	error.value = "";
	if (!saveJourney(remember.value ? journey.value : "not_requested"))
		error.value =
			"Your browser could not save the checklist. You can still use this guide.";
});
function downloadReminder() {
	try {
		error.value = "";
		const date = new Date(reminderDate.value);
		if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now())
			throw new Error("Choose a valid time in the future.");
		const url = URL.createObjectURL(
			new Blob([calendarReminder(date)], {
				type: "text/calendar;charset=utf-8",
			}),
		);
		const link = document.createElement("a");
		link.href = url;
		link.download = "check-my-snapchat-archive.ics";
		link.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	} catch (e) {
		error.value =
			e instanceof Error ? e.message : "Could not create the reminder.";
	}
}
</script>
<template>
	<div class="page">
		<div class="container request-page">
			<header>
				<span class="eyebrow">Your history starts here</span>
				<h1>First, ask for<br />your memories.</h1>
				<p>
					Snapchat prepares the files. You bring them back here. Your password
					and download link stay with Snapchat.
				</p>
			</header>
			<div class="request-grid">
				<section class="card request-steps">
					<span class="eyebrow">The request</span>
					<ol>
						<li>
							<h3>Open Snapchat's My Data</h3>
							<p>
								Sign in on Snapchat's own website. Choose the history categories
								you want, including chats and Memories.
							</p>
							<a
								href="https://accounts.snapchat.com/v2/download-my-data"
								target="_blank"
								rel="noopener noreferrer"
								class="btn btn-primary"
								>Open Snapchat My Data ↗</a
							>
						</li>
						<li>
							<h3>Choose your dates and media</h3>
							<p>
								For the widest view, request your full available history and
								media. A Memories-only export can show your saved photos, but
								cannot reconstruct conversations.
							</p>
						</li>
						<li>
							<h3>Confirm your email and submit</h3>
							<p>
								Snapchat aims to prepare exports within seven days. Larger
								archives can take longer. It sends its own email when the
								download is ready.
							</p>
							<button
								v-if="journey === 'not_requested'"
								class="btn btn-secondary"
								@click="journey = 'requested_by_user'"
							>
								I've submitted my request</button
							><span v-else class="check-confirmed"
								>✓ You marked your request as sent</span
							>
						</li>
						<li>
							<h3>Download every original ZIP</h3>
							<p>
								Check Snapchat's email or recent exports in My Data. Download
								all the parts, then open them together here.
							</p>
							<router-link to="/import" class="btn btn-secondary"
								>I have my ZIPs</router-link
							>
						</li>
					</ol>
					<a
						class="official-source"
						href="https://help.snapchat.com/hc/en-us/articles/7012305371156-How-do-I-download-my-data-from-Snapchat"
						target="_blank"
						rel="noopener noreferrer"
						>Read Snapchat's official instructions ↗</a
					>
				</section>
				<aside>
					<section class="card waiting-card">
						<span class="eyebrow">Your next step</span>
						<h2>Keep your files.<br />Open your history.</h2>
						<p>
							Keep every downloaded ZIP together. When your files arrive,
							open them here to read your conversations and revisit your photos.
						</p>
						<router-link to="/import" class="btn btn-primary"
							>Open my downloaded files</router-link
						>
						<div class="journey-status">
							<span class="status-dot"></span
							>{{
								journey === "reported_ready"
									? "You said your download is ready"
									: journey === "requested_by_user"
										? "Request sent, according to you"
										: "Your request checklist"
							}}
							<p v-if="journey !== 'reported_ready'">
								We don't receive Snapchat's export status. Check your email or
								the My Data portal.
							</p>
						</div>
						<label class="check-option"
							><input v-model="remember" type="checkbox" /> Remember this
							checklist on this device</label
						><button
							v-if="journey === 'requested_by_user'"
							class="text-action"
							@click="journey = 'reported_ready'"
						>
							Snapchat emailed me</button
						><router-link
							v-if="journey === 'reported_ready'"
							class="btn btn-secondary"
							to="/import"
							>Open my downloaded archive</router-link
						><button
							v-if="journey !== 'not_requested'"
							class="text-action"
							@click="
								journey = 'not_requested';
								remember = false;
							"
						>
							Reset my checklist
						</button>
					</section>
					<section class="card reminder-card">
						<h3>A reminder you control.</h3>
						<p>
							Save a calendar event to check your request. Add it to your
							calendar to enable its reminders.
						</p>
						<label for="reminder-date">Remind me at</label
						><input
							id="reminder-date"
							v-model="reminderDate"
							type="datetime-local"
						/><button class="btn btn-secondary" @click="downloadReminder">
							Save calendar reminder ↓</button
						><small
							>This downloads a calendar file. Goodbye Chat sends no
							email.</small
						>
					</section>
					<p v-if="error" role="alert" class="request-error">{{ error }}</p>
				</aside>
			</div>
		</div>
	</div>
</template>
<style scoped>
.request-page {
	max-width: 1150px;
}
.request-page header {
	margin-bottom: 48px;
}
.request-page h1 {
	font-size: 4.7rem;
	letter-spacing: -0.04em;
	margin: 18px 0 22px;
}
.request-page header > p {
	max-width: 540px;
	color: var(--text-soft);
	line-height: 1.8;
}
.request-grid {
	display: grid;
	grid-template-columns: 1.25fr 0.8fr;
	gap: 24px;
}
.request-steps {
	padding: 34px;
}
.request-steps ol {
	list-style: none;
	counter-reset: request;
	padding: 0;
	margin: 28px 0;
}
.request-steps li {
	counter-increment: request;
	padding: 0 0 28px 44px;
	position: relative;
}
.request-steps li:before {
	content: counter(request);
	position: absolute;
	left: 0;
	top: 0;
	border: 1px solid var(--border);
	border-radius: 50%;
	width: 28px;
	height: 28px;
	display: grid;
	place-items: center;
	font-size: 0.7rem;
	color: var(--secondary);
}
.request-steps h3 {
	font-size: 1rem;
	margin: 4px 0 10px;
}
.request-steps p {
	font-size: 0.87rem;
	color: var(--text-soft);
	line-height: 1.8;
	margin-bottom: 15px;
}
.request-steps .btn {
	font-size: 0.78rem;
	padding: 10px 16px;
}
.official-source {
	font-size: 0.76rem;
	color: var(--secondary);
}
.request-grid aside {
	display: grid;
	align-content: start;
	gap: 20px;
}
.waiting-card {
	background: #e8ece2;
	padding: 30px;
	display: grid;
	gap: 20px;
	justify-items: start;
}
.waiting-card h2 {
	font: 500 2.7rem/1.13 var(--font-serif);
	letter-spacing: -0.04em;
}
.waiting-card > p,
.reminder-card p {
	color: var(--text-soft);
	font-size: 0.85rem;
	line-height: 1.8;
}
.journey-status {
	border-top: 1px solid var(--border);
	padding-top: 20px;
	width: 100%;
	font-size: 0.79rem;
}
.journey-status p {
	color: var(--text-soft);
	font-size: 0.74rem;
	margin-top: 10px;
}
.status-dot {
	display: inline-block;
	width: 6px;
	height: 6px;
	background: var(--secondary);
	border-radius: 50%;
	margin-right: 8px;
}
.check-option {
	display: flex;
	align-items: center;
	gap: 9px;
	font-size: 0.73rem;
}
.text-action {
	border: 0;
	background: none;
	padding: 0;
	color: var(--secondary);
	text-decoration: underline;
	font-size: 0.74rem;
}
.reminder-card {
	padding: 28px;
	display: grid;
	gap: 15px;
}
.reminder-card h3 {
	font-family: var(--font-serif);
	font-size: 1.45rem;
}
.reminder-card label,
.reminder-card small {
	font-size: 0.73rem;
	color: var(--text-soft);
}
.reminder-card input {
	background: var(--bg-elevated);
	border: 1px solid var(--border);
	padding: 10px;
	border-radius: 6px;
	font-family: inherit;
	color: var(--text);
}
.reminder-card button {
	font-size: 0.76rem;
}
.check-confirmed {
	font-size: 0.78rem;
	color: var(--secondary);
}
.request-error {
	color: var(--danger);
	font-size: 0.8rem;
}
@media (max-width: 900px) {
	.request-grid {
		grid-template-columns: 1fr;
	}
	.request-page h1 {
		font-size: 3.5rem;
	}
}
</style>
