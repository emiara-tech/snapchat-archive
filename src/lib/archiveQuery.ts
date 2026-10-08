import type { CanonicalArchiveQuery, QueryContext, QueryError, QueryRange, QueryValidation } from "../types/archiveQuery";
import type { LinkState, MediaKind } from "../types/dataset";
import type { QueryOrigin, QueryReview } from "../types/archiveQuery";
import type { ArchiveCollection, CollectionInput, CollectionSelection, CollectionValidation, QueryDiagnostic, QueryEvidence, QueryEvent, QueryMediaRecord, QueryOccurrence, QueryTarget, QueryTime } from "../types/archiveQuery";

const kinds: readonly MediaKind[] = ["text", "image", "video", "audio", "sticker", "gif", "attachment", "unknown"];
const origins: readonly QueryOrigin[] = ["chats", "snaps", "memories", "inventory"];
const links: readonly LinkState[] = ["confirmed", "inferred", "ambiguous", "unlinked"];
const reviews: readonly QueryReview[] = ["exclude", "keep", "later", "unreviewed"];
const activeReviews: readonly QueryReview[] = ["keep", "later", "unreviewed"];
const compareId = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const literal = (value: string) => value.normalize("NFC").toLowerCase();
function record(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null) return false;
	return Reflect.ownKeys(value).every((key) => {
		if (typeof key !== "string") return false;
		const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
		return "value" in descriptor && descriptor.enumerable;
	});
}
function dataArray(value: unknown): value is unknown[] {
	if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false;
	const keys = Reflect.ownKeys(value);
	const length = Object.getOwnPropertyDescriptor(value, "length")?.value as unknown;
	if (typeof length !== "number" || keys.length !== length + 1) return false;
	return keys.every((key) => {
		if (typeof key !== "string") return false;
		const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
		if (!("value" in descriptor)) return false;
		if (key === "length") return true;
		const index = Number(key);
		return descriptor.enumerable && Number.isInteger(index) && index >= 0 && index < length && String(index) === key;
	});
}
const validString = (value: unknown, max = 256): value is string => typeof value === "string" && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(value) && [...value].length <= max;
const floorDivision = (n: bigint, d: bigint) => n / d - (n % d < 0n ? 1n : 0n);
const minMicros = -62135596800000000n, maxMicros = 253402300800000000n;
function civilDate(value: unknown): Date | null {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
	const [year, month, day] = value.split("-").map(Number);
	if (!year || year > 9999 || month! < 1 || month! > 12 || day! < 1 || day! > 31) return null;
	const date = new Date(0); date.setUTCFullYear(year!, month! - 1, day!); date.setUTCHours(0, 0, 0, 0);
	return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day ? date : null;
}
function instantBound(value: unknown): bigint | null {
	if (typeof value !== "string") return null;
	const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
	if (!match) return null;
	const date = civilDate(match[1]), hour = Number(match[2]), minute = Number(match[3]), second = Number(match[4] ?? 0);
	if (!date || hour > 23 || minute > 59 || second > 59) return null;
	const zone = match[6]!;
	let offsetMinutes = 0;
	if (zone !== "Z") { const h = Number(zone.slice(1, 3)), m = Number(zone.slice(4, 6)); if (h > 23 || m > 59) return null; offsetMinutes = (h * 60 + m) * (zone[0] === "-" ? -1 : 1); }
	date.setUTCHours(hour, minute, second, 0);
	const micros = BigInt(date.getTime()) * 1000n + BigInt((match[5] ?? "").padEnd(6, "0") || "0") - BigInt(offsetMinutes) * 60000000n;
	return micros >= minMicros && micros < maxMicros ? micros : null;
}
function instantLabel(micros: bigint): string {
	const second = floorDivision(micros, 1000000n), fraction = micros - second * 1000000n;
	return new Date(Number(second * 1000n)).toISOString().slice(0, -5) + (fraction ? `.${String(fraction).padStart(6, "0").replace(/0+$/, "")}` : "") + "Z";
}
type CalendarDate = readonly [year: number, month: number, day: number];
function compareCalendarDate(a: CalendarDate, b: CalendarDate): number {
	return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}
function calendarBound(value: string | null): CalendarDate | null {
	if (value === null) return null;
	const parts = value.split("-").map(Number);
	return [parts[0]!, parts[1]!, parts[2]!];
}
function localCalendarDate(formatter: Intl.DateTimeFormat, micros: bigint): CalendarDate {
	const parts = formatter.formatToParts(new Date(Number(floorDivision(micros, 1000n))));
	const year = Number(parts.find((part) => part.type === "year")!.value);
	const era = parts.find((part) => part.type === "era")!.value;
	// Intl uses year-of-era. Gregorian 1 BC is astronomical year 0.
	return [era === "BC" ? 1 - year : year, Number(parts.find((part) => part.type === "month")!.value), Number(parts.find((part) => part.type === "day")!.value)];
}

