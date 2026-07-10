import { LNL_GUIDE } from "@/app/api/chat/lnl-guide";
import { generateACFFieldsTool } from "@/app/api/chat/tools/acf";
import { fetchAihubmixModelCatalog } from "@/lib/aihubmix";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createFileRoute } from "@tanstack/react-router";
import { streamText } from "ai";
import { z } from "zod";

const chatBodySchema = z.object({
	messages: z.array(z.unknown()),
	apiKey: z.string().trim().min(1),
});

export const Route = createFileRoute("/api/chat")({
	server: { handlers: { POST: chatHandler } },
});

async function chatHandler({ request }: { request: Request }) {
	try {
		const { requireSession } = await import("@/server/auth");
		await requireSession(request.headers);
	} catch {
		return Response.json({ error: "请先登录" }, { status: 401 });
	}

	const parsed = chatBodySchema.safeParse(
		await request.json().catch(() => null),
	);
	if (!parsed.success) {
		return Response.json({ error: "请先填写API密钥" }, { status: 400 });
	}
	const catalog = await fetchAihubmixModelCatalog(parsed.data.apiKey).catch(
		() => null,
	);
	const modelId = catalog?.models.find(
		({ vendor }) => vendor === "anthropic",
	)?.id;
	if (!modelId) {
		return Response.json({ error: "AI服务暂时不可用" }, { status: 502 });
	}
	const anthropic = createAnthropic({
		apiKey: parsed.data.apiKey,
		baseURL: "https://aihubmix.com/v1",
	});
	try {
		const result = streamText({
			model: anthropic(modelId),
			messages: parsed.data.messages as Parameters<
				typeof streamText
			>[0]["messages"],
			tools: { generateACFFields: generateACFFieldsTool },
			maxSteps: 10,
			system: `
			你是一位WordPress开发专家，专门从事高级自定义字段(ACF)和Tangible Loop & Logic (LNL)开发。
			请使用'generateACFFields'工具帮助用户设计自定义ACF字段组，并生成相应的LNL代码。
			你的任务是输出 3 份代码：
			1. ACF 字段组；
			2. 极简的详情页模板(尽可能展示所有字段)
			3. 极简的归档页模板(设计前要询问用户希望在归档页展示哪些字段)
			下面是 LNL 的指南：
			${LNL_GUIDE}
			`,
		});
		return result.toDataStreamResponse();
	} catch (error) {
		console.error({
			event: "chat_generation_failed",
			error_name: error instanceof Error ? error.name : "UnknownError",
		});
		return Response.json({ error: "AI服务调用失败" }, { status: 500 });
	}
}
