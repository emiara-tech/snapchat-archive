<script setup lang="ts">
import { computed, ref } from "vue";
import type { LocalObservations } from "../lib/observations";
import type { ArchiveCoverage } from "../types/dataset";
const props = defineProps<{
	observations: LocalObservations | null;
	coverage: ArchiveCoverage | null;
	busy: boolean;
	excludedDecisions: number;
}>();
const emit = defineEmits<{
	select: [room: "timeline" | "relationships" | "language", id: string];
	year: [year: number];
	review: [];
}>();
const question = ref("activity");
const questions = [
	{ id: "activity", label: "When did I leave the most traces?" },
	{ id: "people", label: "Which conversations filled this period?" },
	{ id: "content", label: "What did I keep?" },
	{ id: "years", label: "How do the recorded years compare?" },
	{ id: "coverage", label: "What is missing, and what did I exclude?" },
];
const scope = computed(() => {
	const population = props.observations?.population;
	return population?.firstDate
		? `${population.firstDate} → ${population.lastDate}`
		: "No supported dated records";
});
const population = computed(() => props.observations?.population);
const busiest = computed(
	() =>
		[...(props.observations?.timeline ?? [])].sort(
			(a, b) => b.value - a.value || a.id.localeCompare(b.id),
		)[0],
);
const missingSections = computed(() =>
	Object.entries(props.coverage?.sections ?? {}).filter(
		([, section]) => section.status !== "available",
	),
);
</script>
<template>
	<section class="notebook" aria-label="Questions about your recorded history">
		<header>
			<div>
				<span class="eyebrow">Follow a question</span>
				<h2>There's a story in the details.</h2>
			</div>
			<p>
				{{ scope }} · {{ observations?.timezone ?? "UTC" }}<br />Current
				collection · Local calculation v2
			</p>
		</header>
		<nav aria-label="Observation questions">
			<button
				v-for="item in questions"
				:key="item.id"
				:aria-pressed="question === item.id"
				@click="question = item.id"
			>
				{{ item.label }}
			</button>
		</nav>
		<p v-if="busy" role="status" class="notebook-empty">
			Recalculating the selected evidence…
		</p>
		<div v-else-if="observations && population" class="question-answer">
			<template v-if="question === 'activity'">
				<div class="answer-copy">
					<h3>
						{{
							busiest
								? `The most recorded traces: ${busiest.label}.`
								: "No usable dates in this selection."
						}}
					</h3>
					<p v-if="busiest">
						{{ busiest.value.toLocaleString() }} recorded events and standalone
						media items. Each linked asset is counted with its conversation
						event once.
					</p>
					<p>
						{{ population.activeDays }} recorded chat-active days. The longest
						consecutive run contains {{ population.longestChatRun }} days with
						conversation events. This is an archive proxy, not an official
						Snapchat streak.
					</p>
				</div>
				<table>
					<caption>
						Recorded months. Missing months are unavailable evidence.
					</caption>
					<thead>
						<tr>
							<th scope="col">Month</th>
							<th scope="col">Events + standalone media</th>
							<th scope="col">Evidence</th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="group in observations.timeline.slice(0, 64)"
							:key="group.id"
						>
							<th scope="row">{{ group.label }}</th>
							<td>{{ group.value }}</td>
							<td>
								<button @click="emit('select', 'timeline', group.id)">
									Inspect records →
								</button>
							</td>
						</tr>
					</tbody>
				</table>
				<p v-if="observations.timeline.length > 64">
					The table previews 64 months. All groups can be opened through the
					paged evidence controls above.
				</p>
			</template>
			<template v-else-if="question === 'people'">
				<div class="answer-copy">
					<h3>Recorded exchanges, with context.</h3>
					<p>
						Direct conversations are ranked by their recorded events. Group
						traffic stays in its own conversation. Counts include both sides of
						an exchange; they do not measure closeness or relationship quality.
					</p>
				</div>
				<table>
					<caption>
						Direct people and group conversations in the selected period
					</caption>
					<thead>
						<tr>
							<th scope="col">Conversation scope</th>
							<th scope="col">Events</th>
							<th scope="col">Evidence</th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="group in observations.relationships.slice(0, 64)"
							:key="group.id"
						>
							<th scope="row">{{ group.label }}</th>
							<td>{{ group.value }}</td>
							<td>
								<button @click="emit('select', 'relationships', group.id)">
									Inspect exchange →
								</button>
							</td>
						</tr>
					</tbody>
				</table>
			</template>
			<template v-else-if="question === 'content'">
				<div class="answer-copy">
					<h3>
						{{ population.events.toLocaleString() }} conversation events.
						{{
							(
								population.availableAssets + population.unavailableAssets
							).toLocaleString()
						}}
						physical media entries.
					</h3>
					<p>
						These are separate populations. A message with a photo appears in
						both, so adding them would double count some memories.
						{{ population.availableAssets }} media files are available and
						{{ population.unavailableAssets }} are missing.
						{{ population.overlayLayers }} overlay layers remain separate from these historical media counts.
					</p>
				</div>
				<table>
					<caption>
						Media proportions. Denominator:
						{{
							population.availableAssets + population.unavailableAssets
						}}
						selected physical media entries.
					</caption>
					<thead>
						<tr>
							<th scope="col">Kind</th>
							<th scope="col">Entries</th>
							<th scope="col">Share of media entries</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="kind in population.mediaKinds" :key="kind.kind">
							<th scope="row">{{ kind.kind }}</th>
							<td>{{ kind.count }}</td>
							<td>
								{{
									(
										(kind.count /
											Math.max(
												1,
												population.availableAssets +
													population.unavailableAssets,
											)) *
										100
									).toFixed(1)
								}}%
							</td>
						</tr>
					</tbody>
				</table>
				<p>
					{{ population.textMessages }} nonempty text messages:
					{{ population.ownerText }} proven owner,
					{{ population.otherText }} other authors,
					{{ population.uncertainText }} uncertain. Only proven owner text
					contributes to “my words”.
				</p>
			</template>
			<template v-else-if="question === 'years'">
				<div class="answer-copy">
					<h3>Compare what the archive actually contains.</h3>
					<p>
						Raw totals and rates use different denominators. Events per active
						day use only days with recorded conversation events. Missing history
						is not inactivity; these rates cannot describe your entire year.
					</p>
				</div>
				<table>
					<caption>
						Year activity in the current collection. Use Every year in the
						filters to compare more periods.
					</caption>
					<thead>
						<tr>
							<th scope="col">Year</th>
							<th scope="col">Events</th>
							<th scope="col">Owner text</th>
							<th scope="col">Media entries</th>
							<th scope="col">Chat-active days</th>
							<th scope="col">Events / active day</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="year in observations.years" :key="year.year">
							<th scope="row">
								<button @click="emit('year', Number(year.year))">
									{{ year.year }} →
								</button>
							</th>
							<td>{{ year.events }}</td>
							<td>{{ year.ownerText }}</td>
							<td>{{ year.assets }}</td>
							<td>{{ year.activeDays }}</td>
							<td>
								{{ year.eventsPerActiveDay?.toFixed(2) ?? "Unavailable" }}
							</td>
						</tr>
					</tbody>
				</table>
			</template>
			<template v-else>
				<div class="answer-copy">
					<h3>The gaps belong in the picture, too.</h3>
					<p>
						{{ observations.unknownDates }} selected records have no usable
						date. {{ observations.unknownLocations }} selected media entries
						have no supported coordinates. Missing files and unknown authors
						remain explicit.
					</p>
					<p>
						{{ excludedDecisions }} explicit exclusion decisions across this
						archive. Undo and review keep those decisions reversible.
					</p>
					<button @click="emit('review')">Review excluded records →</button>
				</div>
				<ul>
					<li v-for="[name, section] in missingSections" :key="name">
						{{ name }}: {{ section.status }} ·
						{{ section.recordCount }} supported records,
						{{ section.invalidCount }} invalid records, {{ section.unsupportedCount ?? 0 }} retained unsupported records
					</li>
				</ul>
				<p v-if="!missingSections.length">
					All recognized sections in this export have usable coverage. The
					export cannot prove complete lifetime history.
				</p>
			</template>
			<details class="calculation-details">
				<summary>How these answers are measured</summary>
				<p>
					Source categories: imported conversation events and media inventory.
					Counts use the current filters and effective review decisions.
					Timeline counts dated events plus unrepresented media; people counts
					direct conversation events and separate group conversations. Language
					uses proven owner-authored text, lowercase Unicode word tokens, and
					omits links. Unknown dates and authors are excluded from year
					language.
				</p>
				<p>Revision: {{ observations.revision }}</p>
				<p>
					Every number describes available imported records. Originals are
					preserved. No interpretation of personality or feelings is generated.
				</p>
			</details>
		</div>
		<p v-else class="notebook-empty">
			Open a collection to explore its recorded evidence.
		</p>
	</section>
