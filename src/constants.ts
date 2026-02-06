import type {
	BitrateMode,
	ContentHint,
	GraphSettingKey,
	GraphSettings,
	InputSettingKey,
	InputSettings,
	OutputSettingKey,
	OutputSettings,
	PluginSettingsStorage,
} from "./types";

export const LOCAL_STORAGE_KEY = "field-recorder:settings";

export const VIEW_TYPE_FIELD_RECORDER = "field-recorder-view";

const KNOWN_MIME_TYPES = [
	"audio/aac",
	"audio/flac",
	"audio/wav",
	"audio/wave",
	"audio/mpeg",
	"audio/ogg",
	"audio/webm",
	"audio/mp4",
];

export const SUPPORTED_MIME_TYPES = /* @__PURE__ */ (() => {
	const supportedTypes: string[] = [];
	for (const mimeType of KNOWN_MIME_TYPES) {
		if (MediaRecorder.isTypeSupported(mimeType)) {
			supportedTypes.push(mimeType);
		}
	}
	return supportedTypes;
})();

export const MIME_TYPE_TO_EXTENSION: Record<string, string> = {
	"audio/mpeg": "mp3",
	"audio/ogg": "ogg",
	"audio/webm": "webm",
	"audio/wav": "wav",
	"audio/mp4": "m4a",
};

export const MIME_TYPE_TO_FORMAT: Record<string, string> = {
	"audio/mpeg": "MP3",
	"audio/ogg": "OGG",
	"audio/wav": "WAV",
	"audio/mp4": "M4A",
	"audio/webm": "WebM",
};

export const SUPPORTED_BITRATES: Record<string, string> = {
	"32000": "32 kb/s", // lowest
	"96000": "96 kb/s", // low
	"128000": "128 kb/s", // medium-low
	"160000": "160 kb/s", // medium
	"192000": "192 kb/s", // medium-high
	// "256": "256 kb/s", // high
	// "320": "320 kb/s", // highest
};

export const INPUT_SETTING_KEYS = [
	"deviceId",
	"autoGainControl",
	"contentHint",
	"echoCancellation",
	"noiseSuppression",
	"sampleRate",
	"sampleSize",
	"voiceIsolation",
] satisfies InputSettingKey[];

export const GRAPH_SETTING_KEYS = ["gain"] satisfies GraphSettingKey[];

export const OUTPUT_SETTING_KEYS = [
	"filename",
	"mimeType",
	"bitrate",
	"bitrateMode",
] satisfies OutputSettingKey[];

export const DEFAULT_SETTINGS = {
	inputSettings: {
		deviceId: "default",
		sampleRate: 44100,
		sampleSize: 16,
		autoGainControl: true,
		noiseSuppression: false,
		echoCancellation: false,
		voiceIsolation: false,
		contentHint: "" as ContentHint,
	} satisfies InputSettings,

	graphSettings: { gain: 0 } satisfies GraphSettings,

	outputSettings: {
		filename: "",
		mimeType: SUPPORTED_MIME_TYPES.includes("audio/mp4") ? "audio/mp4" : SUPPORTED_MIME_TYPES[0],
		bitrate: 192000,
		bitrateMode: "variable" as BitrateMode,
	} satisfies OutputSettings,
} satisfies PluginSettingsStorage;
