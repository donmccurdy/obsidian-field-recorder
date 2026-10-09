import { computed, type Signal, signal } from "@preact/signals-core";
import { Platform } from "obsidian";
import { debounceSignal } from "utils/debounceSignal";
import { DEFAULT_SAMPLE_WINDOW, RAW_MIME_TYPES } from "./constants";
import type {
	FieldRecorderSettings,
	GraphSettings,
	InputSettings,
	OutputSettings,
} from "./settings";
import type { Mode, SampleWindow, Theme } from "./types";
import { getTheme } from "./utils/theme";

// See: https://github.com/donmccurdy/obsidian-field-recorder/issues/9
const VIEW_DEBOUNCE_MS = Platform.isIosApp ? 400 : 0;

export type FieldRecorderState = Readonly<{
	/**
	 * Plugin's current operating mode. May be:
	 * - off: Plugin is fully inactive.
	 * - monitor: Plugin is open and monitoring audio levels.
	 * - record: Plugin is currently recording.
	 * - pause: Plugin is paused mid-recording.
	 */
	mode: Signal<Mode>;

	/** Active theme / color palette, derived from CSS variables. */
	theme: Signal<Theme>;

	/** Number of visible plugin views. */
	viewsVisible: Signal<number>;
	viewsVisibleDebounced: Signal<number>;

	/** Number of active plugin views, must be >=viewsVisibleCount. */
	viewsActive: Signal<number>;
	viewsActiveDebounced: Signal<number>;

	/** When recording, the current recording's length in bytes. Default 0. */
	byteLength: Signal<number>;

	/** When recording, the current recording's length in milliseconds. Default 0. */
	durationMs: Signal<number>;

	/**
	 * Sample window, aggregated from time domain data each frame. Because
	 * values changes at 60 Hz (or 44100 Hz if I can get AudioWorklets running
	 * in mobile Safari ...) this is NOT a Signal.
	 */
	sampleWindow: SampleWindow;

	/** User settings. */
	settings: FieldRecorderSettings;

	/**
	 * Settings that cannot currently be changed, either due to the selected
	 * device or current model state.
	 */
	settingsDisabled: {
		inputSettings: Signal<Record<keyof InputSettings, boolean>>;
		graphSettings: Signal<Record<keyof GraphSettings, boolean>>;
		outputSettings: Signal<Record<keyof OutputSettings, boolean>>;
	};

	/**
	 * List of audio input devices available for selection. Note that iOS may
	 * not return the full list until after getUserMedia() is called.
	 */
	inputDevices: Signal<InputDeviceInfo[]>;

	/**
	 * Selected audio input device. Device may remain selected if state='off'.
	 */
	activeInput: Signal<InputDeviceInfo | null>;
}>;

export function createState(settings: FieldRecorderSettings): FieldRecorderState {
	const mode = signal<Mode>("off");
	const theme = signal(getTheme(document.body));
	const viewsVisible = signal(0);
	const viewsVisibleDebounced = debounceSignal(viewsVisible, VIEW_DEBOUNCE_MS);
	const viewsActive = signal(0);
	const viewsActiveDebounced = debounceSignal(viewsActive, VIEW_DEBOUNCE_MS);
	const byteLength = signal(0);
	const durationMs = signal(0);

	const timeDomainData: Float32Array[] = [];
	const sampleWindow = { ...DEFAULT_SAMPLE_WINDOW };

	const inputDevices = signal<InputDeviceInfo[]>([]);
	const activeInput = computed(() => {
		const preferredDeviceId = settings.inputSettings.value.deviceId;
		for (const device of inputDevices.value) {
			if (device.deviceId === preferredDeviceId) {
				return device;
			}
		}
		return null;
	});

	const settingsDisabled = {
		inputSettings: computed(() => {
			const modeValue = mode.value;
			const device = activeInput.value;

			if (modeValue !== "monitor" || !device) {
				return {
					autoGainControl: true,
					noiseSuppression: true,
					voiceIsolation: true,
					deviceId: modeValue === "record",
				};
			}

			const capabilities = device.getCapabilities();

			return {
				deviceId: !("deviceId" in capabilities),
				autoGainControl: !("autoGainControl" in capabilities),
				noiseSuppression: !("noiseSuppression" in capabilities),
				voiceIsolation: !("voiceIsolation" in capabilities),
			};
		}),

		graphSettings: computed(() => {
			const modeValue = mode.value;
			const autoGainControl = settings.inputSettings.value.autoGainControl;
			return {
				monitor: modeValue === "off",
				gain: modeValue === "off" || autoGainControl,
			};
		}),

		outputSettings: computed(() => {
			const modeValue = mode.value;
			const mimeType = settings.outputSettings.value.mimeType;
			return {
				filename: false,
				mimeType: modeValue === "record",
				bitrate: modeValue === "record" || RAW_MIME_TYPES.has(mimeType),
			};
		}),
	} satisfies FieldRecorderState["settingsDisabled"];

	return Object.freeze({
		mode,
		theme,
		viewsVisible,
		viewsVisibleDebounced,
		viewsActive,
		viewsActiveDebounced,
		byteLength,
		durationMs,
		timeDomainData,
		sampleWindow,
		settings,
		settingsDisabled,
		inputDevices,
		activeInput,
	});
}
