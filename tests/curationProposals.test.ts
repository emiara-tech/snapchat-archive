import { describe, expect, it, vi } from "vitest";
import { DEFAULT_QUERY, normalizeArchiveDataset } from "../src/lib/dataset";
import { createGuideProposals, createProfileTopicProposals, type ProposalCollection } from "../src/lib/curationProposals";
import { buildYearProfile } from "../src/lib/yearProfile";

function collection(): ProposalCollection {
	const dataset = normalizeArchiveDataset({ entries: [{
		id: { sourceId: "synthetic", path: "memories/2019-01-02_photo-one-main.jpg", ordinal: 0 },
		compressedSize: 16, uncompressedSize: 16, isDirectory: false, signature: 1,
	}], documents: [
		{ sourceId: "synthetic", path: "json/account.json", text: JSON.stringify({ "Basic Information": { Username: "owner" } }) },
		{ sourceId: "synthetic", path: "json/chat_history.json", text: JSON.stringify({ friend: [
			...Array.from({ length: 11 }, (_, index) => ({ From: "owner", IsSender: true, Created: `2019-01-${String(index + 1).padStart(2, "0")} 12:00:00 UTC`, "Media Type": "TEXT", Content: `Literal phrase ${index + 1}` })),
			{ From: "friend", IsSender: false, Created: "2019-01-12 12:00:00 UTC", "Media Type": "TEXT", Content: "Literal phrase incoming" },
			{ From: "owner", IsSender: true, Created: "2019-01-13 12:00:00 UTC", "Media Type": "TEXT", Content: "Literal phrase excluded" },
			{ From: "owner", IsSender: true, Created: "2019-01-14 12:00:00 UTC", "Media Type": "IMAGE", "Media IDs": "photo-one" },
		] }) },
	] });
	const excluded = dataset.events.filter((event) => event.text === "Literal phrase excluded" || event.kind === "image");
	return { dataset, query: { ...DEFAULT_QUERY, review: "all" }, decisions: Object.fromEntries(excluded.map((event) => [event.id, { status: "exclude" as const, updatedAt: "synthetic" }])), queryRevision: 4, reviewRevision: 7 };
}

describe("reviewed local collection proposals", () => {
	it("freezes the exact effective identifiers and preserves exclusions even in the all-review view", () => {
		const current = collection();
		const review = vi.fn(), query = vi.fn();
		const proposals = createGuideProposals({ current: () => current, review, query });
		const prepared = proposals.prepare("Keep all");
		if ("error" in prepared) throw new Error(prepared.error);
		const allowed = current.dataset.events.filter((event) => event.kind === "text" && event.text !== "Literal phrase excluded").map((event) => event.id);
		expect(prepared.eventIds).toEqual(allowed);
		expect(prepared.assetIds).toEqual([]);
		expect(prepared.itemIds).toEqual(allowed);
		expect(Object.isFrozen(prepared.itemIds)).toBe(true);
		expect(Object.isFrozen(prepared.plan.query)).toBe(true);
		expect(review).not.toHaveBeenCalled(); expect(query).not.toHaveBeenCalled();
		expect(proposals.apply(prepared)).toEqual({ kind: "review", count: 12, status: "keep" });
		expect(review).toHaveBeenCalledExactlyOnceWith(allowed, "keep");
		expect(query).not.toHaveBeenCalled();
	});

	it.each(["dataset", "query", "review", "query value", "decision value", "cleared"])("refuses %s drift before any Guide action", (change) => {
		let current: ProposalCollection | null = collection();
		const review = vi.fn(), query = vi.fn();
		const proposals = createGuideProposals({ current: () => current, review, query });
		const prepared = proposals.prepare("Keep all");
		if ("error" in prepared) throw new Error(prepared.error);
		if (change === "dataset") current.dataset = { ...current.dataset, revision: "replacement" };
		if (change === "query") current.queryRevision++;
		if (change === "review") current.reviewRevision++;
		if (change === "query value") current.query.year = 2020;
		if (change === "decision value") current.decisions[prepared.eventIds[0]!] = { status: "exclude", updatedAt: "later" };
		if (change === "cleared") current = null;
		expect(proposals.isCurrent(prepared)).toBe(false);
		expect(proposals.apply(prepared)).toHaveProperty("error");
		expect(review).not.toHaveBeenCalled(); expect(query).not.toHaveBeenCalled();
	});

	it("cannot include an overlay whose only known base was excluded through its conversation event", () => {
		const current = collection(), base = current.dataset.assets[0]!;
		current.dataset.assets.push({ ...base, id: "synthetic-overlay", role: "overlay", overlayState: "resolved", baseAssetIds: [base.id], conversationIds: [] });
		const proposals = createGuideProposals({ current: () => current, review: vi.fn(), query: vi.fn() });
		const prepared = proposals.prepare("Keep all");
		if ("error" in prepared) throw new Error(prepared.error);
		expect(prepared.assetIds).toEqual([]);
	});

	it("reports success only after the exact frozen action succeeds and refuses replay or copied proposals", () => {
		const current = collection(), review = vi.fn(() => { throw new Error("private adapter failure"); }), query = vi.fn();
		const proposals = createGuideProposals({ current: () => current, review, query });
		const prepared = proposals.prepare("Keep all");
		if ("error" in prepared) throw new Error(prepared.error);
		expect(proposals.apply({ ...prepared })).toHaveProperty("error");
		expect(review).not.toHaveBeenCalled();
		expect(proposals.apply(prepared)).toHaveProperty("error");
		expect(proposals.apply(prepared)).toHaveProperty("error");
		expect(review).toHaveBeenCalledTimes(1);
		expect(query).not.toHaveBeenCalled();
	});

	it("applies the inspected filter through the query callback and keeps explanations cost-free", () => {
		const current = collection(), review = vi.fn(), query = vi.fn();
		const proposals = createGuideProposals({ current: () => current, review, query });
		const prepared = proposals.prepare('Find messages containing "phrase 11"');
		if ("error" in prepared) throw new Error(prepared.error);
		expect(prepared.eventIds).toEqual([current.dataset.events.find((event) => event.text === "Literal phrase 11")!.id]);
		expect(proposals.apply(prepared)).toEqual({ kind: "query" });
		expect(query).toHaveBeenCalledExactlyOnceWith({ ...DEFAULT_QUERY, kind: "text", text: "phrase 11" });
		const explanation = proposals.prepare("Who did I talk with most?");
		if ("error" in explanation) throw new Error(explanation.error);
		expect(proposals.apply(explanation)).toHaveProperty("error");
		expect(query).toHaveBeenCalledTimes(1); expect(review).not.toHaveBeenCalled();
		expect(proposals.prepare("Upload the archive")).toHaveProperty("error");
	});
});

