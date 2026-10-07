import type { Authorship } from "../types/dataset";

export function authorLabel(authorship: Authorship, recordedName?: string): string {
	if (authorship === "owner") return "You";
	if (authorship === "conflicting") return recordedName ? `${recordedName} · conflicting authorship` : "Conflicting authorship";
	if (authorship === "unknown") return recordedName ? `${recordedName} · authorship unverified` : "Unknown author";
	return recordedName ?? "Unknown author";
}
