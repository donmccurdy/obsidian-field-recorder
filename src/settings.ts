import type { Signal } from "@preact/signals-core";
import { SUPPORTED_MIME_TYPES } from "./constants";
import type { EmbedPosition, MimeType } from "./types";

///////////////////////////////////////////////////////////////////////////////
// TYPES

export type PluginSettings = {
	filenameTemplate: string;
	embedPosition: EmbedPosition;
};

export type InputSettings = {
	deviceId: string;
	autoGainControl: boolean;
	noiseSuppression: boolean;
	voiceIsolation: boolean;
};

export type GraphSettings = {
	monitor: boolean;
	gain: number;
};

export type OutputSettings = {
	filename: string;
	mimeType: MimeType;
	bitrate: number;
};

export type FieldRecorderSettings = {
	pluginSettings: Signal<PluginSettings>;
	inputSettings: Signal<InputSettings>;
	graphSettings: Signal<GraphSettings>;
	outputSettings: Signal<OutputSettings>;
};

export type FieldRecorderSettingsValues = {
	pluginSettings: PluginSettings;
	inputSettings: InputSettings;
	graphSettings: GraphSettings;
	outputSettings: OutputSettings;
};

export type FieldRecorderSettingsFileStorage = {
	version: 1;
	pluginSettings: Partial<PluginSettings>;
};

export type FieldRecorderSettingsLocalStorage = {
	version: 1;
	inputSettings: Partial<InputSettings>;
	graphSettings: Partial<GraphSettings>;
	outputSettings: Partial<OutputSettings>;
};

///////////////////////////////////////////////////////////////////////////////
// CONSTANTS

export const SETTING_UNAVAILABLE = "Unavailable on current device.";

export const INPUT_SETTING_KEYS = [
	"deviceId",
	"autoGainControl",
	"noiseSuppression",
	"voiceIsolation",
] satisfies (keyof InputSettings)[];

export const GRAPH_SETTING_KEYS = ["monitor", "gain"] satisfies (keyof GraphSettings)[];

export const OUTPUT_SETTING_KEYS = [
	"filename",
	"mimeType",
	"bitrate",
] satisfies (keyof OutputSettings)[];

///////////////////////////////////////////////////////////////////////////////
// DEFAULTS

export const DEFAULT_SETTINGS = {
	pluginSettings: {
		filenameTemplate: "",
		embedPosition: "cursor",
	} satisfies PluginSettings,

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
} satisfies FieldRecorderSettingsValues;
