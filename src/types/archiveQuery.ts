import type { LinkState, MediaKind } from "./dataset";

export type QueryReview = "unreviewed" | "keep" | "exclude" | "later";
export type QueryOrigin = "chats" | "snaps" | "memories" | "inventory";
export interface QueryContext {
	readonly participantIds: readonly string[];
	readonly conversationIds: readonly string[];
	readonly queryVersion: 1;
	readonly occurrenceVersion: 1;
}
export interface QueryError { readonly code: string; readonly path: string }
export type QueryRange = { readonly mode: "calendarDays" | "instants"; readonly start: string | null; readonly end: string | null };
export interface CanonicalArchiveQuery {
	readonly queryVersion: 1;
	readonly matchingVersion: "literal-nfc-lower-v1";
	readonly timezone: string;
	readonly years: readonly number[];
	readonly participantIds: readonly string[];
	readonly conversationIds: readonly string[];
	readonly kinds: readonly MediaKind[];
	readonly sections: readonly QueryOrigin[];
	readonly linkStates: readonly LinkState[];
	readonly reviews: readonly QueryReview[];
	readonly text: string;
	readonly range: QueryRange | null;
	readonly unavailable: "auto" | "include" | "exclude" | "only";
}
export type QueryValidation = { readonly ok: true; readonly query: CanonicalArchiveQuery } | { readonly ok: false; readonly errors: readonly QueryError[] };

export interface QuerySource {
	readonly id: string;
	readonly sourceId: string;
	readonly path: string;
	readonly recordPointer: string;
	readonly entryOrdinal: number;
	readonly documentSha256: string | null;
}
export type QueryTime =
	| { readonly kind: "instant"; readonly epochMicroseconds: string; readonly precision: "second" | "millisecond" | "microsecond"; readonly sourceTimeId: string }
	| { readonly kind: "date-only"; readonly recordedDate: string; readonly sourceTimeId: string }
	| { readonly kind: "unavailable"; readonly reason: "absent" | "invalid" | "un-zoned"; readonly sourceTimeId: string };
export interface QueryConversation {
	readonly id: string;
	readonly provenMemberIds: readonly string[];
	readonly membershipSourceIds: readonly string[];
}
export interface QueryEvent {
	readonly id: string;
	readonly origin: "chats" | "snaps";
	readonly authorId: string | null;
	readonly conversationId: string;
	readonly kind: MediaKind;
	readonly text: string | null;
	readonly time: QueryTime;
	readonly sourceIds: readonly string[];
}
export interface QueryMediaRecord {
	readonly id: string;
	readonly filename: string;
	readonly kind: MediaKind;
	readonly role: "original" | "layer";
	readonly available: boolean;
	readonly entry: { readonly sourceId: string; readonly path: string; readonly ordinal: number } | null;
	readonly sourceIds: readonly string[];
	readonly layerState?: "resolved" | "orphan" | "unresolved";
}
export type AssociationProof =
	| { readonly kind: "export-exact"; readonly sourceIds: readonly string[] }
	| { readonly kind: "owner-confirmed"; readonly sourceIds: readonly string[]; readonly decisionId: string; readonly evidenceRevision: string };
export type QueryAssociation =
	| { readonly state: "confirmed"; readonly mediaId: string; readonly proof: AssociationProof }
	| { readonly state: "inferred" | "ambiguous"; readonly referenceSourceIds: readonly string[]; readonly candidates: readonly { readonly mediaId: string; readonly proofSourceIds: readonly string[] }[] }
	| { readonly state: "unlinked"; readonly missingMediaId: string | null; readonly proofSourceIds: readonly string[] };
