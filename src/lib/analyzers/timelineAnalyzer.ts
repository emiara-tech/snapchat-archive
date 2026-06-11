import { SNAP_JSON_PATHS } from "../snapArchive";
import type { AnalyzerContext, DataAnalyzer } from "./base";
import type { ChatHistory } from "../../types";

export interface TimelinePoint {
	date: string;
	messageCount: number;
}

export class TimelineAnalyzer implements DataAnalyzer<TimelinePoint[]> {
	readonly id = "timeline";
	readonly title = "Timeline Activity";

	async run({ reader }: AnalyzerContext): Promise<TimelinePoint[]> {
		const chatHistory = await reader.readJsonFile<ChatHistory>(
			SNAP_JSON_PATHS.chatHistory,
		);
		if (!chatHistory) return [];

		const map = new Map<string, number>();

		for (const messages of Object.values(chatHistory)) {
			for (const message of messages) {
				const date = normalizeDate(message.Created);
				if (!date) continue;
				const count = map.get(date) ?? 0;
				map.set(date, count + 1);
			}
		}

		return Array.from(map.entries())
			.map(([date, messageCount]) => ({ date, messageCount }))
			.sort((a, b) => (a.date < b.date ? -1 : 1));
	}
}

function normalizeDate(value: string): string | null {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return date.toISOString().slice(0, 10);
}