import { Plugin, setIcon } from "obsidian";
import { concat, getFileExtension, getTimestamp } from "utils";
import {
	DEFAULT_SETTINGS,
	type FieldRecorderPluginSettings,
	FieldRecorderSettingTab,
} from "./settings";

type RecordingState = {
	stream: MediaStream;
	recorder: MediaRecorder;
	chunks: Promise<ArrayBuffer>[];
};

// console.log(navigator.mediaDevices.getSupportedConstraints());
// navigator.mediaDevices.enumerateDevices().then(console.log);
// also: voiceIsolation, suppressLocalAudioPlayback
const DEFAULT_AUDIO_CONSTRAINTS: MediaStreamConstraints["audio"] = {
	autoGainControl: false,
	noiseSuppression: false,
	echoCancellation: false,
	sampleRate: 320000,
	sampleSize: 32,
	// NOTICE: Setting the channel count can change the default device. Not sure how to manage that, probably can't.
	// channelCount: 2
};

export default class FieldRecorderPlugin extends Plugin {
	settings: FieldRecorderPluginSettings;
	recordingState: RecordingState | null = null;

	ribbonIconEl: HTMLElement | null = null;
	statusBarItemEl: HTMLElement | null = null;

	async onload() {
		await this.loadSettings();

		this.ribbonIconEl = this.addRibbonIcon(
			"mic",
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			"Field Recorder: Start/stop recording audio",
			async () => {
				if (this.recordingState) {
					this.stopRecording();
					this.stopMicrophone();
				} else {
					await this.startMicrophone();
					this.startRecording();
				}
			},
		);

		this.addCommand({
			id: "start-recording-audio",
			name: "Start recording audio",
			checkCallback: (checking) => {
				if (checking) return !this.recordingState;
				this.startMicrophone()
					.then(() => this.startRecording())
					.catch((e) => this.onError(e));
				return true;
			},
		});

		this.addCommand({
			id: "stop-recording-audio",
			name: "Stop recording audio",
			checkCallback: (checking) => {
				if (checking) return !!this.recordingState;
				this.stopRecording();
				this.stopMicrophone();
				return true;
			},
		});

		this.addSettingTab(new FieldRecorderSettingTab(this.app, this));
	}

	onunload() {
		if (this.recordingState) {
			this.stopRecording();
			this.stopMicrophone();
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<FieldRecorderPluginSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async startMicrophone() {
		const stream = await navigator.mediaDevices.getUserMedia({
			audio: DEFAULT_AUDIO_CONSTRAINTS,
		});
		const recorder = new MediaRecorder(stream, {
			audioBitrateMode: this.settings.bitrateMode,
			audioBitsPerSecond: this.settings.bitrate,
			mimeType: this.settings.mimeType,
		});
		stream.getAudioTracks().forEach((track) => {
			// console.log(track.label, track.getSettings());
			track.contentHint = "music"; // 'music' | 'speech' (i can't tell if it works...)
		});
		this.recordingState = { stream, recorder, chunks: [] };
		// console.log(this.recordingState);
	}

	stopMicrophone() {
		for (const track of this.recordingState!.stream.getTracks()) {
			track.stop();
		}
		this.recordingState = null;
	}

	startRecording() {
		const { recorder, chunks } = this.recordingState!;
		recorder.start();
		recorder.addEventListener("dataavailable", (event) => {
			chunks.push(event.data.arrayBuffer());
			if (recorder.state === "inactive") {
				this.saveRecording(chunks, recorder).catch((e) => this.onError(e));
			}
		});
		this.showRecordingIndicator();
	}

	stopRecording() {
		this.recordingState!.recorder.stop();
		this.hideRecordingIndicator();
	}

	async saveRecording(chunks: Promise<ArrayBuffer>[], recorder: MediaRecorder) {
		const data = concat(await Promise.all(chunks));
		const filename = `Recording ${getTimestamp()}.${getFileExtension(recorder.mimeType)}`;
		const path = await this.app.fileManager.getAvailablePathForAttachment(filename);
		const file = await this.app.vault.createBinary(path, data);

		const activeEditor = this.app.workspace.activeEditor;
		const activePath = this.app.workspace.getActiveFile()?.path;
		if (activeEditor && activePath) {
			const markdownLink = this.app.fileManager.generateMarkdownLink(file, activePath);
			activeEditor.editor?.replaceSelection(`!${markdownLink}`);
		} else {
			await this.app.workspace.getLeaf(true).openFile(file);
		}
	}

	showRecordingIndicator() {
		this.statusBarItemEl = this.addStatusBarItem();
		const iconEl = this.statusBarItemEl.createEl("span");
		iconEl.classList.add("status-bar-item-icon", "field-recorder-status-bar-icon");
		setIcon(iconEl, "mic");
		this.ribbonIconEl!.classList.add("is-active");
	}

	hideRecordingIndicator() {
		this.statusBarItemEl!.remove();
		this.statusBarItemEl = null;
		this.ribbonIconEl!.classList.remove("is-active");
	}

	onError(e: unknown) {
		console.error(e);
	}
}
