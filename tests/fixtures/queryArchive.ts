import type { QueryEvidence, QueryEvent, QueryMediaRecord, QueryOccurrence, QuerySource, QueryTime } from "../../src/types/archiveQuery";

export function queryArchive(): QueryEvidence {
	const sources: QuerySource[] = [];
	const source = (id: string, path: string, pointer: string, digest: string | null = "a".repeat(64), zip = "part-one") => {
		sources.push({ id, sourceId: zip, path, recordPointer: pointer, entryOrdinal: 0, documentSha256: digest });
		return id;
	};
	const eventRows = [
		["E0", "2019-12-31T23:30:00Z", "chats", "CM", "owner", "text", "CAFE\u0301 <b>coast</b>"],
		["E1", "2020-01-01T00:30:00Z", "snaps", "CM", "Maya", "image", "café coast"],
		["E2", "2020-03-29T00:30:00Z", "chats", "CG", "owner", "image", "meet coast"],
		["E3", "2020-03-29T01:30:00Z", "chats", "CG", "Jules", "video", "coast"],
		["E4", null, "chats", "CU", null, "audio", null],
		["E5", "2020-10-25T00:30:00Z", "chats", "CJ", "owner", "text", "first repeated clock"],
		["E6", "2020-10-25T01:30:00Z", "chats", "CJ", "Jules", "text", "second repeated clock"],
		["E7", "2021-01-02T10:00:00Z", "chats", "CJ", "Jules", "text", "café"],
	] as const;
	const events: QueryEvent[] = eventRows.map(([id, iso, origin, conversationId, authorId, kind, text]) => {
		const sid = source(`SOURCE-${id}`, `json/${origin}.json`, `/${id}`);
		const time: QueryTime = iso ? { kind: "instant", epochMicroseconds: String(BigInt(Date.parse(iso)) * 1000n), precision: "second", sourceTimeId: sid } : { kind: "unavailable", reason: "invalid", sourceTimeId: sid };
		return { id, origin, conversationId, authorId, kind, text, time, sourceIds: [sid] };
	});
	const mediaRows = [["SHARED", "image"], ["PHOTO", "image"], ["VIDEO", "video"], ["ALT", "gif"], ["Q", "gif"], ["ORPHAN", "audio"]] as const;
	const media: QueryMediaRecord[] = mediaRows.map(([id, kind]) => {
		const path = `files/${id}.bin`, sid = source(id === "Q" ? "SOURCE-Q-CANARY" : `SOURCE-${id}`, path, "", null);
		return { id, filename: `${id}.bin`, kind, role: "original", available: true, entry: { sourceId: "part-one", path, ordinal: 0 }, sourceIds: [sid] };
	});
	const makeOccurrence = (id: string, event: QueryEvent, mediaId: string): QueryOccurrence => ({
		id, origin: event.origin, owningEventId: event.id, time: event.time, declaredKind: "unknown", caption: null, location: null, sourceIds: [...event.sourceIds],
		association: { state: "confirmed", mediaId, proof: { kind: "export-exact", sourceIds: [...event.sourceIds] } },
		identity: { identityVersion: 1, documentSha256: "a".repeat(64), documentPath: `json/${event.origin}.json`, rowPointer: `/${event.id}`, repeatRank: 0, referenceOrdinal: 0, copySourceIds: [...event.sourceIds] },
	});
	const occurrences = [makeOccurrence("O0", events[0]!, "SHARED"), makeOccurrence("O1", events[1]!, "SHARED"), makeOccurrence("O2", events[2]!, "PHOTO"), makeOccurrence("O3", events[3]!, "VIDEO")];
	const o4 = makeOccurrence("O4", events[4]!, "Q");
	occurrences.push({ ...o4, association: { state: "ambiguous", referenceSourceIds: ["SOURCE-E4"], candidates: [{ mediaId: "ALT", proofSourceIds: ["SOURCE-E4", "SOURCE-ALT"] }, { mediaId: "Q", proofSourceIds: ["SOURCE-E4", "SOURCE-Q-CANARY"] }] } });
	const m0 = source("SOURCE-M0", "json/memories.json", "/0", "b".repeat(64));
	const m0copy = source("SOURCE-M0-COPY", "json/memories.json", "/0", "b".repeat(64), "part-two");
	const mmiss = source("SOURCE-MMISS", "json/memories.json", "/1", "b".repeat(64));
	const memory = (id: string, sid: string, iso: string, association: QueryOccurrence["association"]): QueryOccurrence => ({ id, origin: "memories", owningEventId: null, declaredKind: "image", caption: null, location: null, sourceIds: [sid], time: { kind: "instant", epochMicroseconds: String(BigInt(Date.parse(iso)) * 1000n), precision: "second", sourceTimeId: sid }, association, identity: { identityVersion: 1, documentSha256: "b".repeat(64), documentPath: "json/memories.json", rowPointer: id === "M0" ? "/0" : "/1", repeatRank: 0, referenceOrdinal: 0, copySourceIds: [sid] } });
	const m = memory("M0", m0, "2020-01-01T00:30:00Z", { state: "confirmed", mediaId: "SHARED", proof: { kind: "export-exact", sourceIds: [m0, m0copy] } });
	occurrences.push({ ...m, caption: "memory coast", location: "CANARY-M0", sourceIds: [m0, m0copy], identity: { ...m.identity, copySourceIds: [m0, m0copy] } });
	occurrences.push(memory("MMISS", mmiss, "2020-01-03T01:00:00Z", { state: "unlinked", missingMediaId: "MISS", proofSourceIds: [mmiss] }));
	media.push({ id: "MISS", filename: "missing.bin", kind: "image", role: "original", available: false, entry: null, sourceIds: [mmiss] });
	const membership = source("SOURCE-MEMBERS", "json/friends.json", "/members", "c".repeat(64));
	return { occurrenceVersion: 1, occurrencesComplete: true, participantIds: ["owner", "Maya", "Jules"], sources, events, media, occurrences, supportingLayers: [], diagnostics: [], conversations: [
		{ id: "CM", provenMemberIds: ["owner", "Maya"], membershipSourceIds: [membership] },
		{ id: "CG", provenMemberIds: ["owner", "Maya", "Jules"], membershipSourceIds: [membership] },
		{ id: "CJ", provenMemberIds: ["owner", "Jules"], membershipSourceIds: [membership] },
		{ id: "CU", provenMemberIds: [], membershipSourceIds: [] },
	] };
}

