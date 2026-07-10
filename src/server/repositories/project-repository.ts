import { z } from "zod";

const listInputSchema = z.object({
	limit: z.number().int().min(1).max(100),
	offset: z.number().int().min(0),
	tags: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
});

const projectRowSchema = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string().nullable(),
	html_content: z.string(),
	thumbnail: z.string().nullable(),
	tags: z.string(),
	purchase_count: z.number().int(),
	is_published: z.union([z.literal(0), z.literal(1)]),
	user_id: z.string(),
	created_at: z.number().int(),
	updated_at: z.number().int(),
	owner_name: z.string(),
	owner_image: z.string().nullable(),
});

const projectColumns = `
	p.id,
	p.title,
	p.description,
	p.html_content,
	p.thumbnail,
	p.tags,
	p.purchase_count,
	p.is_published,
	p.user_id,
	p.created_at,
	p.updated_at,
	u.name AS owner_name,
	u.image AS owner_image
`;

function mapProject(row: unknown) {
	const value = projectRowSchema.parse(row);
	return {
		id: value.id,
		title: value.title,
		description: value.description,
		htmlContent: value.html_content,
		thumbnail: value.thumbnail,
		tags: value.tags,
		purchaseCount: value.purchase_count,
		isPublished: value.is_published === 1,
		userId: value.user_id,
		createdAt: new Date(value.created_at),
		updatedAt: new Date(value.updated_at),
		user: {
			id: value.user_id,
			name: value.owner_name,
			image: value.owner_image,
		},
	};
}

async function getInteractionState(
	database: D1Database,
	userId: string,
	projectId: string,
) {
	const row = await database
		.prepare(
			`SELECT
				EXISTS(SELECT 1 FROM purchase WHERE user_id = ? AND project_id = ?) AS purchased,
				EXISTS(SELECT 1 FROM favorite WHERE user_id = ? AND project_id = ?) AS favorited`,
		)
		.bind(userId, projectId, userId, projectId)
		.first<{ purchased: number; favorited: number }>();

	return {
		purchased: row?.purchased === 1,
		favorited: row?.favorited === 1,
	};
}

