import { expect, test } from "@playwright/test";
import { monitorPage } from "./monitor";

test("@public keeps public pages and protected redirects", async ({ page }) => {
	const errors = monitorPage(page);
	await page.goto("/");
	await expect(
		page.getByRole("heading", {
			name: "利用 AI 构建精美的 Tailwind CSS 网页组件",
		}),
	).toBeVisible();
	await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 1440);

	await page.goto("/signin");
	await expect(page.getByText("欢迎回来", { exact: true })).toBeVisible();
	await expect(
		page.getByRole("button", { name: /使用 Google 登录/ }),
	).toBeVisible();

	await page.goto("/dashboard");
	await expect(page).toHaveURL(/\/signin/);
	expect(errors).toEqual([]);
});
