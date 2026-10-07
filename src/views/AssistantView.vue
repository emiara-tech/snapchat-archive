<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useWorkspaceStore } from "../stores/workspace";
import WorkspaceFilters from "../components/WorkspaceFilters.vue";
import { computeObservations } from "../lib/observations";
import { createGuideProposals, type GuideProposal } from "../lib/curationProposals";

const workspace = useWorkspaceStore();
const request = ref("");
const error = ref("");
const result = ref("");
const proposals = createGuideProposals({
	current: () => workspace.dataset ? { dataset: workspace.dataset, query: workspace.query, decisions: workspace.decisions,
		queryRevision: workspace.queryRevision, reviewRevision: workspace.reviewRevision } : null,
	query: (query) => workspace.setQuery(query),
	review: (ids, status) => workspace.decide(ids, status),
});
const proposal = ref<GuideProposal | null>(null);
const stale = computed(() => proposal.value !== null && !proposals.isCurrent(proposal.value));
const matches = computed(() => {
	if (!workspace.dataset || !proposal.value || stale.value) return { events: [], assets: [] };
	const events = new Set(proposal.value.eventIds), assets = new Set(proposal.value.assetIds);
	return { events: workspace.dataset.events.filter((event) => events.has(event.id)), assets: workspace.dataset.assets.filter((asset) => assets.has(asset.id)) };
});
const matchingIds = computed(() => proposal.value?.itemIds ?? []);
const explanation = computed(() => workspace.dataset && proposal.value?.plan.kind === "explain" && !stale.value ? computeObservations(workspace.dataset, matches.value.events, matches.value.assets) : null);
const suggestions = computed(() => ["Who did I talk with most?", `Show photos from ${workspace.years[0] ?? 2019}`, `Mark videos from ${workspace.years[0] ?? 2019} for later`, 'Find messages containing "hello"']);

function prepare(text = request.value) {
	error.value = "";
	result.value = "";
	proposal.value = null;
	request.value = text;
	const prepared = proposals.prepare(text);
	if ("error" in prepared) { error.value = prepared.error; return; }
	proposal.value = prepared;
}
function apply() {
	if (!proposal.value) return;
	const applied = proposals.apply(proposal.value);
	if ("error" in applied) { error.value = applied.error; return; }
	proposal.value = null;
	if (applied.kind === "review") {
		result.value = `Marked ${applied.count} matching items ${applied.status === "later" ? "for later" : applied.status}. You can undo this review transaction.`;
	} else {
		result.value = "Your workspace now uses the inspected filter. Open Library or Conversations to continue.";
	}
}
onMounted(async () => { if (!workspace.dataset) await workspace.loadFromArchive(); });
</script>

<template>
	<div class="page assistant-page"><div class="container assistant-container">
		<header class="assistant-heading"><span class="eyebrow">The local command guide </span><h1>A little help<br /><em>finding your way.</em></h1><p>Prepare a selection, inspect the evidence, then decide what happens. Nothing leaves your device.</p></header>
		<WorkspaceFilters compact />
		<div class="assistant-grid"><section class="command-card"><span class="panel-kicker">Start with a question</span><h2>What are you looking for?</h2><p class="capability-note">This is a deterministic local command guide. Supported phrases create filters and previews; live AI assistance is not connected.</p><form @submit.prevent="prepare()"><label for="archive-request">Your archive request</label><textarea id="archive-request" v-model="request" rows="4" maxlength="2000" placeholder="Show photos from 2019 with Jamie" /><button class="btn btn-primary" type="submit">Prepare a preview</button></form><div class="suggestions"><button v-for="suggestion in suggestions" :key="suggestion" @click="prepare(suggestion)">{{ suggestion }} →</button></div><div class="assistant-boundary"><strong>Your decisions stay yours.</strong><p>Review changes need your Apply action and can be undone. Export and transfer use their own direct controls. Archive messages cannot authorize actions.</p></div></section><section class="preview-card" aria-live="polite"><span class="panel-kicker">Inspect before acting</span><h2>{{ proposal?.plan.title ?? 'Your preview appears here.' }}</h2><p v-if="error || workspace.error" role="alert" class="error-message">{{ error || workspace.error }}</p><div v-if="result" role="status" class="result-message"><p>{{ result }}</p><div><router-link to="/library">Open Library →</router-link><router-link to="/conversations">Open Conversations →</router-link><button @click="workspace.undo(); result = 'Restored the previous review decisions.'">Undo last review change</button></div></div><template v-if="proposal"><p class="proposal-description">{{ proposal.plan.description }}</p><p v-if="stale" role="alert" class="error-message">Your collection changed after this preview. Prepare it again before applying.</p><template v-else><div class="match-counts"><article><strong>{{ matches.events.length }}</strong><span>Recorded events</span></article><article><strong>{{ matches.assets.length }}</strong><span>Media assets</span></article><article><strong>{{ matchingIds.length }}</strong><span>Unique review items</span></article></div><dl class="query-summary"><div><dt>Year</dt><dd>{{ proposal.plan.query.year ?? 'All recorded years' }}</dd></div><div><dt>Media/text kind</dt><dd>{{ proposal.plan.query.kind }}</dd></div><div><dt>Participant</dt><dd>{{ workspace.dataset?.participants.find(p => p.id === proposal?.plan.query.participantId)?.displayName ?? 'Current or all participants' }}</dd></div><div><dt>Literal search</dt><dd>{{ proposal.plan.query.text || 'None' }}</dd></div><div><dt>Review scope</dt><dd>Active records; exclusions preserved</dd></div></dl><template v-if="explanation"><p class="explanation-note">Participant counts include all selected events in their recorded conversations. Group events can contribute to several participants. Layout distance does not measure closeness.</p><div v-for="person in explanation.relationships.slice(0, 5)" :key="person.id" class="person-count"><span>{{ person.label }}</span><strong>{{ person.value }} events</strong></div><p class="explanation-note">{{ explanation.ownerTextCount }} proven owner text messages. {{ explanation.unknownDates }} selected records lack a usable date. The archive can omit history.</p></template><div class="match-preview"><article v-for="event in matches.events.slice(0, 5)" :key="event.id"><span>{{ event.timestamp?.slice(0, 10) ?? 'Unknown date' }} · {{ event.authorship }}</span><p>{{ event.text || `Recorded ${event.kind} event` }}</p><router-link :to="{ path: '/conversations', query: { conversation: event.conversationId, event: event.id } }">Inspect source →</router-link></article><article v-for="asset in matches.assets.slice(0, 4)" :key="asset.id"><span>{{ asset.timestamp?.slice(0, 10) ?? 'Unknown date' }} · {{ asset.kind }}</span><p>{{ asset.available ? 'Local media available' : 'Recorded media unavailable' }}</p><router-link :to="{ path: '/library', query: { asset: asset.id } }">Inspect media →</router-link></article></div><p v-if="!matchingIds.length" class="explanation-note">No supported recorded items match. Change your request or filters; no evidence is invented.</p><button v-if="proposal.plan.kind !== 'explain'" class="btn btn-primary apply-button" :disabled="!matchingIds.length" @click="apply">{{ proposal.plan.status ? `Apply ${proposal.plan.status} to ${matchingIds.length} items` : 'Apply this filter' }}</button><button class="btn btn-ghost cancel-button" @click="proposal = null">Discard preview</button></template></template><p v-else-if="!result && !error" class="preview-empty">A preview shows the exact filter and its local matches. You can open every source before making a decision.</p></section></div>
	</div></div>
