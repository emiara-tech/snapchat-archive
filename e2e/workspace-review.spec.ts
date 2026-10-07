import { expect, test } from "@playwright/test";
import { importSyntheticArchive } from "./fixtures/archive";

test("excluding an inspected message clears its private evidence everywhere", async ({ page }) => {
	await importSyntheticArchive(page, "/conversations");
	await expect(page).toHaveURL(/\/conversations$/);
	await page.locator(".conversation-button").filter({ hasText: "fixture-maya" }).click();
	const message = page.locator(".message").filter({ hasText: "we made it to the sea!! best summer ever" });
	await message.getByRole("button", { name: "Source", exact: true }).click();
	await expect(page.locator(".source-panel")).toBeVisible();
	await page.locator(".source-panel").getByText("Original fields", { exact: true }).click();
	await expect(page.locator(".source-panel pre")).toContainText("we made it to the sea");
	await message.getByRole("button", { name: "Exclude", exact: true }).click();
	await expect(page.locator(".source-panel")).toHaveCount(0);
	await expect(page.getByText("we made it to the sea!! best summer ever", { exact: true })).toHaveCount(0);
});

test("conversation and library dialogs contain keyboard focus and restore it", async ({ page }) => {
	await importSyntheticArchive(page, "/conversations");
	await expect(page).toHaveURL(/\/conversations$/);
	const mediaTrigger = page.locator(".inline-media").first();
	await mediaTrigger.click();
	const conversationDialog = page.getByRole("dialog", { name: "Media in conversation" });
	await expect(conversationDialog.getByRole("button", { name: "Close", exact: true })).toBeFocused();
	await page.keyboard.press("Tab");
	await expect(conversationDialog.getByRole("button", { name: "Close", exact: true })).toBeFocused();
	await page.keyboard.press("Escape");
	await expect(conversationDialog).toHaveCount(0);
	await expect(mediaTrigger).toBeFocused();
	await page.getByRole("link", { name: "Library", exact: true }).click();
	const memoryTrigger = page.locator(".open-asset").first();
	await memoryTrigger.click();
	const libraryDialog = page.getByRole("dialog", { name: "Memory and its context" });
	await expect(libraryDialog.getByRole("button", { name: "Close", exact: true })).toBeFocused();
	await page.keyboard.press("Shift+Tab");
	await expect(libraryDialog.getByRole("button", { name: "Exclude", exact: true })).toBeFocused();
	await page.keyboard.press("Tab");
	await expect(libraryDialog.getByRole("button", { name: "Close", exact: true })).toBeFocused();
	await page.keyboard.press("Escape");
	await expect(libraryDialog).toHaveCount(0);
	await expect(memoryTrigger).toBeFocused();
});

test("a bulk review preview traps focus and needs a direct apply", async ({ page }) => {
	await importSyntheticArchive(page, "/conversations");
	await page.getByRole("link", { name: "Library", exact: true }).click();
	await page.locator(".memory-card").first().getByRole("checkbox").check();
	const previewTrigger = page.getByRole("button", { name: "Exclude selected", exact: true });
	await previewTrigger.click();
	const dialog = page.getByRole("dialog", { name: "Review decision preview" });
	await expect(dialog.getByRole("button", { name: "Apply exclude", exact: true })).toBeFocused();
	await page.keyboard.press("Shift+Tab");
	await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
	await page.keyboard.press("Escape");
	await expect(dialog).toHaveCount(0);
	await expect(previewTrigger).toBeFocused();
	await expect(page.locator(".memory-card")).toHaveCount(3);
});