export interface QueryOccurrence {
	readonly id: string;
	readonly origin: "chats" | "snaps" | "memories";
	readonly owningEventId: string | null;
	readonly time: QueryTime;
	readonly declaredKind: MediaKind;
	readonly caption: string | null;
	readonly location: string | null;
	readonly sourceIds: readonly string[];
	readonly association: QueryAssociation;
	readonly identity: {
		readonly identityVersion: 1;
		readonly documentSha256: string;
		readonly documentPath: string;
		readonly rowPointer: string;
		readonly repeatRank: number;
		readonly referenceOrdinal: number;
		readonly copySourceIds: readonly string[];
	};
}
export interface QuerySupportingLayer {
	readonly baseMediaId: string;
	readonly layerMediaId: string;
	readonly sourceIds: readonly string[];
	/** Recorded order only. Null remains unknown even when the projection presents known edges first. */
	readonly order: number | null;
}
export interface QueryTarget { readonly kind: "event" | "occurrence" | "media"; readonly id: string }
export interface QueryDiagnostic {
	readonly id: string;
	readonly code: string;
	readonly sourceIds: readonly string[];
	readonly owner: QueryTarget | null;
}
export interface QueryEvidence {
	readonly occurrenceVersion: 1;
	readonly occurrencesComplete: true;
	readonly participantIds: readonly string[];
	readonly conversations: readonly QueryConversation[];
	readonly sources: readonly QuerySource[];
	readonly events: readonly QueryEvent[];
	readonly media: readonly QueryMediaRecord[];
	readonly occurrences: readonly QueryOccurrence[];
	readonly supportingLayers: readonly QuerySupportingLayer[];
	readonly diagnostics: readonly QueryDiagnostic[];
}
export interface CollectionInput {
	readonly evidence: QueryEvidence;
	readonly query: CanonicalArchiveQuery;
	readonly decisions: readonly { readonly target: QueryTarget; readonly status: "keep" | "exclude" | "later" }[];
	readonly denyTargets: readonly QueryTarget[];
	readonly datasetRevision: string;
	readonly queryRevision: string;
	readonly reviewRevision: string;
}
export interface CollectionCounts {
	readonly events: number;
	readonly historicalOccurrences: number;
	readonly originalPhysicalFiles: number;
	readonly missingMediaRecords: number;
	readonly inventoryOriginals: number;
	readonly inventoryLayers: number;
	readonly supportingLayers: number;
	readonly physicalResources: number;
	readonly candidateReferences: number;
	readonly candidateFiles: number;
	readonly later: { readonly events: number; readonly occurrences: number; readonly media: number };
	readonly byOrigin: { readonly events: Readonly<Record<QueryOrigin, number>>; readonly occurrences: Readonly<Record<QueryOrigin, number>>; readonly inventory: Readonly<Record<QueryOrigin, number>> };
	readonly byKind: { readonly events: Readonly<Record<MediaKind, number>>; readonly occurrences: Readonly<Record<MediaKind, number>>; readonly originals: Readonly<Record<MediaKind, number>>; readonly standaloneLayers: Readonly<Record<MediaKind, number>>; readonly supportingLayers: Readonly<Record<MediaKind, number>> };
}
export interface CollectionSelection {
	readonly eventIds: readonly string[];
	readonly occurrenceIds: readonly string[];
	readonly mediaRecordIds: readonly string[];
	readonly inventoryIds: readonly string[];
	readonly supportingLayerIds: readonly string[];
	readonly events: readonly QueryEvent[];
	readonly occurrences: readonly QueryOccurrence[];
	readonly resources: readonly QueryMediaRecord[];
	readonly candidates: readonly { readonly occurrenceId: string; readonly state: "ambiguous" | "inferred"; readonly candidateMediaIds: readonly string[] }[];
	readonly inlineAssociations: readonly { readonly eventId: string; readonly occurrenceId: string; readonly mediaId: string; readonly proof: AssociationProof }[];
	readonly compositions: readonly QuerySupportingLayer[];
	readonly diagnostics: readonly QueryDiagnostic[];
	readonly counts: CollectionCounts;
}
export interface ArchiveCollection {
	readonly query: CanonicalArchiveQuery;
	readonly occurrenceVersion: 1;
	readonly datasetRevision: string;
	readonly queryRevision: string;
	readonly reviewRevision: string;
	readonly matched: CollectionSelection;
	readonly effective: CollectionSelection;
	readonly reviewOnlyDiagnostics: readonly QueryDiagnostic[];
	readonly exclusions: readonly { readonly target: QueryTarget; readonly code: "explicit_exclude" | "effective_deny" }[];
}
export type CollectionValidation = { readonly ok: true; readonly collection: ArchiveCollection } | { readonly ok: false; readonly errors: readonly QueryError[] };
