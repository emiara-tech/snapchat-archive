import type { SnapZipEntryId } from "../lib/snapZip";

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
