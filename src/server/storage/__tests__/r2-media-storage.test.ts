import { describe, expect, it } from "bun:test";

import { R2MediaStorage } from "../r2-media-storage";

describe("R2 media storage", () => {
	it("writes one generated key and returns its public URL", async () => {
		const writes: Array<{
			key: string;
			value: ArrayBuffer | ArrayBufferView;
			contentType?: string;
		}> = [];
		const bucket = {
			put: async (
				key: string,
				value: ArrayBuffer | ArrayBufferView,
				options: R2PutOptions,
			) => {
				writes.push({
					key,
					value,
					contentType: options.httpMetadata?.contentType,
				});
			},
		} as unknown as R2Bucket;
		const storage = new R2MediaStorage(bucket, "https://assets.example.test/");

		const result = await storage.put({
			kind: "thumbnail",
			userId: "user 1",
			projectId: "project/1",
			objectId: "object-1",
			contentType: "image/jpeg",
			body: new Uint8Array([1, 2, 3]),
		});

		expect(result).toEqual({
			key: "thumbnails/user%201/project_project%2F1/object-1.jpg",
			url: "https://assets.example.test/thumbnails/user%201/project_project%2F1/object-1.jpg",
		});
		expect(writes).toHaveLength(1);
		expect(writes[0]?.contentType).toBe("image/jpeg");
	});

	it("replaces media only after the new object is written", async () => {
		const operations: string[] = [];
		const bucket = {
			put: async (key: string) => operations.push(`put:${key}`),
			delete: async (key: string) => operations.push(`delete:${key}`),
		} as unknown as R2Bucket;
		const storage = new R2MediaStorage(bucket, "https://assets.example.test");

		await storage.replace({
			kind: "avatar",
			userId: "user-1",
			objectId: "new",
			contentType: "image/png",
			body: new Uint8Array([1]),
			previousKey: "avatars/user-1/old.png",
		});

		expect(operations).toEqual([
			"put:avatars/user-1/new.png",
			"delete:avatars/user-1/old.png",
		]);
	});
});
