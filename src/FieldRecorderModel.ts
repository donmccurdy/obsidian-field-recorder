import { FieldRecorderAudioGraph } from "FieldRecorderAudioGraph";
import { type Signal, signal } from "@preact/signals-core";
import { Component } from "obsidian";
import type { FieldRecorderPlugin } from "./FieldRecorderPlugin";
import { Timer } from "./Timer";
import type { PluginSettings } from "./types";
import { assert, concat } from "./utils";

export type State = "off" | "idle" | "paused" | "recording";

export class FieldRecorderModel extends Component {
	public readonly state = signal<State>("off");
	public readonly timer = new Timer();
	public readonly inputDevices: Signal<MediaDeviceInfo[]> = signal([]);
	public readonly settings: PluginSettings;

	public graph: FieldRecorderAudioGraph | null = null;
	public recorder: MediaRecorder | null = null;

	private plugin: FieldRecorderPlugin;
	private chunks: Promise<ArrayBuffer>[] = [];
	private subscriptions: (() => void)[] = [];

	constructor(plugin: FieldRecorderPlugin, settings: PluginSettings) {
		super();
		this.plugin = plugin;
		this.settings = settings;
	}

	onload() {
		// TODO: Rewrite device and capability detection:
		// 	1. enumerate kind="audioinput" devices, select preferred device or default
		//  2. call getUserMedia with selected device and local per-device settings (if any)
		//  3. after stream starts, enumerate devices again, selecting preferred device if we couldn't before
		//  4. compare device.getCapabilities() to local settings, update stream tracks and UI state
		//  5. if user changes settings, save to local per-device storage
		//  6. listen for 'devicechange' events and go to (4)
		//
		// TODO: Unsure whether this belongs in the Model, though?
	}

	async startMicrophone() {
		this.graph = this.addChild(await FieldRecorderAudioGraph.createGraph(this.settings));

		// TODO: How does bitrate on the stream affect MediaRecorder quality?
		const outputSettings = this.settings.outputSettings.peek();
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
