import { z } from "zod";

const encryptedPayloadSchema = z.object({
	version: z.literal(1),
	iv: z.string().min(1),
	ciphertext: z.string().min(1),
});

export type EncryptedTaskPayload = z.infer<typeof encryptedPayloadSchema>;

function bytesToBase64(bytes: Uint8Array) {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

function base64ToBytes(value: string) {
	const binary = atob(value);
	return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function importPayloadKey(encodedKey: string) {
	const bytes = base64ToBytes(encodedKey.trim());
	if (bytes.byteLength !== 32) {
		throw new Error("TASK_PAYLOAD_KEY must decode to 32 bytes");
	}
	return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, [
		"encrypt",
		"decrypt",
	]);
}

export async function encryptTaskPayload(
	payload: unknown,
	encodedKey: string,
	taskId: string,
) {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const key = await importPayloadKey(encodedKey);
	const ciphertext = await crypto.subtle.encrypt(
		{
			name: "AES-GCM",
			iv,
			additionalData: new TextEncoder().encode(taskId),
		},
		key,
		new TextEncoder().encode(JSON.stringify(payload)),
	);
	return JSON.stringify({
		version: 1,
		iv: bytesToBase64(iv),
		ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
	} satisfies EncryptedTaskPayload);
}

export async function decryptTaskPayload<T>(
	value: string,
	encodedKey: string,
	taskId: string,
) {
	const encrypted = encryptedPayloadSchema.parse(JSON.parse(value));
	const key = await importPayloadKey(encodedKey);
	const plaintext = await crypto.subtle.decrypt(
		{
			name: "AES-GCM",
			iv: base64ToBytes(encrypted.iv),
			additionalData: new TextEncoder().encode(taskId),
		},
		key,
		base64ToBytes(encrypted.ciphertext),
	);
	return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

export function taskLogContext(input: {
	taskId: string;
	userId?: string;
	modelId?: string;
	status?: string;
}) {
	return {
		task_id: input.taskId,
		user_id: input.userId,
		model_id: input.modelId,
		status: input.status,
	};
}
