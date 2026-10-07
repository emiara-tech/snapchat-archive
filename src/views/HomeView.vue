<script setup lang="ts">
import { defineAsyncComponent } from "vue";
const ArrivalScene = defineAsyncComponent(
	() => import("../components/ArrivalScene.vue"),
);
</script>
<template>
	<div class="arrival">
		<section class="arrival-hero container">
			<div class="arrival-copy">
				<span class="eyebrow">A life outside the yellow app</span>
				<h1>Your data,<br />your <em>memories.</em></h1>
				<p class="arrival-description">
					The photos. The late-night conversations. The person you used to be.
					Open your Snapchat archive and find your way back.
				</p>
				<div class="arrival-actions">
					<router-link to="/import" class="btn btn-primary"
						>Open my archive</router-link
					>
					<router-link to="/request" class="btn btn-secondary"
						>Request my archive</router-link
					>
				</div>
				<p class="local-promise">
					<span aria-hidden="true">◈</span> Your archive opens on your device.
					No account required.
				</p>
			</div>
			<div class="arrival-world">
				<ArrivalScene />
				<div class="world-label">
					<span class="live-dot"></span> A place for your memories
					<span>Drag to look around</span>
				</div>
				<div class="world-caption">
					<span>Keep the memories.</span><em>Leave the app.</em>
				</div>
			</div>
		</section>
		<div class="arrival-strip">
			<div class="container">
				<span>Locally opened</span><span>Originals preserved</span
				><span>Your decisions, reversible</span
				><span>Yours to take elsewhere</span>
			</div>
		</div>
		<section class="container arrival-invitation">
			<div>
				<span class="eyebrow">A different kind of looking back</span>
				<h2>There was a whole<br />world in those chats.</h2>
			</div>
			<p>
				A photo means more beside the conversation it came from. A year looks
				different when you can explore it. Open your own archive to read,
				revisit, and preserve the history it contains.
			</p>
		</section>
		<section class="container arrival-rooms">
			<router-link to="/conversations" class="room-preview room-chat"
				><span class="room-number">01 / RECONNECT</span>
				<div class="tiny-chat">
					<span>Read your messages</span
					><span>Open their attachments</span
					><span>Inspect the original sources</span>
				</div>
				<h3>Put the moments<br />back in context.</h3>
				<p>Follow a photo into the conversation around it.</p>
				<span class="room-link">Explore conversations ↗</span></router-link
			>
			<router-link to="/observatory" class="room-preview room-years"
				><span class="room-number">02 / REDISCOVER</span>
				<div class="tiny-years">
					<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
				</div>
				<h3>Walk through<br />your own history.</h3>
				<p>Find patterns, choose a year, and open the evidence.</p>
				<span class="room-link">Enter the observatory ↗</span></router-link
			>
			<router-link to="/export" class="room-preview room-keep"
				><span class="room-number">03 / TAKE IT WITH YOU</span>
				<div class="tiny-collection">
					<span>✓</span><span>✓</span><span>✓</span>
				</div>
				<h3>Keep what<br />matters to you.</h3>
				<p>Curate a collection and download it with its context.</p>
				<span class="room-link">Export your collection ↗</span></router-link
			>
		</section>
		<section class="container request-invitation">
			<div>
				<span class="eyebrow">Don't have your files yet?</span>
				<h2>Your history is worth requesting.</h2>
				<p>
					Follow the steps to request Snapchat's export, then open the ZIP files
					here when they're ready.
				</p>
			</div>
			<router-link to="/request" class="btn btn-primary"
				>Get my Snapchat archive ↗</router-link
			>
		</section>
		<p class="archive-footnote container">
			Your export may have gaps. Goodbye Chat shows the evidence it actually contains.
		</p>
	</div>
