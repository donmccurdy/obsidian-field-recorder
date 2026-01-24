export const SUPPORTED_EXTENSIONS: Record<string, string> = {
	mpeg: 'mp3',
	ogg: 'ogg',
	webm: 'webm',
	wav: 'wav',
	mp4: 'm4a'
}
export const AUDIO_MIME_TYPES = [
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
	for (const mimeType of AUDIO_MIME_TYPES) {
		if (MediaRecorder.isTypeSupported(mimeType)) {
			supportedTypes.push(mimeType);
		}
	}
	return supportedTypes;
})();

export const SUPPORTED_BITRATES = {
	'32': '32 kb/s',   // lowest
	'96': '96 kb/s',   // low
	'128': '128 kb/s', // medium-low
	'160': '160 kb/s', // medium
	'192': '192 kb/s', // medium-high
	'256': '256 kb/s', // high
	'320': '320 kb/s', // highest
};

export const SUPPORTED_BITRATE_MODES = {
	'variable': 'Variable',
	'constant': 'Constant'
};
