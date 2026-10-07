import { expect, test } from "@playwright/test";

const signedIn = {
	available: true, account: { id: "synthetic-owner", name: "Synthetic owner", email: "owner@example.invalid" }, csrf: "synthetic-csrf",
	connection: { provider: "OpenRouter", state: "usable", limit: 5, remaining: 4, expiresAt: null,
		providerBinding: { bindingState: "known", workspaceId: "synthetic-workspace" } }, aiAvailable: false,
};

test("account callbacks explain cancellation, failure and expired funding", async ({ page }) => {
	await page.route("**/api/session", (route) => route.fulfill({ json: { ...signedIn, connection: { ...signedIn.connection, state: "expired", expiresAt: "2020-01-01T00:00:00Z" } } }));
	await page.goto("/account?result=denied");
	await expect(page.getByText(/You canceled the connection/)).toBeVisible();
	await expect(page.getByText(/Connection expired/)).toBeVisible();
	await expect(page.getByText(/Connection expiry: 2020/)).toBeVisible();
	await page.goto("/account?result=failed");
	await expect(page.getByText(/The connection could not be verified/)).toBeVisible();
	await expect(page.getByRole("link", { name: /Open an archive without an account/ })).toBeVisible();
});

test("a failed status check removes currently verified account and allowance claims", async ({ page }) => {
	let checks = 0;
	await page.route("**/api/session", (route) => {
		checks++;
		return checks === 1 ? route.fulfill({ json: signedIn }) : route.fulfill({ status: 503, json: { error: "synthetic_outage" } });
	});
	await page.goto("/account");
	await expect(page.getByRole("heading", { name: "You are signed in" })).toBeVisible();
	await expect(page.getByText(/Finite key allowance verified/)).toBeVisible();
	await page.getByRole("button", { name: "Check account status again" }).click();
	await expect(page.getByRole("alert")).toBeVisible();
	await expect(page.getByRole("heading", { name: "You are signed in" })).toHaveCount(0);
	await expect(page.getByText(/Finite key allowance verified/)).toHaveCount(0);
});

test("successful logout clears verified state even when the follow-up status check fails", async ({ page }) => {
	let checks = 0;
	await page.route("**/api/session", (route) => {
		checks++;
		return checks === 1 ? route.fulfill({ json: signedIn }) : route.fulfill({ status: 503, json: { error: "synthetic_outage" } });
	});
	await page.route("**/auth/logout", (route) => route.fulfill({ json: { signedOut: true, logoutUrl: null } }));
	await page.goto("/account");
	await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Sign out", exact: true }).click();
	await expect(page.getByRole("alert")).toBeVisible();
	await expect(page.getByRole("button", { name: "Sign out", exact: true })).toHaveCount(0);
	await expect(page.getByText(/Finite key allowance verified/)).toHaveCount(0);
});
