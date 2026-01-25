import { SUPPORTED_MIME_TYPES } from "./constants";

// also: contentHint? gain?
export interface FieldRecorderPluginSettings {
	filename: string;
	bitrate: number;
	bitrateMode: "variable" | "constant";
	mimeType: string;
	autoGainControl: boolean;
	noiseSuppression: boolean;
	echoCancellation: boolean;
	voiceIsolation: boolean;
	inputDeviceId: string;
}

export const DEFAULT_SETTINGS: FieldRecorderPluginSettings = {
	filename: "",
	bitrate: 192000,
	bitrateMode: "variable",
	mimeType: SUPPORTED_MIME_TYPES.includes("audio/mp4")
		? "audio/mp4"
		: (SUPPORTED_MIME_TYPES[0] as string),
	autoGainControl: true,
	noiseSuppression: false,
	echoCancellation: false,
	voiceIsolation: false,
	inputDeviceId: "default",
};
