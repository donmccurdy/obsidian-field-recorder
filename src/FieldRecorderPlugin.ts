import { FieldRecorderModel } from "FieldRecorderModel";
import { effect } from "@preact/signals-core";
import { MarkdownView, Plugin, setIcon, type WorkspaceLeaf } from "obsidian";
import {
	DEFAULT_SETTINGS,
	type FieldRecorderPluginSettings,
	VIEW_TYPE_FIELD_RECORDER,
} from "./constants";
import { FieldRecorderView } from "./FieldRecorderView";
import { getDefaultFilename, getFileExtension } from "./utils";

export class FieldRecorderPlugin extends Plugin {
	model: FieldRecorderModel;
	settings: FieldRecorderPluginSettings;

	ribbonIconEl: HTMLElement | null = null;
	statusBarItemEl: HTMLElement | null = null;

	async onload() {
		await this.loadSettings();

		this.model = new FieldRecorderModel(this, this.settings);
		await this.model.onload();

		this.ribbonIconEl = this.addRibbonIcon("mic", "Open/close field recorder", async () =>
			this._toggleView(),
		);

		this._registerCommands();

		this.registerView(
			VIEW_TYPE_FIELD_RECORDER,
			(leaf: WorkspaceLeaf) => new FieldRecorderView(leaf, { plugin: this, model: this.model }),
		);

		this.register(
			effect(() => {
				if (this.model.state.value === "recording") {
					this._showRecordingIndicator();
				} else {
					this._hideRecordingIndicator();
				}
			}),
		);
	}

	onunload() {
		this.model.onunload();
	}

	private _registerCommands() {
		this.addCommand({
			id: "open",
			name: "Open",
			callback: async () => this._activateView(),
		});

		this.addCommand({
			id: "close",
			name: "Close",
			callback: () => this._deactivateView(),
		});

		this.addCommand({
			id: "start",
			name: "Start recording audio",
			checkCallback: (checking) => {
				if (checking) return this.model.state.peek() === "idle";
				this.model.startRecording();
				return true;
			},
		});

		this.addCommand({
			id: "pause",
			name: "Pause recording audio",
			checkCallback: (checking) => {
				if (checking) return this.model.state.peek() === "recording";
				this.model.pauseRecording();
				return true;
			},
		});

		this.addCommand({
			id: "stop",
			name: "Stop recording audio",
			checkCallback: (checking) => {
				if (checking) return this.model.state.peek() === "recording";
				this.model.stopRecording();
				return true;
			},
		});
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
		await this.model.updateSettings(this.settings);
	}

	private async _toggleView() {
		if (this.app.workspace.getLeavesOfType(VIEW_TYPE_FIELD_RECORDER).length > 0) {
			await this._deactivateView();
		} else {
			await this._activateView();
		}
	}

	private async _activateView() {
		await this.app.workspace.ensureSideLeaf(VIEW_TYPE_FIELD_RECORDER, "right");
	}

	private async _deactivateView() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_FIELD_RECORDER);
	}

	async onViewStateChange() {
		const state = this.model.state.peek();

		const isViewActive = this.app.workspace.getLeavesOfType(VIEW_TYPE_FIELD_RECORDER).length > 0;
		this.ribbonIconEl!.toggleClass("is-active", isViewActive);

		if (isViewActive && state === "off") {
			await this.model.startMicrophone();
		} else if (!isViewActive && state !== "off") {
			this.model.stopAll();
		}
	}

	async saveRecording(data: Uint8Array) {
		const { workspace, vault, fileManager } = this.app;

		const basename = this.settings.filename || getDefaultFilename();
		const filename = `${basename}.${getFileExtension(this.settings.mimeType)}`;
		const path = await fileManager.getAvailablePathForAttachment(filename);
		const file = await vault.createBinary(path, data);

		const recentLeaf = workspace.getMostRecentLeaf();
		if (recentLeaf && recentLeaf.view instanceof MarkdownView && recentLeaf.view.file) {
			const recentFilePath = recentLeaf.view.file.path;
			const markdownLink = fileManager.generateMarkdownLink(file, recentFilePath);
			recentLeaf.view.editor.replaceSelection(`!${markdownLink}`);
		} else {
			await workspace.getLeaf(true).openFile(file);
		}
	}

	private _showRecordingIndicator() {
		this.statusBarItemEl = this.addStatusBarItem();
		const iconEl = this.statusBarItemEl.createEl("span");
		iconEl.toggleClass("status-bar-item-icon", true);
		iconEl.toggleClass("fieldrec-status-bar-icon", true);
		setIcon(iconEl, "mic");
	}

	private _hideRecordingIndicator() {
		if (this.statusBarItemEl) {
			this.statusBarItemEl.remove();
			this.statusBarItemEl = null;
		}
	}
}
