<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { useWorkspaceStore } from "../stores/workspace";
import ArchiveScene from "../components/ArchiveScene.vue";
import WorkspaceFilters from "../components/WorkspaceFilters.vue";
import { defaultProfileYear, prepareProfilePacket, type YearProfile, type ProfileStyleChoices } from "../lib/yearProfile";
import { yearProfileJob } from "../lib/yearProfileJob";
import { emptyProfileEdit, useYearProfileDraftStore, type ProfileEdit } from "../stores/yearProfileDrafts";
import { createProfileTopicProposals, type ProfileTopicProposal } from "../lib/curationProposals";

const emptyEdit = emptyProfileEdit;
const workspace = useWorkspaceStore();
const drafts = useYearProfileDraftStore();
const motion = ref(true);
const year = computed(() => workspace.query.year ?? defaultProfileYear(workspace.selectedEvents, workspace.dataset?.timezone ?? "UTC") ?? workspace.years[0] ?? new Date().getFullYear());
const draft = computed(() => drafts.forYear(year.value));
const styleChoices = computed<ProfileStyleChoices>({ get: () => draft.value.styleChoices, set: (choices) => drafts.setStyle(year.value, choices) });
const intensity = computed({ get: () => styleChoices.value.intensity, set: (value) => { styleChoices.value = { ...styleChoices.value, intensity: value }; } });
const currentEdit = computed(() => draft.value.edit);
const editorRevision = computed(() => draft.value.editorRevision);
const suspended = computed(() => draft.value.suspension !== null);
const suspensionLabel = computed(() => draft.value.suspension === "discarded" ? "Local profile discarded" : "Local calculation canceled");
const profile = shallowRef<YearProfile | null>(null);
const calculating = ref(false);
const calculationError = ref("");
const progress = ref({ fraction: 0, stage: "Preparing local profile" });
const changeBefore = computed(() => draft.value.changeBefore);
const topic = ref("");
const topicProposals = createProfileTopicProposals({
	current: () => workspace.dataset && profile.value ? { dataset: workspace.dataset, query: workspace.query, decisions: workspace.decisions,
		queryRevision: workspace.queryRevision, reviewRevision: workspace.reviewRevision, profile: profile.value,
		editorRevision: editorRevision.value, styleChoices: styleChoices.value } : null,
	edit: (removal) => updateEdit({ ...currentEdit.value, topics: [...currentEdit.value.topics, removal] }),
});
const topicPreview = ref<ProfileTopicProposal | null>(null);
const topicCurrent = computed(() => topicPreview.value !== null && topicProposals.isCurrent(topicPreview.value));
const topicPage = ref(0);
const visibleTopicIds = computed(() => topicPreview.value?.eventIds.slice(topicPage.value * 8, (topicPage.value + 1) * 8) ?? []);
const packetOpen = ref(false);
const packet = computed(() => packetOpen.value && profile.value ? prepareProfilePacket(profile.value) : null);
const evidence = ref<{ label: string; ids: string[] } | null>(null);
const evidenceCount = ref(6);
const profileEvents = computed(() => {
	const ids = new Set(profile.value?.evidenceIds ?? []);
	return new Map(workspace.selectedEvents.filter((event) => ids.has(event.id)).map((event) => [event.id, event]));
});
const inspectedEvents = computed(() => (evidence.value?.ids ?? []).slice(0, evidenceCount.value).flatMap((id) => profileEvents.value.get(id) ? [profileEvents.value.get(id)!] : []));
let calculation = new AbortController();
let calculationGeneration = 0;