</template>

<style scoped>
.assistant-container { max-width: 1340px; }.assistant-heading { margin-bottom: 32px; }.assistant-heading h1 { margin-top: 18px; font-size: clamp(3rem, 5vw, 5rem); }.assistant-heading em { color: var(--secondary); font-style: normal; }.assistant-heading > p { margin-top: 20px; max-width: 620px; color: var(--text-soft); }.assistant-grid { display: grid; grid-template-columns: .9fr 1.1fr; gap: 24px; margin-top: 24px; }.command-card, .preview-card { background: #faf6eb; border: 1px solid var(--border); border-radius: 28px; padding: 32px; }.command-card { align-self: start; }.panel-kicker { font-size: .7rem; text-transform: uppercase; letter-spacing: .13em; color: var(--secondary); }.assistant-grid h2 { font-family: var(--font-serif); font-size: 2rem; margin: 16px 0 20px; }.capability-note { font-size: .85rem; color: var(--text-soft); }.command-card form { display: grid; gap: 12px; margin-top: 24px; }.command-card form label { font-size: .78rem; color: var(--text-soft); }.command-card textarea { border: 1px solid var(--border-strong); border-radius: 14px; background: #fffbf3; font: inherit; font-size: 1rem; padding: 18px; resize: vertical; }.command-card form button { justify-self: start; }.suggestions { display: grid; gap: 6px; margin-top: 22px; }.suggestions button { border: 0; background: transparent; text-align: left; color: var(--secondary); padding: 12px 4px; border-bottom: 1px solid var(--border); font-size: .85rem; }.assistant-boundary { margin-top: 30px; background: #e8ecdc; border-radius: 14px; padding: 20px; font-size: .85rem; }.assistant-boundary p { margin-top: 8px; font-size: .8rem; color: var(--text-soft); }.proposal-description, .preview-empty { color: var(--text-soft); font-size: .87rem; }.preview-empty { padding: 50px 0; }.match-counts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 24px 0; }.match-counts strong { display: block; font-size: 2rem; color: var(--secondary); }.match-counts span { font-size: .73rem; color: var(--text-soft); }.query-summary { margin: 0; font-size: .8rem; }.query-summary > div { display: flex; justify-content: space-between; gap: 20px; border-bottom: 1px solid var(--border); padding: 10px 0; }.query-summary dt { color: var(--text-soft); }.query-summary dd { margin: 0; text-align: right; }.explanation-note { font-size: .79rem; color: var(--text-soft); margin-top: 18px; }.person-count { display: flex; justify-content: space-between; gap: 20px; font-size: .9rem; padding: 10px 0; border-bottom: 1px solid var(--border); }.person-count strong { color: var(--secondary); }.match-preview { display: grid; gap: 12px; margin-top: 22px; }.match-preview article { padding: 15px 18px; background: #efe8d8; border-radius: 12px; }.match-preview span { font-size: .7rem; color: var(--text-soft); }.match-preview p { font-size: .86rem; overflow-wrap: anywhere; margin-top: 7px; }.match-preview a { font-size: .75rem; color: var(--secondary); }.apply-button, .cancel-button { margin-top: 24px; font-size: .8rem; }.apply-button:disabled { background: #ddd5c5; box-shadow: none; cursor: default; }.error-message { padding: 18px; background: #f3e1d4; border-radius: 12px; font-size: .85rem; }.result-message { padding: 20px; background: #e0ebdb; border-radius: 14px; font-size: .85rem; }.result-message > div { display: grid; gap: 12px; margin-top: 16px; }.result-message a { color: var(--secondary); }.result-message button { text-align: left; border: 0; padding: 0; background: transparent; color: var(--secondary); font-size: .8rem; }button:focus-visible, textarea:focus-visible { outline: 3px solid var(--accent-strong); outline-offset: 3px; }
@media (max-width: 1000px) { .assistant-grid { grid-template-columns: 1fr; } }
</style>
