import { describe, expect, it } from "bun:test";

import { normalizeTaskOutput } from "../output";

describe("task output normalization", () => {
	it("stores renderable icons and image URLs as the canonical completed output", () => {
		const output = normalizeTaskOutput({
			code: '<i class="lucide-arrow-right"></i><img src="/images/placeholder/business.jpg">',
			advices: ["Keep spacing consistent"],
		});

		expect(output.code).toContain("<svg");
		expect(output.code).not.toContain('<i class="lucide-arrow-right"></i>');
		expect(output.code).toContain("https://images.unsplash.com/");
		expect(output.code).not.toContain("/images/placeholder/");
		expect(output.advices).toEqual(["Keep spacing consistent"]);
	});
});
