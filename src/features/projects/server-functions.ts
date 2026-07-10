import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { createProjectRepository } from "@/server/repositories/project-repository";
import { createUserRepository } from "@/server/repositories/user-repository";
import { R2MediaStorage } from "@/server/storage/r2-media-storage";

async function ownedRepositories() {
	const [{ env }, { getRequestHeaders }, { requireSession }] =
		await Promise.all([
			import("cloudflare:workers"),
			import("@tanstack/react-start/server"),
			import("@/server/auth"),
		]);
	const session = await requireSession(getRequestHeaders());
	return {
		userId: session.user.id,
		projects: createProjectRepository(env.DB),
		users: createUserRepository(env.DB),
		workerEnv: env,
	};
}

const projectIdSchema = z.object({ projectId: z.string().trim().min(1) });

export const getGalleryData = createServerFn({ method: "GET" })
	.validator(
		z.object({
			page: z.number().int().min(1).default(1),
			pageSize: z.number().int().min(1).max(48).default(12),
			tags: z.array(z.string().trim().min(1)).max(20).default([]),
		}),
	)
	.handler(async ({ data }) => {
		const { userId, projects } = await ownedRepositories();
		const [{ projects: rows, totalCount }, allAvailableTags] =
			await Promise.all([
				projects.listPublishedProjects({
					limit: data.pageSize,
					offset: (data.page - 1) * data.pageSize,
					tags: data.tags,
				}),
				projects.listPublishedTags(),
			]);
		const interactions = Object.fromEntries(
			await Promise.all(
				rows.map(async ({ id }) => {
					const state = await projects.getInteractions(userId, id);
					return [
						id,
						{
							hasPurchased: state.purchased,
							hasFavorited: state.favorited,
						},
					] as const;
				}),
			),
		);
		const totalPages = Math.ceil(totalCount / data.pageSize);
		return {
			projects: rows,
			interactions,
			allAvailableTags,
			userId,
			pagination: {
				page: data.page,
				pageSize: data.pageSize,
				totalCount,
				totalPages,
				hasNextPage: data.page < totalPages,
				hasPrevPage: data.page > 1,
			},
		};
	});

export const togglePurchase = createServerFn({ method: "POST" })
	.validator(projectIdSchema)
	.handler(async ({ data }) => {
		const { userId, projects } = await ownedRepositories();
		return projects.togglePurchase(userId, data.projectId);
	});

export const toggleFavorite = createServerFn({ method: "POST" })
	.validator(projectIdSchema)
	.handler(async ({ data }) => {
		const { userId, projects } = await ownedRepositories();
		return projects.toggleFavorite(userId, data.projectId);
	});

export const getOwnedProjects = createServerFn({ method: "GET" }).handler(
	async () => {
		const { userId, projects } = await ownedRepositories();
		return { userId, projects: await projects.listOwnedProjects(userId) };
	},
);

export const getFavoriteProjects = createServerFn({ method: "GET" }).handler(
	async () => {
		const { userId, projects } = await ownedRepositories();
		return projects.listFavoriteProjects(userId);
	},
);

export const deleteOwnedProject = createServerFn({ method: "POST" })
	.validator(projectIdSchema)
	.handler(async ({ data }) => {
		const { userId, projects } = await ownedRepositories();
		const deleted = await projects.deleteOwnedProject(userId, data.projectId);
		return deleted
			? { success: true as const }
			: { success: false as const, error: "项目未找到或你没有权限删除它" };
	});

export const updateOwnedProject = createServerFn({ method: "POST" })
	.validator(
		projectIdSchema.extend({
			title: z.string().trim().min(1).optional(),
			description: z.string().nullable().optional(),
			tags: z.string().nullable().optional(),
			isPublished: z.boolean().optional(),
		}),
	)
	.handler(async ({ data }) => {
		const { userId, projects } = await ownedRepositories();
		const updated = await projects.updateOwnedProject(
			userId,
			data.projectId,
			data,
		);
		return updated
			? { success: true as const, data: updated }
			: { success: false as const, error: "项目未找到或你没有权限更新它" };
	});

export const createProject = createServerFn({ method: "POST" })
	.validator(
		z.object({
			projectId: z.string().trim().min(1).optional(),
			title: z.string().trim().min(1),
			description: z.string().optional(),
			htmlContent: z.string().min(1),
			thumbnail: z.string().optional(),
			tags: z.string().optional(),
			isPublished: z.boolean(),
		}),
	)
	.handler(async ({ data }) => {
		const { userId, projects } = await ownedRepositories();
		const project = await projects.createProject(userId, {
			...data,
			id: data.projectId,
		});
		return {
			success: true as const,
			data: project,
			redirect: data.isPublished ? "/gallery" : undefined,
		};
	});

export const getProfile = createServerFn({ method: "GET" }).handler(
	async () => {
		const { userId, users } = await ownedRepositories();
		return users.get(userId);
	},
);

export const updateProfile = createServerFn({ method: "POST" })
	.validator(
		z.object({
			name: z.string().trim().min(1),
			image: z.string().nullable().optional(),
			backgroundInfo: z.string().nullable().optional(),
		}),
	)
	.handler(async ({ data }) => {
		const { userId, users } = await ownedRepositories();
		const user = await users.update(userId, data);
		return user
			? { success: true as const, message: "Updated successfully", user }
			: { success: false as const, error: "Failed to update user" };
	});

export const uploadMedia = createServerFn({ method: "POST" })
	.validator(
		z.object({
			kind: z.enum(["avatar", "thumbnail"]),
			dataUrl: z.string().startsWith("data:"),
			fileName: z.string().trim().min(1).max(255),
			projectId: z.string().optional(),
		}),
	)
	.handler(async ({ data }) => {
		const { userId, workerEnv } = await ownedRepositories();
		const match = /^data:([^;,]+);base64,(.+)$/.exec(data.dataUrl);
		if (!match?.[1] || !match[2]) throw new Error("Invalid media payload");
		const binary = atob(match[2]);
		const bytes = Uint8Array.from(binary, (character) =>
			character.charCodeAt(0),
		);
		const storage = new R2MediaStorage(workerEnv.ASSETS, "/api/media");
		const stored = await storage.put({
			kind: data.kind,
			userId,
			projectId: data.projectId,
			contentType: match[1],
			body: bytes,
		});
		return stored.url;
	});
