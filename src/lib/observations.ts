import type {
	ArchiveDataset,
	ConversationEvent,
	MediaAsset,
} from "../types/dataset";
import {
	calendarPeriod,
	measuredLanguage,
	selectionRevision,
} from "./yearProfile";

export interface ObservationGroup {
	id: string;
	label: string;
	value: number;
	definition: string;
	eventIds: string[];
	assetIds: string[];
	latitude?: number;
	longitude?: number;
	calendarMonth?: number;
}
export interface LocalObservations {
	revision: string;
	timezone: string;
	timeline: ObservationGroup[];
	relationships: ObservationGroup[];
	memories: ObservationGroup[];
	language: ObservationGroup[];
	map: ObservationGroup[];
	unknownLocations: number;
	unknownDates: number;
	ownerTextCount: number;
	calculationVersion: 2;
	population: {
		events: number;
		textMessages: number;
		ownerText: number;
		otherText: number;
		uncertainText: number;
		availableAssets: number;
		overlayLayers: number;
		unavailableAssets: number;
		activeDays: number;
		longestChatRun: number;
		firstDate: string | null;
		lastDate: string | null;
		mediaKinds: { kind: string; count: number }[];
	};
	years: {
		year: string;
		events: number;
		ownerText: number;
		assets: number;
		activeDays: number;
		eventsPerActiveDay: number | null;
		eventIds: string[];
		assetIds: string[];
	}[];
}

