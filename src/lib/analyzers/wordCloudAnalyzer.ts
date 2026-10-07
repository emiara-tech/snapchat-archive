import { SNAP_JSON_PATHS } from "../snapArchive";
import type { AnalyzerContext, DataAnalyzer } from "./base";
import type { ChatHistory } from "../../types";

export interface WordFrequency {
	word: string;
	count: number;
}

const STOP_WORDS = new Set([
	"the",
	"and",
	"you",
	"for",
	"but",
	"are",
	"with",
	"this",
	"that",
	"have",
	"just",
	"not",
	"what",
]);

export class WordCloudAnalyzer implements DataAnalyzer<WordFrequency[]> {
	readonly id = "wordCloud";
	readonly title = "Common Words";

	async run({ reader }: AnalyzerContext): Promise<WordFrequency[]> {
		const chatHistory = await reader.readJsonFile<ChatHistory>(
			SNAP_JSON_PATHS.chatHistory,
		);
		if (!chatHistory) return [];

		const frequencyMap = new Map<string, number>();

		for (const messages of Object.values(chatHistory)) {
			for (const message of messages) {
				if (!message.Content) continue;
				const words = tokenize(message.Content);
				for (const word of words) {
					const count = frequencyMap.get(word) ?? 0;
					frequencyMap.set(word, count + 1);
				}
			}
		}

		return Array.from(frequencyMap.entries())
			.map(([word, count]) => ({ word, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 100);
	}
}

function tokenize(input: string): string[] {
	return input
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, " ")
		.split(/\s+/)
		.filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}