watch(() => [workspace.dataset, workspace.selectedEvents, year.value, editorRevision.value, JSON.stringify(styleChoices.value), suspended.value, workspace.queryRevision, workspace.reviewRevision], async () => {
	calculation.abort(); calculation = new AbortController(); const job = calculation; const generation = ++calculationGeneration;
	profile.value = null; evidence.value = null; topicPreview.value = null; packetOpen.value = false;
	calculationError.value = ""; calculating.value = false;
	if (!workspace.dataset || suspended.value) return;
	const data = workspace.dataset; const queryRevision = workspace.queryRevision; const reviewRevision = workspace.reviewRevision;
	const revision = editorRevision.value;
	calculating.value = true; progress.value = { fraction: 0, stage: "Preparing local profile" };
	try {
		const edit = currentEdit.value;
		const result = await yearProfileJob(data, workspace.selectedEvents, year.value, {
			excludedEventIds: [...new Set([...edit.events, ...edit.topics.flatMap((item) => item.eventIds)])],
			excludedConversationIds: [...edit.conversations], queryRevision, reviewRevision, editorRevision: revision,
			styleChoices: { ...styleChoices.value },
		}, job.signal, (update) => { if (!job.signal.aborted && generation === calculationGeneration) progress.value = update; });
		if (!job.signal.aborted && generation === calculationGeneration && workspace.dataset?.revision === data.revision && workspace.queryRevision === queryRevision && workspace.reviewRevision === reviewRevision && editorRevision.value === revision) profile.value = result;
	} catch (error) { if (!job.signal.aborted) calculationError.value = error instanceof Error ? error.message : "Local profile calculation failed."; }
	finally { if (!job.signal.aborted && generation === calculationGeneration) calculating.value = false; }
}, { immediate: true });
function updateEdit(next: ProfileEdit) {
	drafts.edit(year.value, next, profile.value?.messageCount ?? null);
}
function removeExample(id: string) { updateEdit({ ...currentEdit.value, events: [...new Set([...currentEdit.value.events, id])] }); }
function removeConversation(id: string) { updateEdit({ ...currentEdit.value, conversations: [...new Set([...currentEdit.value.conversations, id])] }); }
function restoreConversation(id: string) { updateEdit({ ...currentEdit.value, conversations: currentEdit.value.conversations.filter((item) => item !== id) }); }
function undoProfileEdit() {
	drafts.undo(year.value, profile.value?.messageCount ?? null);
}
function prepareTopic() {
	const prepared = topicProposals.prepare(topic.value);
	if ("error" in prepared) { topicPreview.value = null; return; }
	topicPreview.value = prepared;
	topicPage.value = 0;
}
function applyTopic() {
	if (!topicPreview.value) return;
	const applied = topicProposals.apply(topicPreview.value);
	if ("error" in applied) return;
	topic.value = "";
}
function inspect(label: string, ids: string[]) {
	const allowed = new Set(profile.value?.evidenceIds ?? []);
	evidence.value = { label, ids: [...new Set(ids)].filter((id) => allowed.has(id)) }; evidenceCount.value = 6;
}
function cancelProfile() { calculation.abort(); calculationGeneration++; calculating.value = false; drafts.cancel(year.value); profile.value = null; evidence.value = null; packetOpen.value = false; }
function discardProfile() {
	calculation.abort(); calculationGeneration++; calculating.value = false;
	drafts.discard(year.value); profile.value = null; evidence.value = null; packetOpen.value = false;
	topic.value = ""; topicPreview.value = null;
}
function regenerate() { drafts.regenerate(year.value); }
onBeforeUnmount(() => { calculation.abort(); calculationGeneration++; profile.value = null; });
onMounted(async () => { if (!workspace.dataset) await workspace.loadFromArchive(); });
</script>

