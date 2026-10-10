export type PlatformLabel = "Windows" | "MacOS" | "Linux" | "Android" | "iOS" | "Unknown";

export type Mode = "off" | "monitor" | "pause" | "record";

export type MimeType = "audio/mp4" | "audio/webm;codecs=opus" | "audio/webm;codecs=pcm";

export type EmbedPosition = "cursor" | "start" | "end";

export type Theme = {
	fgColor: string;
	bgColor: string;
	clipColor: string;
};

export type SampleWindow = {
	binIndex: number;
	binCount: number;
	binSizeMs: number;
	startTimeMs: number;
	clipLevel: number;
	referenceLevelDb: number;
	timeDomainData: Float32Array[];
	sampleTimestamps: Uint32Array;
	sampleLevels: Float32Array;
	sampleClips: Uint8Array;
};