function topicCollection() {
	const current = collection();
	const profile = buildYearProfile(current.dataset, current.dataset.events.filter((event) => current.decisions[event.id]?.status !== "exclude"), 2019, "UTC", { queryRevision: current.queryRevision, reviewRevision: current.reviewRevision, editorRevision: 0 });
	return { ...current, profile, editorRevision: 0, styleChoices: { ...profile.styleChoices } };
}

describe("reviewed literal profile exclusions", () => {
	it("freezes every matching eligible profile source beyond a page and edits only after Apply", () => {
		const current = topicCollection(), edit = vi.fn();
		const proposals = createProfileTopicProposals({ current: () => current, edit });
		const prepared = proposals.prepare("  literal PHRASE  ");
		if ("error" in prepared) throw new Error(prepared.error);
		expect(prepared.literal).toBe("literal PHRASE");
		expect(prepared.eventIds).toEqual(current.profile.evidenceIds);
		expect(prepared.eventIds).toHaveLength(11);
		expect(Object.isFrozen(prepared.eventIds)).toBe(true);
		expect(edit).not.toHaveBeenCalled();
		expect(proposals.apply(prepared)).toEqual({ kind: "topic", count: 11 });
		expect(edit).toHaveBeenCalledExactlyOnceWith({ literal: "literal PHRASE", eventIds: current.profile.evidenceIds });
	});

	it.each(["dataset", "query", "review", "profile", "evidence", "editor", "style", "query value", "decision value", "cleared"])("rejects %s drift without any profile edit", (change) => {
		let current: ReturnType<typeof topicCollection> | null = topicCollection();
		const edit = vi.fn();
		const proposals = createProfileTopicProposals({ current: () => current, edit });
		const prepared = proposals.prepare("literal phrase");
		if ("error" in prepared) throw new Error(prepared.error);
		if (change === "dataset") current.dataset = { ...current.dataset, revision: "replacement" };
		if (change === "query") current.queryRevision++;
		if (change === "review") current.reviewRevision++;
		if (change === "profile") current.profile = { ...current.profile, revision: "new profile" };
		if (change === "evidence") current.profile = { ...current.profile, evidenceIds: current.profile.evidenceIds.slice(1) };
		if (change === "editor") current.editorRevision++;
		if (change === "style") current.styleChoices = { ...current.styleChoices, punctuation: "restrained" };
		if (change === "query value") current.query.text = "different";
		if (change === "decision value") current.decisions[prepared.eventIds[0]!] = { status: "exclude", updatedAt: "later" };
		if (change === "cleared") current = null;
		expect(proposals.isCurrent(prepared)).toBe(false);
		expect(proposals.apply(prepared)).toHaveProperty("error");
		expect(edit).not.toHaveBeenCalled();
	});

	it("does not trust incoming or excluded IDs added to profile evidence and rejects empty or stale preparation", () => {
		const current = topicCollection(), edit = vi.fn();
		const permitted = [...current.profile.evidenceIds];
		current.profile = { ...current.profile, evidenceIds: current.dataset.events.map((event) => event.id) };
		const proposals = createProfileTopicProposals({ current: () => current, edit });
		const prepared = proposals.prepare("literal phrase");
		if ("error" in prepared) throw new Error(prepared.error);
		expect(prepared.eventIds).toEqual(permitted);
		expect(proposals.prepare(" ")).toHaveProperty("error");
		expect(proposals.prepare("x".repeat(201))).toHaveProperty("error");
		const empty = proposals.prepare("phrase absent from the source");
		if ("error" in empty) throw new Error(empty.error);
		expect(proposals.apply(empty)).toHaveProperty("error");
		current.editorRevision++;
		expect(proposals.prepare("literal phrase")).toHaveProperty("error");
		expect(edit).not.toHaveBeenCalled();
	});

	it("refuses copied/replayed profile proposals and never reports a failed edit as applied", () => {
		const current = topicCollection(), edit = vi.fn(() => { throw new Error("private edit error"); });
		const proposals = createProfileTopicProposals({ current: () => current, edit });
		const prepared = proposals.prepare("literal phrase");
		if ("error" in prepared) throw new Error(prepared.error);
		expect(proposals.apply({ ...prepared })).toHaveProperty("error");
		expect(edit).not.toHaveBeenCalled();
		expect(proposals.apply(prepared)).toHaveProperty("error");
		expect(proposals.apply(prepared)).toHaveProperty("error");
		expect(edit).toHaveBeenCalledTimes(1);
	});
});
