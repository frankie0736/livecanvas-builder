import { PROMPT } from "./prompt";

export function buildContextualPrompt(input: {
	prompt: string;
	backgroundInfo?: string;
	history?: Array<{ prompt: string; response?: string }>;
	uiTutorial?: string;
}) {
	let result = PROMPT;
	if (input.uiTutorial) {
		result += `\n\n### DaisyUI Tutorial:\n${input.uiTutorial}`;
	}
	if (input.backgroundInfo?.trim()) {
		result += `\n\n### User Context:\n${input.backgroundInfo}`;
	}
	if (input.history?.length) {
		result += "\n\n### Previous Dialogue Context:";
		input.history.forEach((item, index) => {
			result += `\n\nUser Request ${index + 1}: ${item.prompt}`;
			if (item.response) {
				result += `\n\nYour Response ${index + 1}: You generated the following HTML code:\n\`\`\`html\n${item.response}\n\`\`\``;
			}
		});
		result += "\n\n### Current Request:";
	}
	return `${result}\n\n **HERE IS THE COMMAND YOU NEED TO EXECUTE**: ${input.prompt}`;
}
