import type { Config } from "drizzle-kit";

export default {
	schema: "./src/server/db/schema.ts",
	out: "./migrations",
	dialect: "sqlite",
} satisfies Config;