/** Intl's installed IANA timezone data determines supported calendar zones. No host local zone is used. */
function normalizeQuery(input: unknown, context: QueryContext): QueryValidation {
	const errors: QueryError[] = [];
	const fail = (code: string, path: string) => { errors.push({ code, path }); };
	if (!record(input)) return { ok: false, errors: [{ code: "invalid_query", path: "$" }] };
	if (!record(context) || Object.getOwnPropertyNames(context).some((key) => !["participantIds", "conversationIds", "queryVersion", "occurrenceVersion"].includes(key))
		|| !dataArray(context.participantIds) || !dataArray(context.conversationIds)
		|| !context.participantIds.every((id) => validString(id) && id.length > 0) || !context.conversationIds.every((id) => validString(id) && id.length > 0)) {
		return { ok: false, errors: [{ code: "invalid_context", path: "$" }] };
	}
	const known = ["queryVersion", "matchingVersion", "timezone", "years", "participantIds", "conversationIds", "kinds", "sections", "linkStates", "reviews", "text", "range", "unavailable", "year", "participantId", "conversationId", "kind", "review", "linkState"];
	if (Object.getOwnPropertyNames(input).some((key) => !known.includes(key))) fail("unknown_field", "$");
	if (context.queryVersion !== 1 || context.occurrenceVersion !== 1 || (input.queryVersion !== undefined && input.queryVersion !== 1)) fail("unsupported_version", "queryVersion");
	if (input.matchingVersion !== undefined && input.matchingVersion !== "literal-nfc-lower-v1") fail("unsupported_version", "matchingVersion");
	const set = <T extends string | number>(name: string, allowed: (value: unknown) => value is T, fallback: readonly T[] = []): T[] => {
		const raw = input[name];
		if (raw === undefined) return [...fallback];
		if (!dataArray(raw) || raw.length > 64 || !raw.every(allowed)) { fail(name === "sections" && dataArray(raw) && raw.includes("unsupported") ? "unsupported_section" : "invalid_filter", name); return []; }
		return [...new Set(raw)].sort((a, b) => typeof a === "number" && typeof b === "number" ? a - b : compareId(String(a), String(b)));
	};
	const yearOk = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 9999;
	const idOk = (value: unknown, ids: readonly string[]): value is string => validString(value) && ids.includes(value);
	const enumOk = <T extends string>(values: readonly T[]) => (value: unknown): value is T => typeof value === "string" && values.includes(value as T);
	const years = set("years", yearOk), participantIds = set("participantIds", (v): v is string => idOk(v, context.participantIds)), conversationIds = set("conversationIds", (v): v is string => idOk(v, context.conversationIds));
	const selectedKinds = set("kinds", enumOk(kinds)), sections = set("sections", enumOk(origins)), linkStates = set("linkStates", enumOk(links));
	let selectedReviews = set("reviews", enumOk(reviews), activeReviews);
	if (input.reviews !== undefined && selectedReviews.length === 0) selectedReviews = [...reviews];
	const legacy = <T extends string | number>(scalar: string, plural: string, neutral: unknown, selected: T[], allowed: (value: unknown) => value is T) => {
		const value = input[scalar];
		if (value === undefined || value === neutral) return;
		if (!allowed(value)) { fail("invalid_filter", scalar); return; }
		if (input[plural] !== undefined && (selected.length !== 1 || selected[0] !== value)) fail("conflicting_filters", plural);
		else { selected.splice(0, selected.length, value); }
	};
	legacy("year", "years", null, years, yearOk);
	legacy("participantId", "participantIds", null, participantIds, (v): v is string => idOk(v, context.participantIds));
	legacy("conversationId", "conversationIds", null, conversationIds, (v): v is string => idOk(v, context.conversationIds));
	legacy("kind", "kinds", "all", selectedKinds, enumOk(kinds));
	legacy("linkState", "linkStates", "all", linkStates, enumOk(links));
	if (input.review !== undefined) {
		const status = input.review;
		const mapped = status === "all" ? [...reviews] : status === "active" ? [...activeReviews] : enumOk(reviews)(status) ? [status] : null;
		if (!mapped) fail("invalid_filter", "review");
		else if (input.reviews !== undefined && JSON.stringify(mapped) !== JSON.stringify(selectedReviews)) fail("conflicting_filters", "reviews");
		else selectedReviews = mapped;
	}
	let timezone = "UTC";
	try { if (input.timezone !== undefined) { if (!validString(input.timezone) || /^[+-]/.test(input.timezone)) throw new Error(); timezone = new Intl.DateTimeFormat("en", { timeZone: input.timezone }).resolvedOptions().timeZone; } }
	catch { fail("invalid_timezone", "timezone"); }
	let text = "";
	if (input.text !== undefined) { if (!validString(input.text, 1000)) fail("invalid_text", "text"); else text = literal(input.text.trim()); }
	const unavailable = input.unavailable === undefined ? "auto" : input.unavailable;
	if (typeof unavailable !== "string" || !["auto", "include", "exclude", "only"].includes(unavailable)) fail("invalid_filter", "unavailable");
	let range: QueryRange | null = null;
	if (input.range !== undefined && input.range !== null) {
		const raw = input.range;
		if (!record(raw) || Object.getOwnPropertyNames(raw).some((key) => !["mode", "start", "end"].includes(key)) || typeof raw.mode !== "string" || !["calendarDays", "instants"].includes(raw.mode) || !("start" in raw) || !("end" in raw)) fail("invalid_range", "range");
		else {
			const mode = raw.mode as QueryRange["mode"], start = raw.start, end = raw.end;
			const a = start === null ? null : mode === "instants" ? instantBound(start) : civilDate(start);
			const b = end === null ? null : mode === "instants" ? instantBound(end) : civilDate(end);
			if ((start !== null && a === null) || (end !== null && b === null) || (a !== null && b !== null && a >= b)) fail("invalid_range", "range");
			else if (start !== null || end !== null) range = { mode, start: start === null ? null : mode === "instants" ? instantLabel(a as bigint) : start as string, end: end === null ? null : mode === "instants" ? instantLabel(b as bigint) : end as string };
		}
	}
	if (unavailable === "only" && (years.length || range)) fail("conflicting_temporal_filters", "unavailable");
	if (errors.length) return { ok: false, errors };
	const query: CanonicalArchiveQuery = { queryVersion: 1, matchingVersion: "literal-nfc-lower-v1", timezone, years, participantIds, conversationIds, kinds: selectedKinds, sections, linkStates, reviews: selectedReviews, text, range, unavailable: unavailable as CanonicalArchiveQuery["unavailable"] };
	return { ok: true, query };
}

