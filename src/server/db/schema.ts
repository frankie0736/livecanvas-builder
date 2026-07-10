import { relations, sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
	integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`);

const updatedAt = () =>
	integer("updated_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`)
		.$onUpdate(() => new Date());

export const user = sqliteTable("user", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: integer("email_verified", { mode: "boolean" })
		.notNull()
		.default(false),
	image: text("image"),
	backgroundInfo: text("background_info"),
	createdAt: createdAt(),
	updatedAt: updatedAt(),
});

export const session = sqliteTable(
	"session",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		token: text("token").notNull().unique(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = sqliteTable(
	"account",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: integer("access_token_expires_at", {
			mode: "timestamp_ms",
		}),
		refreshTokenExpiresAt: integer("refresh_token_expires_at", {
			mode: "timestamp_ms",
		}),
		scope: text("scope"),
		password: text("password"),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [
		index("account_user_id_idx").on(table.userId),
		uniqueIndex("account_provider_account_idx").on(
			table.providerId,
			table.accountId,
		),
	],
);

export const verification = sqliteTable(
	"verification",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [
		uniqueIndex("verification_identifier_value_idx").on(
			table.identifier,
			table.value,
		),
	],
);

export const project = sqliteTable(
	"project",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		title: text("title").notNull(),
		description: text("description"),
		htmlContent: text("html_content").notNull(),
		thumbnail: text("thumbnail"),
		tags: text("tags").notNull().default(""),
		purchaseCount: integer("purchase_count").notNull().default(0),
		isPublished: integer("is_published", { mode: "boolean" })
			.notNull()
			.default(false),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [
		index("project_user_id_idx").on(table.userId),
		index("project_title_idx").on(table.title),
		index("project_published_created_idx").on(
			table.isPublished,
			table.createdAt,
		),
	],
);

export const purchase = sqliteTable(
	"purchase",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		amount: integer("amount").notNull().default(0),
		createdAt: createdAt(),
	},
	(table) => [
		index("purchase_project_id_idx").on(table.projectId),
		index("purchase_user_id_idx").on(table.userId),
		uniqueIndex("purchase_user_project_idx").on(table.userId, table.projectId),
	],
);

export const favorite = sqliteTable(
	"favorite",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: createdAt(),
	},
	(table) => [
		index("favorite_project_id_idx").on(table.projectId),
		index("favorite_user_id_idx").on(table.userId),
		uniqueIndex("favorite_user_project_idx").on(table.userId, table.projectId),
	],
);

export const generationTaskStatuses = [
	"PENDING",
	"RUNNING",
	"COMPLETED",
	"FAILED",
	"CANCELED",
] as const;

export type GenerationTaskStatus = (typeof generationTaskStatuses)[number];

export const generationTask = sqliteTable(
	"generation_task",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		workflowInstanceId: text("workflow_instance_id").unique(),
		status: text("status").$type<GenerationTaskStatus>().notNull(),
		model: text("model").notNull(),
		encryptedPayload: text("encrypted_payload").notNull(),
		result: text("result"),
		error: text("error"),
		usage: text("usage", { mode: "json" }).$type<Record<string, number>>(),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
		completedAt: integer("completed_at", { mode: "timestamp_ms" }),
	},
	(table) => [
		index("generation_task_user_created_idx").on(table.userId, table.createdAt),
		check(
			"generation_task_state_data_check",
			sql`(
				(${table.status} IN ('PENDING', 'RUNNING') AND ${table.result} IS NULL AND ${table.error} IS NULL AND ${table.completedAt} IS NULL)
				OR (${table.status} = 'COMPLETED' AND ${table.result} IS NOT NULL AND ${table.error} IS NULL AND ${table.completedAt} IS NOT NULL)
				OR (${table.status} = 'FAILED' AND ${table.result} IS NULL AND ${table.error} IS NOT NULL AND ${table.completedAt} IS NOT NULL)
				OR (${table.status} = 'CANCELED' AND ${table.result} IS NULL AND ${table.completedAt} IS NOT NULL)
			)`,
		),
	],
);

export const userRelations = relations(user, ({ many }) => ({
	accounts: many(account),
	sessions: many(session),
	projects: many(project),
	purchases: many(purchase),
	favorites: many(favorite),
	generationTasks: many(generationTask),
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const projectRelations = relations(project, ({ many, one }) => ({
	user: one(user, { fields: [project.userId], references: [user.id] }),
	purchases: many(purchase),
	favorites: many(favorite),
}));

export const purchaseRelations = relations(purchase, ({ one }) => ({
	project: one(project, {
		fields: [purchase.projectId],
		references: [project.id],
	}),
	user: one(user, { fields: [purchase.userId], references: [user.id] }),
}));

export const favoriteRelations = relations(favorite, ({ one }) => ({
	project: one(project, {
		fields: [favorite.projectId],
		references: [project.id],
	}),
	user: one(user, { fields: [favorite.userId], references: [user.id] }),
}));

export const generationTaskRelations = relations(generationTask, ({ one }) => ({
	user: one(user, {
		fields: [generationTask.userId],
		references: [user.id],
	}),
}));
