import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

export const authStatePath = join(
	tmpdir(),
	"livecanvas-builder-playwright-auth.json",
);

export default defineConfig({
	testDir: "./tests/e2e",
	testMatch: "**/*.e2e.ts",
	globalSetup: "./tests/e2e/global-setup.ts",
	outputDir: ".migration/private/playwright/results",
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: [["line"]],
	use: {
		baseURL: process.env.BASE_URL ?? "http://127.0.0.1:5173",
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "off",
	},
	projects: [
		{
			name: "public-desktop",
			grep: /@public/,
			use: {
				...devices["Desktop Chrome"],
				viewport: { width: 1440, height: 900 },
			},
		},
		{
			name: "authenticated-desktop",
			grep: /@auth/,
			use: {
				...devices["Desktop Chrome"],
				viewport: { width: 1440, height: 900 },
				storageState: authStatePath,
			},
		},
		{
			name: "authenticated-mobile",
			grep: /@mobile/,
			use: {
				...devices["iPhone 13"],
				browserName: "chromium",
				viewport: { width: 390, height: 844 },
				storageState: authStatePath,
			},
		},
	],
});