export function parseRecordedLocation(
	location: unknown,
): { latitude: number; longitude: number } | null {
	if (typeof location !== "string") return null;
	const match =
		/^\s*(?:Latitude,\s*Longitude:\s*)?(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\s*$/i.exec(
			location,
		);
	if (!match) return null;
	const latitude = Number(match[1]);
	const longitude = Number(match[2]);
	return Number.isFinite(latitude) &&
		Number.isFinite(longitude) &&
		Math.abs(latitude) <= 90 &&
		Math.abs(longitude) <= 180
		? { latitude, longitude }
		: null;
}

export type ObservationDataset = Pick<
	ArchiveDataset,
	"revision" | "timezone" | "participants" | "conversations"
>;
export type ObservationEvent = Pick<
	ConversationEvent,
	| "id"
	| "conversationId"
	| "timestamp"
	| "assetIds"
	| "ownerAuthored"
	| "authorship"
	| "kind"
	| "text"
>;
export type ObservationAsset = Pick<
	MediaAsset,
	"id" | "timestamp" | "kind" | "available" | "location" | "role"
>;

export function computeObservations(
	dataset: ObservationDataset,
	events: ObservationEvent[],
	assets: ObservationAsset[],
	timezone: string = dataset.timezone,
): LocalObservations {
	const overlayLayers = assets.filter(asset => asset.role === "overlay").length;
	assets = assets.filter(asset => asset.role !== "overlay");
	const periods = new Map<string, ObservationGroup>();
	const addPeriod = (
		timestamp: string | null,
		id: string,
		type: "event" | "asset",
	) => {
		const period = calendarPeriod(timestamp, timezone, "month");
		if (!period) return;
		const group = periods.get(period) ?? {
			id: `month:${period}`,
			label: period,
			value: 0,
			calendarMonth:
				Number(period.slice(0, 4)) * 12 + Number(period.slice(5, 7)) - 1,
			definition:
				"Recorded conversation events plus standalone media items in this month. Media already represented by an event is counted with that event only.",
			eventIds: [],
			assetIds: [],
		};
		group.value++;
		(type === "event" ? group.eventIds : group.assetIds).push(id);
		periods.set(period, group);
	};
	for (const event of events) addPeriod(event.timestamp, event.id, "event");
	const linkedAssets = new Set(events.flatMap((event) => event.assetIds));
	for (const asset of assets)
		if (!linkedAssets.has(asset.id))
			addPeriod(asset.timestamp, asset.id, "asset");
	const eventsByAsset = new Map<string, string[]>();
	const eventsByConversation = new Map<string, ObservationEvent[]>();
	for (const event of events) {
		for (const id of event.assetIds) {
			const ids = eventsByAsset.get(id) ?? [];
			ids.push(event.id);
			eventsByAsset.set(id, ids);
		}
		const records = eventsByConversation.get(event.conversationId) ?? [];
		records.push(event);
		eventsByConversation.set(event.conversationId, records);
	}
	const eventsByParticipant = new Map<string, ObservationEvent[]>();
	const groupRelationships: ObservationGroup[] = [];
	const ownerIds = new Set(
		dataset.participants
			.filter((person) => person.isOwner)
			.map((person) => person.id),
	);
	for (const conversation of dataset.conversations) {
		const records = eventsByConversation.get(conversation.id) ?? [];
		if (!records.length) continue;
		if (
			conversation.scope?.kind !== "direct" ||
			!conversation.scope.recipientId ||
			!conversation.participantIds.some((id) => ownerIds.has(id))
		) {
			groupRelationships.push({
				id: `conversation:${conversation.id}`,
				label: `${conversation.scope?.kind === "group" ? "Group" : "Membership uncertain"} · ${conversation.title}`,
				value: records.length,
				definition:
					"Recorded events in this conversation. Group traffic is kept together and is not attributed to every person. This count does not measure closeness.",
				eventIds: records.map((record) => record.id),
				assetIds: [...new Set(records.flatMap((record) => record.assetIds))],
			});
			continue;
		}
		for (const id of [conversation.scope.recipientId]) {
			const previous = eventsByParticipant.get(id) ?? [];
			for (const record of records) previous.push(record);
			eventsByParticipant.set(id, previous);
		}
	}
	const relationships = dataset.participants
		.filter((participant) => !participant.isOwner)
		.flatMap((participant) => {
			const matching = eventsByParticipant.get(participant.id) ?? [];
			return matching.length
				? [
						{
							id: participant.id,
							label: participant.displayName,
							value: matching.length,
							definition:
								"Recorded events in direct conversations with this participant. Group conversations are counted separately. Distance is an arrangement, not emotional closeness.",
							eventIds: matching.map((event) => event.id),
							assetIds: [
								...new Set(matching.flatMap((event) => event.assetIds)),
							],
						},
					]
				: [];
		})
		.concat(groupRelationships)
		.sort((a, b) => b.value - a.value || a.id.localeCompare(b.id));
	const memories = [...assets]
		.sort(
			(a, b) =>
				(a.timestamp ?? "~~~~").localeCompare(b.timestamp ?? "~~~~") ||
				a.id.localeCompare(b.id),
		)
		.map((asset) => ({
			id: asset.id,
			label: `${asset.timestamp?.slice(0, 10) ?? "Unknown date"} · ${asset.kind}`,
			value: 1,
			definition: asset.available
				? "One selected media asset. Its known links and source are shown below."
				: "This selected media asset is unavailable. Its recorded metadata remains inspectable.",
			eventIds: eventsByAsset.get(asset.id) ?? [],
			assetIds: [asset.id],
		}));
	const ownerEvents = events.filter(
		(event) =>
			event.ownerAuthored &&
			event.authorship === "owner" &&
			event.kind === "text" &&
			event.text?.trim(),
	);
	const measured = measuredLanguage(ownerEvents);
	const language = measured.terms.slice(0, 64).map((term) => ({
		id: `word:${term.word}`,
		label: term.word,
		value: term.count,
		definition: `${term.count} occurrences in ${measured.tokenCount} owner-authored word tokens. ${term.perThousandTokens.toFixed(1)} per 1,000 tokens. Unicode words are lowercased; links are omitted.`,
		eventIds: term.eventIds,
		assetIds: [],
	}));
	const map = assets.flatMap((asset) => {
		const location = parseRecordedLocation(asset.location);
		return location
			? [
					{
						id: `location:${asset.id}`,
						label: `${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)}`,
						value: 1,
						definition:
							"Coordinates recorded in the export. Position uses longitude and latitude on a local plane. Rounded labels do not improve source precision.",
						...location,
						eventIds: eventsByAsset.get(asset.id) ?? [],
						assetIds: [asset.id],
					},
				]
			: [];
	});
	const datedEvents = events.map((event) => ({
		event,
		day: calendarPeriod(event.timestamp, timezone),
	}));
	const activeDays = [
		...new Set(datedEvents.flatMap((item) => (item.day ? [item.day] : []))),
	].sort();
	let longestChatRun = 0,
		run = 0,
		previousDay: number | null = null;
	for (const day of activeDays) {
		const instant = Date.parse(day + "T00:00:00Z");
		run =
			previousDay !== null && instant - previousDay === 86400000 ? run + 1 : 1;
		longestChatRun = Math.max(longestChatRun, run);
		previousDay = instant;
	}
	const annual = new Map<
		string,
		{
			year: string;
			events: number;
			ownerText: number;
			assets: number;
			days: Set<string>;
			eventIds: string[];
			assetIds: string[];
		}
	>();
	const getYear = (year: string) => {
		let entry = annual.get(year);
		if (!entry) {
			entry = {
				year,
				events: 0,
				ownerText: 0,
				assets: 0,
				days: new Set(),
				eventIds: [],
				assetIds: [],
			};
			annual.set(year, entry);
		}
		return entry;
	};
	for (const { event, day } of datedEvents) {
		if (!day) continue;
		const entry = getYear(day.slice(0, 4));
		entry.events++;
		entry.days.add(day);
		entry.eventIds.push(event.id);
		if (
			event.kind === "text" &&
			event.ownerAuthored &&
			event.authorship === "owner" &&
			event.text?.trim()
		)
			entry.ownerText++;
	}
	const dates = [...activeDays];
	const mediaKinds = new Map<string, number>();
	for (const asset of assets) {
		mediaKinds.set(asset.kind, (mediaKinds.get(asset.kind) ?? 0) + 1);
		const day = calendarPeriod(asset.timestamp, timezone);
		if (!day) continue;
		dates.push(day);
		const entry = getYear(day.slice(0, 4));
		entry.assets++;
		entry.assetIds.push(asset.id);
	}
	dates.sort();
	const textMessages = events.filter(
		(event) => event.kind === "text" && event.text?.trim(),
	);
	return {
		revision: `${dataset.revision}:observations-v2:${timezone}:${selectionRevision(events.map((event) => event.id))}:${selectionRevision(assets.map((asset) => asset.id))}`,
		timezone,
		timeline: [...periods.values()].sort((a, b) =>
			a.label.localeCompare(b.label),
		),
		relationships,
		memories,
		language,
		map,
		unknownLocations: assets.length - map.length,
		unknownDates:
			events.filter((event) => !calendarPeriod(event.timestamp, timezone))
				.length +
			assets.filter((asset) => !calendarPeriod(asset.timestamp, timezone))
				.length,
		ownerTextCount: ownerEvents.length,
		calculationVersion: 2,
		population: {
			overlayLayers,
			events: events.length,
			textMessages: textMessages.length,
			ownerText: ownerEvents.length,
			otherText: textMessages.filter((event) => event.authorship === "other")
				.length,
			uncertainText: textMessages.filter(
				(event) =>
					event.authorship === "unknown" || event.authorship === "conflicting",
			).length,
			availableAssets: assets.filter((asset) => asset.available).length,
			unavailableAssets: assets.filter((asset) => !asset.available).length,
			activeDays: activeDays.length,
			longestChatRun,
			firstDate: dates[0] ?? null,
			lastDate: dates.at(-1) ?? null,
			mediaKinds: [...mediaKinds]
				.map(([kind, count]) => ({ kind, count }))
				.sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind)),
		},
		years: [...annual.values()]
			.map(({ days, ...entry }) => ({
				...entry,
				activeDays: days.size,
				eventsPerActiveDay: days.size ? entry.events / days.size : null,
			}))
			.sort((a, b) => a.year.localeCompare(b.year)),
	};
}
