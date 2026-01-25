import { SUPPORTED_MIME_TYPES } from "./constants";

// also: voiceIsolation? contentHint? gain?
export interface FieldRecorderPluginSettings {
	filename: string;
	/** Audio recording quality (bits / second). */
	bitrate: number;
	/** Audio recording bitrate mode. */
	bitrateMode: "variable" | "constant";
	/** Audio recording format. */
	mimeType: string;
	autoGainControl: boolean;
	noiseSuppression: boolean;
	echoCancellation: boolean;
	inputDeviceId: string;
}

export const DEFAULT_SETTINGS: FieldRecorderPluginSettings = {
	filename: "",
	autoGainControl: true,
	bitrate: 192000,
	bitrateMode: "variable",
	mimeType: SUPPORTED_MIME_TYPES.includes("audio/mp4")
		? "audio/mp4"
		: (SUPPORTED_MIME_TYPES[0] as string),
	noiseSuppression: false,
	echoCancellation: false,
	inputDeviceId: "default",
};
