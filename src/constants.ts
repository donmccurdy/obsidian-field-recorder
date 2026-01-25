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

export const SUPPORTED_MIME_TYPES = (() => {
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

export const MIME_TYPE_TO_FORMAT = {
	"audio/mpeg": "MP3",
	"audio/ogg": "OGG",
	"audio/wav": "WAV",
	"audio/mp4": "M4A",
	"audio/webm": "WEBM",
};

export const SUPPORTED_BITRATES = {
	"32": "32 kb/s", // lowest
	"96": "96 kb/s", // low
	"128": "128 kb/s", // medium-low
	"160": "160 kb/s", // medium
	"192": "192 kb/s", // medium-high
	// "256": "256 kb/s", // high
	// "320": "320 kb/s", // highest
};
