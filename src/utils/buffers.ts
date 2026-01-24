export function concat(chunks: ArrayBuffer[]): Uint8Array {
	let byteLength = 0;
	for (const chunk of chunks) {
		byteLength += chunk.byteLength;
	}

	const bytes = new Uint8Array(byteLength);

	let byteOffset = 0;
	for (const chunk of chunks) {
		bytes.set(new Uint8Array(chunk), byteOffset);
		byteOffset += chunk.byteLength;
	}

	return bytes;
}