export function normalizeArchiveQuery(input: unknown, context: QueryContext): QueryValidation {
	try { return normalizeQuery(input, context); }
	catch { return { ok: false, errors: [{ code: "invalid_query", path: "$" }] }; }
}

function compareTime(a: QueryTime, b: QueryTime): number {
	if (a.kind === "instant" && b.kind === "instant") { const av = BigInt(a.epochMicroseconds), bv = BigInt(b.epochMicroseconds); return av < bv ? -1 : av > bv ? 1 : 0; }
	if (a.kind === "instant") return -1;
	if (b.kind === "instant") return 1;
	if (a.kind === "date-only" && b.kind === "date-only") return compareId(a.recordedDate, b.recordedDate);
	if (a.kind === "date-only") return -1;
	if (b.kind === "date-only") return 1;
	return 0;
}
const orderTimed = <T extends { readonly id: string; readonly time: QueryTime }>(items: readonly T[]) => [...items].sort((a, b) => compareTime(a.time, b.time) || compareId(a.id, b.id));
const orderedSourceIds = (sourceIds: readonly string[]) => [...sourceIds].sort(compareId);
function canonicalOccurrence(occurrence: QueryOccurrence): QueryOccurrence {
	const original = occurrence.association;
	let association: QueryOccurrence["association"];
	if (original.state === "confirmed") {
		association = { ...original, proof: { ...original.proof, sourceIds: orderedSourceIds(original.proof.sourceIds) } };
	} else if (original.state === "unlinked") {
		association = { ...original, proofSourceIds: orderedSourceIds(original.proofSourceIds) };
	} else {
		const candidates = [...original.candidates].sort((a, b) => compareId(a.mediaId, b.mediaId));
		association = {
			...original,
			referenceSourceIds: orderedSourceIds(original.referenceSourceIds),
			candidates: candidates.map((candidate) => ({ ...candidate, proofSourceIds: orderedSourceIds(candidate.proofSourceIds) })),
		};
	}
	return {
		...occurrence,
		sourceIds: orderedSourceIds(occurrence.sourceIds),
		identity: { ...occurrence.identity, copySourceIds: orderedSourceIds(occurrence.identity.copySourceIds) },
		association,
	};
}
function orderedDiagnostics(diagnostics: readonly QueryDiagnostic[]): QueryDiagnostic[] {
	return [...diagnostics].sort((a, b) => compareId(a.id, b.id)).map((diagnostic) => ({ ...diagnostic, sourceIds: orderedSourceIds(diagnostic.sourceIds) }));
}
function compareLayerPresentation(a: CollectionSelection["compositions"][number], b: CollectionSelection["compositions"][number]): number {
	const baseOrder = compareId(a.baseMediaId, b.baseMediaId);
	if (baseOrder) return baseOrder;
	if (a.order === null && b.order !== null) return 1;
	if (a.order !== null && b.order === null) return -1;
	if (a.order !== null && b.order !== null && a.order !== b.order) return a.order - b.order;
	return compareId(a.layerMediaId, b.layerMediaId);
}
const associatedId = (o: QueryOccurrence) => o.association.state === "confirmed" ? o.association.mediaId : o.association.state === "unlinked" ? o.association.missingMediaId : null;
const targetKey = (kind: QueryTarget["kind"], id: string) => `${kind}:${id}`;
const itemReview = (decisions: ReadonlyMap<string, QueryReview>, kind: QueryTarget["kind"], id: string): QueryReview => decisions.get(targetKey(kind, id)) ?? "unreviewed";
function occurrenceReview(decisions: ReadonlyMap<string, QueryReview>, occurrence: QueryOccurrence): QueryReview {
	const own = decisions.get(targetKey("occurrence", occurrence.id));
	if (own) return own;
	if (occurrence.owningEventId !== null) return itemReview(decisions, "event", occurrence.owningEventId);
	const mediaId = associatedId(occurrence);
	return mediaId ? itemReview(decisions, "media", mediaId) : "unreviewed";
}
function occurrenceSources(occurrence: QueryOccurrence): Set<string> {
	const association = occurrence.association;
	return new Set([...occurrence.sourceIds, ...(association.state === "confirmed" ? association.proof.sourceIds : association.state === "unlinked" ? association.proofSourceIds : [...association.referenceSourceIds, ...association.candidates.flatMap((c) => c.proofSourceIds)])]);
}
function sourceScopes(evidence: QueryEvidence): Map<string, ReadonlySet<string>> {
	const scopes = new Map<string, ReadonlySet<string>>();
	for (const event of evidence.events) scopes.set(targetKey("event", event.id), new Set(event.sourceIds));
	for (const media of evidence.media) scopes.set(targetKey("media", media.id), new Set(media.sourceIds));
	for (const occurrence of evidence.occurrences) scopes.set(targetKey("occurrence", occurrence.id), occurrenceSources(occurrence));
	return scopes;
}
const kindCounts = () => Object.fromEntries(kinds.map((kind) => [kind, 0])) as Record<MediaKind, number>;
const originCounts = () => Object.fromEntries(origins.map((origin) => [origin, 0])) as Record<QueryOrigin, number>;