<template>
	<div class="page year-room-page"><div class="container year-container">
		<header class="year-heading">
			<div><span class="eyebrow">The year room</span><h1>Hello,<br /><em>{{ year }}.</em></h1></div>
			<p>A little room for the way you used to write. Evidence first. Imagination, clearly labelled.</p>
		</header>
		<WorkspaceFilters compact />
		<p v-if="workspace.error" role="alert">{{ workspace.error }}</p>
		<div class="year-grid">
			<section class="presence-card">
				<div class="presence-title"><span>A procedural imagined presence</span><label><input v-model="motion" type="checkbox" /> Motion</label></div>
				<ArchiveScene mode="persona" :nodes="[]" :motion="motion" />
				<div class="presence-caption"><span>Fictional character · No likeness or voice cloning</span><p>Your original memories stay on your device.</p></div>
				<div class="intensity"><label for="style-intensity">Style intensity</label><input id="style-intensity" v-model.number="intensity" type="range" min="0" max="1" step="0.1" /><span>{{ Math.round(intensity * 100) }}%</span></div>
				<p class="minor">Intensity is your preference. It does not change measured language or establish a convincing recreation.</p>
			</section>
			<section class="conversation-card">
				<span class="panel-kicker">Meet the imagined self</span><h2>A conversation across time.</h2>
				<div class="connection-state" role="status"><strong>Live AI is not connected.</strong><p>Your local profile works now. A live conversation needs verified identity, your own funded connection with a finite provider cap, an approved evidence packet, and a bounded budget.</p><p>No shared AI key or automatic paid fallback is used.</p></div>
				<router-link to="/account" class="btn btn-secondary">Manage account and AI connection</router-link>
			</section>
		</div>
		<section v-if="calculating" class="profile-section profile-progress" aria-live="polite">
			<h2>Measuring the evidence for {{ year }}.</h2><p>{{ progress.stage }}</p><progress :value="progress.fraction" max="1" aria-label="Local profile progress"></progress>
			<button class="btn btn-secondary" @click="cancelProfile">Cancel local calculation</button>
		</section>
		<section v-else-if="suspended || calculationError" class="profile-section">
			<h2>{{ calculationError ? 'This profile needs a smaller collection.' : suspensionLabel }}</h2>
			<p v-if="calculationError" role="alert">{{ calculationError }}</p><p>Your source messages and shared review decisions remain available.</p>
			<button class="btn btn-primary" @click="regenerate">Generate local profile</button>
		</section>
		<section v-if="profile" class="profile-section">
			<div class="profile-heading"><div><span class="panel-kicker">Measured language · {{ profile.timezone }}</span><h2>The evidence for {{ year }}.</h2></div><span class="profile-state">{{ profile.sufficiency === 'insufficient' ? 'Insufficient evidence' : profile.sufficiency === 'limited' ? 'Limited language sketch' : 'Represented local language' }}</span></div>
			<p class="selection-summary">{{ profile.messageCount }} measured messages from {{ profile.eligibleMessageCount }} eligible owner messages. {{ profile.examples.length }} balanced examples. Profile edits apply only in this room.</p>
			<p v-if="changeBefore !== null" role="status" class="selection-summary">Profile evidence: {{ changeBefore }} → {{ profile.messageCount }} messages. Shared collection decisions are unchanged.</p>
			<div class="profile-stats">
				<article><strong>{{ profile.messageCount }}</strong><span>Proven owner messages</span></article>
				<article><strong>{{ profile.activeDays }}</strong><span>Recorded active days</span></article>
				<article><strong>{{ profile.activeMonths.length }}</strong><span>Observed months</span></article>
				<article><strong>{{ profile.uniqueTextCount }}</strong><span>Distinct message texts</span></article>
				<article><strong>{{ profile.duplicateMessageCount }}</strong><span>Exact repeated texts retained</span></article>
				<article><strong>{{ profile.tokenCount }}</strong><span>Unicode word tokens</span></article>
			</div>
			<div class="measurement-grid">
				<article v-for="metric in profile.measurements" :key="metric.id"><strong>{{ metric.value.toFixed(1) }}</strong><h3>{{ metric.label }}</h3><p>{{ metric.unit }} · denominator {{ metric.denominator }} {{ metric.denominatorUnit }}</p><small>{{ metric.policy }}</small><button @click="inspect(metric.label, metric.eventIds)">Inspect measured sources ({{ metric.eventIds.length }})</button></article>
			</div>
			<div class="profile-details">
				<div>
					<h3>Words you left behind</h3><p>{{ profile.tokenCount }} Unicode word tokens. External URLs are omitted from tokens. Rates use 1,000 tokens; language identity is unknown.</p>
					<div class="word-chips"><button v-for="term in profile.terms.slice(0, 20)" :key="term.word" @click="inspect(term.word, term.eventIds)">{{ term.word }} <small>{{ term.count }} · {{ term.perThousandTokens.toFixed(1) }}/1k</small></button><p v-if="!profile.terms.length">No eligible words remain in this profile.</p></div>
					<h3 class="emoji-heading">Repeated phrases</h3><p>Consecutive two- and three-token phrases within messages. Repeated texts count. Each rate uses that phrase length's possible positions.</p>
					<div class="word-chips"><button v-for="phrase in profile.phrases.slice(0, 12)" :key="phrase.word" @click="inspect(phrase.word, phrase.eventIds)">{{ phrase.word }} <small>{{ phrase.count }} · {{ phrase.perThousandTokens.toFixed(1) }}/1k of {{ phrase.denominator }} positions</small></button><p v-if="!profile.phrases.length">No two-token phrase evidence remains.</p></div>
					<h3 class="emoji-heading">Recorded emoji</h3><div class="word-chips"><button v-for="symbol in profile.emoji.slice(0, 12)" :key="symbol.emoji" @click="inspect(symbol.emoji, symbol.eventIds)">{{ symbol.emoji }} <small>{{ symbol.count }} · {{ profile.messageCount ? (symbol.count / profile.messageCount * 100).toFixed(1) : '0' }}/100 messages</small></button><p v-if="!profile.emoji.length">No emoji in the selected owner text.</p></div>
				</div>
				<div>
					<h3>Where the evidence comes from</h3><p>Conversation contributions use the full measured population. Group contexts can contain several audiences; they do not prove one recipient.</p>
					<p v-for="contribution in profile.eligibleContributions.slice(0, 40)" :key="contribution.conversationId" class="contribution"><router-link :to="{ path: '/conversations', query: { conversation: contribution.conversationId } }">{{ contribution.title }}</router-link><span>{{ contribution.selectedCount }}/{{ contribution.count }} messages</span><button v-if="currentEdit.conversations.includes(contribution.conversationId)" @click="restoreConversation(contribution.conversationId)">Restore in profile</button><button v-else @click="removeConversation(contribution.conversationId)">Remove conversation from profile</button></p>
					<p v-if="profile.eligibleContributions.length > 40">Showing the first 40 contributing conversations. Use the shared conversation filter to inspect a narrower context.</p><p v-if="!profile.eligibleContributions.length">No eligible conversation evidence.</p>
				</div>
			</div>
			<h3 class="emoji-heading">Compare recorded contexts</h3><p class="selection-summary">Rates use each context's own message count. Small samples remain sparse; these are observations, not explanations of relationships.</p>
			<div class="context-table"><table><thead><tr><th>Conversation</th><th>Messages / share</th><th>Word tokens</th><th>Mean characters</th><th>Questions / 100 messages</th><th>Emoji / 100 messages</th><th>Evidence</th></tr></thead><tbody><tr v-for="context in profile.contributions.slice(0, 12)" :key="context.conversationId"><th>{{ context.title }}<small v-if="context.count < 3"> · Sparse</small></th><td>{{ context.count }} / {{ Math.round(context.share * 100) }}%</td><td>{{ context.tokenCount }}</td><td>{{ context.averageLength.toFixed(1) }}</td><td>{{ context.questionsPer100Messages.toFixed(1) }}</td><td>{{ context.emojiPer100Messages.toFixed(1) }}</td><td><button @click="inspect(context.title, context.eventIds)">Open sources</button></td></tr></tbody></table></div>
			<div class="profile-limitations"><p>{{ profile.sufficiencyPolicy.reason }}</p><p>{{ profile.sufficiencyPolicy.thresholds }}</p><p v-for="limitation in profile.limitations" :key="limitation">{{ limitation }}</p><p>Omitted from selected records: {{ profile.omitted.incoming }} incoming, {{ profile.omitted.uncertainAuthor }} uncertain authors, {{ profile.omitted.unknownTime }} unknown times, {{ profile.omitted.otherYear }} other years, {{ profile.omitted.knownCopied }} known quoted/copied/forwarded, {{ profile.omitted.profileExcluded }} profile exclusions. First matching reason is counted once.</p><p v-if="profile.firstTimestamp">Recorded span: {{ profile.firstTimestamp }} to {{ profile.lastTimestamp }}. Missing history remains unknown.</p></div>
			<section class="profile-editor">
				<h3>Choose what this profile uses</h3><p>Remove a reviewed set of messages containing one literal phrase. This local match does not promise complete removal of a semantic topic.</p>
				<form @submit.prevent="prepareTopic"><label for="profile-topic">Literal phrase to review</label><input id="profile-topic" v-model="topic" maxlength="200" placeholder="A phrase you want to leave out" /><button class="btn btn-secondary" :disabled="!topic.trim()">Preview literal matches</button></form>
				<div v-if="topicPreview" class="topic-preview">
					<p>{{ topicPreview.eventIds.length }} exact matching messages. Profile count would change from {{ profile.messageCount }} to {{ profile.messageCount - topicPreview.eventIds.length }}.</p>
					<ul><li v-for="id in visibleTopicIds" :key="id"><p>{{ profileEvents.get(id)?.text }}</p><router-link v-if="profileEvents.has(id)" :to="{ path: '/conversations', query: { conversation: profileEvents.get(id)!.conversationId, event: id } }">Open matching source →</router-link></li></ul>
					<div v-if="topicPreview.eventIds.length" class="topic-pages" aria-label="Matching source pages">
						<button class="btn btn-ghost" :disabled="topicPage === 0" @click="topicPage--">Previous matching sources</button>
						<p aria-live="polite">Showing matches {{ topicPage * 8 + 1 }}–{{ Math.min((topicPage + 1) * 8, topicPreview.eventIds.length) }} of {{ topicPreview.eventIds.length }}.</p>
						<button class="btn btn-ghost" :disabled="(topicPage + 1) * 8 >= topicPreview.eventIds.length" @click="topicPage++">Next matching sources</button>
					</div>
					<button class="btn btn-secondary" :disabled="!topicPreview.eventIds.length || !topicCurrent" @click="applyTopic">Remove reviewed matches from profile</button>
				</div>
				<p v-for="(item, index) in currentEdit.topics" :key="index">Reviewed literal “{{ item.literal }}”: {{ item.eventIds.length }} source messages removed.</p>
				<div class="editor-actions"><button class="btn btn-ghost" :disabled="!draft.history.length" @click="undoProfileEdit">Undo profile edit</button><button class="btn btn-ghost" :disabled="!currentEdit.events.length && !currentEdit.conversations.length && !currentEdit.topics.length" @click="updateEdit(emptyEdit())">Restore profile evidence</button><button class="btn btn-ghost" @click="regenerate">Regenerate local profile</button><button class="btn btn-ghost" @click="discardProfile">Discard this local profile</button></div>
			</section>
			<section class="style-choices"><h3>Your style choices</h3><p>These are your preferences for a future approved interpretation. They are separate from measured tendencies.</p><label>Punctuation preference<select :value="styleChoices.punctuation" @change="styleChoices = { ...styleChoices, punctuation: ($event.target as HTMLSelectElement).value as ProfileStyleChoices['punctuation'] }"><option value="measured">Follow measured punctuation</option><option value="restrained">More restrained</option><option value="expressive">More expressive</option></select></label><label>Emoji preference<select :value="styleChoices.emoji" @change="styleChoices = { ...styleChoices, emoji: ($event.target as HTMLSelectElement).value as ProfileStyleChoices['emoji'] }"><option value="measured">Follow measured emoji</option><option value="less">Use fewer emoji</option><option value="more">Use more emoji</option></select></label></section>
			<div class="examples-heading"><h3>Open the original lines</h3><p>{{ profile.examples.length }} examples from {{ profile.messageCount }} measured messages. Round-robin conversation sampling omits exact repeated text. Removing a line here edits only this profile.</p></div>
			<div class="example-grid"><article v-for="event in profile.examples" :key="event.id"><time>{{ event.timestamp?.slice(0, 10) }}</time><blockquote>{{ event.text }}</blockquote><div><router-link :to="{ path: '/conversations', query: { conversation: event.conversationId, event: event.id } }">Open source →</router-link><button @click="removeExample(event.id)">Remove from this profile</button></div><small>{{ event.source.path }} · {{ event.source.recordPointer }}</small></article></div>
			<section v-if="evidence" class="profile-evidence"><h3>Sources for {{ evidence.label }}</h3><p>{{ evidence.ids.length }} contributing messages. Inspecting a metric does not approve external processing.</p><article v-for="event in inspectedEvents" :key="event.id"><p>{{ event.text }}</p><router-link :to="{ path: '/conversations', query: { conversation: event.conversationId, event: event.id } }">Open original conversation →</router-link></article><p v-if="!evidence.ids.length">No contributing message for this measured numerator.</p><button v-if="evidenceCount < evidence.ids.length" class="btn btn-ghost" @click="evidenceCount += 6">Show more source lines</button><button class="btn btn-ghost" @click="evidence = null">Close measured sources</button></section>
			<section class="packet-section"><h3>An inspectable packet, still on your device</h3><p>At most 12 owner examples and 500 Unicode characters per example, with local measurements and your style choices. Gateway, upstream provider, billing connection and budget are unconfigured. Sending remains unavailable.</p><button class="btn btn-secondary" :disabled="profile.sufficiency === 'insufficient'" @click="packetOpen = !packetOpen">{{ packetOpen ? 'Close local packet' : 'Inspect local evidence packet' }}</button><template v-if="packet"><p>{{ packet.excerpts.length }} bounded excerpts; {{ packet.omittedExamples }} sample examples omitted. No recipient or billing source is configured. This inspection grants no upload permission.</p><pre>{{ JSON.stringify(packet, null, 2) }}</pre><button class="btn btn-secondary" disabled>Approve and send unavailable</button></template></section>
		</section>
	</div></div>
