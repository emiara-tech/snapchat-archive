import { BlobWriter, TextReader, Uint8ArrayReader, ZipWriter } from "@zip.js/zip.js";
import { readFile } from "node:fs/promises";

// Internal test inputs only. Every browser test opens this through the real ZIP importer.
export async function makeSyntheticArchive(): Promise<Blob> {
    const owner = "fixture-owner";
    const documents: Record<string, unknown> = {
        "json/account.json": { "Basic Information": { Username: owner } },
        "json/friends.json": { Friends: [{ Username: "fixture-maya", "Display Name": "Maya" }, { Username: "fixture-jules", "Display Name": "Jules" }] },
        "json/chat_history.json": {
            "fixture-maya": [
                { From: owner, IsSender: true, Created: "2013-07-12 17:15:00 UTC", "Media Type": "TEXT", Content: "we made it to the sea!! best summer ever" },
                { From: "fixture-maya", IsSender: false, Created: "2013-07-12 17:16:00 UTC", "Media Type": "IMAGE", "Media IDs": "fixture-coast" },
                { From: owner, IsSender: true, Created: "2013-07-12 17:17:00 UTC", "Media Type": "TEXT", Content: "remember this exact moment 🌊" },
                { From: owner, IsSender: true, Created: "2016-10-03 21:00:00 UTC", "Media Type": "TEXT", Content: "new city, same terrible jokes. coffee tomorrow?" },
                { From: "fixture-maya", IsSender: false, Created: "2016-10-03 21:01:00 UTC", "Media Type": "TEXT", Content: "obviously. bring the camera" },
            ],
            "fixture-night-crew": [
                { From: "fixture-jules", IsSender: false, "Conversation Title": "Night crew", Created: "2020-02-20 23:10:00 UTC", "Media Type": "IMAGE", "Media IDs": "fixture-city" },
                { From: owner, IsSender: true, "Conversation Title": "Night crew", Created: "2020-02-20 23:11:00 UTC", "Media Type": "TEXT", Content: "one more walk home. the city looks unreal tonight ✨" },
                { From: "fixture-maya", IsSender: false, "Conversation Title": "Night crew", Created: "2020-02-20 23:12:00 UTC", "Media Type": "TEXT", Content: "save this one" },
            ],
        },
        "json/memories_history.json": { "Saved Media": [
            { Date: "2013-07-12 17:16:00 UTC", "Media Type": "Image", "Download Link": "https://example.invalid/?mid=fixture-coast" },
            { Date: "2020-02-20 23:10:00 UTC", "Media Type": "Image", "Download Link": "https://example.invalid/?mid=fixture-city" },
            { Date: "2016-10-03 10:30:00 UTC", "Media Type": "Image", "Download Link": "https://example.invalid/?mid=fixture-coffee" },
        ] },
    };
    const writer = new ZipWriter(new BlobWriter("application/zip"), { useWebWorkers: false });
    for (const [path, record] of Object.entries(documents)) await writer.add(path, new TextReader(JSON.stringify(record)));
    const image = new Uint8Array(await readFile(new URL("./pixel.jpg", import.meta.url)));
    for (const path of ["memories/2013-07-12_fixture-coast-main.jpg", "memories/2020-02-20_fixture-city-main.jpg", "memories/2016-10-03_fixture-coffee-main.jpg"]) await writer.add(path, new Uint8ArrayReader(image));
    return writer.close();
}
