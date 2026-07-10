import { z } from "zod";

const userRowSchema = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string(),
	image: z.string().nullable(),
	background_info: z.string().nullable(),
	created_at: z.number().int(),
	updated_at: z.number().int(),
});

function mapUser(row: unknown) {
	const value = userRowSchema.parse(row);
	return {
		id: value.id,
		name: value.name,
		email: value.email,
		image: value.image,
		backgroundInfo: value.background_info,
		createdAt: new Date(value.created_at),
		updatedAt: new Date(value.updated_at),
	};
}

export function createUserRepository(database: D1Database) {
	const get = async (userId: string) => {
		const row = await database
			.prepare(
				"SELECT id, name, email, image, background_info, created_at, updated_at FROM user WHERE id = ?",
			)
			.bind(userId)
			.first();
		return row ? mapUser(row) : null;
	};

	return {
		get,
		async update(
			userId: string,
			input: {
				name: string;
				image?: string | null;
				backgroundInfo?: string | null;
			},
		) {
			const current = await get(userId);
			if (!current) return null;
			await database
				.prepare(
					"UPDATE user SET name = ?, image = ?, background_info = ?, updated_at = ? WHERE id = ?",
				)
				.bind(
					input.name,
					input.image === undefined ? current.image : input.image,
					input.backgroundInfo === undefined
						? current.backgroundInfo
						: input.backgroundInfo,
					Date.now(),
					userId,
				)
				.run();
			return get(userId);
		},
	};
}