</template>

<style scoped>
.year-container { max-width: 1460px; }.year-heading { display: flex; align-items: end; justify-content: space-between; gap: 32px; margin-bottom: 32px; }.year-heading h1 { margin-top: 16px; font-size: clamp(3.5rem, 6vw, 6rem); }.year-heading em { font-style: normal; color: var(--secondary); }.year-heading > p { max-width: 320px; color: var(--text-soft); }
.year-grid { display: grid; grid-template-columns: minmax(0, 1.12fr) minmax(340px, .88fr); gap: 24px; margin-top: 24px; }.presence-card { padding: 18px; background: #173c33; color: #f5efd4; border-radius: 28px; }.presence-title { display: flex; justify-content: space-between; gap: 16px; font-size: .74rem; padding: 8px 6px 18px; }.presence-caption { padding: 20px 8px 0; }.presence-caption span { font-size: .74rem; color: #f0d989; }.presence-caption p { margin-top: 8px; font-size: .86rem; color: #c5d4b9; }.intensity { display: flex; align-items: center; gap: 16px; padding: 22px 8px 8px; font-size: .75rem; }.intensity input { min-width: 0; flex: 1; accent-color: #efd58f; }.minor { font-size: .73rem; color: #c5d4b9; padding: 8px; }
.conversation-card { border-radius: 28px; background: #fbf7ec; padding: 32px; border: 1px solid var(--border); }.panel-kicker { font-size: .7rem; letter-spacing: .13em; text-transform: uppercase; color: var(--secondary); }.conversation-card h2 { font-family: var(--font-serif); font-size: 2rem; margin: 16px 0 24px; }.connection-state { padding: 18px; background: #eee8d8; border-radius: 14px; font-size: .8rem; }.connection-state p { color: var(--text-soft); margin-top: 8px; }
.profile-section { margin-top: 40px; padding: 32px; background: #fcf8ed; border: 1px solid var(--border); border-radius: 26px; }.profile-heading { display: flex; justify-content: space-between; gap: 20px; align-items: center; }.profile-heading h2 { font-family: var(--font-serif); font-size: 2.2rem; margin-top: 12px; }.profile-state { font-size: .75rem; padding: 9px 13px; border-radius: 7px; color: var(--secondary); background: var(--secondary-soft); }.profile-stats { display: grid; grid-template-columns: repeat(6, 1fr); margin: 30px 0; gap: 12px; }.profile-stats article { border-left: 1px solid var(--border); padding-left: 16px; }.profile-stats strong { display: block; color: var(--secondary); font-size: 2rem; }.profile-stats span { font-size: .72rem; color: var(--text-soft); }.profile-details { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }.profile-details p { color: var(--text-soft); font-size: .8rem; margin-top: 10px; }.word-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }.word-chips span { background: #efe7d5; padding: 8px 13px; border-radius: 7px; font-size: .87rem; }.word-chips small { color: var(--secondary); margin-left: 8px; }.emoji-heading { margin-top: 28px; }.contribution { display: flex; justify-content: space-between; gap: 16px; border-bottom: 1px solid var(--border); padding: 8px 0; }.contribution a { color: var(--secondary); }.profile-limitations { margin-top: 24px; padding: 20px; border-radius: 12px; background: #eee8d8; font-size: .75rem; color: var(--text-soft); }.profile-limitations p + p { margin-top: 6px; }.examples-heading { margin-top: 30px; }.examples-heading p { margin-top: 10px; color: var(--text-soft); font-size: .8rem; }.example-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 20px; }.example-grid article { padding: 20px; border: 1px solid var(--border); background: #f3ecdc; border-radius: 14px; }.example-grid time { font-size: .7rem; color: var(--text-soft); }.example-grid blockquote { margin: 14px 0; font-size: 1rem; overflow-wrap: anywhere; }.example-grid article > div { display: flex; justify-content: space-between; gap: 12px; font-size: .72rem; }.example-grid a { color: var(--secondary); }.example-grid button { border: 0; background: transparent; color: #9b5035; font-size: .72rem; }.example-grid small { display: block; font-size: .6rem; color: var(--text-soft); margin-top: 14px; overflow-wrap: anywhere; }.profile-undo { margin-top: 20px; }button:focus-visible, input:focus-visible { outline: 3px solid var(--accent-strong); outline-offset: 3px; }
@media (max-width: 1080px) { .year-grid { grid-template-columns: 1fr; }.profile-stats { grid-template-columns: repeat(3, 1fr); }.example-grid { grid-template-columns: repeat(2, 1fr); } }

.selection-summary { font-size: .82rem; color: var(--text-soft); margin-top: 14px; }
.measurement-grid { display: grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap: 12px; margin: 25px 0; }
.measurement-grid article { border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
.measurement-grid strong { color: var(--secondary); font-size: 1.8rem; }
.measurement-grid h3 { font-size: .82rem; margin: 10px 0; }
.measurement-grid p, .measurement-grid small { font-size: .68rem; color: var(--text-soft); }
.measurement-grid button, .word-chips button, .contribution button, .context-table button { font: inherit; color: var(--secondary); border: 0; background: #efe7d5; border-radius: 7px; padding: 8px 10px; cursor: pointer; }
.measurement-grid button { margin-top: 12px; font-size: .7rem; }
.profile-progress progress { display: block; width: 100%; height: 20px; accent-color: var(--secondary); margin: 18px 0; }
.profile-editor, .style-choices, .packet-section, .profile-evidence { margin-top: 30px; padding-top: 25px; border-top: 1px solid var(--border); }
.profile-editor p, .style-choices p, .packet-section p, .profile-evidence p { font-size: .82rem; color: var(--text-soft); margin: 12px 0; }
.profile-editor form { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin: 18px 0; }
.profile-editor input, .style-choices select { font: inherit; padding: 10px; border: 1px solid var(--border); background: #fffaf0; border-radius: 8px; }
.profile-editor input { flex: 1; min-width: 200px; }
.editor-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 20px; }
.style-choices label { display: inline-flex; flex-direction: column; gap: 8px; margin: 16px 20px 0 0; font-size: .8rem; }
.topic-preview { padding: 16px; border-radius: 12px; background: #ece7d9; }
.topic-preview ul { margin: 16px 20px; max-height: 260px; overflow: auto; }
.topic-preview li { margin-bottom: 10px; font-size: .8rem; overflow-wrap: anywhere; }
.topic-preview li a { color: var(--secondary); font-size: .75rem; }.topic-pages { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
.context-table { overflow-x: auto; margin-top: 18px; }
.context-table table { width: 100%; border-collapse: collapse; font-size: .73rem; }
.context-table th, .context-table td { text-align: left; padding: 10px; border-bottom: 1px solid var(--border); }
.context-table thead { color: var(--secondary); }
.profile-evidence article { padding: 14px 0; border-bottom: 1px solid var(--border); }
.profile-evidence article p { white-space: pre-wrap; overflow-wrap: anywhere; }
.profile-evidence a { color: var(--secondary); font-size: .78rem; }
.packet-section pre { white-space: pre-wrap; overflow-wrap: anywhere; font-size: .68rem; max-height: 440px; overflow: auto; background: #eee8d8; padding: 18px; margin: 20px 0; border-radius: 12px; }
@media(max-width:1080px) { .measurement-grid { grid-template-columns:repeat(3,minmax(0,1fr)); } }
@media(max-width:650px) { .measurement-grid { grid-template-columns:1fr; } .example-grid { grid-template-columns:1fr; } .year-heading { display:block; } .year-heading>p { margin-top:16px; } .profile-section { padding:20px; } }
</style>
