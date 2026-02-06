import { computed, effect, type Signal, signal } from "@preact/signals-core";
import { Component } from "obsidian";
import { AudioGraph } from "./AudioGraph";
import { DEFAULT_SETTINGS, INPUT_SETTING_KEYS } from "./constants";
import type { FieldRecorderPlugin } from "./FieldRecorderPlugin";
import { Timer } from "./Timer";
import type { InputSettingKey, PluginSettings, PluginSettingsDisabled } from "./types";
import { assert, concat } from "./utils";

export type State = "off" | "idle" | "paused" | "recording";

// const INPUT_SETTINGS_ENABLED = Object.fromEntries(
// 	INPUT_SETTING_KEYS.map((key) => [key, false]),
// ) as Record<InputSettingKey, boolean>;

const INPUT_SETTINGS_DISABLED = Object.fromEntries(
	INPUT_SETTING_KEYS.map((key) => [key, true]),
) as Record<InputSettingKey, boolean>;

// TODO: Rewrite device and capability detection:
// 	1. enumerate kind="audioinput" devices, select preferred device or default
//  2. call getUserMedia with selected device and local per-device settings (if any)
//  3. after stream starts, enumerate devices again, selecting preferred device if we couldn't before
//  4. compare device.getCapabilities() to local settings, update stream tracks and UI state
//  5. if user changes settings, save to local per-device storage
//  6. listen for 'devicechange' events and go to (4)
export class FieldRecorderModel extends Component {
	public readonly state = signal<State>("off");
	public readonly timer = new Timer();

	/**
	 * List of audio input devices available for selection. Note that iOS may
	 * not return the full list until after getUserMedia() is called.
	 */
	public readonly inputDevices = signal<InputDeviceInfo[]>([]);
	public readonly inputTrackSettings = signal<MediaTrackSettings[]>([]);
	public readonly inputSampleRates: Signal<number[]>;
	public readonly inputSampleSizes: Signal<number[]>;

	/** Selected audio input device. Device may remain selected if state='off'. */
	public readonly activeInput: Signal<InputDeviceInfo | null>;

	/** User's preferred settings. */
	public readonly preferredSettings: PluginSettings;

	/** Device's settings, based on user preferences and device capabilities. */
	public readonly resolvedSettings: PluginSettings;

	/**
	 * Settings that cannot currently be changed, either due to the selected
	 * device or current model state.
	 */
	public readonly disabledSettings: PluginSettingsDisabled;

	public graph: AudioGraph | null = null;
	public recorder: MediaRecorder | null = null;

	private plugin: FieldRecorderPlugin;
	private chunks: Promise<ArrayBuffer>[] = [];
	private subscriptions: (() => void)[] = [];

	constructor(plugin: FieldRecorderPlugin, settings: PluginSettings) {
		super();

		this.plugin = plugin;

		this.preferredSettings = settings;

		this.resolvedSettings = {} as unknown as PluginSettings;

		this.resolvedSettings.inputSettings = computed(() => {
			const state = this.state.value;
			const preferred = settings.inputSettings.value;
			const resolved = this.inputTrackSettings.value[0];
			return { ...preferred, ...(state !== "off" && resolved) };
		});

		this.resolvedSettings.graphSettings = computed(() => {
			const autoGainControl = settings.inputSettings.value.autoGainControl;
			const preferred = settings.graphSettings.value;
			return { ...preferred, gain: autoGainControl ? 0.0 : preferred.gain };
		});

		this.resolvedSettings.outputSettings = computed(() => ({ ...settings.outputSettings.value }));

		this.disabledSettings = {
			inputSettings: computed(() => {
				const state = this.state.value;
				const device = this.activeInput.value;

				if (state !== "idle" || !device) {
					return {
						...INPUT_SETTINGS_DISABLED,
						deviceId: state === "recording",
					};
				}

				const capabilities = device.getCapabilities();

				return {
					deviceId: !("deviceId" in capabilities),
					autoGainControl: !("autoGainControl" in capabilities),
					echoCancellation: !("echoCancellation" in capabilities),
					noiseSuppression: !("noiseSuppression" in capabilities),
					voiceIsolation: !("voiceIsolation" in capabilities),
					contentHint: !("contentHint" in capabilities),
					sampleRate: !("sampleRate" in capabilities),
					sampleSize: !("sampleSize" in capabilities),
				};
			}),

			graphSettings: computed(() => {
				const state = this.state.value;
				const autoGainControl = this.resolvedSettings.inputSettings.value.autoGainControl;
				return { gain: state === "off" || autoGainControl };
			}),

			outputSettings: computed(() => {
				const state = this.state.value;
				return {
					filename: false,
					mimeType: state === "recording",
					bitrate: state === "recording",
					bitrateMode: state === "recording",
				};
			}),
		};

		this.activeInput = computed(() => {
			const inputDevices = this.inputDevices.value;
			const preferredDeviceId = this.preferredSettings.inputSettings.value.deviceId;
			for (const device of inputDevices) {
				if (device.deviceId === preferredDeviceId) {
					return device;
				}
			}
			return null;
		});

		this.inputSampleRates = computed(() => {
			const input = this.activeInput.value;
			const range = input?.getCapabilities().sampleRate;
			if (!input || !range?.min || !range?.max) {
				return [DEFAULT_SETTINGS.inputSettings.sampleRate];
			}
			return [range.min, range.max];
		});

		this.inputSampleSizes = computed(() => {
			const input = this.activeInput.value;
			const range = input?.getCapabilities().sampleSize;
			if (!input || !range?.min || !range?.max) {
				return [DEFAULT_SETTINGS.inputSettings.sampleSize];
			}
			return [range.min, range.max];
		});
	}

