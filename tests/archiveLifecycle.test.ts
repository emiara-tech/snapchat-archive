import { describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { BlobWriter, TextReader, ZipWriter } from "@zip.js/zip.js";
import { useArchiveStore } from "../src/stores/archive";
import { createArchiveSession } from "../src/lib/snapArchive";
import { buildSnapZipIndex, readSnapZipEntryContent } from "../src/lib/snapZip";
import { loadArchiveDataset } from "../src/lib/dataset";

async function archiveFile(files: Record<string, string>): Promise<File> {
	const writer = new ZipWriter(new BlobWriter("application/zip"));
	for (const [path, text] of Object.entries(files)) await writer.add(path, new TextReader(text));
	return new File([await writer.close()], "synthetic.zip", { type: "application/zip" });
}

describe("archive lifecycle and limits", () => {
	it("rejects a canceled dataset load and permits a fresh attested load from the same reader", async () => {
		const session = await createArchiveSession([await archiveFile({
			"json/chat_history.json": '{"maya":[{"From":"owner","Media Type":"TEXT","Content":"retained words"}]}',
		})]);
		try {
			const controller = new AbortController(); controller.abort();
			await expect(loadArchiveDataset(session, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
			const dataset = await loadArchiveDataset(session);
			expect(dataset.events).toHaveLength(1);
			expect(dataset.events[0]?.source).toMatchObject({ recordPointer: "/maya/0", entryOrdinal: 0, documentByteLength: 74 });
			expect(dataset.events[0]?.source.documentSha256).toMatch(/^[a-f0-9]{64}$/);
			expect(dataset.queryEvidence).toBeNull();
		} finally { session.reader.dispose(); }
	});

	it("canceling an in-flight import prevents old success and permits a valid retry", async () => {
		setActivePinia(createPinia());
		const store = useArchiveStore();
		const file = await archiveFile({ "json/account.json": '{"Basic Information":{"Username":"synthetic"}}' });
		store.startProcessing();
		const old = store.prepareArchive([file]);
		store.resetArchive();
		await expect(old).rejects.toMatchObject({ name: "AbortError" });
		expect(store.archiveSession).toBeNull();
		expect(store.importError).toBeNull();
		store.startProcessing(); await store.prepareArchive([file]); store.completeProcessing();
		expect(store.archiveSession?.metadata.account?.["Basic Information"].Username).toBe("synthetic");
		expect(store.isImported).toBe(true);
		store.resetArchive();
	});

	it("disposing a session revokes created media and rejects further reads", async () => {
		const file = await archiveFile({ "memories/local.jpg": "synthetic bytes" });
		const session = await createArchiveSession([file]);
		const revoke = vi.spyOn(URL, "revokeObjectURL");
		const url = await session.reader.readMediaBlob("memories/local.jpg");
		session.reader.dispose(); session.reader.dispose();
		expect(revoke).toHaveBeenCalledWith(url);
		await expect(session.reader.readMediaBlob("memories/local.jpg")).rejects.toMatchObject({ name: "AbortError" });
		revoke.mockRestore();
	});

	it("enforces configured entry and decompression limits against actual output", async () => {
		const file = await archiveFile({ "a.txt": "abcdefghij", "b.txt": "klmnopqrst" });
		await expect(buildSnapZipIndex([{ id: "one", file }], { limits: { maxEntries: 1 } })).rejects.toMatchObject({ limit: "maxEntries" });
		await expect(buildSnapZipIndex([{ id: "one", file }], { limits: { maxEntryBytes: 5 } })).rejects.toMatchObject({ limit: "maxEntryBytes" });
		await expect(buildSnapZipIndex([{ id: "one", file }], { limits: { maxTotalBytes: 15 } })).rejects.toMatchObject({ limit: "maxTotalBytes" });
		const index = await buildSnapZipIndex([{ id: "one", file }]);
		const target = index.entries.find((entry) => entry.id.path === "a.txt")!;
		target.uncompressedSize = 1;
		await expect(readSnapZipEntryContent(index, target.id, { maxBytes: 3 })).rejects.toMatchObject({ limit: "maxReadBytes" });
	});

	it("rejects unsafe paths and cancellation before starting a ZIP read", async () => {
		const file = await archiveFile({ "../unsafe.txt": "data" });
		await expect(buildSnapZipIndex([{ id: "unsafe", file }])).rejects.toThrow("unsafe file path");
		const controller = new AbortController(); controller.abort();
		await expect(buildSnapZipIndex([{ id: "one", file }], { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
	});
});
