import type { ArchiveDataset, ArchiveQuery, ConversationEvent, MediaAsset, MediaLink } from "../types/dataset";
import type { SnapZipEntryId, SnapZipEntryMeta } from "./snapZip";
import { normalizeTime } from "./dataset";
import { authorLabel } from "./evidenceLabels";
import { unsupportedRecordedOverlay } from "./imageComposition";
import { createExportPlan, type ExportPlan } from "./exportBundle";

export interface ExportSnapshotInput {
	dataset: ArchiveDataset;
	events: ConversationEvent[];
	assets: MediaAsset[];
	query: ArchiveQuery;
	revision: string;
	mode: "curated" | "complete";
	composeImages: boolean;
	physicalEntries?: SnapZipEntryMeta[];
}

function entryKey(entry: SnapZipEntryId): string {
	return JSON.stringify([entry.sourceId, entry.path, entry.ordinal]);
}

/** Snapshot only the approved collection; candidate links remain evidence, never inline attachments. */
export function prepareExportSnapshot(input: ExportSnapshotInput): ExportPlan {
	const { dataset, events, assets } = input;
	const conversations = new Map(dataset.conversations.map((conversation) => [conversation.id, conversation]));
	const participants = new Map(dataset.participants.map((person) => [person.id, person]));
	const entries = new Map((input.physicalEntries ?? []).map((entry) => [entryKey(entry.id), entry]));
	const assetsByEntry = new Map(assets.flatMap((asset) => asset.entryId ? [[entryKey(asset.entryId), asset] as const] : []));
	const eventIds = new Set(events.map((event) => event.id));
	const assetIds = new Set(assets.map((asset) => asset.id));
	const linksByAsset = new Map<string, MediaLink[]>();
	const attachmentsByEvent = new Map<string, Set<string>>();
	for (const link of dataset.links) {
		if (!eventIds.has(link.eventId) || !assetIds.has(link.assetId)) continue;
		const links = linksByAsset.get(link.assetId) ?? [];
		links.push(link); linksByAsset.set(link.assetId, links);
		if (link.status === "confirmed") {
			const attachments = attachmentsByEvent.get(link.eventId) ?? new Set<string>();
			attachments.add(link.assetId); attachmentsByEvent.set(link.eventId, attachments);
		}
	}
	return createExportPlan({
		datasetFingerprint: dataset.fingerprint, revision: input.revision, timezone: dataset.timezone,
		mode: input.mode, query: input.query, composeImages: input.composeImages,
		events: events.map((event) => ({
			id: event.id, conversationId: event.conversationId,
			conversationTitle: conversations.get(event.conversationId)?.title ?? "Recorded conversation",
			sender: authorLabel(event.authorship, participants.get(event.participantId ?? "")?.displayName),
			authorship: event.authorship, date: event.timestamp, originalTime: event.time.raw, timePrecision: event.time.precision,
			kind: event.kind, text: event.text, assetIds: [...(attachmentsByEvent.get(event.id) ?? [])],
			sourceId: `${event.source.sourceId}:${event.source.recordPointer}`, source: event.source, sources: event.sources,
		})),
		assets: assets.map((asset) => {
			const links = linksByAsset.get(asset.id) ?? [];
			const linkStates = [...new Set(links.map((link) => link.status))].sort();
			const originalTime = asset.raw.Date ?? null;
			const time = normalizeTime(originalTime);
			return {
				id: asset.id, path: asset.entryId?.path ?? null, sourceId: asset.entryId?.sourceId ?? null,
				sourceOrdinal: asset.entryId?.ordinal, mimeType: asset.mimeType, byteSize: asset.byteSize, date: asset.timestamp,
				originalTime, timePrecision: time.precision, timestampZone: time.zone, location: asset.location,
				overlayPath: asset.overlayEntryId?.path ?? null, overlaySourceId: asset.overlayEntryId?.sourceId ?? null,
				overlayOrdinal: asset.overlayEntryId?.ordinal,
				overlayByteSize: asset.overlayEntryId ? entries.get(entryKey(asset.overlayEntryId))?.uncompressedSize : undefined,
				overlayAssetId: asset.overlayEntryId ? assetsByEntry.get(entryKey(asset.overlayEntryId))?.id ?? null : null,
				compositionBlockedReason: unsupportedRecordedOverlay(asset.raw) ? "The archive records an overlay transform that this renderer has not verified. Its source layers are preserved." : undefined,
				linkState: linkStates.length > 1 ? "mixed" : linkStates[0] ?? "unlinked", linkStates, links, sources: asset.sources,
			};
		}),
		coverage: [...dataset.coverage.warnings],
	});
}
