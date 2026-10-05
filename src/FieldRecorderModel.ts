import { batch, effect } from "@preact/signals-core";
import { Component } from "obsidian";
import { AudioGraph } from "./AudioGraph";
import { RECORDER_CHUNK_INTERVAL_MS } from "./constants";
import type { FieldRecorderState } from "./FieldRecorderState";
import { assert } from "./utils/assert";
import { resetSampleWindow, updateSampleWindow } from "./utils/audio";
import { concat } from "./utils/buffers";
import { Timer } from "./utils/timer";

export class FieldRecorderModel extends Component {
	private readonly state: FieldRecorderState;
	private readonly timer = new Timer();

	private graph: AudioGraph | null = null;
	private recorder: MediaRecorder | null = null;

	private chunks: Promise<ArrayBuffer>[] = [];
	private chunkCallbacks: ((bytes: Uint8Array) => Promise<void>)[] = [];
	private chunkByteLength = 0;

	constructor(state: FieldRecorderState) {
		super();
		this.state = state;
	}

	onload() {
		// TODO: Belongs in the plugin?
		this.register(
			effect(() => {
				const onDeviceChange = () => void this._onDeviceChange();
				navigator.mediaDevices.addEventListener("devicechange", onDeviceChange);
				return () => navigator.mediaDevices.removeEventListener("devicechange", onDeviceChange);
			}),
		);

		// TODO: GainNode not working on iOS?
		// https://bugs.webkit.org/show_bug.cgi?id=180696
		this.register(
			effect(() => {
				const mode = this.state.mode.value;
				const { autoGainControl } = this.state.settings.inputSettings.value;
				const { monitor, gain } = this.state.settings.graphSettings.value;
				if (mode !== "off") {
					this.graph!.setMonitor(monitor);
					this.graph!.setGain(autoGainControl ? 1.0 : 2 ** gain);
				}
			}),
		);

		this.register(
			this.state.settings.inputSettings.subscribe(() => {
				if (this.state.mode.peek() === "monitor") {
					this.stopMonitoring(); // Plugin will restart mic automatically.
				}
			}),
		);
	}

	async getInputDevices(): Promise<InputDeviceInfo[]> {
		const devices = await navigator.mediaDevices.enumerateDevices();
		return devices.filter(({ kind }) => kind === "audioinput") as InputDeviceInfo[];
	}

	async startMonitoring() {
		const inputSettings = this.state.settings.inputSettings.peek();

		// On iOS we can't get the device list until after calling getUserMedia. Which,
		// is frustrating, given we need to pass a deviceId _into_ getUserMedia. But OK.
		this.state.inputDevices.value = await this.getInputDevices();
		this.graph = this.addChild(await AudioGraph.createGraph(inputSettings));
		this.state.inputDevices.value = await this.getInputDevices();

		resetSampleWindow(this.state.sampleWindow);

		this.state.mode.value = "monitor";
	}

	stopMonitoring() {
		const { mode } = this.state;
		assert(mode.peek() === "monitor");

		this.removeChild(this.graph!);
		this.graph = null;

		mode.value = "off";
	}

	startRecording() {
		const { mode } = this.state;
		assert(mode.peek() === "monitor" || mode.peek() === "pause");
		assert(this.graph);

		const outputSettings = this.state.settings.outputSettings.peek();

		if (mode.peek() === "pause") {
			this.recorder!.resume();
			this.state.mode.value = "record";
			this.timer.resume();
			return;
		}

		this.recorder = new MediaRecorder(this.graph.destination.stream, {
			audioBitsPerSecond: outputSettings.bitrate,
			mimeType: outputSettings.mimeType,
		});

		this.recorder.addEventListener("dataavailable", (event) => {
			this.chunks.push(event.data.arrayBuffer());
			this.chunkByteLength += event.data.size;

			// Use `event.target`, as `this.recorder` may already have been deleted.
			if ((event.target as MediaRecorder).state === "inactive") {
				void this._onRecordingEnd();
			}
		});

		this.recorder.start(RECORDER_CHUNK_INTERVAL_MS);
		this.timer.start();

		mode.value = "record";
	}

	pauseRecording() {
		const { state, recorder, timer } = this;
		assert(state.mode.peek() === "record");

		recorder!.pause();
		timer.pause();

		state.mode.value = "pause";
	}

	stopRecording() {
		const { mode } = this.state;
		assert(mode.peek() === "record" || mode.peek() === "pause");

		this.recorder!.stop();
		this.recorder = null;
		this.timer.stop();

		mode.value = "monitor";
	}

	stopAll() {
		const mode = this.state.mode.peek();
		if (mode === "record" || mode === "pause") {
			this.stopRecording();
			this.stopMonitoring();
		} else if (mode === "monitor") {
			this.stopMonitoring();
		}
	}

	update() {
		this.state.durationMs.value = this.timer.getDurationMs();
		this.state.byteLength.value = this.chunkByteLength;
		this.graph!.getFloatTimeDomainData(this.state.sampleWindow.timeDomainData);
		updateSampleWindow(this.state.mode.peek(), this.state.sampleWindow);
	}

	private async _onRecordingEnd() {
		const bytes = concat(await Promise.all(this.chunks));
		await Promise.all(this.chunkCallbacks.map((fn) => fn(bytes)));
		this.chunks.length = 0;
		this.chunkByteLength = 0;
	}

	// TODO: Belongs in the plugin?
	private async _onDeviceChange() {
		const mode = this.state.mode.peek();
		const deviceId = this.state.settings.inputSettings.peek().deviceId;

		if (mode === "off") {
			return;
		}

		const inputDevices = await this.getInputDevices();
		const inputDeviceIDs = new Set(inputDevices.map((d) => d.deviceId));

		const lostDevice = this.graph!.stream.getAudioTracks().some((track) => {
			const settings = track.getSettings();
			return settings.deviceId && !inputDeviceIDs.has(settings.deviceId);
		});

		const gainedDevice = this.graph!.stream.getAudioTracks().some((track) => {
			const settings = track.getSettings();
			return settings.deviceId !== deviceId && inputDeviceIDs.has(deviceId);
		});

		if (lostDevice || (gainedDevice && mode === "monitor")) {
			batch(() => {
				this.state.inputDevices.value = inputDevices;
				this.stopAll(); // Plugin will restart mic automatically.
			});
		}
	}

	addEventListener(type: "dataavailable", callback: (chunk: Uint8Array) => Promise<void>) {
		assert(type === "dataavailable", "invalid event type");
		this.chunkCallbacks.push(callback);
	}

	removeEventListener(type: "dataavailable", callback: (chunk: Uint8Array) => Promise<void>) {
		assert(type === "dataavailable", "invalid event type");
		this.chunkCallbacks = this.chunkCallbacks.filter((fn) => fn !== callback);
	}

	onunload() {
		this.stopAll();
	}
}
