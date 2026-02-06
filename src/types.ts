import type { Signal } from "@preact/signals-core";

export type State = "off" | "idle" | "paused" | "recording";

export type BitrateMode = "variable" | "constant";
export type ContentHint = "" | "speech" | "speech-recognition" | "music";

// TODO: Type check that this is compatible with MediaTrackConstraints?
export type InputSettings = {
	deviceId: string;
	sampleRate: number;
	sampleSize: number;
	autoGainControl: boolean;
	noiseSuppression: boolean;
	echoCancellation: boolean;
	voiceIsolation: boolean;
	contentHint: ContentHint;
};

export type InputSettingKey = keyof InputSettings;

// TODO: Reverb, compression, ...
export type GraphSettings = {
	gain: number;
};

export type GraphSettingKey = keyof GraphSettings;

export type OutputSettings = {
	filename: string;
	mimeType: string;
	bitrate: number;
	bitrateMode: BitrateMode;
};

export type OutputSettingKey = keyof OutputSettings;

export type SettingKey = InputSettingKey | GraphSettingKey | OutputSettingKey;

export type PluginSettings = {
	inputSettings: Signal<InputSettings>;
	graphSettings: Signal<GraphSettings>;
	outputSettings: Signal<OutputSettings>;
};

export type PluginSettingsDisabled = {
	inputSettings: Signal<Record<keyof InputSettings, boolean>>;
	graphSettings: Signal<Record<keyof GraphSettings, boolean>>;
	outputSettings: Signal<Record<keyof OutputSettings, boolean>>;
};

// TODO: Versioning?
// TODO: Keep settings in localstorage, or exclude 'deviceId'?
export type PluginSettingsStorage = {
	inputSettings: Partial<InputSettings>;
	graphSettings: Partial<GraphSettings>;
	outputSettings: Partial<OutputSettings>;
};
