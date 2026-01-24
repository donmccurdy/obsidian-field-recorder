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