function projection(evidence: QueryEvidence, selectedEvents: readonly QueryEvent[], selectedOccurrences: readonly QueryOccurrence[], inventory: readonly QueryMediaRecord[], decisions: ReadonlyMap<string, QueryReview>): CollectionSelection {
	const events = orderTimed(selectedEvents).map((event) => ({ ...event, sourceIds: orderedSourceIds(event.sourceIds) }));
	const occurrences = orderTimed(selectedOccurrences).map(canonicalOccurrence);
	const byMedia = new Map(evidence.media.map((media) => [media.id, media]));
	const ordinaryIds = new Set(inventory.map((media) => media.id));
	const scopedMediaSources = new Map<string, Set<string>>();
	for (const occurrence of occurrences) {
		const id = associatedId(occurrence);
		if (id) { ordinaryIds.add(id); const sourceIds = scopedMediaSources.get(id) ?? new Set<string>(); for (const sourceId of occurrenceSources(occurrence)) sourceIds.add(sourceId); scopedMediaSources.set(id, sourceIds); }
	}
	const earliest = new Map<string, QueryTime>();
	for (const occurrence of occurrences) {
		const id = associatedId(occurrence);
		if (id && occurrence.time.kind === "instant" && (!earliest.has(id) || compareTime(occurrence.time, earliest.get(id)!) < 0)) earliest.set(id, occurrence.time);
	}
	const mediaRecordIds = [...ordinaryIds].sort((a, b) => {
		const at = earliest.get(a), bt = earliest.get(b);
		return at && bt ? compareTime(at, bt) || compareId(a, b) : at ? -1 : bt ? 1 : compareId(a, b);
	});
	const compositions = evidence.supportingLayers.filter((edge) => ordinaryIds.has(edge.baseMediaId)).map((edge) => {
		const allowed = new Set([...byMedia.get(edge.baseMediaId)!.sourceIds, ...byMedia.get(edge.layerMediaId)!.sourceIds, ...(scopedMediaSources.get(edge.baseMediaId) ?? [])]);
		return { ...edge, sourceIds: orderedSourceIds(edge.sourceIds.filter((id) => allowed.has(id))) };
	}).filter((edge) => edge.sourceIds.length > 0).sort(compareLayerPresentation);
	const supportingLayerIds = [...new Set(compositions.map((edge) => edge.layerMediaId))].sort(compareId);
	const resourceIds = new Set([...mediaRecordIds, ...supportingLayerIds]);
	const resources = [...resourceIds].map((id) => byMedia.get(id)!).filter(Boolean).map((media): QueryMediaRecord => {
		const selectedSourceIds = scopedMediaSources.get(media.id) ?? new Set<string>();
		return { id: media.id, filename: media.filename, kind: media.kind, role: media.role, available: media.available, entry: media.entry,
			sourceIds: orderedSourceIds(media.entry ? media.sourceIds : media.sourceIds.filter((id) => selectedSourceIds.has(id))), ...(media.layerState ? { layerState: media.layerState } : {}) };
	});
	const candidates = occurrences.flatMap((o) => o.association.state === "ambiguous" || o.association.state === "inferred" ? [{ occurrenceId: o.id, state: o.association.state, candidateMediaIds: o.association.candidates.map((candidate) => candidate.mediaId).sort(compareId) }] : []);
	const eventIds = events.map((event) => event.id);
	const selectedEventIds = new Set(eventIds);
	const inlineAssociations = occurrences.flatMap((o) => o.owningEventId && selectedEventIds.has(o.owningEventId) && o.association.state === "confirmed" ? [{ eventId: o.owningEventId, occurrenceId: o.id, mediaId: o.association.mediaId, proof: o.association.proof }] : []);
	const byOrigin = { events: originCounts(), occurrences: originCounts(), inventory: originCounts() };
	const byKind = { events: kindCounts(), occurrences: kindCounts(), originals: kindCounts(), standaloneLayers: kindCounts(), supportingLayers: kindCounts() };
	for (const event of events) { byOrigin.events[event.origin]++; byKind.events[event.kind]++; }
	for (const occurrence of occurrences) { const media = byMedia.get(associatedId(occurrence) ?? ""); byOrigin.occurrences[occurrence.origin]++; byKind.occurrences[occurrence.association.state === "confirmed" ? media!.kind : occurrence.declaredKind]++; }
	byOrigin.inventory.inventory = inventory.length;
	const ordinary = mediaRecordIds.map((id) => byMedia.get(id)!);
	for (const media of ordinary) { if (media.available && media.role === "original") byKind.originals[media.kind]++; else if (media.role === "layer") byKind.standaloneLayers[media.kind]++; }
	for (const id of supportingLayerIds) byKind.supportingLayers[byMedia.get(id)!.kind]++;
	const selectedTargets = new Set([...events.map((e) => `event:${e.id}`), ...occurrences.map((o) => `occurrence:${o.id}`), ...resources.map((m) => `media:${m.id}`)]);
	const scopedSources = sourceScopes({ ...evidence, events, occurrences, media: resources });
	return structuredClone({ eventIds, occurrenceIds: occurrences.map((o) => o.id), mediaRecordIds, inventoryIds: inventory.map((m) => m.id).sort(compareId), supportingLayerIds, events, occurrences, resources, candidates, inlineAssociations, compositions,
		diagnostics: orderedDiagnostics(evidence.diagnostics.filter((d) => d.owner && selectedTargets.has(`${d.owner.kind}:${d.owner.id}`)).map((d) => ({ ...d, sourceIds: d.sourceIds.filter((id) => scopedSources.get(targetKey(d.owner!.kind, d.owner!.id))!.has(id)) }))),
		counts: { events: events.length, historicalOccurrences: occurrences.length, originalPhysicalFiles: ordinary.filter((m) => m.available && m.role === "original").length, missingMediaRecords: ordinary.filter((m) => !m.entry).length,
			inventoryOriginals: inventory.filter((m) => m.role === "original").length, inventoryLayers: inventory.filter((m) => m.role === "layer").length, supportingLayers: supportingLayerIds.length,
			physicalResources: new Set(resources.filter((m) => m.entry).map((m) => JSON.stringify(m.entry))).size, candidateReferences: candidates.length, candidateFiles: new Set(candidates.flatMap((c) => c.candidateMediaIds)).size,
			later: { events: events.filter((e) => itemReview(decisions, "event", e.id) === "later").length, occurrences: occurrences.filter((o) => occurrenceReview(decisions, o) === "later").length, media: ordinary.filter((m) => itemReview(decisions, "media", m.id) === "later").length }, byOrigin, byKind },
	});
}