export function createProjectRepository(database: D1Database) {
	const getOwnedProject = async (userId: string, projectId: string) => {
		const row = await database
			.prepare(
				`SELECT ${projectColumns} FROM project p INNER JOIN user u ON u.id = p.user_id WHERE p.id = ? AND p.user_id = ?`,
			)
			.bind(projectId, userId)
			.first();
		return row ? mapProject(row) : null;
	};

	return {
		async listPublishedTags() {
			const rows = await database
				.prepare(
					"SELECT tags FROM project WHERE is_published = 1 AND tags != ''",
				)
				.all<{ tags: string }>();
			return [
				...new Set(
					rows.results.flatMap(({ tags }) =>
						tags
							.split(",")
							.map((tag) => tag.trim())
							.filter(Boolean),
					),
				),
			].sort();
		},

		async listPublishedProjects(input: {
			limit: number;
			offset: number;
			tags?: string[];
		}) {
			const { limit, offset, tags } = listInputSchema.parse(input);
			const tagConditions = tags.map(() => "p.tags LIKE ?").join(" AND ");
			const where = `p.is_published = 1${tagConditions ? ` AND ${tagConditions}` : ""}`;
			const tagBindings = tags.map((tag) => `%${tag}%`);
			const [projectResult, countRow] = await Promise.all([
				database
					.prepare(
						`SELECT ${projectColumns} FROM project p INNER JOIN user u ON u.id = p.user_id WHERE ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
					)
					.bind(...tagBindings, limit, offset)
					.all(),
				database
					.prepare(
						`SELECT count(*) AS total_count FROM project p WHERE ${where}`,
					)
					.bind(...tagBindings)
					.first<{ total_count: number }>(),
			]);

			return {
				projects: projectResult.results.map(mapProject),
				totalCount: countRow?.total_count ?? 0,
			};
		},

		async listOwnedProjects(userId: string) {
			const result = await database
				.prepare(
					`SELECT ${projectColumns} FROM project p INNER JOIN user u ON u.id = p.user_id WHERE p.user_id = ? ORDER BY p.created_at DESC`,
				)
				.bind(userId)
				.all();
			return result.results.map(mapProject);
		},

		async listFavoriteProjects(userId: string) {
			const result = await database
				.prepare(
					`SELECT ${projectColumns} FROM favorite f INNER JOIN project p ON p.id = f.project_id INNER JOIN user u ON u.id = p.user_id WHERE f.user_id = ? ORDER BY f.created_at DESC`,
				)
				.bind(userId)
				.all();
			return result.results.map(mapProject);
		},

		getOwnedProject,

		async createProject(
			userId: string,
			input: {
				id?: string;
				title: string;
				description?: string;
				htmlContent: string;
				thumbnail?: string;
				tags?: string;
				isPublished: boolean;
			},
		) {
			const id = input.id ?? crypto.randomUUID();
			const now = Date.now();
			await database
				.prepare(
					`INSERT INTO project
					 (id, title, description, html_content, thumbnail, tags, purchase_count, is_published, user_id, created_at, updated_at)
					 VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
				)
				.bind(
					id,
					input.title,
					input.description ?? "",
					input.htmlContent,
					input.thumbnail ?? "",
					input.tags ?? "",
					input.isPublished ? 1 : 0,
					userId,
					now,
					now,
				)
				.run();
			return getOwnedProject(userId, id);
		},

		async updateOwnedProject(
			userId: string,
			projectId: string,
			input: {
				title?: string;
				description?: string | null;
				tags?: string | null;
				isPublished?: boolean;
			},
		) {
			const current = await getOwnedProject(userId, projectId);
			if (!current) return null;
			await database
				.prepare(
					`UPDATE project SET title = ?, description = ?, tags = ?, is_published = ?, updated_at = ?
					 WHERE id = ? AND user_id = ?`,
				)
				.bind(
					input.title ?? current.title,
					input.description ?? current.description ?? "",
					input.tags ?? current.tags,
					(input.isPublished ?? current.isPublished) ? 1 : 0,
					Date.now(),
					projectId,
					userId,
				)
				.run();
			return getOwnedProject(userId, projectId);
		},

		async deleteOwnedProject(userId: string, projectId: string) {
			const current = await getOwnedProject(userId, projectId);
			if (!current) return null;
			await database
				.prepare("DELETE FROM project WHERE id = ? AND user_id = ?")
				.bind(projectId, userId)
				.run();
			return current;
		},

		async getInteractions(userId: string, projectId: string) {
			return getInteractionState(database, userId, projectId);
		},

		async togglePurchase(userId: string, projectId: string) {
			const current = await getInteractionState(database, userId, projectId);

			if (current.purchased) {
				await database.batch([
					database
						.prepare(
							`UPDATE project SET purchase_count = max(0, purchase_count - 1), updated_at = unixepoch() * 1000
							 WHERE id = ? AND EXISTS(SELECT 1 FROM purchase WHERE user_id = ? AND project_id = ?)`,
						)
						.bind(projectId, userId, projectId),
					database
						.prepare(
							"DELETE FROM purchase WHERE user_id = ? AND project_id = ?",
						)
						.bind(userId, projectId),
				]);
			} else {
				const purchaseId = crypto.randomUUID();
				await database.batch([
					database
						.prepare(
							`INSERT OR IGNORE INTO purchase (id, project_id, user_id, amount, created_at)
							 VALUES (?, ?, ?, 0, unixepoch() * 1000)`,
						)
						.bind(purchaseId, projectId, userId),
					database
						.prepare(
							`UPDATE project SET purchase_count = purchase_count + 1, updated_at = unixepoch() * 1000
							 WHERE id = ? AND EXISTS(SELECT 1 FROM purchase WHERE id = ?)`,
						)
						.bind(projectId, purchaseId),
				]);
			}

			const state = await getInteractionState(database, userId, projectId);
			return { purchased: state.purchased };
		},

		async toggleFavorite(userId: string, projectId: string) {
			const current = await getInteractionState(database, userId, projectId);

			if (current.favorited) {
				await database
					.prepare("DELETE FROM favorite WHERE user_id = ? AND project_id = ?")
					.bind(userId, projectId)
					.run();
			} else {
				await database
					.prepare(
						`INSERT OR IGNORE INTO favorite (id, project_id, user_id, created_at)
						 VALUES (?, ?, ?, unixepoch() * 1000)`,
					)
					.bind(crypto.randomUUID(), projectId, userId)
					.run();
			}

			const state = await getInteractionState(database, userId, projectId);
			return { favorited: state.favorited };
		},
	};
}
