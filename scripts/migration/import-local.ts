import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { createImportSql } from "../../src/migration/sql";
import { transformSnapshot } from "../../src/migration/transform";
import { runQuiet, sourceTables } from "./shared";

const { values } = parseArgs({
	options: { input: { type: "string" } },
	strict: true,
});
if (!values.input) throw new Error("import-local requires --input");

await mkdir(values.input, { recursive: true, mode: 0o700 });
const source = {} as Record<string, unknown>;
for (const logicalName of Object.keys(sourceTables)) {
	source[logicalName] = JSON.parse(
		await readFile(join(values.input, `${logicalName}.json`), "utf8"),
	);
}
const target = transformSnapshot(source as never);
const importPath = join(values.input, "d1-import.sql");
await writeFile(importPath, createImportSql(target), { mode: 0o600 });

await runQuiet(
	["bunx", "wrangler", "d1", "migrations", "apply", "DB", "--local"],
	{
		label: "local D1 migration",
		diagnosticPath: join(values.input, "wrangler-migrate"),
	},
);
await runQuiet(
	[
		"bunx",
		"wrangler",
		"d1",
		"execute",
		"DB",
		"--local",
		`--file=${importPath}`,
	],
	{
		label: "local D1 import",
		diagnosticPath: join(values.input, "wrangler-import"),
	},
);

console.log(
	`import ok users=${target.user.length} accounts=${target.account.length} projects=${target.project.length} purchases=${target.purchase.length} favorites=${target.favorite.length} sessions=0`,
);
