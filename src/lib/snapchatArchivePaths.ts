export const SNAPCHAT_JSON_PATHS = {
	account: "json/account.json",
	friends: "json/friends.json",
	chatHistory: "json/chat_history.json",
	snapHistory: "json/snap_history.json",
	memoriesHistory: "json/memories_history.json",
	storyHistory: "json/story_history.json",
} as const;

export const EXPECTED_SNAPCHAT_JSON_PATHS = Object.values(SNAPCHAT_JSON_PATHS);