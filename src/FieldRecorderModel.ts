import type { FieldRecorderPlugin } from "FieldRecorderPlugin";
import { type Signal, signal } from "@preact/signals-core";
import type { WaveformProcessorMessage } from "constants-shared";
import type { FieldRecorderPluginSettings } from "./constants";
import { Timer } from "./Timer";
import { assert, concat } from "./utils";
import WaveformProcessorModule from "./WaveformProcessor.worklet.js?inline";

const MSG_WORKLET_LOAD: WaveformProcessorMessage["data"] = { type: "worklet-load" };

export type State = "off" | "idle" | "paused" | "recording";

// Reuse a singleton AudioContext across recording sessions, to avoid creating
// many AudioWorklet instances 'should' be GC'd after their AudioContext closes,
// and I'm using the 'worklet-unload' event to alter the process() return value,
// but worklets aren't otherwise being cleaned up automatically.
// See: https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process
// TODO(cleanup): Test across browsers and consider filing a Chromium bug.
let audioCtx: AudioContext | null = null;
async function getAudioContext(): Promise<AudioContext> {
	if (!audioCtx) {
		audioCtx = new AudioContext({ sinkId: { type: "none" } });
		const blob = new Blob([WaveformProcessorModule], { type: "application/javascript" });
		const objectURL = URL.createObjectURL(blob);
		await audioCtx.audioWorklet.addModule(objectURL);
	}
	return audioCtx;
}

export class FieldRecorderModel {
	plugin: FieldRecorderPlugin;

	// TODO: Too many top-level properties!
	state: Signal<State> = signal("off");
	settings: FieldRecorderPluginSettings;
	audioCtx: AudioContext | null = null;
	sourceNode: MediaStreamAudioSourceNode | null = null;
	gainNode: GainNode | null;
	workletNode: AudioWorkletNode | null;
	workletView: DataView | null;
	destinationNode: MediaStreamAudioDestinationNode | null = null;
	stream: MediaStream | null = null;
	recorder: MediaRecorder | null = null;
	timer = new Timer();
	inputDevices: Signal<MediaDeviceInfo[]> = signal([]);
	supportedConstraints: Signal<MediaTrackSupportedConstraints> = signal({});
	chunks: Promise<ArrayBuffer>[] = [];
	subscriptions: (() => void)[] = [];

	constructor(plugin: FieldRecorderPlugin, settings: FieldRecorderPluginSettings) {
		this.plugin = plugin;
		this.settings = settings;
	}

	async onload() {
		const devices = await navigator.mediaDevices.enumerateDevices();
		this.inputDevices.value = devices.filter(({ kind }) => kind === "audioinput");
		this.supportedConstraints.value = navigator.mediaDevices.getSupportedConstraints();

		const onDeviceChange = () => {
			this.supportedConstraints.value = navigator.mediaDevices.getSupportedConstraints();
			navigator.mediaDevices
				.enumerateDevices()
				.then((devices) => {
					this.inputDevices.value = devices.filter(({ kind }) => kind === "audioinput");
				})
				.catch(console.error);
		};
		navigator.mediaDevices.addEventListener("devicechange", onDeviceChange);
		this.subscriptions.push(() =>
			navigator.mediaDevices.removeEventListener("devicechange", onDeviceChange),
		);
	}

	async updateSettings(settings: FieldRecorderPluginSettings) {
		this.settings = settings;

		const state = this.state.peek();
		if (state === "idle") {
			this.stopMicrophone();
			await this.startMicrophone();
		} else if (state !== "off") {
			this._updateAudioNodes();
		}
	}

	async startMicrophone() {
		const { settings } = this;

		this.stream = await navigator.mediaDevices.getUserMedia({
			audio: {
				deviceId: settings.inputDeviceId,
				autoGainControl: settings.autoGainControl,
				noiseSuppression: settings.noiseSuppression,
				echoCancellation: settings.echoCancellation,
				voiceIsolation: settings.voiceIsolation,
			},
		});

		this.audioCtx = await getAudioContext();
		this.sourceNode = this.audioCtx.createMediaStreamSource(this.stream);
		this.gainNode = this.audioCtx.createGain();
		this.workletNode = new AudioWorkletNode(this.audioCtx, "waveform-processor");
		this.destinationNode = this.audioCtx.createMediaStreamDestination();

		this.workletNode.port.postMessage(MSG_WORKLET_LOAD);
		this.workletNode.port.onmessage = (msg: WaveformProcessorMessage) => {
			if (msg.data.type === "worklet-buffer") {
				this.workletView = new DataView(msg.data.buffer);
			}
		};

		this.sourceNode.connect(this.gainNode);
		this.gainNode.connect(this.workletNode);
		this.gainNode.connect(this.destinationNode);

		this.recorder = new MediaRecorder(this.destinationNode.stream, {
			audioBitrateMode: settings.bitrateMode,
			audioBitsPerSecond: settings.bitrate,
			mimeType: settings.mimeType,
		});

		this.recorder.addEventListener("dataavailable", (event) => {
			this.chunks.push(event.data.arrayBuffer());
			// Use `event.target`, as `this.recorder` may already have been deleted.
			if ((event.target as MediaRecorder).state === "inactive") {
				void this._onRecordingEnd();
			}
		});

		this.state.value = "idle";

		this._updateAudioNodes();
	}

	stopMicrophone() {
		assert(this.state.value === "idle");

		// TODO: See getAudioContext().
		// this.workletNode!.port.postMessage(MSG_WORKLET_UNLOAD);
		// this.workletNode!.port.close();
		// void this.audioCtx!.close();
		this.stream!.getTracks().forEach((track) => void track.stop());

		this.recorder = null;
		this.stream = null;
		this.sourceNode = null;
		this.gainNode = null;
		this.workletNode = null;
		this.destinationNode = null;
		this.audioCtx = null;
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

	private _updateAudioNodes() {
		const { settings } = this;
		if (settings.autoGainControl) {
			this.gainNode!.gain.value = 1.0;
		} else {
			this.gainNode!.gain.value = 2 ** settings.gain;
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
