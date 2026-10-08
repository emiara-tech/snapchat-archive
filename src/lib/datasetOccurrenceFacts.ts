import { isSafeArchivePath } from "./snapZip";
import type { ReferenceInterpretation, ReferenceParserRule } from "../types/dataset";

const errorMessages = {
	limits: "The occurrence preparation limits are invalid.",
	budget: "The archive exceeds the supported occurrence preparation limits. Select fewer ZIP parts and retry.",
	domain: "The archive contains an unsupported source locator for occurrence preparation.",
} as const;

export class OccurrencePreparationError extends Error {
	readonly code: keyof typeof errorMessages;
	constructor(code: keyof typeof errorMessages) { super(errorMessages[code]); this.name = "OccurrencePreparationError"; this.code = code; }
}

/** Existing worker protocol carries only one of these fixed messages, never an arbitrary error. */
export function knownOccurrenceError(message: unknown): OccurrencePreparationError | null {
	for (const code of ["limits", "budget", "domain"] as const) if (message === errorMessages[code]) return new OccurrencePreparationError(code);
	return null;
}

export const DEFAULT_OCCURRENCE_LIMITS = {
	maxDocumentBytes: 128 * 1024 * 1024, maxDocumentsEncodedBytes: 256 * 1024 * 1024,
	maxEventRows: 250_000, maxOccurrences: 250_000, maxResources: 250_000, maxSources: 500_000, maxDiagnostics: 250_000,
	maxReferencePositionsPerRow: 4096, maxReferencePositions: 500_000, maxCandidatesPerOccurrence: 64,
	maxAssociationTargets: 500_000, maxSourceIdsPerFact: 128, maxReferenceFieldBytes: 1024 * 1024,
	maxReferenceFieldsBytes: 64 * 1024 * 1024, maxTokenBytes: 4096, maxLocatorBytes: 4096,
	maxLiteralBytes: 16 * 1024, maxFactBytes: 256 * 1024, maxFactsBytes: 256 * 1024 * 1024,
};
export type OccurrencePreparationLimits = typeof DEFAULT_OCCURRENCE_LIMITS;

export function resolveOccurrenceLimits(overrides?: Partial<OccurrencePreparationLimits>): OccurrencePreparationLimits {
	const resolved = { ...DEFAULT_OCCURRENCE_LIMITS };
	if (overrides === undefined) return resolved;
	try {
		if (!overrides || typeof overrides !== "object" || Array.isArray(overrides) || ![Object.prototype, null].includes(Object.getPrototypeOf(overrides))) throw new OccurrencePreparationError("limits");
		for (const key of Reflect.ownKeys(overrides)) {
			if (typeof key !== "string" || !Object.hasOwn(resolved, key)) throw new OccurrencePreparationError("limits");
			const descriptor = Object.getOwnPropertyDescriptor(overrides, key);
			if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) throw new OccurrencePreparationError("limits");
			const field = key as keyof OccurrencePreparationLimits;
			if (!Number.isSafeInteger(descriptor.value) || descriptor.value < 1 || descriptor.value > resolved[field]) throw new OccurrencePreparationError("limits");
			resolved[field] = descriptor.value;
		}
	} catch {
		throw new OccurrencePreparationError("limits");
	}
	return resolved;
}

export function occurrenceUtf8Bytes(text: string, ceiling: number): number {
	let bytes = 0;
	for (let index = 0; index < text.length; index += 1) {
		const code = text.charCodeAt(index);
		if (code >= 0xd800 && code <= 0xdbff && text.charCodeAt(index + 1) >= 0xdc00 && text.charCodeAt(index + 1) <= 0xdfff) { bytes += 4; index += 1; }
		else bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : 3;
		if (bytes > ceiling) throw new OccurrencePreparationError("budget");
	}
	return bytes;
}

export function isOccurrenceScalarString(value: unknown, maxCodePoints = Number.MAX_SAFE_INTEGER): value is string {
	if (typeof value !== "string") return false;
	let count = 0;
	for (let index = 0; index < value.length; index += 1) {
		const code = value.charCodeAt(index);
		if (code >= 0xd800 && code <= 0xdbff) {
			const next = value.charCodeAt(++index);
			if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
		} else if (code >= 0xdc00 && code <= 0xdfff) return false;
		if (++count > maxCodePoints) return false;
	}
	return true;
}

