import { Plugin, setIcon, type WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_FIELD_RECORDER } from "./constants";
import { FieldRecorderItemView } from "./FieldRecorderItemView";
import { DEFAULT_SETTINGS, type FieldRecorderPluginSettings } from "./settings";
import { concat, getDefaultFilename, getFileExtension } from "./utils";

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
	// sampleRate: 320000,
	// sampleSize: 32,
	// NOTE: Changing channel count may change the selected device...
	// channelCount: 2
};

export default class FieldRecorderPlugin extends Plugin {
	settings: FieldRecorderPluginSettings;
	recordingState: RecordingState | null = null;

	ribbonIconEl: HTMLElement | null = null;
	statusBarItemEl: HTMLElement | null = null;

	async onload() {
		await this.loadSettings();

		this.ribbonIconEl = this.addRibbonIcon("mic", "Open field recorder", async () => {
			await this.app.workspace.ensureSideLeaf(VIEW_TYPE_FIELD_RECORDER, "right");
		});

		this.addCommand({
			id: "open",
			name: "Open",
			callback: async () => {
				await this.activateView();
			},
		});

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

		this.registerView(
			VIEW_TYPE_FIELD_RECORDER,
			(leaf: WorkspaceLeaf) => new FieldRecorderItemView(leaf, { plugin: this }),
		);
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

	async activateView() {
		const { workspace } = this.app;

		const leaves = workspace.getLeavesOfType(VIEW_TYPE_FIELD_RECORDER);
		if (leaves.length > 0) {
			await workspace.revealLeaf(leaves[0]!);
			return;
		}

		const leaf = workspace.getRightLeaf(false)!;
		await leaf.setViewState({ type: VIEW_TYPE_FIELD_RECORDER, active: true });
		await workspace.revealLeaf(leaf);
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

	showRecordingIndicator() {
		this.statusBarItemEl = this.addStatusBarItem();
		const iconEl = this.statusBarItemEl.createEl("span");
		iconEl.toggleClass("status-bar-item-icon", true);
		iconEl.toggleClass("fieldrec-status-bar-icon", true);
		setIcon(iconEl, "mic");
		this.ribbonIconEl!.toggleClass("is-active", true);
	}

	hideRecordingIndicator() {
		this.statusBarItemEl!.remove();
		this.statusBarItemEl = null;
		this.ribbonIconEl!.toggleClass("is-active", false);
	}

	onError(e: unknown) {
		console.error(e);
	}
}