export function precisionArchive(): QueryEvidence {
	const base = queryArchive(), sources = [...base.sources], events: QueryEvent[] = [], media: QueryMediaRecord[] = [], occurrences: QueryOccurrence[] = [];
	const rows = [
		["N_NEG", "ON", "NEG", { kind: "instant", epochMicroseconds: "-1", precision: "microsecond" }],
		["N_ZERO", "OZERO", "ZERO", { kind: "instant", epochMicroseconds: "0", precision: "second" }],
		["N_POS", "OPOS", "POS", { kind: "instant", epochMicroseconds: "1", precision: "microsecond" }],
		["Z_EARLY", "OZ", "ZMEDIA", { kind: "instant", epochMicroseconds: "1577836800000001", precision: "microsecond" }],
		["A_LATE", "OA", "AMEDIA", { kind: "instant", epochMicroseconds: "1577836800000002", precision: "microsecond" }],
		["D_DATE", "OD", "DATE", { kind: "date-only", recordedDate: "2019-12-31" }],
		["D_BAD", "OB", "BAD", { kind: "unavailable", reason: "invalid" }],
		["D_UNZONED", "OU", "UNZONE", { kind: "unavailable", reason: "un-zoned" }],
	] as const;
	for (const [eid, oid, mid, clock] of rows) {
		const sid = `SOURCE-${eid}`, msid = `SOURCE-${mid}`, pointer = `/${eid}`, path = `files/${mid}.bin`;
		sources.push({ id: sid, sourceId: "precision", path: "json/chats.json", recordPointer: pointer, entryOrdinal: 0, documentSha256: "d".repeat(64) }, { id: msid, sourceId: "precision", path, recordPointer: "", entryOrdinal: 0, documentSha256: null });
		const time: QueryTime = { ...clock, sourceTimeId: sid };
		events.push({ id: eid, origin: "chats", authorId: "owner", conversationId: "CM", kind: "image", text: null, time, sourceIds: [sid] });
		media.push({ id: mid, filename: `${mid}.bin`, kind: "image", role: "original", available: true, entry: { sourceId: "precision", path, ordinal: 0 }, sourceIds: [msid] });
		occurrences.push({ id: oid, origin: "chats", owningEventId: eid, time, declaredKind: "image", caption: null, location: null, sourceIds: [sid], association: { state: "confirmed", mediaId: mid, proof: { kind: "export-exact", sourceIds: [sid] } }, identity: { identityVersion: 1, documentSha256: "d".repeat(64), documentPath: "json/chats.json", rowPointer: pointer, repeatRank: 0, referenceOrdinal: 0, copySourceIds: [sid] } });
	}
	return { ...base, sources, events, media, occurrences };
}

