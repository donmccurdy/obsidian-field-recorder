import { MIME_TYPE_TO_EXTENSION, SUPPORTED_MIME_TYPES } from "./constants";

export function getFileExtension(mimeType: string) {
	const match = mimeType.match(/^(audio\/\w+).*/);
	if (match && SUPPORTED_MIME_TYPES.some((mimeType) => match[1]!.startsWith(mimeType))) {
		return MIME_TYPE_TO_EXTENSION[match[1]!];
	}
	throw new Error(`Unsupported mimeType: "${mimeType}"`);
}

export function getDefaultFilename() {
	const date = new Date();
	const yyyy = date.getFullYear();
	const mm = String(date.getMonth() + 1).padStart(2, "0");
	const dd = String(date.getDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd} Recording`;
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