function validateEvidence(input: CollectionInput): QueryError[] {
	const errors: QueryError[] = [], fail = (path: string, code = "invalid_evidence") => { errors.push({ code, path }); };
	const shape = (value: unknown, keys: readonly string[], path: string): value is Record<string, unknown> => {
		if (!record(value) || Object.getOwnPropertyNames(value).some((key) => !keys.includes(key))) { fail(path); return false; } return true;
	};
	if (!shape(input, ["evidence", "query", "decisions", "denyTargets", "datasetRevision", "queryRevision", "reviewRevision"], "$")) return errors;
	const e = input.evidence;
	if (!shape(e, ["occurrenceVersion", "occurrencesComplete", "participantIds", "conversations", "sources", "events", "media", "occurrences", "supportingLayers", "diagnostics"], "evidence")) return errors;
	if (e.occurrenceVersion !== 1 || e.occurrencesComplete !== true) return [{ code: "incomplete_occurrences", path: "evidence" }];
	for (const field of ["participantIds", "conversations", "sources", "events", "media", "occurrences", "supportingLayers", "diagnostics"] as const) if (!dataArray(e[field])) fail(`evidence.${field}`);
	if (!dataArray(input.decisions) || !dataArray(input.denyTargets)) fail("decisions");
	for (const field of ["datasetRevision", "queryRevision", "reviewRevision"] as const) if (!validString(input[field]) || !input[field]) fail(field);
	if (errors.length) return errors;
	const index = <T extends { readonly id: string }>(items: readonly T[], path: string): Map<string, T> => {
		const result = new Map<string, T>();
		items.forEach((item, i) => { if (!record(item) || !validString(item.id) || !item.id || result.has(item.id)) fail(`${path}[${i}]`); else result.set(item.id, item); }); return result;
	};
	const sources = index(e.sources, "evidence.sources"), events = index(e.events, "evidence.events"), media = index(e.media, "evidence.media"), occurrences = index(e.occurrences, "evidence.occurrences"), conversations = index(e.conversations, "evidence.conversations");
	index(e.diagnostics, "evidence.diagnostics");
	const participants = new Set(e.participantIds);
	if (participants.size !== e.participantIds.length || e.participantIds.some((id) => !validString(id) || !id)) fail("evidence.participantIds");
	const integer = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
	const sha = (v: unknown) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
	const refs = (value: unknown, path: string, allowed?: ReadonlySet<string>, requireEvidence = false): boolean => {
		const valid = dataArray(value) && (!requireEvidence || value.length > 0) && new Set(value).size === value.length && value.every((id) => validString(id) && sources.has(id) && (!allowed || allowed.has(id)));
		if (!valid) fail(path); return valid;
	};
	const clock = (time: QueryTime, path: string, scope: ReadonlySet<string>) => {
		if (!record(time)) { fail(path); return; }
		if (!scope.has(time.sourceTimeId) || !sources.has(time.sourceTimeId)) fail(path);
		if (time.kind === "instant") {
			if (!shape(time, ["kind", "epochMicroseconds", "precision", "sourceTimeId"], path) || !validString(time.epochMicroseconds, 32) || !/^(?:0|-?[1-9]\d*)$/.test(time.epochMicroseconds) || !["second", "millisecond", "microsecond"].includes(time.precision)) { fail(path); return; }
			const us = BigInt(time.epochMicroseconds);
			if (us < minMicros || us >= maxMicros || (time.precision === "second" && us % 1000000n !== 0n) || (time.precision === "millisecond" && us % 1000n !== 0n)) fail(path);
		} else if (time.kind === "date-only") { if (!shape(time, ["kind", "recordedDate", "sourceTimeId"], path) || !civilDate(time.recordedDate)) fail(path); }
		else if (time.kind !== "unavailable" || !shape(time, ["kind", "reason", "sourceTimeId"], path) || !["absent", "invalid", "un-zoned"].includes(time.reason)) fail(path);
	};
	e.sources.forEach((s, i) => { const path = `evidence.sources[${i}]`; if (!shape(s, ["id", "sourceId", "path", "recordPointer", "entryOrdinal", "documentSha256"], path) || !validString(s.sourceId) || !s.sourceId || !validString(s.path, 4096) || !s.path || !validString(s.recordPointer, 4096) || !integer(s.entryOrdinal) || (s.documentSha256 !== null && !sha(s.documentSha256))) fail(path); });
	e.conversations.forEach((c, i) => {
		const path = `evidence.conversations[${i}]`;
		if (!shape(c, ["id", "provenMemberIds", "membershipSourceIds"], path) || !dataArray(c.provenMemberIds) || new Set(c.provenMemberIds).size !== c.provenMemberIds.length || c.provenMemberIds.some((id) => !participants.has(id))) { fail(path); return; }
		refs(c.membershipSourceIds, path, undefined, c.provenMemberIds.length > 0);
	});
	const physicalEntries = new Set<string>();
	e.media.forEach((m, i) => {
		const path = `evidence.media[${i}]`;
		if (!shape(m, ["id", "filename", "kind", "role", "available", "entry", "sourceIds", "layerState"], path) || !validString(m.filename, 4096) || !kinds.includes(m.kind) || !["original", "layer"].includes(m.role) || typeof m.available !== "boolean") { fail(path); return; }
		if (!refs(m.sourceIds, path, undefined, true)) return;
		if (m.available) {
			if (!shape(m.entry, ["sourceId", "path", "ordinal"], path) || !validString(m.entry.sourceId) || !validString(m.entry.path, 4096) || !integer(m.entry.ordinal)) { fail(path); return; }
			const entry = m.entry, key = JSON.stringify([entry.sourceId, entry.path, entry.ordinal]);
			if (physicalEntries.has(key)) fail(path); physicalEntries.add(key);
			if (!m.sourceIds.every((id) => { const s = sources.get(id); return s?.sourceId === entry.sourceId && s.path === entry.path && s.entryOrdinal === entry.ordinal && s.documentSha256 === null; })) fail(path);
		} else if (m.entry !== null || m.role !== "original") fail(path);
		if (m.role === "layer" && !["resolved", "orphan", "unresolved"].includes(m.layerState ?? "")) fail(path);
		if (m.role === "original" && m.layerState !== undefined) fail(path);
	});
	e.events.forEach((event, i) => {
		const path = `evidence.events[${i}]`;
		if (!shape(event, ["id", "origin", "authorId", "conversationId", "kind", "text", "time", "sourceIds"], path) || !["chats", "snaps"].includes(event.origin) || !conversations.has(event.conversationId) || (event.authorId !== null && !participants.has(event.authorId)) || !kinds.includes(event.kind) || (event.text !== null && !validString(event.text, Number.MAX_SAFE_INTEGER))) { fail(path); return; }
		if (refs(event.sourceIds, path, undefined, true)) clock(event.time, `${path}.time`, new Set(event.sourceIds));
	});
	const identityKeys = new Set<string>();
	const timeFacts = (time: QueryTime) => time.kind === "instant" ? [time.kind, time.epochMicroseconds, time.precision] : time.kind === "date-only" ? [time.kind, time.recordedDate] : [time.kind, time.reason];
	e.occurrences.forEach((o, i) => {
		const path = `evidence.occurrences[${i}]`;
		if (!shape(o, ["id", "origin", "owningEventId", "time", "declaredKind", "caption", "location", "sourceIds", "association", "identity"], path) || !["chats", "snaps", "memories"].includes(o.origin) || !kinds.includes(o.declaredKind) || (o.caption !== null && !validString(o.caption, Number.MAX_SAFE_INTEGER)) || (o.location !== null && !validString(o.location, Number.MAX_SAFE_INTEGER))) { fail(path); return; }
		const owner = o.owningEventId === null ? null : events.get(o.owningEventId);
		if (o.origin === "memories" ? o.owningEventId !== null : !owner || owner.origin !== o.origin) fail(path);
		if (owner && record(owner.time) && record(o.time) && JSON.stringify(timeFacts(owner.time)) !== JSON.stringify(timeFacts(o.time))) fail(`${path}.time`);
		if (!refs(o.sourceIds, path, undefined, true)) return;
		clock(o.time, `${path}.time`, new Set(o.sourceIds));
		if (o.sourceIds.some((id) => sources.get(id)?.documentSha256 === null)) fail(path);
		const identity = o.identity;
		if (!shape(identity, ["identityVersion", "documentSha256", "documentPath", "rowPointer", "repeatRank", "referenceOrdinal", "copySourceIds"], `${path}.identity`) || identity.identityVersion !== 1 || !sha(identity.documentSha256) || !validString(identity.documentPath, 4096) || !identity.documentPath || !validString(identity.rowPointer, 4096) || !integer(identity.repeatRank) || !integer(identity.referenceOrdinal)) { fail(`${path}.identity`); return; }
		if (!refs(identity.copySourceIds, `${path}.identity`, new Set(o.sourceIds), true)) return;
		if (o.sourceIds.length !== identity.copySourceIds.length) fail(`${path}.identity`);
		for (const id of identity.copySourceIds) { const s = sources.get(id); if (!s || s.documentSha256 !== identity.documentSha256 || s.path !== identity.documentPath || s.recordPointer !== identity.rowPointer) fail(`${path}.identity`); }
		const identityKey = JSON.stringify([o.origin, identity.documentSha256, identity.documentPath, identity.rowPointer, identity.repeatRank, identity.referenceOrdinal]);
		if (identityKeys.has(identityKey)) fail(`${path}.identity`); identityKeys.add(identityKey);
		const a = o.association;
		if (!record(a)) { fail(`${path}.association`); return; }
		if (a.state === "confirmed") {
			const m = media.get(a.mediaId), proof = a.proof;
			if (!shape(a, ["state", "mediaId", "proof"], `${path}.association`) || !m?.available || m.role !== "original" || !record(proof) || !["export-exact", "owner-confirmed"].includes(proof.kind)) { fail(`${path}.association`); return; }
			if (!shape(proof, proof.kind === "export-exact" ? ["kind", "sourceIds"] : ["kind", "sourceIds", "decisionId", "evidenceRevision"], `${path}.association.proof`)) return;
			if (!refs(proof.sourceIds, `${path}.association.proof`, new Set([...o.sourceIds, ...m.sourceIds]), true)) return;
			if (proof.kind === "export-exact" && !proof.sourceIds.some((id) => o.sourceIds.includes(id))) fail(`${path}.association.proof`);
			if (proof.kind === "owner-confirmed" && (!validString(proof.decisionId) || !proof.decisionId || !validString(proof.evidenceRevision) || !proof.evidenceRevision)) fail(`${path}.association.proof`);
		} else if (a.state === "unlinked") {
			if (!shape(a, ["state", "missingMediaId", "proofSourceIds"], `${path}.association`)) return;
			const m = a.missingMediaId === null ? null : media.get(a.missingMediaId);
			if (a.missingMediaId !== null && (!m || m.available || m.entry !== null || m.role !== "original")) fail(`${path}.association`);
			refs(a.proofSourceIds, `${path}.association`, new Set(o.sourceIds), true);
		} else if (a.state === "ambiguous" || a.state === "inferred") {
			if (!shape(a, ["state", "referenceSourceIds", "candidates"], `${path}.association`) || !dataArray(a.candidates)) { fail(`${path}.association`); return; }
			refs(a.referenceSourceIds, `${path}.association`, new Set(o.sourceIds), true);
			const seen = new Set<string>();
			Array.from(a.candidates).forEach((candidate, n) => { const cp = `${path}.association.candidates[${n}]`; if (!shape(candidate, ["mediaId", "proofSourceIds"], cp) || !validString(candidate.mediaId)) { fail(cp); return; } const m = media.get(candidate.mediaId); if (!m?.available || m.role !== "original" || seen.has(candidate.mediaId)) { fail(cp); return; } seen.add(candidate.mediaId); refs(candidate.proofSourceIds, cp, new Set([...o.sourceIds, ...m.sourceIds]), true); });
		} else fail(`${path}.association`);
	});
	const edgeKeys = new Set<string>(), layerIds = new Set<string>();
	e.supportingLayers.forEach((edge, i) => {
		const path = `evidence.supportingLayers[${i}]`;
		if (!shape(edge, ["baseMediaId", "layerMediaId", "sourceIds", "order"], path)) return;
		const base = media.get(edge.baseMediaId), layer = media.get(edge.layerMediaId), key = JSON.stringify([edge.baseMediaId, edge.layerMediaId]);
		if (!base?.available || base.role !== "original" || !layer?.available || layer.role !== "layer" || layer.layerState !== "resolved" || edgeKeys.has(key) || (edge.order !== null && !integer(edge.order))) fail(path);
		edgeKeys.add(key); layerIds.add(edge.layerMediaId); refs(edge.sourceIds, path, undefined, true);
	});
	for (const m of e.media) if (m.role === "layer" && m.layerState === "resolved" && !layerIds.has(m.id)) fail("evidence.supportingLayers");
	const targetValid = (target: QueryTarget, path: string) => {
		if (!shape(target, ["kind", "id"], path) || !(target.kind === "event" ? events.has(target.id) : target.kind === "occurrence" ? occurrences.has(target.id) : target.kind === "media" ? media.has(target.id) : false)) { fail(path); return false; } return true;
	};
	e.diagnostics.forEach((d, i) => { const path = `evidence.diagnostics[${i}]`; if (!shape(d, ["id", "code", "sourceIds", "owner"], path) || !validString(d.code) || !d.code) { fail(path); return; } refs(d.sourceIds, path); if (d.owner !== null) targetValid(d.owner, path); });
	const decisionKeys = new Set<string>();
	input.decisions.forEach((d, i) => { const path = `decisions[${i}]`; if (!shape(d, ["target", "status"], path) || !["keep", "exclude", "later"].includes(d.status) || !targetValid(d.target, path)) { fail(path); return; } const key = targetKey(d.target.kind, d.target.id); if (decisionKeys.has(key)) fail(path); decisionKeys.add(key); });
	input.denyTargets.forEach((target, i) => targetValid(target, `denyTargets[${i}]`));
	return errors;
}

