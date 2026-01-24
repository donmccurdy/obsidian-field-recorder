import { Platform } from "obsidian";
import type { MimeType, SampleWindow } from "./types";

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

export const RECORDER_CHUNK_INTERVAL_MS = 5000;

const SAMPLE_BIN_COUNT = 32;
const SAMPLE_BIN_SIZE_MS = 125;
const SAMPLE_CLIP_LEVEL = 0.98;
// TODO: Better way to determine reference level?
const SAMPLE_REFERENCE_LEVEL_DB = Platform.isIosApp ? -60 : -40;

export const DEFAULT_SAMPLE_WINDOW: SampleWindow = Object.freeze({
	binIndex: 0,
	binCount: SAMPLE_BIN_COUNT,
	binSizeMs: SAMPLE_BIN_SIZE_MS,
	startTimeMs: Number.NEGATIVE_INFINITY,
	clipLevel: SAMPLE_CLIP_LEVEL,
	referenceLevelDb: SAMPLE_REFERENCE_LEVEL_DB,
	timeDomainData: [],
	sampleTimestamps: new Uint32Array(SAMPLE_BIN_COUNT),
	sampleLevels: new Float32Array(SAMPLE_BIN_COUNT),
	sampleClips: new Uint8Array(SAMPLE_BIN_COUNT),
});
