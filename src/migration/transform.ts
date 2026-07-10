import { createHash } from "node:crypto";
import { z } from "zod";

const dateSchema = z
	.union([z.date(), z.string().datetime({ offset: true })])
	.transform((value) => new Date(value).getTime());
const nullableDateSchema = z
	.union([z.date(), z.string().datetime({ offset: true })])
	.nullable()
	.transform((value) => (value === null ? null : new Date(value).getTime()));

const userSchema = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string(),
	emailVerified: nullableDateSchema,
	image: z.string().nullable(),
	backgroundInfo: z.string().nullable(),
	createdAt: dateSchema,
	updatedAt: dateSchema,
});

const accountSchema = z.object({
	id: z.string(),
	userId: z.string(),
	provider: z.string(),
	providerAccountId: z.string(),
	refresh_token: z.string().nullable(),
	access_token: z.string().nullable(),
	expires_at: z.number().int().nullable(),
	scope: z.string().nullable(),
	id_token: z.string().nullable(),
	createdAt: dateSchema,
	updatedAt: dateSchema,
});

const projectSchema = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string().nullable(),
	htmlContent: z.string(),
	thumbnail: z.string().nullable(),
	tags: z.string().nullable(),
	purchaseCount: z.number().int(),
	isPublished: z.boolean(),
	userId: z.string(),
	createdAt: dateSchema,
	updatedAt: dateSchema,
});

const purchaseSchema = z.object({
	id: z.string(),
	projectId: z.string(),
	userId: z.string(),
	amount: z.number().int(),
	createdAt: dateSchema,
});

const favoriteSchema = z.object({
	id: z.string(),
	projectId: z.string(),
	userId: z.string(),
	createdAt: dateSchema,
});

export const sourceSnapshotSchema = z.object({
	user: z.array(userSchema),
	account: z.array(accountSchema),
	session: z.array(z.record(z.unknown())),
	project: z.array(projectSchema),
	purchase: z.array(purchaseSchema),
	favorite: z.array(favoriteSchema),
});

export type SourceSnapshot = z.input<typeof sourceSnapshotSchema>;
export type TargetData = ReturnType<typeof transformSnapshot>;

function byId<T extends { id: string }>(left: T, right: T) {
	if (left.id < right.id) return -1;
	if (left.id > right.id) return 1;
	return 0;
}

export function transformSnapshot(input: SourceSnapshot) {
	const source = sourceSnapshotSchema.parse(input);

	return {
		user: source.user
			.map((row) => ({
				id: row.id,
				name: row.name,
				email: row.email,
				email_verified: row.emailVerified === null ? 0 : 1,
				image: row.image,
				background_info: row.backgroundInfo,
				created_at: row.createdAt,
				updated_at: row.updatedAt,
			}))
			.sort(byId),
		account: source.account
			.map((row) => ({
				id: row.id,
				account_id: row.providerAccountId,
				provider_id: row.provider,
				user_id: row.userId,
				access_token: row.access_token,
				refresh_token: row.refresh_token,
				id_token: row.id_token,
				access_token_expires_at:
					row.expires_at === null ? null : row.expires_at * 1000,
				refresh_token_expires_at: null,
				scope: row.scope,
				password: null,
				created_at: row.createdAt,
				updated_at: row.updatedAt,
			}))
			.sort(byId),
		project: source.project
			.map((row) => ({
				id: row.id,
				title: row.title,
				description: row.description,
				html_content: row.htmlContent,
				thumbnail: row.thumbnail,
				tags: row.tags ?? "",
				purchase_count: row.purchaseCount,
				is_published: row.isPublished ? 1 : 0,
				user_id: row.userId,
				created_at: row.createdAt,
				updated_at: row.updatedAt,
			}))
			.sort(byId),
		purchase: source.purchase
			.map((row) => ({
				id: row.id,
				project_id: row.projectId,
				user_id: row.userId,
				amount: row.amount,
				created_at: row.createdAt,
			}))
			.sort(byId),
		favorite: source.favorite
			.map((row) => ({
				id: row.id,
				project_id: row.projectId,
				user_id: row.userId,
				created_at: row.createdAt,
			}))
			.sort(byId),
	};
}

export function canonicalHash(value: unknown) {
	return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
