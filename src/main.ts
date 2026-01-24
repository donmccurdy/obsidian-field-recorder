import {Plugin, setIcon} from 'obsidian';
import {DEFAULT_SETTINGS, FieldRecorderPluginSettings, FieldRecorderSettingTab as FieldRecorderSettingTab} from "./settings";
import { concat, getFileExtension, getTimestamp } from 'utils';

type RecordingState = {
	stream: MediaStream,
	recorder: MediaRecorder,
	chunks: Promise<ArrayBuffer>[],
}

export default class FieldRecorderPlugin extends Plugin {
	settings: FieldRecorderPluginSettings;
	recordingState: RecordingState | null = null;

	ribbonIconEl: HTMLElement | null = null;
	statusBarItemEl: HTMLElement | null = null;

	async onload() {
		await this.loadSettings();

		// eslint-disable-next-line obsidianmd/ui/sentence-case
		this.ribbonIconEl = this.addRibbonIcon('mic', 'Field Recorder: Start/stop recording audio', async (o) => {
			if (this.recordingState) {
				this.stopRecording();
				this.stopMicrophone();
			} else {
				await this.startMicrophone();
				this.startRecording();
			}
		});

		this.addCommand({
			id: 'start-recording-audio',
			name: 'Start recording audio',
			checkCallback: (checking) => {
				if (checking) return !this.recordingState;
				this.startMicrophone()
					.then(() => this.startRecording())
					.catch((e) => this.onError(e));
				return true;
			}
		});

		this.addCommand({
			id: 'stop-recording-audio',
			name: 'Stop recording audio',
			checkCallback: (checking) => {
				if (checking) return !!this.recordingState;
				this.stopRecording();
				this.stopMicrophone();
				return true;
			}
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
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<FieldRecorderPluginSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async startMicrophone() {
		const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		const recorder = new MediaRecorder(stream, {
			audioBitrateMode: this.settings.bitrateMode,
			audioBitsPerSecond: this.settings.bitrate,
			mimeType: this.settings.mimeType,
		});
		this.recordingState = {stream, recorder, chunks: []};
	}

	stopMicrophone() {
		this.recordingState!.stream.getTracks().forEach((track) => track.stop());
		this.recordingState = null;
	}

	startRecording() {
		const {recorder, chunks} = this.recordingState!;
		recorder.start();
		recorder.addEventListener("dataavailable", (event) => {
			chunks.push(event.data.arrayBuffer());
			if (recorder.state === 'inactive') {
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
		const {mimeType, audioBitsPerSecond, audioBitrateMode} = recorder;
		const data = concat(await Promise.all(chunks));
		const filename = `Recording ${getTimestamp()}.${getFileExtension(mimeType)}`;
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

		console.debug(`Created file: ${path} (${mimeType}, ${audioBitsPerSecond / 1000} kb/s, ${audioBitrateMode})`);
	}

	showRecordingIndicator() {
		this.statusBarItemEl = this.addStatusBarItem();
		const iconEl = this.statusBarItemEl.createEl('span');
		iconEl.classList.add('status-bar-item-icon', 'field-recorder-status-bar-icon');
		setIcon(iconEl, 'mic');
		this.ribbonIconEl!.classList.add('is-active');
	}

	hideRecordingIndicator() {
		this.statusBarItemEl!.remove();
		this.statusBarItemEl = null;
		this.ribbonIconEl!.classList.remove('is-active');
	}

	onError(e: unknown) {
		console.error(e);
	}
}
