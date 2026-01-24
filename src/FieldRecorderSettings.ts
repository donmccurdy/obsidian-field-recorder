import type { Signal } from "@preact/signals-core";
import { Setting } from "obsidian";
import { MIME_TYPE_TO_NAME, SUPPORTED_BITRATES, SUPPORTED_MIME_TYPES } from "./constants";
import type { MimeType } from "./types";

///////////////////////////////////////////////////////////////////////////////
// TYPES

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
	inputSettings: Signal<InputSettings>;
	graphSettings: Signal<GraphSettings>;
	outputSettings: Signal<OutputSettings>;
};

export type FieldRecorderSettingsPersistentV1 = {
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
} satisfies FieldRecorderSettingsPersistentV1;

///////////////////////////////////////////////////////////////////////////////
// CONFIGS

type SettingComponentType = "toggle" | "slider" | "dropdown";

type SettingConfig = {
	name: string;
	desc?: string;
	type: SettingComponentType;
	options?: Record<string, string>;
	limits?: [number, number, number];
	cls?: string[];
	transform?: [(src: unknown) => string, (enc: string) => unknown];
};

type SettingKey = keyof InputSettings | keyof GraphSettings | keyof OutputSettings;

export const SETTING_CONFIGS: Partial<Record<SettingKey, SettingConfig>> = {
	deviceId: {
		name: "Input",
		type: "dropdown",
		cls: ["-wide"],
	},
	monitor: {
		name: "Monitor",
		desc: "Play back input audio while recording (headphones recommended).",
		type: "toggle",
	},
	bitrate: {
		name: "Quality",
		type: "dropdown",
		options: SUPPORTED_BITRATES,
		transform: [String, Number],
	},
	mimeType: {
		name: "Format",
		type: "dropdown",
		options: Object.fromEntries(
			SUPPORTED_MIME_TYPES.map((mimeType) => [mimeType, MIME_TYPE_TO_NAME[mimeType]]),
		),
	},
	autoGainControl: {
		name: "Auto gain control",
		desc: "Manages gain to maintain a steady overall volume level.",
		type: "toggle",
	},
	gain: {
		name: "Gain",
		type: "slider",
		limits: [-5, +5, 0.05],
	},
	noiseSuppression: {
		// TODO: Has no effect if voice isolation is on, and should be disabled.
		name: "Noise suppression",
		desc: "Removes background noise.",
		type: "toggle",
	},
	voiceIsolation: {
		name: "Voice isolation",
		desc: "Removes non-vocal noise; stronger form of noise suppression.",
		type: "toggle",
	},
};

///////////////////////////////////////////////////////////////////////////////
// UI

export function createSetting<K extends SettingKey>(
	el: HTMLElement,
	id: K,
	signal: Signal<Partial<Record<SettingKey, unknown>>>,
	options?: Partial<SettingConfig>,
): Setting {
	const config = SETTING_CONFIGS[id]!;
	const setting = new Setting(el)
		.setName(config.name)
		.setDesc(config.desc || "")
		.setDisabled(true)
		.setClass("fieldrec-setting-item");

	for (const cls of config.cls || []) {
		setting.setClass(cls);
	}

	switch (config.type) {
		case "toggle":
			setting.addToggle((toggle) =>
				toggle
					.setValue(signal.peek()[id] as boolean)
					.setDisabled(true)
					.onChange((value) => {
						signal.value = { ...signal.peek(), [id]: value };
					}),
			);
			break;

		case "slider":
			setting.addSlider((slider) =>
				slider
					.setValue(signal.peek()[id] as number)
					.setInstant(true)
					.setLimits(...(config.limits as [number, number, number]))
					.setDynamicTooltip()
					.setDisabled(true)
					.onChange((value) => {
						signal.value = { ...signal.peek(), [id]: value };
					}),
			);
			break;

		case "dropdown":
			setting.addDropdown((dropdown) => {
				const [tIn, tOut] = options?.transform || [String, String];
				dropdown
					.addOptions(options?.options ?? (config.options as Record<string, string>))
					.setValue(tIn(signal.peek()[id]))
					.setDisabled(true)
					.onChange((value) => {
						signal.value = { ...signal.peek(), [id]: tOut(value) };
					});
			});
			break;

		default:
			throw new Error("Unexpected setting type");
	}

	return setting;
}