	onload() {
		this.register(
			effect(() => {
				const onDeviceChange = () => {
					void this.getInputDevices().then((devices) => {
						this.inputDevices.value = devices;
					});
				};
				navigator.mediaDevices.addEventListener("devicechange", onDeviceChange);
				return () => navigator.mediaDevices.removeEventListener("devicechange", onDeviceChange);
			}),
		);

		// this.register(
		// 	effect(() => {
		// 		// eslint-disable-next-line no-console
		// 		console.table({
		// 			...this.resolvedSettings.inputSettings.value,
		// 			...this.resolvedSettings.graphSettings.value,
		// 			...this.resolvedSettings.outputSettings.value,
		// 		});
		// 	}),
		// );

		// TODO: GainNode not working on iOS?
		// https://bugs.webkit.org/show_bug.cgi?id=180696
		this.register(
			effect(() => {
				const state = this.state.value;
				const { autoGainControl } = this.resolvedSettings.inputSettings.value;
				const { gain } = this.preferredSettings.graphSettings.value;
				if (state !== "off") {
					this.graph!.setGain(autoGainControl ? 1.0 : 2 ** gain);
				}
			}),
		);

		this.register(
			this.preferredSettings.inputSettings.subscribe(() => {
				if (this.state.peek() === "idle") {
					this.stopMicrophone(); // Plugin will restart mic automatically.
				}
			}),
		);
	}

	async getInputDevices(): Promise<InputDeviceInfo[]> {
		const devices = await navigator.mediaDevices.enumerateDevices();
		return devices.filter(({ kind }) => kind === "audioinput") as InputDeviceInfo[];
	}

	async startMicrophone() {
		const inputSettings = this.preferredSettings.inputSettings.peek();

		// TODO: On iOS we can't get the device list until after calling getUserMedia. Which,
		// is frustrating, given we need to pass a deviceId _into_ getUserMedia. But OK.
		this.inputDevices.value = await this.getInputDevices();
		this.graph = this.addChild(await AudioGraph.createGraph(inputSettings));
		this.inputDevices.value = await this.getInputDevices();

		this.inputTrackSettings.value = this.graph.stream
			.getAudioTracks()
			.map((track) => track.getSettings());

		// TODO: How does bitrate on the stream affect MediaRecorder quality?
		const outputSettings = this.resolvedSettings.outputSettings.peek();
		this.recorder = new MediaRecorder(this.graph.destination.stream, {
			audioBitsPerSecond: outputSettings.bitrate,
			audioBitrateMode: outputSettings.bitrateMode,
			mimeType: outputSettings.mimeType,
		});

		this.recorder.addEventListener("dataavailable", (event) => {
			this.chunks.push(event.data.arrayBuffer());
			// Use `event.target`, as `this.recorder` may already have been deleted.
			if ((event.target as MediaRecorder).state === "inactive") {
				void this._onRecordingEnd();
			}
		});

		this.state.value = "idle";
	}

	stopMicrophone() {
		assert(this.state.value === "idle");
		this.removeChild(this.graph!);
		this.graph = null;
		this.state.value = "off";
	}

	startRecording() {
		const { state, recorder } = this;
		assert(state.value === "idle" || state.value === "paused");
		assert(recorder);

		if (state.value === "idle") {
			recorder.start();
		} else {
			recorder.resume();
		}

		this.state.value = "recording";
		this.timer.start();
	}

	pauseRecording() {
		const { state, recorder } = this;
		assert(state.value === "recording");
		recorder!.pause();
		this.state.value = "paused";
		this.timer.pause();
	}

	stopRecording() {
		const { state, recorder } = this;
		assert(state.value === "recording" || state.value === "paused");
		recorder!.stop();
		this.state.value = "idle";
		this.timer.stop();
	}

	stopAll() {
		const state = this.state.peek();
		if (state === "recording" || state === "paused") {
			this.stopRecording();
			this.stopMicrophone();
		} else if (state === "idle") {
			this.stopMicrophone();
		}
	}

	private async _onRecordingEnd() {
		const chunks = await Promise.all(this.chunks);
		await this.plugin.saveRecording(concat(chunks));
		this.chunks.length = 0;
	}

	onunload() {
		const { state } = this;
		if (state.value === "recording" || state.value === "paused") {
			this.stopRecording();
		}
		if (state.value === "idle") {
			this.stopMicrophone();
		}
		this.chunks.length = 0;
		this.subscriptions.forEach((unsub) => void unsub());
		this.subscriptions.length = 0;
	}
}
