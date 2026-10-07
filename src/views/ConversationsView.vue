<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useWorkspaceStore } from "../stores/workspace";
import WorkspaceFilters from "../components/WorkspaceFilters.vue";
import LocalAsset from "../components/LocalAsset.vue";
import { useModalFocus } from "../composables/useModalFocus";
import { authorLabel } from "../lib/evidenceLabels";
import type { ConversationEvent, MediaAsset } from "../types/dataset";

const workspace = useWorkspaceStore();
const route = useRoute();
const router = useRouter();
const selectedConversationId = ref<string | null>(null);
const sourceEvent = ref<ConversationEvent | null>(null);
const focusedAsset = ref<MediaAsset | null>(null);
const focusedEvent = ref<ConversationEvent | null>(null);
const windowStart = ref(0);
const windowSize = 60;
const jumpDate = ref("");
const thread = ref<HTMLElement | null>(null);
const participants = computed(() => new Map(workspace.dataset?.participants.map((person) => [person.id, person]) ?? []));
const assets = computed(() => new Map(workspace.dataset?.assets.map((asset) => [asset.id, asset]) ?? []));
const visibleAssetIds = computed(() => new Set(workspace.filteredAssets.map((asset) => asset.id)));
const conversations = computed(() => {
	const matching = new Set(workspace.filteredEvents.map((event) => event.conversationId));
	return (workspace.dataset?.conversations ?? []).filter((conversation) => matching.has(conversation.id));
});
const selectedConversation = computed(() => conversations.value.find((conversation) => conversation.id === selectedConversationId.value) ?? conversations.value[0] ?? null);
const events = computed(() => workspace.filteredEvents.filter((event) => event.conversationId === selectedConversation.value?.id));
const visibleEvents = computed(() => events.value.slice(windowStart.value, windowStart.value + windowSize));
const selectedCount = computed(() => workspace.selectedEvents.filter((event) => event.conversationId === selectedConversation.value?.id).length);

