import { FieldRecorderModel, type State } from "FieldRecorderModel";
import { effect, signal } from "@preact/signals-core";
import { MarkdownView, Plugin, setIcon, type WorkspaceLeaf } from "obsidian";
import {
	DEFAULT_SETTINGS,
	type FieldRecorderPluginSettings,
	VIEW_TYPE_FIELD_RECORDER,
} from "./constants";
import { FieldRecorderView } from "./FieldRecorderView";
import { detectPalette, frame, getDefaultFilename, getFileExtension } from "./utils";
import { WaveformProcessor } from "./WaveformProcessor";

export class FieldRecorderPlugin extends Plugin {
	model: FieldRecorderModel;
	processor: WaveformProcessor;
	settings: FieldRecorderPluginSettings;
	palette = signal(detectPalette(document.body));

	ribbonIconEl: HTMLElement | null = null;
	statusBarItemEl: HTMLElement | null = null;

	isViewRunning = signal(false);
	isViewOpen = signal(true);

	async onload() {
		await this.loadSettings();

		this.model = this.addChild(new FieldRecorderModel(this, this.settings));
		this.processor = this.addChild(new WaveformProcessor(this));

		this.ribbonIconEl = this.addRibbonIcon("mic", "Open/close field recorder", () =>
			this._toggleView(),
		);

		this.registerCommands();

		this.registerView(
			VIEW_TYPE_FIELD_RECORDER,
			(leaf: WorkspaceLeaf) => new FieldRecorderView(leaf, { plugin: this, model: this.model }),
		);

		this.register(effect(() => this._updateMicIndicator(this.model.state.value)));

		this.register(
			effect(() => {
				const { isViewRunning, isViewOpen } = this;
				const { state } = this.model;

				// View has just opened or come into view. Start the mic.
				if (isViewRunning.value && isViewOpen.value && state.value === "off") {
					void this.model.startMicrophone();
				}

				// View is out of view, and recording is idle. Stop the mic.
				if (isViewRunning.value && !isViewOpen.value && state.value === "idle") {
					this.model.stopAll();
				}

				// View is not running, and necessarily not open. Stop the mic.
				if (!isViewRunning.value && !isViewOpen.value && state.value !== "off") {
					this.model.stopAll();
				}
			}),
		);

		this.registerEvent(
			this.app.workspace.on("css-change", () => {
				this.palette.value = detectPalette(document.body);
			}),
		);

		this.register(frame(() => this.tick()));
	}

	tick() {
		const { model, processor, app } = this;

		if (model.state.peek() === "off") {
			return;
		}

		processor.tick();

		for (const leaf of app.workspace.getLeavesOfType(VIEW_TYPE_FIELD_RECORDER)) {
			if (leaf.view instanceof FieldRecorderView) {
				leaf.view.tick();
			}
		}
	}

	private registerCommands() {
		this.addCommand({
			id: "open",
			name: "Open",
			callback: async () => this._openView(),
		});

		this.addCommand({
			id: "close",
			name: "Close",
			callback: () => this._closeView(),
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
		// TODO: Use signals.
		await this.saveData(this.settings);
		await this.model.updateSettings(this.settings);
	}

	// TODO: Inline this into onViewStateChange().
	private _isViewOpen(): boolean {
		if (this.app.workspace.rightSplit.collapsed) {
			return false;
		}
		// TODO: Check that at least one of these leaves is visible.
		return this.app.workspace.getLeavesOfType(VIEW_TYPE_FIELD_RECORDER).length > 0;
	}

	private async _toggleView() {
		if (this._isViewOpen()) {
			await this._closeView();
		} else {
			await this._openView();
		}
	}

	private async _openView() {
		if (this.app.workspace.rightSplit.collapsed) {
			this.app.workspace.rightSplit.expand();
		}
		await this.app.workspace.ensureSideLeaf(VIEW_TYPE_FIELD_RECORDER, "right");
	}

	private async _closeView() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_FIELD_RECORDER);
	}

	async onViewStateChange() {
		this.isViewRunning.value =
			this.app.workspace.getLeavesOfType(VIEW_TYPE_FIELD_RECORDER).length > 0;
		this.isViewOpen.value = this._isViewOpen();
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

	private _updateMicIndicator(state: State) {
		this.ribbonIconEl!.toggleClass("is-active", state !== "off");

		if (state === "recording") {
			this.statusBarItemEl = this.addStatusBarItem();
			const iconEl = this.statusBarItemEl.createEl("span");
			iconEl.toggleClass("status-bar-item-icon", true);
			iconEl.toggleClass("fieldrec-status-bar-icon", true);
			setIcon(iconEl, "mic");
		} else if (this.statusBarItemEl) {
			this.statusBarItemEl.remove();
			this.statusBarItemEl = null;
		}
	}
}
