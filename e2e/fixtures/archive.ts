import { expect, type Page } from "@playwright/test";
import { makeSyntheticArchive } from "../../tests/fixtures/archive";

export async function importSyntheticArchive(page: Page, destination = "/welcome") {
    await page.goto("/import");
    await page.locator('input[type="file"]').setInputFiles({ name: "synthetic-test-input.zip", mimeType: "application/zip", buffer: Buffer.from(await (await makeSyntheticArchive()).arrayBuffer()) });
    await page.getByRole("button", { name: "Open the box", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Your archive is ready", exact: true })).toBeVisible();
    const rooms: Record<string, string> = { "/welcome": "Overview", "/conversations": "Conversations", "/library": "Library", "/observatory": "Observatory", "/year-room": "Past self", "/assistant": "Guide", "/export": "Export" };
    if (destination !== "/welcome") {
        const label = rooms[destination];
        if (!label) throw new Error("Unsupported internal test destination");
        await page.getByRole("navigation", { name: "Main navigation", exact: true }).getByRole("link", { name: label, exact: true }).click();
        await expect(page).toHaveURL(new RegExp(destination + "(?:\\?|$)"));
    }
}
