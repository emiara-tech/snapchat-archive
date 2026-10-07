import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import type { DurableStore } from "./store";

// Explicit single-host development storage. Deployed functions use the shared store.
export function localStore(path: string): DurableStore & { close(): void } {
	if (!isAbsolute(path))
		throw new Error("Local account store requires an absolute path");
	mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
	const database = new DatabaseSync(path);
	chmodSync(path, 0o600);
	database.exec(
		"PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS records (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires INTEGER NOT NULL)",
	);
	const read = database.prepare(
		"SELECT value FROM records WHERE key=? AND expires>?",
	);
	const write = database.prepare(
		"INSERT INTO records(key,value,expires) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,expires=excluded.expires",
	);
	const remove = database.prepare("DELETE FROM records WHERE key=?");
	const take = database.prepare(
		"DELETE FROM records WHERE key=? AND value=? AND expires>?",
	);
	const claim = database.prepare(
		"INSERT INTO records(key,value,expires) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,expires=excluded.expires WHERE records.expires<=?",
	);
	const replace = database.prepare(
		"UPDATE records SET value=?,expires=? WHERE key=? AND value=? AND expires>?",
	);
	const expiry = (seconds: number) =>
		Date.now() + Math.max(1, Math.floor(seconds)) * 1000;
	return {
		close() {
			database.close();
		},
		async get(key) {
			const record = read.get(key, Date.now());
			return typeof record?.value === "string" ? record.value : null;
		},
		async put(key, value, seconds) {
			write.run(key, value, expiry(seconds));
		},
		async remove(key) {
			remove.run(key);
		},
		async take(key, expected) {
			return Number(take.run(key, expected, Date.now()).changes) === 1;
		},
		async claim(key, value, seconds) {
			return (
				Number(claim.run(key, value, expiry(seconds), Date.now()).changes) === 1
			);
		},
		async replace(key, expected, value, seconds) {
			return (
				Number(
					replace.run(value, expiry(seconds), key, expected, Date.now())
						.changes,
				) === 1
			);
		},
	};
}
