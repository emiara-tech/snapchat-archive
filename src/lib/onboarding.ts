export type JourneyState =
	"not_requested" | "requested_by_user" | "reported_ready";
const STORAGE_KEY = "goodbye-chat:journey:v1";
export function readJourney(): JourneyState {
	try {
		const value = localStorage.getItem(STORAGE_KEY);
		return value === "requested_by_user" || value === "reported_ready"
			? value
			: "not_requested";
	} catch {
		return "not_requested";
	}
}
export function saveJourney(state: JourneyState): boolean {
	try {
		if (state === "not_requested") localStorage.removeItem(STORAGE_KEY);
		else localStorage.setItem(STORAGE_KEY, state);
		return true;
	} catch {
		return false;
	}
}
export function calendarReminder(date: Date): string {
	if (!Number.isFinite(date.getTime()))
		throw new Error("Choose a valid reminder date.");
	const stamp = (value: Date) =>
		value
			.toISOString()
			.replace(/[-:]/g, "")
			.replace(/\.\d{3}/, "");
	return [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Goodbye Chat//Archive reminder//EN",
		"BEGIN:VEVENT",
		`UID:${crypto.randomUUID()}@goodbye.chat`,
		`DTSTAMP:${stamp(new Date())}`,
		`DTSTART:${stamp(date)}`,
		`DTEND:${stamp(new Date(date.getTime() + 15 * 60 * 1000))}`,
		"SUMMARY:Check your Snapchat archive request",
		"DESCRIPTION:Check Snapchat email or My Data. After downloading your original ZIPs\\, return to Goodbye Chat to open them privately.",
		"URL:https://goodbye.chat/request",
		"BEGIN:VALARM",
		"ACTION:DISPLAY",
		"DESCRIPTION:Check your Snapchat archive request",
		"TRIGGER:PT0M",
		"END:VALARM",
		"END:VEVENT",
		"END:VCALENDAR",
		"",
	].join("\r\n");
}
