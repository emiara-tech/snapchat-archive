import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const workflow = readFileSync(
	new URL("../.github/workflows/coderabbit-approval.yml", import.meta.url),
	"utf8",
);
const block = /^ {10}script: \|\n((?: {12}[^\n]*\n|\n)+)/m.exec(workflow)?.[1];
if (!block) throw new Error("The CodeRabbit approval workflow script is missing");
const script = block.replace(/^ {12}/gm, "");
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const runApprovalCheck = new AsyncFunction("context", "github", "core", "setTimeout", script);
const headSha = "a".repeat(40);

function review(id: number, state: string, commit = headSha, login = "coderabbitai[bot]", type = "Bot") {
	return { id, state, commit_id: commit, user: { login, type } };
}

async function check(
	reviews: ReturnType<typeof review>[],
	currentHead = headSha,
	state = "open",
) {
	const setFailed = vi.fn();
	const notice = vi.fn();
	const paginate = vi.fn().mockResolvedValue(reviews);
	await runApprovalCheck(
		{ repo: { owner: "example", repo: "archive" }, payload: { pull_request: { number: 2, head: { sha: headSha } } } },
		{ rest: { pulls: { get: vi.fn().mockResolvedValue({ data: { state, head: { sha: currentHead } } }), listReviews: vi.fn() } }, paginate },
		{ setFailed, notice, info: vi.fn() },
		(callback: () => void) => callback(),
	);
	return { setFailed, notice, paginate };
}

describe("the CodeRabbit approval merge gate", () => {
	it("accepts CodeRabbit approval of the current head", async () => {
		const result = await check([review(1, "APPROVED")]);
		expect(result.setFailed).not.toHaveBeenCalled();
		expect(result.notice).toHaveBeenCalledOnce();
	});

	it.each([
		["no review", []],
		["another reviewer's approval", [review(1, "APPROVED", headSha, "maintainer", "User")]],
		["an unverified bot identity", [review(1, "APPROVED", headSha, "coderabbitai[bot]", "User")]],
		["an earlier commit's approval", [review(1, "APPROVED", "b".repeat(40))]],
		["a dismissed approval", [review(1, "DISMISSED")]],
		["a newer changes request", [review(1, "APPROVED"), review(2, "CHANGES_REQUESTED")]],
	])("rejects %s", async (_, reviews) => {
		const result = await check(reviews);
		expect(result.setFailed).toHaveBeenCalledOnce();
		expect(result.notice).not.toHaveBeenCalled();
	});

	it("keeps a valid approval when a later review only comments", async () => {
		const result = await check([review(1, "APPROVED"), review(2, "COMMENTED")]);
		expect(result.setFailed).not.toHaveBeenCalled();
		expect(result.notice).toHaveBeenCalledOnce();
	});

	it.each([
		["a changed head", "b".repeat(40), "open"],
		["a closed pull request", headSha, "closed"],
	])("rejects a stale run for %s", async (_, currentHead, state) => {
		const result = await check([review(1, "APPROVED")], currentHead, state);
		expect(result.setFailed).toHaveBeenCalledOnce();
		expect(result.paginate).not.toHaveBeenCalled();
	});
});
