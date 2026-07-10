import type { TargetData } from "./transform";

type SqlValue = string | number | null;

export const targetColumns: Record<keyof TargetData, string[]> = {
	user: [
		"id",
		"name",
		"email",
		"email_verified",
		"image",
		"background_info",
		"created_at",
		"updated_at",
	],
	account: [
		"id",
		"account_id",
		"provider_id",
		"user_id",
		"access_token",
		"refresh_token",
		"id_token",
		"access_token_expires_at",
		"refresh_token_expires_at",
		"scope",
		"password",
		"created_at",
		"updated_at",
	],
	project: [
		"id",
		"title",
		"description",
		"html_content",
		"thumbnail",
		"tags",
		"purchase_count",
		"is_published",
		"user_id",
		"created_at",
		"updated_at",
	],
	purchase: ["id", "project_id", "user_id", "amount", "created_at"],
	favorite: ["id", "project_id", "user_id", "created_at"],
};

function sqlLiteral(value: SqlValue) {
	if (value === null) return "NULL";
	if (typeof value === "number") {
		if (!Number.isSafeInteger(value)) throw new Error("Unsafe SQL integer");
		return String(value);
	}
	return `CAST(X'${Buffer.from(value, "utf8").toString("hex")}' AS TEXT)`;
}

function insertRows(
	table: keyof TargetData,
	rows: Array<Record<string, SqlValue>>,
) {
	if (rows.length === 0) return "";
	const columns = targetColumns[table];
	return rows
		.map(
			(row) =>
				`INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns
					.map((column) => sqlLiteral(row[column] ?? null))
					.join(",")});`,
		)
		.join("\n");
}

export function createImportSql(data: TargetData) {
	const deleteOrder: Array<
		keyof TargetData | "session" | "verification" | "generation_task"
	> = [
		"generation_task",
		"session",
		"verification",
		"favorite",
		"purchase",
		"project",
		"account",
		"user",
	];
	const insertOrder: Array<keyof TargetData> = [
		"user",
		"account",
		"project",
		"purchase",
		"favorite",
	];

	return [
		"PRAGMA foreign_keys = ON;",
		...deleteOrder.map((table) => `DELETE FROM ${table};`),
		...insertOrder.map((table) =>
			insertRows(table, data[table] as Array<Record<string, SqlValue>>),
		),
		"PRAGMA foreign_key_check;",
	]
		.filter(Boolean)
		.join("\n");
}
