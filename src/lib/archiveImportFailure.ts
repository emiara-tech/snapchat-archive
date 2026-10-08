import { OccurrencePreparationError } from "./datasetOccurrenceFacts";

export interface ArchiveImportFailure {
	readonly code: "budget" | "domain" | "limits" | "unknown";
	readonly title: string;
	readonly description: string;
	readonly actionLabel: string;
	readonly preservationNotice: string;
}

const UNKNOWN_FAILURE: ArchiveImportFailure = Object.freeze({
	code: "unknown",
	title: "Couldn't open your archive.",
	description: "The app could not open this ZIP selection. Choose different ZIPs and try again.",
	actionLabel: "Choose different ZIPs",
	preservationNotice: "Your original ZIP files are unchanged.",
});

const BUDGET_FAILURE: ArchiveImportFailure = Object.freeze({
	code: "budget",
	title: "Archive is above the processing limit.",
	description: "This ZIP selection exceeds the current app's local processing limit. Try a smaller ZIP selection.",
	actionLabel: "Choose different ZIPs",
	preservationNotice: "Your original ZIP files are unchanged.",
});

const DOMAIN_FAILURE: ArchiveImportFailure = Object.freeze({
	code: "domain",
	title: "Unsupported archive identifier format.",
	description: "This archive uses an identifier format the app cannot process. Choose a different ZIP selection.",
	actionLabel: "Choose different ZIPs",
	preservationNotice: "Your original ZIP files are unchanged.",
});

const LIMITS_FAILURE: ArchiveImportFailure = Object.freeze({
	code: "limits",
	title: "Local processing could not start.",
	description: "The app could not start local archive processing. Choose different ZIPs and try again.",
	actionLabel: "Choose different ZIPs",
	preservationNotice: "Your original ZIP files are unchanged.",
});

export function describeArchiveImportFailure(error: unknown): ArchiveImportFailure {
	try {
		if (error instanceof OccurrencePreparationError) {
			const code = Object.getOwnPropertyDescriptor(error, "code");
			if (code && "value" in code) {
				if (code.value === "budget") return BUDGET_FAILURE;
				if (code.value === "domain") return DOMAIN_FAILURE;
				if (code.value === "limits") return LIMITS_FAILURE;
			}
		}
	} catch {
		// An unknown thrown value cannot supply application recovery copy.
	}
	return UNKNOWN_FAILURE;
}