</template>
<style scoped>
.notebook {
	margin-top: 32px;
	padding: 30px;
	border: 1px solid var(--border);
	border-radius: 24px;
	background: #fcf8ed;
}
.notebook header {
	display: flex;
	justify-content: space-between;
	gap: 24px;
	align-items: end;
}
.notebook h2 {
	font: 500 2.1rem var(--font-serif);
	margin-top: 14px;
}
.notebook header p {
	font-size: 0.75rem;
	color: var(--text-soft);
	text-align: right;
}
.notebook nav {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	margin-top: 24px;
}
.notebook button {
	border: 1px solid var(--border);
	background: #f7f0e1;
	border-radius: 8px;
	padding: 9px 13px;
	color: var(--secondary);
	font: inherit;
	font-size: 0.8rem;
}
.notebook nav button[aria-pressed="true"] {
	background: var(--secondary);
	color: #fff7de;
}
.question-answer {
	padding-top: 26px;
}
.answer-copy h3 {
	font: 500 1.6rem var(--font-serif);
}
.question-answer p {
	font-size: 0.85rem;
	color: var(--text-soft);
	margin-top: 12px;
	max-width: 900px;
}
.question-answer table {
	width: 100%;
	border-collapse: collapse;
	margin-top: 24px;
	font-size: 0.8rem;
}
.question-answer th,
.question-answer td {
	padding: 13px 10px;
	text-align: left;
	border-bottom: 1px solid var(--border);
}
.question-answer caption {
	text-align: left;
	color: var(--text-soft);
	font-size: 0.75rem;
	padding-bottom: 12px;
}
.question-answer table button {
	border: 0;
	background: transparent;
	padding: 4px 0;
	font-size: 0.75rem;
}
.question-answer ul {
	margin: 16px 0;
	padding-left: 22px;
	font-size: 0.8rem;
	color: var(--text-soft);
}
.calculation-details {
	margin-top: 24px;
	border-top: 1px solid var(--border);
	padding-top: 18px;
	font-size: 0.75rem;
	color: var(--text-soft);
	overflow-wrap: anywhere;
}
.notebook-empty {
	padding: 32px 0;
	color: var(--text-soft);
}
@media (max-width: 900px) {
	.notebook header {
		display: block;
	}
	.notebook header p {
		text-align: left;
		margin-top: 15px;
	}
	.question-answer {
		overflow: auto;
	}
	.question-answer table {
		min-width: 520px;
	}
}
</style>
