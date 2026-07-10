import { describe, expect, it } from "bun:test";

import {
	canonicalMediaUrl,
	collectOwnedMediaReferences,
	createMediaKey,
	inferMediaType,
	legacyR2Key,
	ownedMediaSource,
} from "../../server/storage/media";

describe("media migration algebra", () => {
	it("maps owned URLs to deterministic non-overlapping R2 keys", () => {
		expect(
			legacyR2Key(
				"https://store.public.blob.vercel-storage.com/avatars/user/avatar.png?download=1",
			),
		).toBe("legacy/vercel/avatars/user/avatar.png");
		expect(legacyR2Key("https://zone.b-cdn.net/images/hero.webp")).toBe(
			"legacy/bunny/zone.b-cdn.net/images/hero.webp",
		);
	});

	it("deduplicates owned database references and leaves providers external", () => {
		const references = collectOwnedMediaReferences(
			[
				{
					image: "https://store.public.blob.vercel-storage.com/avatar.png?x=1",
				},
				{
					image: "https://store.public.blob.vercel-storage.com/avatar.png?x=2",
				},
				{ image: "https://lh3.googleusercontent.com/avatar" },
			],
			[{ thumbnail: "https://zone.b-cdn.net/project.jpg" }],
		);

		expect(references.size).toBe(2);
		expect(
			references.get(
				canonicalMediaUrl(
					"https://store.public.blob.vercel-storage.com/avatar.png",
				),
			),
		).toBe("vercel");
		expect(
			ownedMediaSource("https://images.unsplash.com/photo.jpg"),
		).toBeNull();
	});

	it("uses one key generator and one MIME mapping for new media", () => {
		expect(inferMediaType("image.jpeg", "image/jpeg; charset=binary")).toBe(
			"image/jpeg",
		);
		expect(inferMediaType("image.webp")).toBe("image/webp");
		expect(
			createMediaKey({
				kind: "avatar",
				userId: "user-1",
				objectId: "object-1",
				contentType: "image/png",
			}),
		).toBe("avatars/user-1/object-1.png");
	});
});
