import { type Signal, signal } from "@preact/signals-core";
import type { App } from "obsidian";
import type { FieldRecorderPluginSettings } from "./settings";
import { assert, concat, getDefaultFilename, getFileExtension } from "./utils";

export class FieldRecorderModel {
	app: App;
	state: Signal<"off" | "idle" | "paused" | "recording"> = signal("off");
	settings: FieldRecorderPluginSettings;
	stream: MediaStream | null = null;
	recorder: MediaRecorder | null = null;
	chunks: Promise<ArrayBuffer>[] = [];

	constructor(app: App, settings: FieldRecorderPluginSettings) {
		this.app = app;
		this.settings = settings;
	}

	async updateSettings(settings: FieldRecorderPluginSettings) {
		this.settings = settings;
		if (this.state.peek() === "idle") {
			this.stopMicrophone();
			await this.startMicrophone();
		}
	}

	async startMicrophone() {
		const { settings } = this;
		const stream = await navigator.mediaDevices.getUserMedia({
			audio: {
				deviceId: settings.inputDeviceId,
				autoGainControl: settings.autoGainControl,
				noiseSuppression: settings.noiseSuppression,
				echoCancellation: settings.echoCancellation,
			},
		});
		const recorder = new MediaRecorder(stream, {
			audioBitrateMode: settings.bitrateMode,
			audioBitsPerSecond: settings.bitrate,
			mimeType: settings.mimeType,
		});

		// stream.getAudioTracks().forEach((track) => {
		// 	// console.log(track.label, track.getSettings());
		// 	track.contentHint = "music"; // 'music' | 'speech' (i can't tell if it works...)
		// });

		this.stream = stream;
		this.recorder = recorder;
		this.state.value = "idle";
	}

	stopMicrophone() {
		assert(this.state.value === "idle");
		for (const track of this.stream!.getTracks()) {
			track.stop();
		}

		this.stream = null;
		this.recorder = null;
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
					this.saveRecording(chunks, recorder).catch((e) => {
						console.error(e);
					});
				}
			});
		} else {
			recorder.resume();
		}

		this.state.value = "recording";
	}

	pauseRecording() {
		const { state, recorder } = this;
		assert(state.value === "recording");
		recorder!.pause();
		this.state.value = "paused";
	}

	stopRecording() {
		const { state, recorder } = this;
		assert(state.value === "recording" || state.value === "paused");
		recorder!.stop();
		this.state.value = "idle";
		this.chunks = [];
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
	}
}
