import { FieldRecorderModel } from "FieldRecorderModel";
import { effect, signal } from "@preact/signals-core";
import { MarkdownView, Plugin, setIcon, type WorkspaceLeaf } from "obsidian";
import { AudioProcessor } from "./AudioProcessor";
import {
	DEFAULT_SETTINGS,
	LOCAL_STORAGE_KEY,
	MIME_TYPE_TO_EXTENSION,
	VIEW_TYPE_FIELD_RECORDER,
} from "./constants";
import { FieldRecorderView } from "./FieldRecorderView";
import type { PluginSettings, PluginSettingsStorage, State } from "./types";
import { detectPalette, frame, getDefaultFilename } from "./utils";

export class FieldRecorderPlugin extends Plugin {
	model: FieldRecorderModel;
	processor: AudioProcessor;
	palette = signal(detectPalette(document.body));

	ribbonIconEl: HTMLElement | null = null;
	statusBarItemEl: HTMLElement | null = null;

	viewsVisibleCount = signal(0);
	viewsActiveCount = signal(0);

	async onload() {
		this.model = this.addChild(new FieldRecorderModel(this, this.loadSettings()));
		this.processor = this.addChild(new AudioProcessor(this));

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
				const state = this.model.state.value;
				const isViewActive = this.viewsActiveCount.value > 0;
				const isViewVisible = this.viewsVisibleCount.value > 0;

				// View has just opened or come into view. Start the mic.
				if (isViewActive && isViewVisible && state === "off") {
					void this.model.startMicrophone();
				}

				// View is out of view, and recording is idle. Stop the mic.
				if (isViewActive && !isViewVisible && state === "idle") {
					this.model.stopAll();
				}

				// View is not running, and necessarily not open. Stop the mic.
				if (!isViewActive && !isViewVisible && state !== "off") {
					this.model.stopAll();
				}
			}),
		);

		this.register(
			effect(() => {
				const settings = this.model.settings;
				this.saveSettings({
					inputSettings: settings.inputSettings.value,
					graphSettings: settings.graphSettings.value,
					outputSettings: settings.outputSettings.value,
				});
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

	saveSettings(settings: PluginSettingsStorage): void {
		this.app.saveLocalStorage(LOCAL_STORAGE_KEY, settings);
	}

	loadSettings(): PluginSettings {
		type Result = Partial<PluginSettingsStorage> | null;
		const saved = this.app.loadLocalStorage(LOCAL_STORAGE_KEY) as Result;

		return {
			inputSettings: signal({
				...DEFAULT_SETTINGS.inputSettings,
				...saved?.inputSettings,
			}),
			graphSettings: signal({
				...DEFAULT_SETTINGS.graphSettings,
				...saved?.graphSettings,
			}),
			outputSettings: signal({
				...DEFAULT_SETTINGS.outputSettings,
				...saved?.outputSettings,
			}),
		};
	}

	clearSettings(): void {
		this.app.saveLocalStorage(LOCAL_STORAGE_KEY, null);
	}

	private async _toggleView() {
		if (this.viewsVisibleCount.peek() > 0) {
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

	async saveRecording(data: Uint8Array) {
		const { workspace, vault, fileManager } = this.app;

		const outputSettings = this.model.settings.outputSettings.peek();
		const basename = outputSettings.filename || getDefaultFilename();
		const filename = `${basename}.${MIME_TYPE_TO_EXTENSION[outputSettings.mimeType]}`;
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