function selectCollection(input: CollectionInput): CollectionValidation {
	const errors = validateEvidence(input);
	if (errors.length) return { ok: false, errors };
	const context: QueryContext = { participantIds: input.evidence.participantIds, conversationIds: input.evidence.conversations.map((c) => c.id), queryVersion: 1, occurrenceVersion: 1 };
	const canonical = normalizeArchiveQuery(input.query, context);
	if (!canonical.ok) return { ok: false, errors: canonical.errors.map((error) => ({ code: error.code, path: error.path === "$" ? "query" : `query.${error.path}` })) };
	if (Object.keys(canonical.query).some((key) => !(key in input.query) || JSON.stringify(input.query[key as keyof CanonicalArchiveQuery]) !== JSON.stringify(canonical.query[key as keyof CanonicalArchiveQuery]))) return { ok: false, errors: [{ code: "noncanonical_query", path: "query" }] };
	const evidence = input.evidence;
	const query = input.query;
	const formatter = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", { timeZone: query.timezone, era: "short", year: "numeric", month: "2-digit", day: "2-digit" });
	const boundStart = query.range?.mode === "instants" && query.range.start ? instantBound(query.range.start) : null;
	const boundEnd = query.range?.mode === "instants" && query.range.end ? instantBound(query.range.end) : null;
	const calendarStart = query.range?.mode === "calendarDays" ? calendarBound(query.range.start) : null;
	const calendarEnd = query.range?.mode === "calendarDays" ? calendarBound(query.range.end) : null;
	const temporalMatches = (time: QueryTime) => {
		if (time.kind !== "instant") return query.unavailable === "include" || query.unavailable === "only" || (query.unavailable === "auto" && !query.years.length && !query.range);
		if (query.unavailable === "only") return false;
		const micros = BigInt(time.epochMicroseconds);
		const localDate = localCalendarDate(formatter, micros);
		if (query.years.length && !query.years.includes(localDate[0])) return false;
		if (query.range?.mode === "calendarDays") return (calendarStart === null || compareCalendarDate(localDate, calendarStart) >= 0) && (calendarEnd === null || compareCalendarDate(localDate, calendarEnd) < 0);
		return (boundStart === null || micros >= boundStart) && (boundEnd === null || micros < boundEnd);
	};
	const decisions = new Map(input.decisions.map((decision) => [targetKey(decision.target.kind, decision.target.id), decision.status]));
	const deny = new Set(input.denyTargets.map((target) => targetKey(target.kind, target.id)));
	const blocked = (kind: QueryTarget["kind"], id: string) => deny.has(targetKey(kind, id)) || itemReview(decisions, kind, id) === "exclude";
	const eventMap = new Map(evidence.events.map((event) => [event.id, event]));
	const mediaMap = new Map(evidence.media.map((media) => [media.id, media]));
	const provenMembers = new Map(evidence.conversations.map((conversation) => [conversation.id, new Set(conversation.provenMemberIds)]));
	const eventReferences = new Map<string, QueryOccurrence[]>();
	for (const occurrence of evidence.occurrences) if (occurrence.owningEventId) { const refs = eventReferences.get(occurrence.owningEventId) ?? []; refs.push(occurrence); eventReferences.set(occurrence.owningEventId, refs); }
	const sectionMatches = (origin: QueryOrigin) => !query.sections.length || query.sections.includes(origin);
	const textMatches = (values: readonly (string | null)[]) => !query.text || values.some((value) => value !== null && literal(value).includes(query.text));
	const kindMatches = (kind: MediaKind) => !query.kinds.length || query.kinds.includes(kind);
	const linkMatches = (states: readonly LinkState[]) => !query.linkStates.length || states.some((state) => query.linkStates.includes(state));
	const contextMatches = (event: QueryEvent | null) => {
		if (query.conversationIds.length && (!event || !query.conversationIds.includes(event.conversationId))) return false;
		if (!query.participantIds.length) return true;
		return event !== null && query.participantIds.some((id) => id === event.authorId || provenMembers.get(event.conversationId)!.has(id));
	};
	const selectedEvents = evidence.events.filter((event) => {
		const refs = eventReferences.get(event.id) ?? [];
		return temporalMatches(event.time) && sectionMatches(event.origin) && textMatches([event.text]) && contextMatches(event) && kindMatches(event.kind) && linkMatches(refs.length ? refs.map((ref) => ref.association.state) : ["unlinked"]) && query.reviews.includes(itemReview(decisions, "event", event.id));
	});
	const selectedOccurrences = evidence.occurrences.filter((occurrence) => {
		const event = occurrence.owningEventId ? eventMap.get(occurrence.owningEventId)! : null;
		const media = mediaMap.get(associatedId(occurrence) ?? "");
		return temporalMatches(occurrence.time) && sectionMatches(occurrence.origin) && textMatches([event?.text ?? null, occurrence.caption, occurrence.location]) && contextMatches(event) && kindMatches(occurrence.association.state === "confirmed" ? media!.kind : occurrence.declaredKind) && linkMatches([occurrence.association.state]) && query.reviews.includes(occurrenceReview(decisions, occurrence));
	});
	const referenced = new Set(evidence.occurrences.map(associatedId).filter((id) => id !== null));
	const resolvedLayers = new Set(evidence.supportingLayers.map((edge) => edge.layerMediaId));
	const inventory = evidence.media.filter((media) => media.available && (media.role === "original" ? !referenced.has(media.id) : !resolvedLayers.has(media.id)) && temporalMatches({ kind: "unavailable", reason: "absent", sourceTimeId: media.sourceIds[0]! }) && sectionMatches("inventory") && textMatches([media.filename]) && contextMatches(null) && kindMatches(media.kind) && linkMatches(["unlinked"]) && query.reviews.includes(itemReview(decisions, "media", media.id)));
	const matched = projection(evidence, selectedEvents, selectedOccurrences, inventory, decisions);
	const effectiveEvents = selectedEvents.filter((event) => !blocked("event", event.id));
	const effectiveOccurrences = selectedOccurrences.filter((occurrence) => !blocked("occurrence", occurrence.id) && (!occurrence.owningEventId || !blocked("event", occurrence.owningEventId)) && (!associatedId(occurrence) || !blocked("media", associatedId(occurrence)!))).map((occurrence): QueryOccurrence => {
		const association = occurrence.association;
		return association.state === "ambiguous" || association.state === "inferred" ? { ...occurrence, association: { ...association, candidates: association.candidates.filter((candidate) => !blocked("media", candidate.mediaId)) } } : occurrence;
	});
	const effectiveEvidence = { ...evidence, supportingLayers: evidence.supportingLayers.filter((edge) => !blocked("media", edge.baseMediaId) && !blocked("media", edge.layerMediaId)) };
	const originalScopes = sourceScopes(evidence);
	const exclusions: ArchiveCollection["exclusions"][number][] = input.decisions.filter((d) => d.status === "exclude").map((d) => ({ target: d.target, code: "explicit_exclude" }));
	for (const target of input.denyTargets) exclusions.push({ target, code: "effective_deny" });
	exclusions.sort((a, b) => compareId(targetKey(a.target.kind, a.target.id), targetKey(b.target.kind, b.target.id)) || compareId(a.code, b.code));
	const collection: ArchiveCollection = { query: structuredClone(input.query), occurrenceVersion: 1, datasetRevision: input.datasetRevision, queryRevision: input.queryRevision, reviewRevision: input.reviewRevision,
		matched, effective: projection(effectiveEvidence, effectiveEvents, effectiveOccurrences, inventory.filter((m) => !blocked("media", m.id)), decisions), reviewOnlyDiagnostics: structuredClone(orderedDiagnostics(evidence.diagnostics.filter((d) => !d.owner || d.sourceIds.some((id) => !originalScopes.get(targetKey(d.owner!.kind, d.owner!.id))!.has(id))))), exclusions: structuredClone(exclusions), };
	return { ok: true, collection };
}

export function selectArchiveCollection(input: CollectionInput): CollectionValidation {
	try { return selectCollection(input); }
	catch { return { ok: false, errors: [{ code: "invalid_evidence", path: "$" }] }; }
}