export function layeredArchive(): QueryEvidence {
	const base = queryArchive(), sources = [...base.sources], media = [...base.media];
	for (const [id, state] of [["LV", "resolved"], ["LO", "orphan"], ["LU", "unresolved"]] as const) {
		const sid = `SOURCE-${id}`, path = `files/${id}.png`;
		sources.push({ id: sid, sourceId: "layers", path, recordPointer: "", entryOrdinal: 0, documentSha256: null });
		media.push({ id, filename: `${id}.png`, kind: "image", role: "layer", available: true, entry: { sourceId: "layers", path, ordinal: 0 }, sourceIds: [sid], layerState: state });
	}
	return { ...base, sources, media, supportingLayers: [{ baseMediaId: "VIDEO", layerMediaId: "LV", sourceIds: ["SOURCE-VIDEO", "SOURCE-LV"], order: 0 }] };
}

export function copiedArchive(): QueryEvidence {
	const base = queryArchive(), sources = [...base.sources], template = base.occurrences.find((o) => o.id === "M0")!;
	const occurrences: QueryOccurrence[] = [];
	for (const [id, pointer, digest, caption] of [["M0", "/0", "b", "repeat coast"], ["M1", "/1", "b", "repeat coast"], ["M2", "/0", "e", "repeat coast"], ["M3", "/0", "f", "CANARY-OTHER"]] as const) {
		const sid = `COPY-${id}`, copyIds = [sid];
		sources.push({ id: sid, sourceId: `doc-${digest}`, path: "json/memories.json", recordPointer: pointer, entryOrdinal: 0, documentSha256: digest.repeat(64) });
		if (id === "M0" || id === "M1") { const copyId = `COPY-${id}-SECOND`; copyIds.push(copyId); sources.push({ id: copyId, sourceId: "doc-b-copy", path: "json/memories.json", recordPointer: pointer, entryOrdinal: 0, documentSha256: digest.repeat(64) }); }
		occurrences.push({ ...template, id, caption, location: id === "M3" ? "CANARY-OTHER" : null, sourceIds: copyIds, time: { ...template.time, sourceTimeId: sid }, association: { state: "confirmed", mediaId: "SHARED", proof: { kind: "export-exact", sourceIds: copyIds } }, identity: { ...template.identity, documentSha256: digest.repeat(64), rowPointer: pointer, repeatRank: id === "M1" ? 1 : 0, copySourceIds: copyIds } });
	}
	return { ...base, sources, events: [], media: base.media.filter((m) => m.id === "SHARED"), occurrences };
}
