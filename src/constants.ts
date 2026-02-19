import type {
	GraphSettingKey,
	GraphSettings,
	InputSettingKey,
	InputSettings,
	MimeType,
	OutputSettingKey,
	OutputSettings,
	PluginSettingsStorageV1,
} from "./types";

export const LOCAL_STORAGE_KEY = "field-recorder:settings";

export const VIEW_TYPE_FIELD_RECORDER = "field-recorder-view";

export const MIME_TYPE_TO_EXTENSION: Record<MimeType, string> = {
	"audio/mp4": "m4a",
	"audio/webm;codecs=opus": "webm",
	"audio/webm;codecs=pcm": "webm",
};

export const MIME_TYPE_TO_NAME: Record<MimeType, string> = {
	"audio/mp4": "M4A",
	"audio/webm;codecs=opus": "WebM (Opus)",
	"audio/webm;codecs=pcm": "WebM (PCM)",
};

export const SUPPORTED_MIME_TYPES = /* @__PURE__ */ (() => {
	const supportedTypes: string[] = [];
	for (const mimeType in MIME_TYPE_TO_EXTENSION) {
		if (MediaRecorder.isTypeSupported(mimeType)) {
			supportedTypes.push(mimeType);
		}
	}
	return supportedTypes as MimeType[];
})();

/** Raw formats are uncompressed, "bitrate" has no obvious effect on these. */
export const RAW_MIME_TYPES = new Set<MimeType>(["audio/webm;codecs=pcm"]);

export const SUPPORTED_BITRATES: Record<string, string> = {
	"32000": "32 kb/s", // lowest
	"96000": "96 kb/s", // low
	"128000": "128 kb/s", // medium-low
	"160000": "160 kb/s", // medium
	"192000": "192 kb/s", // medium-high
	"256000": "256 kb/s", // high
	"320000": "320 kb/s", // highest
};

export const INPUT_SETTING_KEYS = [
	"deviceId",
	"autoGainControl",
	"noiseSuppression",
	"voiceIsolation",
] satisfies InputSettingKey[];

export const GRAPH_SETTING_KEYS = ["monitor", "gain"] satisfies GraphSettingKey[];

export const OUTPUT_SETTING_KEYS = ["filename", "mimeType", "bitrate"] satisfies OutputSettingKey[];

export const DEFAULT_SETTINGS = {
	version: 1,
	inputSettings: {
		deviceId: "default",
		autoGainControl: true,
		noiseSuppression: false,
		voiceIsolation: false,
	} satisfies InputSettings,

	graphSettings: { monitor: false, gain: 0 } satisfies GraphSettings,

	outputSettings: {
		filename: "",
		mimeType: SUPPORTED_MIME_TYPES.includes("audio/mp4") ? "audio/mp4" : SUPPORTED_MIME_TYPES[0],
		bitrate: 192000,
	} satisfies OutputSettings,
} satisfies PluginSettingsStorageV1;
