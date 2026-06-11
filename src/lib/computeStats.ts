import type {
	Friend,
	SnapHistory,
	ChatHistory,
	StoryHistoryJson,
	ComputedArchiveStats,
	TopFriendEntry,
	MediaRecord,
} from "../types";

export interface ComputeStatsInput {
	friends: Friend[];
	snapHistory: SnapHistory | null;
	chatHistory: ChatHistory | null;
	storyHistory: StoryHistoryJson | null;
	memories: MediaRecord[];
	indexedMediaBytes?: number;
}

export function computeStats(input: ComputeStatsInput): ComputedArchiveStats {
	const {
		friends,
		snapHistory,
		chatHistory,
		storyHistory,
		memories,
		indexedMediaBytes,
	} = input;

	const totalSnaps = snapHistory
		? Object.values(snapHistory).reduce(
				(sum, entries) => sum + entries.length,
				0,
			)
		: 0;

	const totalChats = chatHistory
		? Object.values(chatHistory).reduce((sum, thread) => sum + thread.length, 0)
		: 0;

	const totalStories = storyHistory?.["Your Story Views"]?.length ?? 0;
	const dateRange = computeDateRange({
		snapHistory,
		chatHistory,
		storyHistory,
		memories,
	});

	return {
		totalSnaps,
		totalChats,
		totalStories,
		totalMemories: memories.length,
		totalFriends: friends.length,
		longestChatActiveRunDays: chatHistory
			? computeLongestChatActiveRun(chatHistory)
			: 0,
		dateRange,
		totalDays:
			dateRange.start && dateRange.end
				? Math.max(1, dayDiff(dateRange.start, dateRange.end))
				: 0,
		topFriends: chatHistory ? computeTopFriends(chatHistory, friends) : [],
		totalIndexedMediaSize: formatBytes(indexedMediaBytes ?? 0),
	};
}

function computeDateRange(input: {
	snapHistory: SnapHistory | null;
	chatHistory: ChatHistory | null;
	storyHistory: StoryHistoryJson | null;
	memories: MediaRecord[];
}): { start: string; end: string } {
	const days: string[] = [];

	for (const memory of input.memories) {
		pushISODate(days, memory.date);
	}

	if (input.chatHistory) {
		for (const thread of Object.values(input.chatHistory)) {
			for (const message of thread) {
				pushISODate(days, message.Created);
			}
		}
	}

	if (input.snapHistory) {
		for (const thread of Object.values(input.snapHistory)) {
			for (const snap of thread) {
				pushISODate(days, snap.Created);
			}
		}
	}

	for (const story of input.storyHistory?.["Your Story Views"] ?? []) {
		pushISODate(days, story["Story Date"]);
	}

	if (!days.length) return { start: "", end: "" };
	days.sort();
	return { start: days[0], end: days[days.length - 1] };
}

function computeLongestChatActiveRun(chatHistory: ChatHistory): number {
	const allDays = new Set<string>();

	for (const thread of Object.values(chatHistory)) {
		for (const message of thread) {
			const day = toISODate(message.Created);
			if (day) allDays.add(day);
		}
	}

	if (!allDays.size) return 0;

	const sorted = Array.from(allDays).sort();
	let best = 1;
	let current = 1;

	for (let i = 1; i < sorted.length; i++) {
		const prev = new Date(sorted[i - 1]);
		const curr = new Date(sorted[i]);
		const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);

		if (diff === 1) {
			current += 1;
			if (current > best) best = current;
		} else {
			current = 1;
		}
	}

	return best;
}

function computeTopFriends(
	chatHistory: ChatHistory,
	friends: Friend[],
): TopFriendEntry[] {
	const displayNameByUsername = new Map<string, string>();
	for (const friend of friends) {
		displayNameByUsername.set(friend.Username, friend["Display Name"]);
	}

	const entries: TopFriendEntry[] = [];

	for (const [conversationKey, thread] of Object.entries(chatHistory)) {
		const sentMessages = thread.filter((m) => m.IsSender).length;
		const receivedMessages = thread.length - sentMessages;

		entries.push({
			username: conversationKey,
			displayName:
				displayNameByUsername.get(conversationKey) ?? conversationKey,
			totalMessages: thread.length,
			sentMessages,
			receivedMessages,
		});
	}

	return entries.sort((a, b) => b.totalMessages - a.totalMessages).slice(0, 8);
}

function pushISODate(days: string[], input: string): void {
	const day = toISODate(input);
	if (day) days.push(day);
}

function dayDiff(start: string, end: string): number {
	const a = new Date(start);
	const b = new Date(end);
	if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
	return Math.ceil(Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function toISODate(input: string): string | null {
	const d = new Date(input);
	if (Number.isNaN(d.getTime())) return null;
	return d.toISOString().slice(0, 10);
}

function formatBytes(bytes: number): string {
	if (bytes <= 0) return "0 B";
	const units = ["B", "KB", "MB", "GB", "TB"];
	const exponent = Math.min(
		Math.floor(Math.log(bytes) / Math.log(1024)),
		units.length - 1,
	);
	const value = bytes / 1024 ** exponent;
	return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}