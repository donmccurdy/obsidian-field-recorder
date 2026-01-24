import {App, Editor, MarkdownView, Modal, Plugin, setIcon} from 'obsidian';
import {DEFAULT_SETTINGS, FieldRecorderPluginSettings, FieldRecorderSettingTab as FieldRecorderSettingTab} from "./settings";

type RecordingState = {
	stream: MediaStream,
	recorder: MediaRecorder,
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
					.catch((e) => {
						console.error('Failed to start recording', e);
					});
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

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-modal',
			name: 'Open modal',
			callback: () => {
				new FieldRecorderModal(this.app).open();
			}
		});

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'replace-selected',
			name: 'Replace selected content',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				editor.replaceSelection('Sample editor command');
			}
		});

		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-modal-complex',
			name: 'Open modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new FieldRecorderModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
				return false;
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
		const recorder = new MediaRecorder(stream);
		this.recordingState = {stream, recorder};
	}

	stopMicrophone() {
		this.recordingState!.stream.getTracks().forEach((track) => track.stop());
		this.recordingState = null;
	}

	startRecording() {
		this.recordingState!.recorder.start();
		this.recordingState!.recorder.addEventListener("dataavailable", async (event) => {
			console.log('dataavailable', event.data);
		    // // Write chunks to the file.
		    // await writable.write(event.data);
		    // if (recorder.state === "inactive") {
		    //   // Close the file when the recording stops.
		    //   await writable.close();
		    // }
		  });

		this.showRecordingIndicator();
	}

	stopRecording() {
		this.recordingState!.recorder.stop();
		this.hideRecordingIndicator();
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
}

class FieldRecorderModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		let {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}
