export function getDefaultFilename() {
	const date = new Date();
	const yyyy = date.getFullYear();
	const mm = String(date.getMonth() + 1).padStart(2, "0");
	const dd = String(date.getDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd} Recording`;
}

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

export function assert(condition: unknown, msg = "Assertion failed"): asserts condition {
	if (!condition) {
		throw new Error(msg);
	}
}

export function formatDuration(ms: number): string {
	let seconds = Math.floor(ms / 1000);

	const hh = String(Math.floor(seconds / 3600)).padStart(2, "0");

	seconds = seconds % 3600;

	const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
	const ss = String(seconds % 60).padStart(2, "0");
	const cc = String(Math.floor((ms % 1000) / 10)).padStart(2, "0");

	if (hh === "00") {
		return `${mm}:${ss}.${cc}`;
	}

	return `${hh}:${mm}:${ss}.${cc}`;
}

export function formatBytes(bytes: number, decimals = 2): string {
	if (bytes === 0) return "0 bytes";

	const k = 1000;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ["bytes", "KB", "MB", "GB", "TB"];

	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}

export function frame(fn: () => void): () => void {
	let handle: number;
	const animate = () => {
		handle = requestAnimationFrame(animate);
		fn();
	};
	handle = requestAnimationFrame(animate);
	return () => cancelAnimationFrame(handle);
}

export type Palette = {
	fgColor: string;
	bgColor: string;
	clipColor: string;
};

export function detectPalette(rootEl: HTMLElement): Palette {
	const computedStyle = window.getComputedStyle(rootEl);
	return {
		fgColor: computedStyle.getPropertyValue("--interactive-accent"),
		bgColor: computedStyle.getPropertyValue("--background-modifier-form-field"),
		clipColor: computedStyle.getPropertyValue("--color-red"),
	};
}
