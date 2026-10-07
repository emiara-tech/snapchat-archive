<script setup lang="ts">
import { computed } from "vue";
import { useWorkspaceStore } from "../stores/workspace";

defineProps<{ compact?: boolean }>();
const workspace = useWorkspaceStore();
const years = computed(() => [...new Set([
	...(workspace.dataset?.events.map((event) => event.year) ?? []),
	...(workspace.dataset?.assets.map((asset) => asset.year) ?? []),
].filter((year): year is number => year !== null))].sort((a, b) => b - a));
const participants = computed(() => workspace.dataset?.participants.filter((participant) => !participant.isOwner) ?? []);
const conversations = computed(() => workspace.dataset?.conversations ?? []);
const activeCount = computed(() => [workspace.query.year, workspace.query.participantId, workspace.query.conversationId, workspace.query.text, workspace.query.kind !== "all", workspace.query.review !== "active", workspace.query.linkState !== "all"].filter(Boolean).length);
function value(event: Event) { return (event.target as HTMLInputElement | HTMLSelectElement).value; }
</script>

<template>
	<section class="workspace-filters" :class="{ compact }" aria-label="Collection filters">
		<div class="filter-topline"><span>One collection, every room</span><button v-if="activeCount" class="clear-filters" @click="workspace.resetQuery()">Clear {{ activeCount }} filters</button></div>
		<div class="filter-controls">
			<label class="search-control">Search your history<input type="search" :value="workspace.query.text" placeholder="A phrase, a person, a forgotten joke..." @input="workspace.setQuery({ text: value($event) })"></label>
			<label>Year<select aria-label="Year" :value="workspace.query.year ?? 'all'" @change="workspace.setQuery({ year: value($event) === 'all' ? null : Number(value($event)) })"><option value="all">Every year</option><option v-for="year in years" :key="year" :value="year">{{ year }}</option></select></label>
			<label>Person<select aria-label="Person" :value="workspace.query.participantId ?? 'all'" @change="workspace.setQuery({ participantId: value($event) === 'all' ? null : value($event) })"><option value="all">Everyone</option><option v-for="person in participants" :key="person.id" :value="person.id">{{ person.displayName }}{{ person.username ? ` · ${person.username}` : '' }}</option></select></label>
			<label>Type<select aria-label="Type" :value="workspace.query.kind" @change="workspace.setQuery({ kind: value($event) as typeof workspace.query.kind })"><option value="all">All types</option><option v-for="kind in ['text', 'image', 'video', 'audio', 'sticker', 'gif', 'attachment', 'unknown']" :key="kind" :value="kind">{{ kind }}</option></select></label>
			<label>Review<select aria-label="Review status" :value="workspace.query.review" @change="workspace.setQuery({ review: value($event) as typeof workspace.query.review })"><option value="active">Not excluded</option><option value="all">All, including excluded</option><option value="keep">Kept</option><option value="later">Review later</option><option value="unreviewed">Unreviewed</option><option value="exclude">Excluded</option></select></label>
		</div>
		<details v-if="!compact" class="more-filters"><summary>Conversation and attachment evidence</summary><div class="filter-controls extra"><label>Conversation<select aria-label="Conversation" :value="workspace.query.conversationId ?? 'all'" @change="workspace.setQuery({ conversationId: value($event) === 'all' ? null : value($event) })"><option value="all">Every conversation</option><option v-for="conversation in conversations" :key="conversation.id" :value="conversation.id">{{ conversation.title }}</option></select></label><label>Attachment evidence<select aria-label="Attachment evidence" :value="workspace.query.linkState" @change="workspace.setQuery({ linkState: value($event) as typeof workspace.query.linkState })"><option value="all">Every evidence state</option><option value="confirmed">Confirmed</option><option value="inferred">Inferred</option><option value="ambiguous">Ambiguous</option><option value="unlinked">Unlinked</option></select></label></div></details>
		<p v-if="workspace.query.review === 'exclude' || workspace.query.review === 'all'" class="review-note">Reviewing excluded items locally. Excluded content stays out of exports and observations.</p>
	</section>
</template>

<style scoped>
.workspace-filters { padding: 20px 24px; border: 1px solid var(--border); border-radius: 20px; background: rgba(255,251,245,.72); }
.filter-topline { display:flex; justify-content:space-between; gap:20px; margin-bottom:12px; font-size:.72rem; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:var(--text-soft); }
.clear-filters { border:0; background:transparent; color:var(--secondary); font:inherit; text-transform:none; letter-spacing:0; }
.filter-controls { display:grid; grid-template-columns:minmax(250px,2fr) repeat(4,minmax(100px,1fr)); gap:12px; }
label { display:grid; gap:6px; color:var(--text-soft); font-size:.73rem; }
input,select { width:100%; padding:10px 12px; border:1px solid var(--border); border-radius:10px; background:var(--bg-elevated); color:var(--text-h); font: .88rem var(--font-sans); }
input:focus,select:focus { outline:2px solid var(--secondary); outline-offset:2px; }
.more-filters { margin-top:12px; font-size:.78rem; color:var(--text-soft); }
.more-filters summary { cursor:pointer; }
.extra { margin-top:12px; grid-template-columns:1fr 1fr; }
.review-note { margin-top:12px; color:var(--danger); font-size:.82rem; }
.compact .filter-controls { grid-template-columns:minmax(220px,2fr) repeat(4,1fr); }
@media(max-width:1000px) { .filter-controls,.compact .filter-controls { grid-template-columns:repeat(3,1fr); } .search-control { grid-column:span 3; } }
@media(max-width:650px) { .filter-controls,.compact .filter-controls { grid-template-columns:1fr 1fr; } .search-control { grid-column:span 2; } }
</style>
