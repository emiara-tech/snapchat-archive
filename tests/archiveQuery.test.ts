import { describe, expect, it } from "vitest";
import { normalizeArchiveQuery, selectArchiveCollection } from "../src/lib/archiveQuery";
import { copiedArchive, layeredArchive, precisionArchive, queryArchive } from "./fixtures/queryArchive";
import type { ArchiveCollection, CollectionInput, QueryEvidence } from "../src/types/archiveQuery";

const context = { participantIds: ["owner", "Maya", "Jules"], conversationIds: ["CM", "CG", "CJ", "CU"], queryVersion: 1 as const, occurrenceVersion: 1 as const };

describe("canonical archive query", () => {
	it("rejects executable or hidden query input without reading accessors or exposing keys", () => {
		let reads = 0;
		const getter = () => { reads++; return [2019]; };
		const accessor = Object.defineProperty({}, "years", { enumerable: true, get: getter });
		const hidden = Object.defineProperty({}, "PRIVATE-HIDDEN-CANARY", { value: true });
		const symbol = { [Symbol("PRIVATE-SYMBOL-CANARY")]: true };
		const arrayAccessor = Object.defineProperty([2019], "0", { get: () => { reads++; return 2019; } });
		const arrayHidden = Object.defineProperty([2019], "PRIVATE-ARRAY-CANARY", { value: true });
		const arraySymbol = Object.defineProperty([2019], Symbol("PRIVATE-ARRAY-SYMBOL-CANARY"), { value: true });
		for (const raw of [accessor, hidden, symbol, { years: arrayAccessor }, { years: arrayHidden }, { years: arraySymbol }]) {
			const result = normalizeArchiveQuery(raw, context);
			expect(result.ok).toBe(false);
			expect(JSON.stringify(result)).not.toContain("PRIVATE-");
		}
		expect(reads).toBe(0);
	});
	it("rejects non-data objects and sparse filters instead of silently widening them", () => {
		expect(normalizeArchiveQuery(new Date(0), context).ok).toBe(false);
		expect(normalizeArchiveQuery({ years: Array(1) }, context).ok).toBe(false);
		expect(normalizeArchiveQuery(Object.create({ years: [2019] }), context).ok).toBe(false);
	});
	it("rejects unsupported zones and private malformed inputs with fixed schema error paths", () => {
		for (const input of [{ timezone: "+01:00" }, { "PRIVATE-KEY-CANARY": true }, { text: "PRIVATE-TEXT-CANARY".repeat(100) }, { text: "\uD800" }, { sections: ["unsupported"] }, { participantIds: ["PRIVATE-PROOF-CANARY"] }, { unavailable: null }, { years: [2020], unavailable: "only" }, { range: { mode: ["instants"], start: null, end: null } }]) {
			const result = normalizeArchiveQuery(input, context);
			expect(result.ok).toBe(false); expect(JSON.stringify(result)).not.toContain("PRIVATE-");
		}
		expect(normalizeArchiveQuery({ reviews: [] }, context)).toMatchObject({ ok: true, query: { reviews: ["exclude", "keep", "later", "unreviewed"] } });
		expect(normalizeArchiveQuery({ year: null, years: [2020] }, context)).toMatchObject({ ok: true, query: { years: [2020] } });
	});
	it("normalizes equivalent full filters and rejects a conflicting legacy scalar without exposing values", () => {
		const result = normalizeArchiveQuery({ years: [2020, 2020], year: 2020, participantIds: ["Maya", "Jules", "Maya"], text: "  CAFE\u0301  " }, context);
		expect(result).toEqual({ ok: true, query: {
			queryVersion: 1, matchingVersion: "literal-nfc-lower-v1", timezone: "UTC",
			years: [2020], participantIds: ["Jules", "Maya"], conversationIds: [], kinds: [], sections: [], linkStates: [],
			reviews: ["keep", "later", "unreviewed"], text: "café", range: null, unavailable: "auto",
		} });
		expect(normalizeArchiveQuery({ ...("query" in result ? result.query : {}), years: [2020, 2020], text: "CAFÉ" }, context)).toEqual(result);
		expect(normalizeArchiveQuery({ year: 2019, years: [2020] }, context)).toEqual({ ok: false, errors: [{ code: "conflicting_filters", path: "years" }] });
	});
});

function collection(input: unknown = {}, extra: Partial<CollectionInput> = {}): ArchiveCollection {
	const query = normalizeArchiveQuery(input, context);
	if (!query.ok) throw new Error(JSON.stringify(query.errors));
	const result = selectArchiveCollection({ evidence: queryArchive(), query: query.query, decisions: [], denyTargets: [], datasetRevision: "dataset-1", queryRevision: "query-2", reviewRevision: "review-3", ...extra });
	if (!result.ok) throw new Error(JSON.stringify(result.errors));
	return result.collection;
}

