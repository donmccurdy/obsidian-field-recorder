import WaveformProcessorModule from "inline:./WaveformProcessor.js";
import { type Signal, signal } from "@preact/signals-core";
import type { App } from "obsidian";
import type { FieldRecorderPluginSettings } from "./constants";
import { Timer } from "./Timer";
import { assert, concat, getDefaultFilename, getFileExtension } from "./utils";

export class FieldRecorderModel {
	app: App;
	state: Signal<"off" | "idle" | "paused" | "recording"> = signal("off");
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

	constructor(app: App, settings: FieldRecorderPluginSettings) {
		this.app = app;
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

		// TODO: Both getUserMedia and AudioContext take a sampleRate parameter.

		this.stream = await navigator.mediaDevices.getUserMedia({
			audio: {
				deviceId: settings.inputDeviceId,
				autoGainControl: settings.autoGainControl,
				noiseSuppression: settings.noiseSuppression,
				echoCancellation: settings.echoCancellation,
				voiceIsolation: settings.voiceIsolation,
			},
		});

		this.audioCtx = new AudioContext({ sinkId: { type: "none" } });

		const blob = new Blob([WaveformProcessorModule], { type: "application/javascript" });
		const objectURL = URL.createObjectURL(blob);
		await this.audioCtx.audioWorklet.addModule(objectURL);

		this.sourceNode = this.audioCtx.createMediaStreamSource(this.stream);
		this.gainNode = this.audioCtx.createGain();
		this.workletNode = new AudioWorkletNode(this.audioCtx, "waveform-processor");
		this.destinationNode = this.audioCtx.createMediaStreamDestination();

		this.workletNode.port.postMessage({ type: "worklet-init" });
		this.workletNode.port.onmessage = (msg) => {
			if ((msg.data as { type?: string })?.type === "worklet-init") {
				const data = msg.data as { type: string; buffer: SharedArrayBuffer };
				this.workletView = new DataView(data.buffer);
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

		this.state.value = "idle";

		this._updateAudioNodes();
	}

	stopMicrophone() {
		assert(this.state.value === "idle");

		this.stream!.getTracks().forEach((track) => void track.stop());
		void this.audioCtx?.close();

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
		const { state, recorder, chunks } = this;
		assert(state.value === "idle" || state.value === "paused");
		assert(recorder);

		if (state.value === "idle") {
			recorder.start();
			recorder.addEventListener("dataavailable", (event) => {
				chunks.push(event.data.arrayBuffer());
				if (recorder.state === "inactive") {
					this.saveRecording(chunks, recorder).catch(console.error);
				}
			});
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
		this.chunks = [];
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

	async saveRecording(chunks: Promise<ArrayBuffer>[], recorder: MediaRecorder) {
		const { workspace, vault, fileManager } = this.app;

		const basename = this.settings.filename || getDefaultFilename();
		const filename = `${basename}.${getFileExtension(recorder.mimeType)}`;
		const path = await fileManager.getAvailablePathForAttachment(filename);

		const data = concat(await Promise.all(chunks));
		const file = await vault.createBinary(path, data);

		const activeEditor = workspace.activeEditor;
		const activePath = workspace.getActiveFile()?.path;
		if (activeEditor && activePath) {
			const markdownLink = fileManager.generateMarkdownLink(file, activePath);
			activeEditor.editor?.replaceSelection(`!${markdownLink}`);
		} else {
			await workspace.getLeaf(true).openFile(file);
		}
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
