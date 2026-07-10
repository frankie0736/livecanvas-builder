import { createMediaKey, publicMediaUrl } from "./media";

export class R2MediaStorage {
	constructor(
		private readonly bucket: R2Bucket,
		private readonly publicBaseUrl: string,
	) {}

	async put(input: {
		kind: "avatar" | "thumbnail";
		userId: string;
		projectId?: string;
		objectId?: string;
		contentType: string;
		body: ArrayBuffer | Uint8Array;
	}) {
		const key = createMediaKey({
			...input,
			objectId: input.objectId ?? crypto.randomUUID(),
		});
		await this.bucket.put(key, input.body, {
			httpMetadata: { contentType: input.contentType },
		});
		return { key, url: publicMediaUrl(this.publicBaseUrl, key) };
	}

	async replace(
		input: Parameters<R2MediaStorage["put"]>[0] & { previousKey?: string },
	) {
		const result = await this.put(input);
		if (input.previousKey && input.previousKey !== result.key) {
			await this.bucket.delete(input.previousKey);
		}
		return result;
	}

	async delete(key: string) {
		await this.bucket.delete(key);
	}

	get(key: string) {
		return this.bucket.get(key);
	}
}