describe("exact archive collection", () => {
	it("rejects nonenumerable DTO values instead of dropping validated query or evidence fields", () => {
		const normalized = normalizeArchiveQuery({ years: [2019] }, context);
		if (!normalized.ok) throw new Error("fixture query");
		const hiddenQuery = Object.defineProperty({ ...normalized.query }, "years", { value: [2019], enumerable: false });
		const hiddenMember = Object.defineProperty([2019], "0", { value: 2019, enumerable: false });
		const hiddenText = queryArchive();
		Object.defineProperty(hiddenText.events[0]!, "text", { value: "PRIVATE-HIDDEN-TEXT-CANARY", enumerable: false });
		expect(normalizeArchiveQuery(hiddenQuery, context).ok).toBe(false);
		expect(normalizeArchiveQuery({ years: hiddenMember }, context).ok).toBe(false);
		for (const input of [
			{ evidence: queryArchive(), query: hiddenQuery },
			{ evidence: hiddenText, query: normalized.query },
			{ evidence: queryArchive(), query: { ...normalized.query, years: hiddenMember } },
		]) {
			const result = selectArchiveCollection({ ...input, decisions: [], denyTargets: [], datasetRevision: "d", queryRevision: "q", reviewRevision: "r" });
			expect(result.ok).toBe(false);
			expect(JSON.stringify(result)).not.toContain("PRIVATE-");
		}
		Object.freeze(normalized.query.years);
		Object.freeze(normalized.query);
		expect(collection({}, { query: normalized.query }).effective.eventIds).toEqual(["E0"]);
	});
	it("withholds compositions lacking permitted attributable proof without promoting their layers to inventory", () => {
		const source = layeredArchive();
		const unrelated = { ...source, supportingLayers: source.supportingLayers.map((edge) => ({ ...edge, sourceIds: ["SOURCE-M0"] })) };
		const before = JSON.stringify(unrelated);
		const video = collection({ kinds: ["video"] }, { evidence: unrelated }).effective;
		expect(video.compositions).toEqual([]);
		expect(video.supportingLayerIds).toEqual([]);
		expect(video.resources.map((resource) => resource.id)).toEqual(["VIDEO"]);
		expect(collection({ sections: ["inventory"] }, { evidence: unrelated }).effective.inventoryIds).toEqual(["ALT", "LO", "LU", "ORPHAN", "Q"]);
		const memoryProof = { ...source, supportingLayers: [{ baseMediaId: "SHARED", layerMediaId: "LV", order: 0, sourceIds: ["SOURCE-M0"] }] };
		expect(collection({ sections: ["memories"] }, { evidence: memoryProof }).effective.compositions).toEqual([{ baseMediaId: "SHARED", layerMediaId: "LV", order: 0, sourceIds: ["SOURCE-M0"] }]);
		expect(collection({ years: [2019] }, { evidence: memoryProof }).effective.compositions).toEqual([]);
		expect(collection({ years: [2019] }, { evidence: memoryProof }).effective.mediaRecordIds).toEqual(["SHARED"]);
		expect(JSON.stringify(unrelated)).toBe(before);
	});
	it("requires an occurrence witness for export confirmation while retaining reference-only and supplementary proof", () => {
		const source = queryArchive();
		const query = normalizeArchiveQuery({}, context);
		if (!query.ok) throw new Error("fixture query");
		const physicalOnly = { ...source, occurrences: source.occurrences.map((occurrence) => occurrence.id === "O0" ? { ...occurrence, association: { state: "confirmed" as const, mediaId: "SHARED", proof: { kind: "export-exact" as const, sourceIds: ["SOURCE-SHARED"] } } } : occurrence) };
		expect(selectArchiveCollection({ evidence: physicalOnly, query: query.query, decisions: [], denyTargets: [], datasetRevision: "d", queryRevision: "q", reviewRevision: "r" }).ok).toBe(false);
		expect(collection({}, { evidence: source }).effective.inlineAssociations.find((association) => association.occurrenceId === "O0")?.proof).toEqual({ kind: "export-exact", sourceIds: ["SOURCE-E0"] });
		const supplemented = { ...source, occurrences: source.occurrences.map((occurrence) => occurrence.id === "O0" ? { ...occurrence, association: { state: "confirmed" as const, mediaId: "SHARED", proof: { kind: "export-exact" as const, sourceIds: ["SOURCE-SHARED", "SOURCE-E0"] } } } : occurrence) };
		expect(collection({}, { evidence: supplemented }).effective.inlineAssociations.find((association) => association.occurrenceId === "O0")?.proof).toEqual({ kind: "export-exact", sourceIds: ["SOURCE-E0", "SOURCE-SHARED"] });
	});
	it("canonicalizes complete nested source, candidate and diagnostic memberships without mutation", () => {
		const source = layeredArchive();
		const diagnostics = [
			{ id: "DB", code: "gap", owner: { kind: "event" as const, id: "E0" }, sourceIds: ["SOURCE-E0"] },
			{ id: "DA", code: "gap", owner: { kind: "event" as const, id: "E0" }, sourceIds: ["SOURCE-E0"] },
			{ id: "DM", code: "gap", owner: { kind: "occurrence" as const, id: "M0" }, sourceIds: ["SOURCE-M0-COPY", "SOURCE-M0"] },
			{ id: "DUZ", code: "unsupported", owner: null, sourceIds: ["SOURCE-M0-COPY", "SOURCE-M0"] },
			{ id: "DUA", code: "unsupported", owner: null, sourceIds: ["SOURCE-MMISS"] },
		];
		const evidence = { ...source, diagnostics };
		const reordered: QueryEvidence = {
			...evidence, sources: [...evidence.sources].reverse(),
			events: [...evidence.events].reverse().map((event) => ({ ...event, sourceIds: [...event.sourceIds].reverse() })),
			media: [...evidence.media].reverse().map((media) => ({ ...media, sourceIds: [...media.sourceIds].reverse() })),
			occurrences: [...evidence.occurrences].reverse().map((occurrence) => {
				const association = occurrence.association;
				return { ...occurrence, sourceIds: [...occurrence.sourceIds].reverse(), identity: { ...occurrence.identity, copySourceIds: [...occurrence.identity.copySourceIds].reverse() }, association:
					association.state === "confirmed" ? { ...association, proof: { ...association.proof, sourceIds: [...association.proof.sourceIds].reverse() } }
					: association.state === "unlinked" ? { ...association, proofSourceIds: [...association.proofSourceIds].reverse() }
					: { ...association, referenceSourceIds: [...association.referenceSourceIds].reverse(), candidates: [...association.candidates].reverse().map((candidate) => ({ ...candidate, proofSourceIds: [...candidate.proofSourceIds].reverse() })) } };
			}),
			supportingLayers: [...evidence.supportingLayers].reverse().map((edge) => ({ ...edge, sourceIds: [...edge.sourceIds].reverse() })),
			diagnostics: [...diagnostics].reverse().map((diagnostic) => ({ ...diagnostic, sourceIds: [...diagnostic.sourceIds].reverse() })),
		};
		const before = JSON.stringify(reordered);
		const expected = collection({}, { evidence });
		expect(collection({}, { evidence: reordered })).toEqual(expected);
		expect(expected.effective.diagnostics.map((diagnostic) => diagnostic.id)).toEqual(["DA", "DB", "DM"]);
		expect(expected.reviewOnlyDiagnostics.map((diagnostic) => diagnostic.id)).toEqual(["DUA", "DUZ"]);
		expect(expected.effective.diagnostics.find((diagnostic) => diagnostic.id === "DM")?.sourceIds).toEqual(["SOURCE-M0", "SOURCE-M0-COPY"]);
		expect(expected.effective.occurrences.find((occurrence) => occurrence.id === "O4")?.association).toEqual({ state: "ambiguous", referenceSourceIds: ["SOURCE-E4"], candidates: [
			{ mediaId: "ALT", proofSourceIds: ["SOURCE-ALT", "SOURCE-E4"] },
			{ mediaId: "Q", proofSourceIds: ["SOURCE-E4", "SOURCE-Q-CANARY"] },
		] });
		expect(JSON.stringify(reordered)).toBe(before);
	});
	it("presents mixed known and unknown layer orders identically across every edge permutation", () => {
		const source = layeredArchive();
		const template = source.media.find((media) => media.id === "LV")!;
		const added = ["LX", "LY"].map((id) => ({ ...template, id, filename: `${id}.png`, entry: { sourceId: "layers", path: `files/${id}.png`, ordinal: 0 }, sourceIds: [`SOURCE-${id}`] }));
		const sources = added.map((media) => ({ id: media.sourceIds[0]!, sourceId: "layers", path: media.entry.path, recordPointer: "", entryOrdinal: 0, documentSha256: null }));
		const edges = [
			{ baseMediaId: "VIDEO", layerMediaId: "LV", order: 2, sourceIds: ["SOURCE-LV"] },
			{ baseMediaId: "VIDEO", layerMediaId: "LX", order: null, sourceIds: ["SOURCE-LX"] },
			{ baseMediaId: "VIDEO", layerMediaId: "LY", order: 1, sourceIds: ["SOURCE-LY"] },
		];
		const evidence = { ...source, media: [...source.media, ...added], sources: [...source.sources, ...sources], supportingLayers: edges };
		const before = JSON.stringify(evidence);
		const expected = collection({ kinds: ["video"] }, { evidence }).effective;
		expect(expected.compositions.map((edge) => [edge.layerMediaId, edge.order])).toEqual([["LY", 1], ["LV", 2], ["LX", null]]);
		for (const positions of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
			const permutation = { ...evidence, supportingLayers: positions.map((index) => edges[index]!) };
			expect(collection({ kinds: ["video"] }, { evidence: permutation }).effective).toEqual(expected);
		}
		expect(JSON.stringify(evidence)).toBe(before);
	});
	it("compares numeric local calendar dates across both supported UTC limits", () => {
		const source = queryArchive();
		const atEdge = (epochMicroseconds: string): QueryEvidence => {
			const time = { kind: "instant" as const, epochMicroseconds, precision: "microsecond" as const, sourceTimeId: "SOURCE-E0" };
			return { ...source, events: [{ ...source.events[0]!, time }], occurrences: [{ ...source.occurrences[0]!, time }], media: source.media.filter((media) => media.id === "SHARED") };
		};
		const minimum = atEdge("-62135596800000000");
		expect(collection({ timezone: "Etc/GMT+1", years: [1] }, { evidence: minimum }).effective.eventIds).toEqual([]);
		expect(collection({ timezone: "Etc/GMT+1", range: { mode: "calendarDays", start: null, end: "0001-01-01" } }, { evidence: minimum }).effective.occurrenceIds).toEqual(["O0"]);
		expect(collection({ timezone: "Etc/GMT+1", range: { mode: "calendarDays", start: "0001-01-01", end: null } }, { evidence: minimum }).effective.eventIds).toEqual([]);
		expect(collection({ years: [1] }, { evidence: minimum }).effective.eventIds).toEqual(["E0"]);
		const maximum = atEdge("253402300799999999");
		expect(collection({ timezone: "Etc/GMT-14", range: { mode: "calendarDays", start: null, end: "9999-12-31" } }, { evidence: maximum }).effective.eventIds).toEqual([]);
		expect(collection({ timezone: "Etc/GMT-14", range: { mode: "calendarDays", start: "9999-12-31", end: null } }, { evidence: maximum }).effective.occurrenceIds).toEqual(["O0"]);
		expect(collection({ years: [9999] }, { evidence: maximum }).effective.eventIds).toEqual(["E0"]);
	});
	it("rejects hidden or executable complete evidence, including nested arrays, before reading it", () => {
		const query = normalizeArchiveQuery({}, context);
		if (!query.ok) throw new Error("fixture query");
		let reads = 0;
		const evidenceCases = [queryArchive(), queryArchive(), queryArchive(), queryArchive(), queryArchive()];
		Object.defineProperty(evidenceCases[0]!.events[0]!, "PRIVATE-HIDDEN-CANARY", { value: true });
		Object.defineProperty(evidenceCases[1]!.events, "0", { get() { reads++; return queryArchive().events[0]; } });
		Object.defineProperty(evidenceCases[2]!.occurrences[0]!.identity.copySourceIds, "0", { get() { reads++; return "SOURCE-E0"; } });
		Object.defineProperty(evidenceCases[3]!.occurrences[4]!.association, "PRIVATE-HIDDEN-CANARY", { value: true });
		Object.defineProperty(evidenceCases[4]!.media[0]!.sourceIds, Symbol("PRIVATE-SYMBOL-CANARY"), { value: true });
		for (const evidence of evidenceCases) {
			const result = selectArchiveCollection({ evidence, query: query.query, decisions: [], denyTargets: [], datasetRevision: "d", queryRevision: "q", reviewRevision: "r" });
			expect(result.ok).toBe(false);
			expect(JSON.stringify(result)).not.toContain("PRIVATE-");
		}
		expect(reads).toBe(0);
	});
	it("matches the remaining handwritten intersections and keeps input and prior results unchanged", () => {
		const cases: [unknown, string[], string[], string[]][] = [
			[{ years: [2019] }, ["E0"], ["O0"], ["SHARED"]],
			[{ timezone: "Europe/Oslo", years: [2020] }, ["E0", "E1", "E2", "E3", "E5", "E6"], ["O0", "M0", "O1", "MMISS", "O2", "O3"], ["SHARED", "MISS", "PHOTO", "VIDEO"]],
			[{ years: [2020] }, ["E1", "E2", "E3", "E5", "E6"], ["M0", "O1", "MMISS", "O2", "O3"], ["SHARED", "MISS", "PHOTO", "VIDEO"]],
			[{ linkStates: ["unlinked"] }, ["E5", "E6", "E7"], ["MMISS"], ["MISS", "ALT", "ORPHAN", "Q"]],
			[{ sections: ["memories"], text: "CAFÉ" }, [], [], []],
			[{ years: [2019], text: "memory coast" }, [], [], []],
		];
		for (const [query, e, o, m] of cases) { const selected = collection(query).effective; expect(selected.eventIds).toEqual(e); expect(selected.occurrenceIds).toEqual(o); expect(selected.mediaRecordIds).toEqual(m); }
		const evidence = queryArchive(), lastEvent = evidence.events.find((e) => e.id === "E7")!, first = evidence.occurrences[0]!;
		const ocj = { ...first, id: "OCJ", owningEventId: "E7", time: lastEvent.time, sourceIds: lastEvent.sourceIds, association: { state: "confirmed" as const, mediaId: "SHARED", proof: { kind: "export-exact" as const, sourceIds: lastEvent.sourceIds } }, identity: { ...first.identity, rowPointer: "/E7", copySourceIds: lastEvent.sourceIds } };
		expect(collection({ years: [2019], conversationIds: ["CJ"] }, { evidence: { ...evidence, occurrences: [...evidence.occurrences, ocj] } }).effective.mediaRecordIds).toEqual([]);
		const original = JSON.stringify(evidence);
		const freeze = (value: unknown): void => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } };
		freeze(evidence);
		const prior = collection({}, { evidence }); freeze(prior);
		const reordered = { ...evidence, sources: [...evidence.sources].reverse(), media: [...evidence.media].reverse(), occurrences: [...evidence.occurrences].reverse(), events: [...evidence.events].reverse(), conversations: [...evidence.conversations].reverse() };
		const result = collection({}, { evidence: reordered });
		expect(result.effective).toEqual(prior.effective);
		(result.effective.occurrences[0]!.sourceIds as string[]).push("MUTATED");
		expect(JSON.stringify(evidence)).toBe(original); expect(JSON.stringify(prior)).not.toContain("MUTATED"); expect(JSON.stringify(collection({}, { evidence }))).not.toContain("MUTATED");
	});
	it("keeps typed targets separate when an event and standalone media share an identifier", () => {
		const source = queryArchive(), evidence = { ...source, events: [{ ...source.events[0]!, id: "SHARED" }], occurrences: [], media: source.media.filter((m) => m.id === "SHARED") };
		const result = collection({}, { evidence, denyTargets: [{ kind: "event", id: "SHARED" }] }).effective;
		expect(result.eventIds).toEqual([]); expect(result.mediaRecordIds).toEqual(["SHARED"]); expect(result.inventoryIds).toEqual(["SHARED"]);
	});
	it("retains typed owner confirmation and refuses conflicting confirmations or copy identities", () => {
		const source = queryArchive(), o4 = source.occurrences.find((o) => o.id === "O4")!;
		const confirmed = { ...o4, association: { state: "confirmed" as const, mediaId: "Q", proof: { kind: "owner-confirmed" as const, decisionId: "decision-1", evidenceRevision: "review-3", sourceIds: ["SOURCE-E4", "SOURCE-Q-CANARY"] } } };
		const evidence = { ...source, occurrences: source.occurrences.map((o) => o.id === "O4" ? confirmed : o) };
		const result = collection({ linkStates: ["confirmed"] }, { evidence }).effective;
		expect(result.eventIds).toEqual(["E0", "E1", "E2", "E3", "E4"]); expect(result.occurrenceIds).toEqual(["O0", "M0", "O1", "O2", "O3", "O4"]);
		expect(result.mediaRecordIds).toEqual(["SHARED", "PHOTO", "VIDEO", "Q"]); expect(result.inlineAssociations.at(-1)?.proof.kind).toBe("owner-confirmed");
		const q = normalizeArchiveQuery({}, context); if (!q.ok) throw new Error("query");
		const input: CollectionInput = { evidence, query: q.query, decisions: [], denyTargets: [], datasetRevision: "d", queryRevision: "q", reviewRevision: "r" };
		expect(selectArchiveCollection({ ...input, evidence: { ...evidence, occurrences: [...evidence.occurrences, { ...confirmed, id: "SECOND-CONFIRM" }] } }).ok).toBe(false);
		expect(selectArchiveCollection({ ...input, evidence: { ...evidence, occurrences: evidence.occurrences.map((o) => o.id === "O4" ? { ...confirmed, association: { ...confirmed.association, mediaId: "MISS" } } : o) } }).ok).toBe(false);
		const layers = layeredArchive();
		expect(selectArchiveCollection({ ...input, evidence: { ...layers, supportingLayers: [...layers.supportingLayers, layers.supportingLayers[0]!] } }).ok).toBe(false);
	});
	it("keeps both repeated local clocks and gives unavailable dates an explicit category", () => {
		expect(collection({ timezone: "Europe/Oslo", range: { mode: "calendarDays", start: "2020-03-29", end: "2020-03-30" } }).effective.eventIds).toEqual(["E2", "E3"]);
		expect(collection({ timezone: "Europe/Oslo", range: { mode: "calendarDays", start: "2020-10-25", end: "2020-10-26" } }).effective.eventIds).toEqual(["E5", "E6"]);
		expect(collection({ range: { mode: "instants", start: "2020-10-25T00:00:00Z", end: "2020-10-25T01:00:00Z" } }).effective.eventIds).toEqual(["E5"]);
		const evidence = precisionArchive(), unavailable = collection({ unavailable: "only" }, { evidence }).effective;
		expect(unavailable.eventIds).toEqual(["D_DATE", "D_BAD", "D_UNZONED"]);
		expect(unavailable.events[0]?.time).toMatchObject({ kind: "date-only", recordedDate: "2019-12-31" });
		expect(collection({ years: [2020], unavailable: "include" }, { evidence }).effective.eventIds).toEqual(["Z_EARLY", "A_LATE", "D_DATE", "D_BAD", "D_UNZONED"]);
		expect(collection({ sections: ["inventory"], years: [2020] }).effective.mediaRecordIds).toEqual([]);
		expect(collection({ sections: ["inventory"], years: [2020], unavailable: "include" }).effective.mediaRecordIds).toEqual(["ALT", "ORPHAN", "Q"]);
		expect(collection({ sections: ["inventory"], years: [2020], unavailable: "include", participantIds: ["Maya"] }).effective.mediaRecordIds).toEqual([]);
		for (const start of ["", "2020-02-30", "2020-01-01T00:00:00", "2020-01-01T00:00:00.0000001Z"]) expect(normalizeArchiveQuery({ range: { mode: start.includes("T") ? "instants" : "calendarDays", start, end: null } }, context).ok).toBe(false);
		expect(normalizeArchiveQuery({ range: { mode: "instants", start: null, end: null } }, context)).toMatchObject({ ok: true, query: { range: null } });
	});
	it("selects required support bytes outside the kind facet and withholds them when their last context disappears", () => {
		const evidence = layeredArchive();
		const selected = collection({ kinds: ["video"] }, { evidence }).effective;
		expect(selected.mediaRecordIds).toEqual(["VIDEO"]); expect(selected.supportingLayerIds).toEqual(["LV"]);
		expect(selected.counts).toMatchObject({ historicalOccurrences: 1, originalPhysicalFiles: 1, supportingLayers: 1, physicalResources: 2 });
		const extraProof = { ...evidence, supportingLayers: evidence.supportingLayers.map((edge) => ({ ...edge, sourceIds: [...edge.sourceIds, "SOURCE-M0"] })) };
		expect(JSON.stringify(collection({ kinds: ["video"] }, { evidence: extraProof }).effective)).not.toContain("SOURCE-M0");
		const excludedLayer = collection({ kinds: ["video"] }, { evidence, denyTargets: [{ kind: "media", id: "LV" }] }).effective;
		expect(excludedLayer.mediaRecordIds).toEqual(["VIDEO"]); expect(excludedLayer.compositions).toEqual([]); expect(excludedLayer.supportingLayerIds).toEqual([]);
		expect(collection({ kinds: ["video"] }, { evidence, denyTargets: [{ kind: "event", id: "E3" }] }).effective.resources).toEqual([]);
		const inventory = collection({ sections: ["inventory"] }, { evidence }).effective;
		expect(inventory.inventoryIds).toEqual(["ALT", "LO", "LU", "ORPHAN", "Q"]); expect(inventory.counts.physicalResources).toBe(5); expect(inventory.counts.historicalOccurrences).toBe(0);
		const reused = { ...evidence, events: evidence.events.filter((e) => e.id === "E2" || e.id === "E3"), occurrences: evidence.occurrences.filter((o) => o.id === "O2" || o.id === "O3"), media: evidence.media.filter((m) => ["PHOTO", "VIDEO", "LV"].includes(m.id)), supportingLayers: [...evidence.supportingLayers, { baseMediaId: "PHOTO", layerMediaId: "LV", sourceIds: ["SOURCE-PHOTO", "SOURCE-LV"], order: 0 }] };
		const remaining = collection({}, { evidence: reused, denyTargets: [{ kind: "event", id: "E2" }] }).effective;
		expect(remaining.occurrenceIds).toEqual(["O3"]); expect(remaining.supportingLayerIds).toEqual(["LV"]); expect(remaining.counts.physicalResources).toBe(2);
		expect(collection({}, { evidence: reused, denyTargets: [{ kind: "event", id: "E2" }, { kind: "event", id: "E3" }] }).effective.resources).toEqual([]);
	});
	it("retains true identical saves and scopes copied provenance without merging overlapping documents", () => {
		const evidence = copiedArchive();
		expect(collection({}, { evidence }).effective.occurrenceIds).toEqual(["M0", "M1", "M2", "M3"]);
		const matched = collection({ text: "repeat coast" }, { evidence }).effective;
		expect(matched.occurrenceIds).toEqual(["M0", "M1", "M2"]); expect(matched.mediaRecordIds).toEqual(["SHARED"]);
		expect(matched.counts).toMatchObject({ historicalOccurrences: 3, originalPhysicalFiles: 1 });
		const diagnostics = [{ id: "DU", code: "unsupported", owner: null, sourceIds: ["COPY-M3"] }, { id: "DM0", code: "gap", owner: { kind: "occurrence" as const, id: "M0" }, sourceIds: ["COPY-M0", "COPY-M3"] }];
		const kept = collection({}, { evidence: { ...evidence, diagnostics }, denyTargets: [{ kind: "occurrence", id: "M3" }] });
		expect(kept.effective.occurrenceIds).toEqual(["M0", "M1", "M2"]);
		expect(kept.effective.diagnostics[0]?.sourceIds).toEqual(["COPY-M0"]);
		expect(JSON.stringify(kept.effective)).not.toContain("COPY-M3"); expect(JSON.stringify(kept.effective)).not.toContain("CANARY-OTHER");
		expect(JSON.stringify(evidence)).toContain("CANARY-OTHER");
	});
	it("uses a missing reference's declared kind and exports only its selected metadata pointers", () => {
		const source = queryArchive();
		const evidence = { ...source, media: source.media.map((m) => m.id === "MISS" ? { ...m, kind: "unknown" as const, sourceIds: ["SOURCE-MMISS", "SOURCE-M0"] } : m), occurrences: source.occurrences.map((o) => o.id === "MMISS" ? { ...o, declaredKind: "video" as const } : o) };
		const result = collection({ kinds: ["video"] }, { evidence }).effective;
		expect(result.occurrenceIds).toEqual(["MMISS", "O3"]);
		expect(result.mediaRecordIds).toEqual(["MISS", "VIDEO"]);
		expect(result.resources.find((m) => m.id === "MISS")?.sourceIds).toEqual(["SOURCE-MMISS"]);
		expect(result.counts.byKind.occurrences.video).toBe(2);
		const invalidPhysical = { ...source, media: source.media.map((m) => m.id === "SHARED" ? { ...m, sourceIds: [...m.sourceIds, "SOURCE-M0"] } : m) };
		const q = normalizeArchiveQuery({}, context); if (!q.ok) throw new Error("query");
		expect(selectArchiveCollection({ evidence: invalidPhysical, query: q.query, decisions: [], denyTargets: [], datasetRevision: "d", queryRevision: "q", reviewRevision: "r" }).ok).toBe(false);
	});
	it("rejects incomplete evidence and malformed dependent proofs before returning a partial collection", () => {
		const evidence = queryArchive(), q = normalizeArchiveQuery({}, context);
		if (!q.ok) throw new Error("query");
		const input: CollectionInput = { evidence, query: q.query, decisions: [], denyTargets: [], datasetRevision: "d", queryRevision: "q", reviewRevision: "r" };
		expect(selectArchiveCollection({ ...input, evidence: { ...evidence, occurrencesComplete: false } as unknown as QueryEvidence })).toEqual({ ok: false, errors: [{ code: "incomplete_occurrences", path: "evidence" }] });
		const o4 = evidence.occurrences.find((o) => o.id === "O4")!;
		if (o4.association.state !== "ambiguous") throw new Error("fixture");
		const invalid = { ...o4, association: { ...o4.association, candidates: [{ mediaId: "MISS", proofSourceIds: ["SOURCE-E4"] }] } };
		expect(selectArchiveCollection({ ...input, evidence: { ...evidence, occurrences: evidence.occurrences.map((o) => o.id === "O4" ? invalid : o) } }).ok).toBe(false);
		const wrongProof = { ...o4, association: { ...o4.association, candidates: [{ mediaId: "ALT", proofSourceIds: ["SOURCE-Q-CANARY"] }] } };
		expect(selectArchiveCollection({ ...input, evidence: { ...evidence, occurrences: evidence.occurrences.map((o) => o.id === "O4" ? wrongProof : o) } }).ok).toBe(false);
		const badTime = { ...evidence.events[0]!, time: { kind: "instant" as const, epochMicroseconds: "-1", precision: "millisecond" as const, sourceTimeId: "SOURCE-E0" } };
		expect(selectArchiveCollection({ ...input, evidence: { ...evidence, events: [badTime, ...evidence.events.slice(1)] } }).ok).toBe(false);
		expect(selectArchiveCollection({ ...input, query: { ...q.query, participantIds: ["PRIVATE-PROOF-CANARY"] } }).ok).toBe(false);
	});
	it("uses the selected timezone for years and retains signed microseconds at exclusive bounds", () => {
		expect(collection({ years: [2019] }).effective.eventIds).toEqual(["E0"]);
		expect(collection({ timezone: "Europe/Oslo", years: [2020] }).effective.eventIds).toEqual(["E0", "E1", "E2", "E3", "E5", "E6"]);
		const evidence = precisionArchive();
		expect(collection({ years: [1969] }, { evidence }).effective.eventIds).toEqual(["N_NEG"]);
		expect(collection({ years: [1970] }, { evidence }).effective.eventIds).toEqual(["N_ZERO", "N_POS"]);
		expect(collection({ timezone: "Europe/Oslo", years: [1970] }, { evidence }).effective.eventIds).toEqual(["N_NEG", "N_ZERO", "N_POS"]);
		expect(collection({ range: { mode: "instants", start: "1969-12-31T23:59:59.999999Z", end: "1970-01-01T00:00:00Z" } }, { evidence }).effective.mediaRecordIds).toEqual(["NEG"]);
		expect(collection({ range: { mode: "instants", start: "2020-01-01T00:00:00.000001Z", end: "2020-01-01T00:00:00.000002Z" } }, { evidence }).effective.eventIds).toEqual(["Z_EARLY"]);
		expect(collection({}, { evidence }).effective.eventIds).toEqual(["N_NEG", "N_ZERO", "N_POS", "Z_EARLY", "A_LATE", "D_DATE", "D_BAD", "D_UNZONED"]);
	});
	it("removes denied candidate proof and limits owned diagnostics to selected source scope", () => {
		const evidence = queryArchive();
		const diagnostics = [{ id: "DU", code: "unsupported", owner: null, sourceIds: ["SOURCE-M0"] }, { id: "D0", code: "gap", owner: { kind: "occurrence" as const, id: "O0" }, sourceIds: ["SOURCE-E0", "SOURCE-M0"] }];
		const result = collection({}, { evidence: { ...evidence, diagnostics }, denyTargets: [{ kind: "media", id: "Q" }, { kind: "occurrence", id: "M0" }] });
		expect(result.effective.candidates).toEqual([{ occurrenceId: "O4", state: "ambiguous", candidateMediaIds: ["ALT"] }]);
		expect(result.effective.occurrences.find((o) => o.id === "O4")?.association).toEqual({ state: "ambiguous", referenceSourceIds: ["SOURCE-E4"], candidates: [{ mediaId: "ALT", proofSourceIds: ["SOURCE-ALT", "SOURCE-E4"] }] });
		expect(result.effective.diagnostics).toEqual([{ ...diagnostics[1], sourceIds: ["SOURCE-E0"] }]);
		expect(result.reviewOnlyDiagnostics.map((d) => d.id)).toEqual(["D0", "DU"]);
		const serialized = JSON.stringify(result.effective);
		expect(serialized).not.toContain("SOURCE-Q-CANARY"); expect(serialized).not.toContain("SOURCE-M0"); expect(serialized).not.toContain("CANARY-M0");
		expect(result.matched.occurrences.find((o) => o.id === "O4")?.association).toEqual({ state: "ambiguous", referenceSourceIds: ["SOURCE-E4"], candidates: [
			{ mediaId: "ALT", proofSourceIds: ["SOURCE-ALT", "SOURCE-E4"] },
			{ mediaId: "Q", proofSourceIds: ["SOURCE-E4", "SOURCE-Q-CANARY"] },
		] });
		expect(result.effective.mediaRecordIds).toEqual(["SHARED", "MISS", "PHOTO", "VIDEO", "ALT", "ORPHAN"]);
		expect(result.effective.counts).toMatchObject({ originalPhysicalFiles: 5, inventoryOriginals: 2, candidateFiles: 1, physicalResources: 5 });
	});
	it("stops review fallback at an undecided event and keeps exclusion authority above child choices", () => {
		const decisions: CollectionInput["decisions"] = [{ target: { kind: "media", id: "SHARED" }, status: "keep" }, { target: { kind: "event", id: "E1" }, status: "later" }];
		expect(collection({ reviews: ["keep"] }, { decisions }).effective.occurrenceIds).toEqual(["M0"]);
		const later = collection({ reviews: ["later"] }, { decisions }).effective;
		expect(later.eventIds).toEqual(["E1"]); expect(later.occurrenceIds).toEqual(["O1"]); expect(later.mediaRecordIds).toEqual(["SHARED"]);
		expect(later.counts.later).toEqual({ events: 1, occurrences: 1, media: 0 });
		const blocked = [...decisions, { target: { kind: "event" as const, id: "E0" }, status: "exclude" as const }, { target: { kind: "occurrence" as const, id: "O0" }, status: "keep" as const }];
		const kept = collection({ reviews: ["keep"] }, { decisions: blocked });
		expect(kept.matched.occurrenceIds).toEqual(["O0", "M0"]);
		expect(kept.effective.occurrenceIds).toEqual(["M0"]);
		expect(JSON.stringify(kept.effective)).not.toContain("SOURCE-E0");
		const fileExcluded = blocked.map((decision) => decision.target.kind === "media" ? { ...decision, status: "exclude" as const } : decision);
		expect(collection({ reviews: ["keep"] }, { decisions: fileExcluded }).effective.mediaRecordIds).toEqual([]);
		const rule = collection({ reviews: [] }, { decisions, denyTargets: [{ kind: "event", id: "E0" }, { kind: "event", id: "E1" }, { kind: "media", id: "SHARED" }] }).effective;
		expect(rule.eventIds).toEqual(["E2", "E3", "E5", "E6", "E7", "E4"]);
		expect(rule.occurrenceIds).toEqual(["MMISS", "O2", "O3", "O4"]);
		expect(rule.mediaRecordIds).toEqual(["MISS", "PHOTO", "VIDEO", "ALT", "ORPHAN", "Q"]);
		expect(collection({ reviews: ["exclude"] }, { decisions: blocked }).effective.eventIds).toEqual([]);
	});
	it("uses event kind, reference kind and proven membership without promoting candidate bytes", () => {
		const compound = collection({ participantIds: ["Maya", "Jules"], conversationIds: ["CM", "CG"], kinds: ["image", "video"], sections: ["chats", "snaps"], linkStates: ["confirmed"] }).effective;
		expect(compound.eventIds).toEqual(["E1", "E2", "E3"]);
		expect(compound.occurrenceIds).toEqual(["O0", "O1", "O2", "O3"]);
		expect(compound.mediaRecordIds).toEqual(["SHARED", "PHOTO", "VIDEO"]);
		const ambiguous = collection({ kinds: ["unknown"], linkStates: ["ambiguous"] }).effective;
		expect(ambiguous.eventIds).toEqual([]); expect(ambiguous.occurrenceIds).toEqual(["O4"]);
		expect(ambiguous.mediaRecordIds).toEqual([]); expect(ambiguous.counts.candidateFiles).toBe(2);
		expect(collection({ kinds: ["gif"], linkStates: ["ambiguous"] }).effective.occurrenceIds).toEqual([]);
		expect(collection({ kinds: ["gif"] }).effective.mediaRecordIds).toEqual(["ALT", "Q"]);
		const source = queryArchive();
		const unknown = { ...source, events: source.events.slice(0, 2).map((event) => ({ ...event, conversationId: "CU" })), occurrences: source.occurrences.slice(0, 2), media: source.media.filter((m) => m.id === "SHARED") };
		expect(collection({ participantIds: ["Maya"] }, { evidence: unknown }).effective.eventIds).toEqual(["E1"]);
		expect(collection({ participantIds: ["Maya"] }, { evidence: unknown }).effective.occurrenceIds).toEqual(["O1"]);
	});
	it("scopes each selected file to the exact matching occurrence's section and literal context", () => {
		const memories = collection({ sections: ["memories"] }).effective;
		expect(memories.eventIds).toEqual([]);
		expect(memories.occurrenceIds).toEqual(["M0", "MMISS"]);
		expect(memories.mediaRecordIds).toEqual(["SHARED", "MISS"]);
		expect(memories.occurrences[0]?.sourceIds).toEqual(["SOURCE-M0", "SOURCE-M0-COPY"]);
		const café = collection({ text: "CAFÉ" }).effective;
		expect(café.eventIds).toEqual(["E0", "E1", "E7"]);
		expect(café.occurrenceIds).toEqual(["O0", "O1"]);
		expect(café.mediaRecordIds).toEqual(["SHARED"]);
		expect(JSON.stringify(café)).not.toContain("CANARY-M0");
		const split = collection({ sections: ["memories"], text: "CAFÉ" }).effective;
		expect(split.occurrenceIds).toEqual([]); expect(split.mediaRecordIds).toEqual([]);
		expect(collection({ text: "<b>coast</b>" }).effective.eventIds).toEqual(["E0"]);
	});
	it("keeps historical occurrences, physical inventory and candidates distinct in the neutral collection", () => {
		const result = collection();
		expect(result.effective.eventIds).toEqual(["E0", "E1", "E2", "E3", "E5", "E6", "E7", "E4"]);
		expect(result.effective.occurrenceIds).toEqual(["O0", "M0", "O1", "MMISS", "O2", "O3", "O4"]);
		expect(result.effective.mediaRecordIds).toEqual(["SHARED", "MISS", "PHOTO", "VIDEO", "ALT", "ORPHAN", "Q"]);
		expect(result.effective.inventoryIds).toEqual(["ALT", "ORPHAN", "Q"]);
		expect(result.effective.candidates).toEqual([{ occurrenceId: "O4", state: "ambiguous", candidateMediaIds: ["ALT", "Q"] }]);
		expect(result.effective.counts).toMatchObject({ events: 8, historicalOccurrences: 7, originalPhysicalFiles: 6, missingMediaRecords: 1, inventoryOriginals: 3, inventoryLayers: 0, supportingLayers: 0, physicalResources: 6, candidateReferences: 1, candidateFiles: 2 });
		expect(result.effective.inlineAssociations.map((link) => link.occurrenceId)).toEqual(["O0", "O1", "O2", "O3"]);
		expect(result).toMatchObject({ datasetRevision: "dataset-1", queryRevision: "query-2", reviewRevision: "review-3" });
	});
});