</template>
<style scoped>
.arrival {
	padding-top: 130px;
}
.arrival-hero {
	display: grid;
	grid-template-columns: 1fr 1.03fr;
	align-items: center;
	gap: 38px;
	min-height: 630px;
	padding-bottom: 70px;
}
.arrival-copy {
	position: relative;
	z-index: 1;
}
.arrival h1 {
	font-size: clamp(4rem, 6.7vw, 6.4rem);
	line-height: 1.04;
	letter-spacing: -0.055em;
	margin: 20px 0 28px;
}
.arrival h1 em {
	color: var(--secondary);
	font-weight: 500;
}
.arrival-description {
	max-width: 460px;
	font-size: 1.12rem;
	line-height: 1.75;
	color: var(--text-soft);
}
.arrival-actions {
	display: flex;
	flex-wrap: wrap;
	gap: 10px;
	margin: 30px 0 22px;
}
.local-promise {
	display: flex;
	gap: 10px;
	font-size: 0.76rem;
	color: var(--text-soft);
	align-items: center;
}
.local-promise span {
	font-size: 1.25rem;
	color: var(--secondary);
}
.arrival-world {
	height: 530px;
	border-radius: 4px 100px 4px 4px;
	background: #e6e8dd;
	position: relative;
	overflow: hidden;
	border: 1px solid #d4d7c9;
}
.world-label {
	position: absolute;
	top: 24px;
	left: 24px;
	right: 24px;
	display: flex;
	align-items: center;
	gap: 7px;
	font-size: 0.66rem;
	color: #40594f;
	text-transform: uppercase;
	letter-spacing: 0.08em;
	pointer-events: none;
}
.world-label > span:last-child {
	margin-left: auto;
	text-transform: none;
	letter-spacing: 0;
	opacity: 0.7;
}
.live-dot {
	width: 6px;
	height: 6px;
	background: #1f6958;
	border-radius: 50%;
}
.world-caption {
	position: absolute;
	bottom: 28px;
	left: 30px;
	display: grid;
	font-size: 1.8rem;
	font-family: var(--font-serif);
	line-height: 1.25;
	color: #233f33;
	pointer-events: none;
}
.world-caption em {
	opacity: 0.65;
	font-size: 1.6rem;
}
.arrival-strip {
	border-block: 1px solid var(--border);
	background: #f0eadd;
}
.arrival-strip .container {
	display: flex;
	justify-content: space-between;
	gap: 20px;
	padding-block: 19px;
	font-size: 0.76rem;
	color: var(--text-soft);
}
.arrival-strip span:before {
	content: "✧";
	margin-right: 12px;
	color: var(--secondary);
}
.arrival-invitation {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 80px;
	align-items: end;
	padding-top: 85px;
	padding-bottom: 40px;
}
.arrival-invitation h2 {
	font: 500 clamp(2.4rem, 4vw, 3.5rem)/1.12 var(--font-serif);
	letter-spacing: -0.035em;
	margin-top: 15px;
}
.arrival-invitation p {
	max-width: 465px;
	color: var(--text-soft);
	line-height: 1.85;
	font-size: 1rem;
}
.arrival-rooms {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 18px;
	padding-bottom: 75px;
}
.room-preview {
	display: block;
	padding: 28px;
	border: 1px solid var(--border);
	border-radius: 6px;
	min-height: 400px;
	transition:
		transform 0.2s,
		box-shadow 0.2s;
	background: #fbf7ee;
}
.room-preview:hover {
	transform: translateY(-5px);
	box-shadow: var(--shadow-md);
}
.room-number {
	font-size: 0.65rem;
	letter-spacing: 0.12em;
	color: var(--text-soft);
}
.room-preview h3 {
	font: 500 1.85rem/1.15 var(--font-serif);
	letter-spacing: -0.035em;
}
.room-preview p {
	font-size: 0.84rem;
	color: var(--text-soft);
	margin: 14px 0 28px;
	max-width: 260px;
}
.room-link {
	font-size: 0.76rem;
	color: var(--secondary);
}
.tiny-chat {
	height: 155px;
	padding-top: 20px;
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 7px;
}
.tiny-chat span {
	font-size: 0.64rem;
	padding: 7px 11px;
	background: #e9e5db;
	border-radius: 10px 10px 10px 2px;
}
.tiny-chat span:nth-child(2) {
	align-self: flex-end;
	background: #d4e5d9;
}
.room-years {
	background: #e7ebe1;
}
.tiny-years {
	height: 155px;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	padding: 15px 0;
}
.tiny-years i {
	height: 25px;
	width: 13px;
	background: #799b80;
	border-radius: 3px;
	transform: skewY(-15deg);
}
.tiny-years i:nth-child(2n) {
	height: 65px;
	background: #b2be97;
}
.tiny-years i:nth-child(3n) {
	height: 90px;
	background: #416f58;
}
.tiny-years i:nth-child(4n) {
	height: 40px;
	background: #d1ad5a;
}
.room-keep {
	background: #efdfc7;
}
.tiny-collection {
	height: 155px;
	display: flex;
	justify-content: center;
	align-items: center;
}
.tiny-collection span {
	display: grid;
	place-items: end;
	padding: 8px;
	width: 80px;
	height: 90px;
	background: #fcf7ec;
	border: 1px solid #dacdb8;
	transform: rotate(-12deg);
	font-size: 0.72rem;
	color: var(--secondary);
	box-shadow: var(--shadow-sm);
}
.tiny-collection span:nth-child(2) {
	transform: rotate(8deg);
	margin-left: -15px;
	background: #d5e0ce;
}
.tiny-collection span:nth-child(3) {
	transform: rotate(18deg);
	margin-left: -15px;
	background: #e4c98c;
}
.request-invitation {
	display: flex;
	gap: 30px;
	justify-content: space-between;
	align-items: center;
	border-top: 1px solid var(--border);
	padding-top: 50px;
	padding-bottom: 40px;
}
.request-invitation h2 {
	font: 500 2.1rem/1.2 var(--font-serif);
	margin: 12px 0;
}
.request-invitation p {
	color: var(--text-soft);
	font-size: 0.9rem;
	max-width: 580px;
}
.archive-footnote {
	font-size: 0.72rem;
	color: var(--text-soft);
	padding-bottom: 45px;
}
@media (max-width: 900px) {
	.arrival {
		padding-top: 105px;
	}
	.arrival-hero {
		grid-template-columns: 1fr;
	}
	.arrival-world {
		height: 400px;
	}
	.arrival-invitation {
		grid-template-columns: 1fr;
		gap: 25px;
	}
	.arrival-rooms {
		grid-template-columns: 1fr;
	}
	.arrival-strip .container {
		flex-wrap: wrap;
	}
	.request-invitation {
		align-items: flex-start;
		flex-direction: column;
	}
	.arrival h1 {
		font-size: 4.5rem;
	}
}
@media (prefers-reduced-motion: reduce) {
	.room-preview {
		transition: none;
	}
	.room-preview:hover {
		transform: none;
	}
}
</style>