function sender(event: ConversationEvent) {
	return authorLabel(event.authorship, participants.value.get(event.participantId ?? "")?.displayName);
}
function formattedDate(timestamp: string | null, full = false) { if (!timestamp) return "Time not recorded"; return new Intl.DateTimeFormat("en", { timeZone: workspace.dataset?.timezone ?? "UTC", ...(full ? { dateStyle: "medium" as const } : { hour: "2-digit" as const, minute: "2-digit" as const }) }).format(new Date(timestamp)); }
function dayKey(event: ConversationEvent) { return event.timestamp?.slice(0, 10) ?? "undated"; }
function eventAssets(event: ConversationEvent) { return event.assetIds.map((id) => assets.value.get(id)).filter((asset): asset is MediaAsset => Boolean(asset && visibleAssetIds.value.has(asset.id))); }
function candidates(event: ConversationEvent) { return (workspace.dataset?.links ?? []).filter((link) => link.eventId === event.id && link.status !== "confirmed"); }
function preview(conversationId: string) { const event = workspace.filteredEvents.find((event) => event.conversationId === conversationId); return event?.text ?? (event ? `Recorded ${event.kind}` : "No text available"); }
function conversationDate(conversationId: string) { const dated = workspace.filteredEvents.filter((event) => event.conversationId === conversationId && event.timestamp); return dated.length ? formattedDate(dated[dated.length - 1]!.timestamp, true) : "Undated history"; }
function selectConversation(id: string) { selectedConversationId.value = id; windowStart.value = 0; sourceEvent.value = null; router.replace({ path: "/conversations", query: { conversation: id } }); }
async function revealEvent(id: string) {
	const index = events.value.findIndex((event) => event.id === id);
	if (index < 0) return;
	windowStart.value = Math.max(0, index - 8);
	await nextTick();
	thread.value?.querySelector<HTMLElement>(`[data-event-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center", behavior: "instant" });
}
function jumpToDate() { const index = events.value.findIndex((event) => event.timestamp && event.timestamp.slice(0, 10) >= jumpDate.value); if (index >= 0) revealEvent(events.value[index]!.id); }
function openMedia(asset: MediaAsset, event: ConversationEvent) { focusedAsset.value = asset; focusedEvent.value = event; }
function closeMedia() { const event = focusedEvent.value; focusedAsset.value = null; focusedEvent.value = null; if (event) nextTick(() => thread.value?.querySelector<HTMLElement>(`[data-event-id="${CSS.escape(event.id)}"] button`)?.focus()); }
const viewerDialog = useModalFocus(() => Boolean(focusedAsset.value), closeMedia);
watch(() => [workspace.query, workspace.dataset?.fingerprint], () => { windowStart.value = 0; sourceEvent.value = null; focusedAsset.value = null; }, { deep: true });
watch(() => [workspace.dataset?.revision, workspace.filteredEvents, workspace.filteredAssets], () => {
	const visibleIds = new Set(workspace.filteredEvents.map((event) => event.id));
	if (sourceEvent.value) sourceEvent.value = workspace.filteredEvents.find((event) => event.id === sourceEvent.value?.id) ?? null;
	if (focusedEvent.value && !visibleIds.has(focusedEvent.value.id)) closeMedia();
	if (focusedAsset.value && !workspace.filteredAssets.some((asset) => asset.id === focusedAsset.value?.id)) closeMedia();
});
watch(() => route.query, async () => { if (typeof route.query.conversation === "string") selectedConversationId.value = route.query.conversation; if (typeof route.query.event === "string") await revealEvent(route.query.event); }, { immediate: true });
watch(events, async () => { if (typeof route.query.event === "string") await revealEvent(route.query.event); });
onMounted(() => { if (!workspace.dataset) workspace.loadFromArchive(); });
</script>

<template>
	<div class="page conversations-page"><div class="container">
		<header class="room-heading"><div><span class="eyebrow">The conversation room</span><h1>Read between<br>the memories.</h1></div><p>Old jokes. Long nights. The photo that explains everything. Your recorded exchanges, back in context.</p></header>
		<WorkspaceFilters compact />
		<div v-if="workspace.loading" class="empty-room" role="status">Connecting your conversations...</div>
		<div v-else-if="workspace.error" class="empty-room" role="alert">{{ workspace.error }}<button class="btn btn-secondary" @click="workspace.loadFromArchive()">Try again</button></div>
		<div v-else-if="!conversations.length" class="empty-room"><h2>No exchanges in this selection.</h2><p>Some exports omit conversation history. Try clearing filters or check the coverage in the observatory.</p><button class="btn btn-secondary" @click="workspace.resetQuery()">Clear filters</button></div>
		<div v-else class="conversation-workbench">
			<aside class="conversation-list" aria-label="Conversations"><div class="list-heading">{{ conversations.length }} recorded conversations</div><button v-for="conversation in conversations" :key="conversation.id" class="conversation-button" :class="{ selected: selectedConversation?.id === conversation.id }" @click="selectConversation(conversation.id)"><span class="avatar">{{ conversation.title.slice(0,1).toUpperCase() }}</span><span class="conversation-copy"><strong>{{ conversation.title }}</strong><small>{{ conversationDate(conversation.id) }}</small><span>{{ preview(conversation.id) }}</span></span><span class="conversation-count">{{ workspace.filteredEvents.filter(event => event.conversationId === conversation.id).length }}</span></button></aside>
			<section class="thread-shell" aria-label="Recorded conversation"><header class="thread-heading"><div><h2>{{ selectedConversation?.title }}</h2><p>{{ selectedCount }} selected events · {{ workspace.dataset?.timezone }}<span v-if="selectedConversation && selectedConversation.participantIds.length > 2"> · Recorded group context</span></p></div><div class="jump"><label for="jump-date">Jump to date</label><input id="jump-date" v-model="jumpDate" type="date"><button @click="jumpToDate" :disabled="!jumpDate">Go</button></div></header>
				<p v-if="typeof route.query.event === 'string' && !events.some(event => event.id === route.query.event)" class="context-warning" role="status">That event is outside the current filters or is excluded. Clear filters or review your exclusions to find its context.</p>
				<div ref="thread" class="thread"><button v-if="windowStart > 0" class="context-button" @click="windowStart = Math.max(0, windowStart - windowSize)">Earlier context · {{ windowStart }} events above</button>
					<template v-for="(event, index) in visibleEvents" :key="event.id"><p v-if="index === 0 || dayKey(event) !== dayKey(visibleEvents[index - 1]!)" class="day-separator">{{ formattedDate(event.timestamp, true) }}</p><article class="message" :class="{ owner: event.authorship === 'owner', excluded: workspace.decisions[event.id]?.status === 'exclude' }" :data-event-id="event.id"><div class="message-top"><strong>{{ sender(event) }}</strong><span>{{ formattedDate(event.timestamp) }}</span></div><p v-if="event.text" class="message-text">{{ event.text }}</p><p v-else class="missing-text">Recorded {{ event.kind }}. Text was not included.</p><button v-for="asset in eventAssets(event)" :key="asset.id" class="inline-media" :aria-label="`Open ${asset.kind} from ${sender(event)}`" @click="openMedia(asset, event)"><LocalAsset :asset-id="asset.id" :path="asset.path" :overlay-path="asset.overlayPath" :kind="asset.kind" :label="`Recorded ${asset.kind}`" /></button><p v-if="!event.text && !eventAssets(event).length" class="attachment-gap">Its available record is preserved. An original attachment may be missing.</p><details v-for="link in candidates(event)" :key="link.id" class="link-candidate"><summary>{{ link.status }} media association</summary><p>{{ link.basis }}</p><p v-if="link.missingReason">{{ link.missingReason }}</p><small>Association candidates stay separate from recorded attachments.</small><LocalAsset v-if="visibleAssetIds.has(link.assetId) && assets.get(link.assetId)?.available" :asset-id="link.assetId" :path="assets.get(link.assetId)?.path ?? null" :kind="assets.get(link.assetId)?.kind ?? 'unknown'" label="Association candidate" /><div class="message-actions"><button v-if="visibleAssetIds.has(link.assetId) && assets.get(link.assetId)?.available" @click="workspace.decideAssociation(link.id, 'confirm')">Confirm association</button><button @click="workspace.decideAssociation(link.id, 'reject')">Reject association</button><button v-if="workspace.associationDecisions[link.id]" @click="workspace.decideAssociation(link.id, 'undo')">Undo association decision</button></div></details><div class="message-actions"><button @click="sourceEvent = event">Source</button><button @click="workspace.decide(event.id, 'keep')">Keep</button><button @click="workspace.decide(event.id, 'exclude')">Exclude</button><button @click="workspace.decide(event.id, 'later')">Later</button><span v-if="workspace.decisions[event.id]">{{ workspace.decisions[event.id]?.status }}</span></div></article></template>
					<button v-if="windowStart + windowSize < events.length" class="context-button" @click="windowStart += windowSize">Later context · {{ events.length - windowStart - windowSize }} events below</button></div>
				<footer class="thread-footer">The export may contain gaps. Available messages are evidence; missing messages stay missing.</footer>
			</section>
		</div>
		<section v-if="sourceEvent" class="source-panel card"><button class="close-source" aria-label="Close source inspector" @click="sourceEvent = null">Close</button><span class="eyebrow">Evidence inspector</span><h2>Where this message came from</h2><dl><div><dt>Authorship</dt><dd>{{ sourceEvent.authorship }}</dd></div><div><dt>Recorded time</dt><dd>{{ sourceEvent.time.raw ?? 'Not included' }}</dd></div><div><dt>Normalized time</dt><dd>{{ sourceEvent.timestamp ?? 'Unknown' }} · {{ sourceEvent.time.precision }}</dd></div><div><dt>Source occurrence</dt><dd>{{ sourceEvent.source.path }}{{ sourceEvent.source.recordPointer }}</dd></div><div><dt>Stable event ID</dt><dd>{{ sourceEvent.id }}</dd></div></dl><details><summary>Original fields</summary><pre>{{ JSON.stringify(sourceEvent.raw, null, 2) }}</pre></details></section>
	</div>
		<div v-if="focusedAsset" :ref="viewerDialog" tabindex="-1" class="viewer-overlay" role="dialog" aria-modal="true" aria-label="Media in conversation" @click.self="closeMedia" @keydown.esc="closeMedia"><section class="viewer"><button class="viewer-close" @click="closeMedia" autofocus>Close</button><LocalAsset :asset-id="focusedAsset.id" :path="focusedAsset.path" :overlay-path="focusedAsset.overlayPath" :kind="focusedAsset.kind" focused /><p>{{ selectedConversation?.title }} · {{ formattedDate(focusedEvent?.timestamp ?? null, true) }}</p><p v-if="focusedAsset.overlayPath" class="viewer-note">Original with its separate recorded overlay. Source components remain unchanged.</p></section></div>
	</div>
</template>

<style scoped>
.conversations-page{padding-top:58px}.room-heading{display:flex;justify-content:space-between;align-items:end;gap:40px;margin-bottom:34px}.room-heading h1{font-size:clamp(3rem,5vw,4.8rem);margin-top:12px}.room-heading>p{max-width:340px;color:var(--text-soft);font-size:1.05rem}.conversation-workbench{display:grid;grid-template-columns:310px minmax(0,1fr);gap:20px;margin-top:24px;min-height:650px}.conversation-list{background:var(--bg-card);border:1px solid var(--border);border-radius:20px;padding:12px;height:760px;overflow:auto}.list-heading{padding:12px;font-size:.72rem;text-transform:uppercase;letter-spacing:.1em;color:var(--text-soft)}.conversation-button{display:flex;align-items:center;gap:12px;width:100%;padding:16px 12px;border:0;border-radius:12px;background:transparent;text-align:left}.conversation-button.selected{background:var(--secondary-soft)}.avatar{display:grid;place-items:center;flex-shrink:0;width:42px;height:42px;border-radius:14px;background:#dac5a0;color:var(--text-h);font-weight:700}.conversation-copy{min-width:0;display:grid;gap:2px}.conversation-copy strong{font-size:.95rem}.conversation-copy small{font-size:.65rem;color:var(--text-soft)}.conversation-copy>span{max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.78rem;color:var(--text-soft)}.conversation-count{margin-left:auto;font-size:.7rem;color:var(--secondary)}.thread-shell{background:rgba(255,251,245,.55);border:1px solid var(--border);border-radius:20px;overflow:hidden}.thread-heading{padding:24px;display:flex;align-items:center;justify-content:space-between;gap:20px;border-bottom:1px solid var(--border)}.thread-heading h2{font-size:1.65rem}.thread-heading p{font-size:.75rem;color:var(--text-soft);margin-top:6px}.jump{display:grid;grid-template-columns:1fr auto;gap:4px;font-size:.66rem;color:var(--text-soft)}.jump label{grid-column:span 2}.jump input,.jump button{padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-elevated);color:var(--text)}.thread{height:620px;overflow:auto;padding:20px 32px;scroll-behavior:auto}.day-separator{text-align:center;font-size:.7rem;color:var(--text-soft);margin:18px 0 22px}.message{width:fit-content;max-width:83%;min-width:160px;padding:14px 18px;border-radius:16px 16px 16px 4px;background:#fff;box-shadow:0 3px 14px #46392308;margin:12px 0}.message.owner{margin-left:auto;background:#eedca5;border-radius:16px 16px 4px 16px}.message.excluded{opacity:.55}.message-top{display:flex;justify-content:space-between;gap:22px;align-items:center;margin-bottom:6px}.message-top strong{font-size:.74rem}.message-top span{font-size:.64rem;color:var(--text-soft)}.message-text{white-space:pre-wrap;overflow-wrap:anywhere;font-size:.95rem}.missing-text,.attachment-gap{font-size:.78rem;color:var(--text-soft)}.inline-media{display:block;width:310px;max-width:100%;padding:0;background:none;border:0;margin:10px 0}.message-actions{display:flex;gap:10px;align-items:center;margin-top:10px}.message-actions button{border:0;background:transparent;color:var(--text-soft);font-size:.62rem;padding:3px 0}.message-actions span{color:var(--secondary);font-size:.65rem}.context-button{display:block;margin:12px auto;border:1px solid var(--border);border-radius:20px;background:white;padding:8px 16px;color:var(--secondary);font-size:.72rem}.thread-footer{padding:14px 24px;font-size:.7rem;color:var(--text-soft);border-top:1px solid var(--border)}.link-candidate{font-size:.72rem;margin:10px 0;color:var(--text-soft)}.source-panel{padding:30px;margin-top:24px}.source-panel h2{font-size:1.5rem;margin:10px 0 20px}.source-panel dl{display:grid;gap:12px}.source-panel dl>div{display:grid;grid-template-columns:150px 1fr;gap:15px;font-size:.82rem}.source-panel dt{color:var(--text-soft)}.source-panel dd{margin:0;overflow-wrap:anywhere}.source-panel pre{overflow:auto;font-size:.75rem;max-height:300px}.close-source{float:right;border:0;background:var(--secondary-soft);color:var(--secondary);border-radius:20px;padding:8px 18px}.empty-room{text-align:center;padding:70px 30px;display:grid;gap:20px;justify-items:center}.empty-room h2{font-size:2rem}.empty-room p{max-width:500px;color:var(--text-soft)}.context-warning{padding:12px 24px;color:var(--danger);font-size:.82rem}.viewer-overlay{position:fixed;inset:0;z-index:150;background:#181710bd;display:grid;place-items:center;padding:40px}.viewer{position:relative;background:var(--bg);width:min(900px,90vw);padding:24px;border-radius:20px}.viewer-close{margin-bottom:16px;display:block;margin-left:auto;border:0;background:var(--secondary-soft);padding:9px 20px;border-radius:20px;color:var(--secondary)}.viewer>p{margin-top:14px;font-size:.9rem}.viewer-note{color:var(--text-soft)}@media(max-width:950px){.conversation-workbench{grid-template-columns:240px 1fr}.room-heading{align-items:start}.jump{display:none}}@media(max-width:700px){.room-heading{display:block}.room-heading>p{margin-top:20px}.conversation-workbench{grid-template-columns:1fr}.conversation-list{height:200px}.thread{padding:16px}.message{max-width:92%}}
</style>
