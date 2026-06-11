import { SNAP_JSON_PATHS } from "../snapArchive";
import type { DataAnalyzer, AnalyzerContext } from "./base";
import type { ChatHistory } from "../../types";

export interface StreakSummary {
	friendId: string;
	bestStreak: number;
	currentStreak: number;
	lastActiveDate: string | null;
}

export class StreakAnalyzer implements DataAnalyzer<StreakSummary[]> {
	readonly id = "streaks";
	readonly title = "Conversation Streaks";

	async run({ reader }: AnalyzerContext): Promise<StreakSummary[]> {
		const chatHistory = await reader.readJsonFile<ChatHistory>(
			SNAP_JSON_PATHS.chatHistory,
		);
		if (!chatHistory) return [];

		const summaries: StreakSummary[] = [];

		for (const [friendId, messages] of Object.entries(chatHistory)) {
			if (!messages.length) continue;
			const daySet = new Set<string>();
			for (const message of messages) {
				const day = normalizeDate(message.Created);
				if (day) daySet.add(day);
			}

			if (!daySet.size) continue;

			const orderedDays = Array.from(daySet).sort();
			let best = 1;
			let current = 1;

			for (let i = 1; i < orderedDays.length; i += 1) {
				const prevDate = new Date(orderedDays[i - 1]);
				const currentDate = new Date(orderedDays[i]);
				const diffDays =
					(currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

				if (diffDays === 1) {
					current += 1;
				} else {
					current = 1;
				}

				if (current > best) {
					best = current;
				}
			}

			const lastActiveDate = orderedDays[orderedDays.length - 1] ?? null;
			const today = new Date();
			const lastActive = lastActiveDate ? new Date(lastActiveDate) : null;
			const isCurrentActive = lastActive
				? (today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24) <= 1
				: false;

			summaries.push({
				friendId,
				bestStreak: best,
				currentStreak: isCurrentActive ? current : 0,
				lastActiveDate,
			});
		}

		return summaries.sort((a, b) => b.bestStreak - a.bestStreak);
	}
}

function normalizeDate(input: string): string | null {
	const date = new Date(input);
	if (Number.isNaN(date.getTime())) return null;
	return date.toISOString().slice(0, 10);
}