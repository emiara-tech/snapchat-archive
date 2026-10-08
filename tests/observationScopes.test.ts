import { describe, expect, it } from "vitest";
import { normalizeArchiveDataset } from "../src/lib/dataset";
import { computeObservations } from "../src/lib/observations";

function archive(chats: Record<string, unknown[]>) {
	return normalizeArchiveDataset({ entries: [], documents: [
		{ sourceId: "synthetic", path: "json/account.json", text: JSON.stringify({ "Basic Information": { Username: "owner" } }) },
		{ sourceId: "synthetic", path: "json/friends.json", text: JSON.stringify({ Friends: [{ Username: "friend", "Display Name": "Friend" }] }) },
		{ sourceId: "synthetic", path: "json/chat_history.json", text: JSON.stringify(chats) },
	] });
}
const message = { From: "friend", IsSender: false, Created: "2020-01-01 12:00:00 UTC", "Media Type": "TEXT", Content: "Recorded words" };

describe("evidence-backed conversation scope", () => {
	it("keeps a recorded group with incomplete membership out of direct person counts", () => {
		const dataset = archive({ "known-group": [{ ...message, "Conversation Title": "The group" }], friend: [message] });
		const observations = computeObservations(dataset, dataset.events, dataset.assets);
		expect(observations.relationships.map((group) => [group.label, group.value]).sort()).toEqual([["Friend", 1], ["Group · The group", 1]]);
		expect(dataset.conversations.find((conversation) => conversation.title === "The group")?.scope?.kind).toBe("group");
		expect(dataset.conversations.find((conversation) => conversation.title === "friend")?.scope?.kind).toBe("direct");
	});
	it("holds unknown membership and contradictory direct-thread senders in conversation scopes", () => {
		const dataset = archive({ opaque: [message], friend: [message, { ...message, From: "third-person" }] });
		const observations = computeObservations(dataset, dataset.events, dataset.assets);
		expect(dataset.conversations.find((conversation) => conversation.title === "opaque")?.scope?.kind).toBe("unknown");
		expect(dataset.conversations.find((conversation) => conversation.title === "friend")?.scope?.kind).toBe("group");
		expect(observations.relationships.map((group) => [group.label, group.value]).sort()).toEqual([["Group · friend", 2], ["Membership uncertain · opaque", 1]]);
	});
	it("compares annual totals under observed chat-active-day denominators and counts overlays separately", () => {
		const dataset = archive({ friend: [
			message,
			{ ...message, From: "owner", IsSender: true, Content: "Owner words", Created: "2020-01-01 13:00:00 UTC" },
			{ ...message, Created: "2020-01-03 12:00:00 UTC" },
			{ ...message, Created: "2021-01-01 12:00:00 UTC" },
		] });
		const physical = normalizeArchiveDataset({ entries: [
			{ id: { sourceId: "images", path: "memories/2022-06-01_one-main.jpg", ordinal: 0 }, compressedSize: 5, uncompressedSize: 5, isDirectory: false },
			{ id: { sourceId: "images", path: "memories/2022-06-01_one-overlay.png", ordinal: 1 }, compressedSize: 5, uncompressedSize: 5, isDirectory: false },
		], documents: [{ sourceId: "images", path: "json/memories_history.json", text: JSON.stringify({ "Saved Media": [{ Date: "2022-06-01 12:00:00 UTC", "Media Type": "Image", "Download Link": "https://example.invalid/?mid=one" }] }) }] });
		dataset.assets = physical.assets;
		const observations = computeObservations(dataset, dataset.events, dataset.assets);
		expect(observations.years.map(({ year, events, ownerText, assets, activeDays, eventsPerActiveDay }) => ({ year, events, ownerText, assets, activeDays, eventsPerActiveDay }))).toEqual([
			{ year: "2020", events: 3, ownerText: 1, assets: 0, activeDays: 2, eventsPerActiveDay: 1.5 },
			{ year: "2021", events: 1, ownerText: 0, assets: 0, activeDays: 1, eventsPerActiveDay: 1 },
			{ year: "2022", events: 0, ownerText: 0, assets: 1, activeDays: 0, eventsPerActiveDay: null },
		]);
		expect(observations.population).toMatchObject({ events: 4, activeDays: 3, longestChatRun: 1, availableAssets: 1, overlayLayers: 1 });
		expect(observations.memories).toHaveLength(1);
		expect(observations.timeline.find((group) => group.label === "2022-06")?.value).toBe(1);
	});
});
