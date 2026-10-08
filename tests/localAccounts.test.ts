import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { localStore } from "../server/localStore";
const directories: string[] = [];
const stores: ReturnType<typeof localStore>[] = [];
afterEach(() => {
	vi.restoreAllMocks();
	for (const store of stores.splice(0)) store.close();
	for (const directory of directories.splice(0))
		rmSync(directory, { recursive: true, force: true });
});
function fixture() {
	const directory = mkdtempSync(join(tmpdir(), "goodbye-account-store-"));
	directories.push(directory);
	const path = join(directory, "private", "accounts.sqlite");
	const open = () => {
		const store = localStore(path);
		stores.push(store);
		return store;
	};
	return { path, open };
}
describe("persistent single-host account storage", () => {
	it("persists opaque records and atomically consumes a transaction across separate connections", async () => {
		const f = fixture();
		const first = f.open();
		const second = f.open();
		await first.put("transaction", "encrypted-synthetic-record", 600);
		expect(await second.get("transaction")).toBe("encrypted-synthetic-record");
		const outcomes = await Promise.all([
			first.take("transaction", "encrypted-synthetic-record"),
			second.take("transaction", "encrypted-synthetic-record"),
		]);
		expect(outcomes.filter(Boolean)).toHaveLength(1);
		expect(await first.get("transaction")).toBeNull();
		expect(statSync(f.path).mode & 0o777).toBe(0o600);
	});
	it("allows one reservation and prevents stale session updates from resurrecting logout", async () => {
		const f = fixture();
		const first = f.open();
		const second = f.open();
		expect(await first.claim("lease", "first", 30)).toBe(true);
		expect(await second.claim("lease", "second", 30)).toBe(false);
		expect(await second.take("lease", "second")).toBe(false);
		await first.put("session", "old-encrypted-record", 600);
		expect(await second.replace("session", "wrong", "replacement", 600)).toBe(
			false,
		);
		await first.remove("session");
		expect(
			await second.replace(
				"session",
				"old-encrypted-record",
				"replacement",
				600,
			),
		).toBe(false);
		expect(await first.get("session")).toBeNull();
	});
	it("expires authority and releases an expired lease without a stale holder deleting its replacement", async () => {
		const f = fixture();
		const first = f.open();
		const second = f.open();
		let now = 1000000;
		vi.spyOn(Date, "now").mockImplementation(() => now);
		await first.put("session", "encrypted-record", 10);
		expect(await first.claim("lease", "first", 10)).toBe(true);
		now += 11000;
		expect(await second.get("session")).toBeNull();
		expect(await second.claim("lease", "second", 10)).toBe(true);
		expect(await first.take("lease", "first")).toBe(false);
		expect(await second.get("lease")).toBe("second");
	});
});
