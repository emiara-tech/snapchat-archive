import type { SnapZipEntryId } from "../lib/snapZip";
import type { QueryDiagnostic, QueryEvidence, QueryMediaRecord, QueryOccurrence, QuerySource } from "./archiveQuery";

export type MediaKind = "text" | "image" | "video" | "audio" | "sticker" | "gif" | "attachment" | "unknown";
export type LinkState = "confirmed" | "inferred" | "ambiguous" | "unlinked";
export type ReviewStatus = "keep" | "exclude" | "later";
export type Authorship = "owner" | "other" | "unknown" | "conflicting";

export interface SourceReference {
	sourceId: string;
	sourceFingerprint?: string;
	path: string;
	recordPointer: string;
	entryOrdinal?: number;
	/** SHA-256 of decompressed original JSON bytes, supplied by the local reader. */
	documentSha256?: string;
	documentByteLength?: number;
}

export interface Participant {
	id: string;
	username: string | null;
	displayName: string;
	isOwner: boolean;
	sources: SourceReference[];
}

export interface Conversation {
	id: string;
	title: string;
	participantIds: string[];
	eventIds: string[];
	sources: SourceReference[];
	/** Recorded membership proof. Missing membership never establishes a direct exchange. */
	scope?: { kind: "direct" | "group" | "unknown"; recipientId: string | null; basis: string; evidence: SourceReference[] };
}

export interface NormalizedTime {
	raw: unknown;
	instant: string | null;
	precision: "microsecond" | "millisecond" | "second" | "date" | "unknown";
	zone: string | null;
	valid: boolean;
	reason: string | null;
	orderKey: string;
}

export interface ConversationEvent {
	id: string;
	conversationId: string;
	participantId: string | null;
	ownerAuthored: boolean;
	authorship: Authorship;
	kind: MediaKind;
	text: string | null;
	timestamp: string | null;
	year: number | null;
	time: NormalizedTime;
	source: SourceReference;
	sources: SourceReference[];
	assetIds: string[];
	mediaReferenceIds: string[];
	raw: Record<string, unknown>;
}

export interface MediaAsset {
	id: string;
	path: string | null;
	overlayPath: string | null;
	kind: MediaKind;
	timestamp: string | null;
	year: number | null;
	source: SourceReference;
	sources: SourceReference[];
	entryId: SnapZipEntryId | null;
	overlayEntryId: SnapZipEntryId | null;
	conversationIds: string[];
	available: boolean;
	mediaId: string | null;
	byteSize: number;
	mimeType: string;
	location: string | null;
	raw: Record<string, unknown>;
	role?: "original" | "overlay";
	overlayState?: "none" | "resolved" | "ambiguous" | "missing-base";
	overlayCandidates?: SnapZipEntryId[];
	baseAssetIds?: string[];
}

export interface MediaLink {
	id: string;
	eventId: string;
	assetId: string;
	status: LinkState;
	basis: string;
	evidence: SourceReference[];
	candidateAssetIds: string[];
	missingReason?: string;
	/** Groups mutually exclusive candidates for one exported reference. */
	referenceId?: string;
}

export interface CoverageSection {
	status: "available" | "missing" | "invalid" | "partial" | "unsupported";
	recordCount: number;
	invalidCount: number;
	unsupportedCount?: number;
}

export interface ArchiveCoverage {
	sections: Record<string, CoverageSection>;
	missingMedia: number;
	unknownAuthors: number;
	invalidDates: number;
	duplicateRecords: number;
	unsupportedRecords: number;
	warnings: string[];
}

export interface UnsupportedEvidence {
	source: SourceReference;
	reason: string;
	raw: unknown;
}

export interface RecordedRowPosition {
	readonly containerPointer: string;
	readonly rowIndex: number;
}

export type ReferenceParserRule = "array-v1" | "json-array-string-v1" | "delimited-v1";
export type ReferenceInterpretation =
	| { readonly state: "absent" | "unsupported"; readonly parserRule: null; readonly sourcePositions: null; readonly knownSupportedSlots: 0; readonly unknownRemainder: true }
	| { readonly state: "supported"; readonly parserRule: ReferenceParserRule; readonly sourcePositions: number; readonly knownSupportedSlots: number; readonly unknownRemainder: boolean };

export interface DatasetEventRowFact {
	readonly eventId: string;
	readonly origin: "chats" | "snaps";
	readonly identity: Omit<QueryOccurrence["identity"], "referenceOrdinal">;
	readonly recordedPosition: RecordedRowPosition;
	readonly references: ReferenceInterpretation;
}

export type DatasetOccurrenceFact = Omit<QueryOccurrence, "time"> & {
	readonly normalizedTime: NormalizedTime;
	readonly recordedPosition: RecordedRowPosition;
	readonly rawMediaType: string | null;
	readonly reference: {
		readonly referenceId: string | null;
		readonly parserRule: ReferenceParserRule | "memory-mid-v1";
		readonly matchingRule: "chat-exact-v1" | "memory-date-mid-main-v1";
		readonly fieldPointer: string;
		readonly token: string;
	} | null;
};

export type DatasetReferenceDiagnostic = Omit<QueryDiagnostic, "code"> & {
	readonly code: "absent-reference-field" | "unsupported-reference-field" | "malformed-reference-position" | "unknown-occurrence-kind" | "unresolved-memory-reference" | "reference-target-is-layer" | "unsupported-memory-row" | "unsupported-occurrence-field";
	readonly fieldPointer: string | null;
	readonly referenceOrdinal: number | null;
};

export interface DatasetOccurrenceFacts {
	readonly occurrenceVersion: 1;
	readonly sources: readonly QuerySource[];
	readonly resources: readonly QueryMediaRecord[];
	readonly occurrences: readonly DatasetOccurrenceFact[];
	readonly eventRows: readonly DatasetEventRowFact[];
	readonly referenceDiagnostics: readonly DatasetReferenceDiagnostic[];
}

export interface ArchiveDataset {
	fingerprint: string;
	/** True only when source ZIP bytes were fingerprinted, rather than advertised CRC metadata. */
	identityVerified?: boolean;
	revision: string;
	normalizationVersion: number;
	ownerUsername: string | null;
	timezone: "UTC";
	participants: Participant[];
	conversations: Conversation[];
	events: ConversationEvent[];
	assets: MediaAsset[];
	links: MediaLink[];
	coverage: ArchiveCoverage;
	unsupported: UnsupportedEvidence[];
	/** Only a complete producer may publish canonical query evidence. Legacy fixtures omit it. */
	queryEvidence?: QueryEvidence | null;
	queryEvidenceUnavailableReason?: "producer-incomplete";
	/** Staged source-backed facts; exact query time/membership/publication are still unavailable. */
	occurrenceFacts?: DatasetOccurrenceFacts | null;
	occurrenceFactsUnavailableReason?: "missing-document-proof" | null;
}

export interface ArchiveQuery {
	year: number | null;
	participantId: string | null;
	conversationId: string | null;
	text: string;
	kind: MediaKind | "all";
	review: "active" | "all" | ReviewStatus | "unreviewed";
	linkState: LinkState | "all";
}

export interface ReviewDecision {
	status: ReviewStatus;
	updatedAt: string;
}

export interface AssociationDecision {
	linkId: string;
	action: "confirm" | "reject";
	updatedAt: string;
	evidenceRevision?: string;
}
