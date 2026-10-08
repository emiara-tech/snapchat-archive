import { expect, test } from "@playwright/test";
import { BlobWriter, TextReader, ZipWriter } from "@zip.js/zip.js";
import { makeSyntheticArchive } from "../tests/fixtures/archive";

async function makeOverLimitArchive(): Promise<Blob> {
	const writer = new ZipWriter(new BlobWriter("application/zip"), { useWebWorkers: false });
	await writer.add("json/account.json", new TextReader(JSON.stringify({
		"Basic Information": { Username: "capacity-fixture-owner" },
	})));
	await writer.add("json/chat_history.json", new TextReader(JSON.stringify({
		"capacity-fixture-thread": [{
			From: "capacity-fixture-owner",
			IsSender: true,
			Created: "2020-01-01 12:00:00 UTC",
			"Media Type": "IMAGE",
			Content: "PRIVATE-CAPACITY-CONTENT-CANARY",
			"Media IDs": Array(4097).fill("PRIVATE-CAPACITY-TOKEN-CANARY"),
		}],
	})));
	return writer.close();
}

test("a real preparation limit offers safe advice and a successful replacement ZIP import", async ({ page }) => {
	const pageErrors: string[] = [];
	page.on("pageerror", (error) => { pageErrors.push(error.message); });

	await page.goto("/import");
	await page.locator('input[type="file"]').setInputFiles({
		name: "PRIVATE-CAPACITY-FILENAME-CANARY.zip",
		mimeType: "application/zip",
		buffer: Buffer.from(await (await makeOverLimitArchive()).arrayBuffer()),
	});
	await page.getByRole("button", { name: "Open the box", exact: true }).click();

	await expect(page).toHaveURL(/\/welcome$/);
	await expect(page.getByRole("heading", { name: "Couldn't open your archive", exact: true })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Your archive is ready", exact: true })).toHaveCount(0);
	const failure = page.getByRole("alert");
	await expect(failure).toContainText("This ZIP selection exceeds the current app's local processing limit. Try a smaller ZIP selection.");
	await expect(failure).toContainText("Your original ZIP files are unchanged.");
	await expect(failure.getByRole("button", { name: "Try loading the workspace again", exact: true })).toBeVisible();
	await expect(page.locator("body")).not.toContainText("PRIVATE-CAPACITY-");
	await expect(failure).not.toContainText(/download|incomplete|damaged/i);

	await failure.getByRole("button", { name: "Choose different ZIPs", exact: true }).click();
	await expect(page).toHaveURL(/\/import$/);
	await expect(page.getByRole("alert")).toHaveCount(0);
	await page.locator('input[type="file"]').setInputFiles({
		name: "replacement-test-input.zip",
		mimeType: "application/zip",
		buffer: Buffer.from(await (await makeSyntheticArchive()).arrayBuffer()),
	});
	await page.getByRole("button", { name: "Open the box", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Your archive is ready", exact: true })).toBeVisible();
	await expect(page.getByRole("region", { name: "Current archive selection", exact: true }).getByText("8", { exact: true })).toBeVisible();
	await expect(page.getByRole("alert")).toHaveCount(0);
	await expect(page.getByRole("heading", { name: "Couldn't open your archive", exact: true })).toHaveCount(0);
	expect(pageErrors).toEqual([]);
});
