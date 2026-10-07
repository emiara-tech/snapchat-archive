import { SNAP_JSON_PATHS } from "../snapArchive";
import type { AnalyzerContext, DataAnalyzer } from "./base";
import type { ChatHistory } from "../../types";

export interface BestFriendSummary {
	friendId: string;
	totalMessages: number;
	sentMessages: number;
	receivedMessages: number;
}

export class BestFriendsAnalyzer implements DataAnalyzer<BestFriendSummary[]> {
	readonly id = "bestFriends";
	readonly title = "Interaction Leaders";

	async run({ reader }: AnalyzerContext): Promise<BestFriendSummary[]> {
		const chatHistory = await reader.readJsonFile<ChatHistory>(
			SNAP_JSON_PATHS.chatHistory,
		);
		if (!chatHistory) return [];

		const summaries: BestFriendSummary[] = [];

		for (const [friendId, messages] of Object.entries(chatHistory)) {
			const sentMessages = messages.filter(
				(message) => message.IsSender,
			).length;
			const receivedMessages = messages.length - sentMessages;
			const totalMessages = messages.length;

			summaries.push({
				friendId,
				totalMessages,
				sentMessages,
				receivedMessages,
			});
		}

		return summaries.sort((a, b) => b.totalMessages - a.totalMessages);
	}
}