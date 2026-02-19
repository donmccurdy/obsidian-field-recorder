import type { Signal } from "@preact/signals-core";

export type State = "off" | "idle" | "paused" | "recording";

export type MimeType = "audio/mp4" | "audio/webm;codecs=opus" | "audio/webm;codecs=pcm";

export type InputSettings = {
	deviceId: string;
	autoGainControl: boolean;
	noiseSuppression: boolean;
	voiceIsolation: boolean;
};

export type InputSettingKey = keyof InputSettings;

export type GraphSettings = {
	monitor: boolean;
	gain: number;
};

export type GraphSettingKey = keyof GraphSettings;

export type OutputSettings = {
	filename: string;
	mimeType: MimeType;
	bitrate: number;
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

export type PluginSettingsStorageV1 = {
	version: 1;
	inputSettings: Partial<InputSettings>;
	graphSettings: Partial<GraphSettings>;
	outputSettings: Partial<OutputSettings>;
};
