import { Platform } from "obsidian";
import type { PlatformLabel } from "../types";

export function getPlatformLabel(): PlatformLabel {
	if (Platform.isAndroidApp) return "Android";
	if (Platform.isIosApp) return "iOS";
	if (Platform.isWin) return "Windows";
	if (Platform.isLinux) return "Linux";
	if (Platform.isMacOS) return "MacOS"; // must be after iOS!
	return "Unknown";
}
