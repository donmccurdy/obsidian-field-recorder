import { SUPPORTED_EXTENSIONS } from "./constants";

export function getFileExtension(mimeType: string) {
	const match = mimeType.match(/^audio\/(\w+).*/);
	if (match && SUPPORTED_EXTENSIONS[match[1]!]) {
		return SUPPORTED_EXTENSIONS[match[1]!];
	}
	throw new Error(`Unsupported mimeType: "${mimeType}"`);
}

export function getTimestamp() {
	const date = new Date();
	let timestamp = "";
	timestamp += date.getFullYear();
	timestamp += String(date.getMonth() + 1).padStart(2, "0");
	timestamp += String(date.getDate()).padStart(2, "0");
	timestamp += String(date.getHours()).padStart(2, "0");
	timestamp += String(date.getMinutes()).padStart(2, "0");
	timestamp += String(date.getSeconds()).padStart(2, "0");
	return timestamp;
}

export function concat(chunks: ArrayBuffer[]) {
	let byteLength = 0;
	for (const chunk of chunks) {
		byteLength += chunk.byteLength;
	}

	const data = new ArrayBuffer(byteLength);
	const bytes = new Uint8Array(data);

	let byteOffset = 0;
	for (const chunk of chunks) {
		bytes.set(new Uint8Array(chunk), byteOffset);
		byteOffset += chunk.byteLength;
	}
	return data;
}
