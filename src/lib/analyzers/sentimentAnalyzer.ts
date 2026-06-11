import { SNAP_JSON_PATHS } from "../snapArchive";
import type { AnalyzerContext, DataAnalyzer } from "./base";
import type { ChatHistory } from "../../types";

export type SentimentMode = "keywords" | "api";

export interface SentimentAnalyzerOptions {
	mode?: SentimentMode;
	externalClient?: (messages: string[]) => Promise<number[]>;
}

export interface SentimentSummary {
	friendId: string;
	averageScore: number;
	messageCount: number;
}

const POSITIVE_WORDS = new Set([
	"love",
	"great",
	"amazing",
	"fun",
	"best",
	"good",
	"happy",
	"yes",
]);
const NEGATIVE_WORDS = new Set([
	"hate",
	"bad",
	"angry",
	"sad",
	"no",
	"worst",
	"upset",
]);

export class SentimentAnalyzer implements DataAnalyzer<SentimentSummary[]> {
	readonly id = "sentiment";
	readonly title = "Sentiment Overview";

	private readonly mode: SentimentMode;
	private readonly client?: (messages: string[]) => Promise<number[]>;

	constructor(options?: SentimentAnalyzerOptions) {
		this.mode = options?.mode ?? "keywords";
		this.client = options?.externalClient;
	}

	async run({ reader }: AnalyzerContext): Promise<SentimentSummary[]> {
		const chatHistory = await reader.readJsonFile<ChatHistory>(
			SNAP_JSON_PATHS.chatHistory,
		);
		if (!chatHistory) return [];

		if (this.mode === "api" && !this.client) {
			throw new Error(
				"Sentiment analyzer is set to API mode but no client was provided",
			);
		}

		const summaries: SentimentSummary[] = [];

		for (const [friendId, messages] of Object.entries(chatHistory)) {
			const textMessages = messages
				.filter((message) => message.Content && message.Content.trim().length)
				.map((message) => message.Content!.trim());

			if (!textMessages.length) continue;

			let scores: number[];
			if (this.mode === "api" && this.client) {
				scores = await this.client(textMessages);
			} else {
				scores = textMessages.map(keywordSentiment);
			}

			const averageScore =
				scores.reduce((sum, score) => sum + score, 0) / scores.length;
			summaries.push({
				friendId,
				averageScore,
				messageCount: textMessages.length,
			});
		}

		return summaries.sort((a, b) => b.averageScore - a.averageScore);
	}
}

function keywordSentiment(text: string): number {
	const words = text
		.toLowerCase()
		.replace(/[^a-z\s]/g, " ")
		.split(/\s+/)
		.filter(Boolean);

	if (!words.length) return 0;

	let score = 0;
	for (const word of words) {
		if (POSITIVE_WORDS.has(word)) score += 1;
		if (NEGATIVE_WORDS.has(word)) score -= 1;
	}

	return score / words.length;
}