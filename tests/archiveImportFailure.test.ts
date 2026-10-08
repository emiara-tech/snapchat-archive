import { expect, it, vi } from "vitest";
import { describeArchiveImportFailure } from "../src/lib/archiveImportFailure";
import { OccurrencePreparationError } from "../src/lib/datasetOccurrenceFacts";

it("explains a valid archive's capacity failure without blaming the download or exposing its error", () => {
	const error = new OccurrencePreparationError("budget");
	error.message = "PRIVATE-IMPORT-CANARY.zip contains PRIVATE-REFERENCE-CANARY";

	expect(describeArchiveImportFailure(error)).toEqual({
		code: "budget",
		title: "Archive is above the processing limit.",
		description: "This ZIP selection exceeds the current app's local processing limit. Try a smaller ZIP selection.",
		actionLabel: "Choose different ZIPs",
		preservationNotice: "Your original ZIP files are unchanged.",
	});
});

it("explains an unsupported identifier format without disclosing the identifier or recommending another download", () => {
	const error = new OccurrencePreparationError("domain");
	error.message = "PRIVATE-IDENTIFIER-CANARY";

	expect(describeArchiveImportFailure(error)).toEqual({
		code: "domain",
		title: "Unsupported archive identifier format.",
		description: "This archive uses an identifier format the app cannot process. Choose a different ZIP selection.",
		actionLabel: "Choose different ZIPs",
		preservationNotice: "Your original ZIP files are unchanged.",
	});
});

it("explains invalid local processing configuration without treating the ZIP as damaged", () => {
	const error = new OccurrencePreparationError("limits");
	error.message = "PRIVATE-CONFIGURATION-CANARY";

	expect(describeArchiveImportFailure(error)).toEqual({
		code: "limits",
		title: "Local processing could not start.",
		description: "The app could not start local archive processing. Choose different ZIPs and try again.",
		actionLabel: "Choose different ZIPs",
		preservationNotice: "Your original ZIP files are unchanged.",
	});
});

it("uses generic copy for private errors and class-name or code lookalikes", () => {
	const error = Object.assign(new Error("PRIVATE-UNKNOWN-IMPORT-CANARY.zip"), {
		name: "OccurrencePreparationError",
		code: "budget",
		filename: "PRIVATE-FILENAME-CANARY.zip",
		cause: { token: "PRIVATE-TOKEN-CANARY" },
	});

	expect(describeArchiveImportFailure(error)).toEqual({
		code: "unknown",
		title: "Couldn't open your archive.",
		description: "The app could not open this ZIP selection. Choose different ZIPs and try again.",
		actionLabel: "Choose different ZIPs",
		preservationNotice: "Your original ZIP files are unchanged.",
	});
});

it("does not read private message, name or unknown-field getters on a concrete known error", () => {
	const getter = vi.fn(() => { throw new Error("PRIVATE-GETTER-CANARY"); });
	const error = new OccurrencePreparationError("domain");
	for (const field of ["message", "name", "stack", "filename", "token"])
		Object.defineProperty(error, field, { get: getter });

	expect(describeArchiveImportFailure(error).code).toBe("domain");
	expect(getter).not.toHaveBeenCalled();
});

it("rejects accessor codes without running the accessor", () => {
	const getter = vi.fn(() => { throw new Error("PRIVATE-CODE-GETTER-CANARY"); });
	const error = new OccurrencePreparationError("budget");
	Object.defineProperty(error, "code", { get: getter });

	expect(describeArchiveImportFailure(error).code).toBe("unknown");
	expect(getter).not.toHaveBeenCalled();
});

it("does not coerce unknown objects or malformed concrete codes", () => {
	const coerce = vi.fn(() => { throw new Error("PRIVATE-COERCION-CANARY"); });
	const object = { toString: coerce, [Symbol.toPrimitive]: coerce };
	const error = new OccurrencePreparationError("budget");
	Object.defineProperty(error, "code", { value: object });

	expect(describeArchiveImportFailure(object).code).toBe("unknown");
	expect(describeArchiveImportFailure(error).code).toBe("unknown");
	expect(coerce).not.toHaveBeenCalled();
});

it("does not read getters on unapproved thrown values or retain their data", () => {
	const getter = vi.fn(() => { throw new Error("PRIVATE-UNAPPROVED-GETTER-CANARY"); });
	const object = Object.defineProperties({}, {
		message: { get: getter }, code: { get: getter }, name: { get: getter },
		toString: { get: getter }, [Symbol.toPrimitive]: { get: getter },
	});

	const failure = describeArchiveImportFailure(object);
	expect(failure.code).toBe("unknown");
	expect(Object.keys(failure).sort()).toEqual(["actionLabel", "code", "description", "preservationNotice", "title"]);
	expect(getter).not.toHaveBeenCalled();
});

it.each([null, undefined, "PRIVATE-THROWN-STRING-CANARY", 123, false, Symbol("PRIVATE-SYMBOL-CANARY")])(
	"safely describes primitive thrown value %s",
	(error) => { expect(describeArchiveImportFailure(error).code).toBe("unknown"); },
);

it("handles an uninspectable thrown value without exposing another error", () => {
	const { proxy, revoke } = Proxy.revocable({}, {});
	revoke();
	expect(describeArchiveImportFailure(proxy).code).toBe("unknown");
});