/** Iterative JSON-equivalent accounting avoids a giant serialization or recursive raw-field walk. */
export function occurrenceEncodedBytes(value: unknown, ceiling: number): number {
	type Part = { value: unknown } | { bytes: number };
	function* parts(object: unknown): Generator<Part> {
		if (Array.isArray(object)) {
			for (let index = 0; index < object.length; index += 1) { if (index) yield { bytes: 1 }; yield { value: object[index] ?? null }; }
		} else if (typeof object === "object" && object !== null) {
			let first = true;
			for (const key in object) if (Object.hasOwn(object, key)) {
				const descriptor = Object.getOwnPropertyDescriptor(object, key)!;
				if (!("value" in descriptor)) throw new OccurrencePreparationError("domain");
				if (descriptor.value === undefined) continue;
				if (!first) yield { bytes: 1 }; first = false;
				yield { value: key }; yield { bytes: 1 }; yield { value: descriptor.value };
			}
		}
	}
	let bytes = 0;
	const add = (amount: number) => { bytes += amount; if (bytes > ceiling) throw new OccurrencePreparationError("budget"); };
	function* root(): Generator<Part> { yield { value }; }
	const frames: Generator<Part>[] = [root()];
	while (frames.length) {
		const step = frames[frames.length - 1]!.next();
		if (step.done) { frames.pop(); continue; }
		if ("bytes" in step.value) { add(step.value.bytes); continue; }
		const item = step.value.value;
		if (typeof item === "string") {
			add(2);
			for (let index = 0; index < item.length; index += 1) {
				const code = item.charCodeAt(index);
				if (code === 34 || code === 92) add(2);
				else if (code < 32) add([8, 9, 10, 12, 13].includes(code) ? 2 : 6);
				else if (code >= 0xd800 && code <= 0xdbff && item.charCodeAt(index + 1) >= 0xdc00 && item.charCodeAt(index + 1) <= 0xdfff) { add(4); index += 1; }
				else if (code >= 0xd800 && code <= 0xdfff) add(6);
				else add(code < 0x80 ? 1 : code < 0x800 ? 2 : 3);
			}
		} else if (item === null || item === undefined) add(4);
		else if (typeof item === "boolean") add(item ? 4 : 5);
		else if (typeof item === "number") add(Number.isFinite(item) ? String(item).length : 4);
		else if (typeof item === "object") { add(2); frames.push(parts(item)); }
		else throw new OccurrencePreparationError("domain");
	}
	return bytes;
}

/** One tokenizer for both retained source slots and legacy token/link projections. */
export function parseReferenceSlots(value: unknown, present: boolean, limits: OccurrencePreparationLimits, remainingPositions: number): {
	slots: { token: string; ordinal: number }[];
	malformedOrdinals: number[];
	interpretation: ReferenceInterpretation;
} {
	const slots: { token: string; ordinal: number }[] = [];
	const malformedOrdinals: number[] = [];
	let parserRule: ReferenceParserRule = "array-v1";
	let sourcePositions = 0;
	const positionCeiling = Math.min(limits.maxReferencePositionsPerRow, remainingPositions);
	if (!present) return { slots, malformedOrdinals, interpretation: { state: "absent", parserRule: null, sourcePositions: null, knownSupportedSlots: 0, unknownRemainder: true } };
	const append = (item: unknown, ordinal: number) => {
		if (ordinal >= positionCeiling) throw new OccurrencePreparationError("budget");
		const token = typeof item === "string" ? item.trim() : null;
		if (token) occurrenceUtf8Bytes(token, limits.maxTokenBytes);
		if (token && isOccurrenceScalarString(token) && isSafeArchivePath(token) && !/[?#&<>]/.test(token)) slots.push({ token, ordinal });
		else malformedOrdinals.push(ordinal);
	};
	if (Array.isArray(value)) {
		if (value.length > positionCeiling) throw new OccurrencePreparationError("budget");
		sourcePositions = value.length;
		value.forEach(append);
	} else if (typeof value === "string") {
		const trimmed = value.trim();
		if (trimmed.startsWith("[")) {
			let parsed: unknown;
			try { parsed = JSON.parse(trimmed); } catch { parsed = null; }
			if (!Array.isArray(parsed)) return { slots, malformedOrdinals, interpretation: { state: "unsupported", parserRule: null, sourcePositions: null, knownSupportedSlots: 0, unknownRemainder: true } };
			if (parsed.length > positionCeiling) throw new OccurrencePreparationError("budget");
			parserRule = "json-array-string-v1";
			sourcePositions = parsed.length;
			parsed.forEach(append);
		} else {
			parserRule = "delimited-v1";
			let start = -1;
			for (let index = 0; index <= value.length; index += 1) {
				if (index === value.length || /[\s,;]/.test(value[index]!)) {
					if (start !== -1) { append(value.slice(start, index), sourcePositions++); start = -1; }
				} else if (start === -1) start = index;
			}
		}
	} else return { slots, malformedOrdinals, interpretation: { state: "unsupported", parserRule: null, sourcePositions: null, knownSupportedSlots: 0, unknownRemainder: true } };
	return { slots, malformedOrdinals, interpretation: { state: "supported", parserRule, sourcePositions, knownSupportedSlots: slots.length, unknownRemainder: malformedOrdinals.length > 0 } };
}
