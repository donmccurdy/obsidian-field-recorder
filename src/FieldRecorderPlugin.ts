import { effect, signal } from "@preact/signals-core";
import { MarkdownView, Plugin, setIcon, type WorkspaceLeaf } from "obsidian";
import { LOCAL_STORAGE_KEY, MIME_TYPE_TO_EXTENSION, VIEW_TYPE_FIELD_RECORDER } from "./constants";
import { FieldRecorderModel } from "./FieldRecorderModel";
import {
	DEFAULT_SETTINGS,
	type FieldRecorderSettings,
	type FieldRecorderSettingsPersistentV1,
} from "./FieldRecorderSettings";
import { createState, type FieldRecorderState } from "./FieldRecorderState";
import { FieldRecorderView } from "./FieldRecorderView";
import type { Mode } from "./types";
import { getDefaultFilename } from "./utils/filesystem";
import { frame } from "./utils/signals";
import { getTheme } from "./utils/theme";

/**
 * Entrypoint of Field Recorder Obsidian Plugin.
 *
 * Creates singleton resources for the plugin (model, state). Plugin state is
 * largely managed by Signals, and effects registered in the plugin respond
 * to changes in Signal state.
 */
export class FieldRecorderPlugin extends Plugin {
	state: FieldRecorderState;
	model: FieldRecorderModel;
	ribbonIconEl: HTMLElement | null = null;
	statusBarItemEl: HTMLElement | null = null;

	onload() {
		this.state = createState(this.loadSettings());
		this.model = this.addChild(new FieldRecorderModel(this.state));
		this.ribbonIconEl = this.addRibbonIcon("mic", "Open/close field recorder", () =>
			this._toggleView(),
		);

		this.registerCommands();
		this.registerEffects();
		this.registerView(VIEW_TYPE_FIELD_RECORDER, (leaf: WorkspaceLeaf) => {
			const { state, model } = this;
			return new FieldRecorderView(leaf, { state, model });
		});
	}

	update() {
		const { model, app, state } = this;

		if (state.mode.peek() !== "off") {
			model.update();
			for (const leaf of app.workspace.getLeavesOfType(VIEW_TYPE_FIELD_RECORDER)) {
				if (leaf.view instanceof FieldRecorderView) {
					leaf.view.update();
				}
			}
		}
	}

	private registerCommands() {
		const model = this.model;

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
				if (checking) return this.state.mode.peek() === "monitor";
				model.startRecording();
				return true;
			},
		});

		this.addCommand({
			id: "pause",
			name: "Pause recording audio",
			checkCallback: (checking) => {
				if (checking) return this.state.mode.peek() === "record";
				model.pauseRecording();
				return true;
			},
		});

		this.addCommand({
			id: "stop",
			name: "Stop recording audio",
			checkCallback: (checking) => {
				if (checking) return this.state.mode.peek() === "record";
				model.stopRecording();
				return true;
			},
		});
	}

	private registerEffects() {
		const model = this.model;

		const onDataAvailable = (bytes: Uint8Array) => this.saveRecording(bytes);
		model.addEventListener("dataavailable", onDataAvailable);
		this.register(() => model.removeEventListener("dataavailable", onDataAvailable));

		this.register(effect(() => this._updateMicIndicator(this.state.mode.value)));

		this.register(
			effect(() => {
				const mode = this.state.mode.value;
				const isViewActive = this.state.viewsActive.value > 0;
				const isViewVisible = this.state.viewsVisible.value > 0;

				// View has just opened or come into view. Start the mic.
				if (isViewActive && isViewVisible && mode === "off") {
					void model.startMonitoring();
				}

				// View is out of view, and recording is idle. Stop the mic.
				if (isViewActive && !isViewVisible && mode === "monitor") {
					model.stopAll();
				}

				// View is not running, and necessarily not open. Stop the mic.
				if (!isViewActive && !isViewVisible && mode !== "off") {
					model.stopAll();
				}
			}),
		);

		this.register(
			effect(() => {
				const settings = this.state.settings;
				this.saveSettings({
					version: 1,
					inputSettings: settings.inputSettings.value,
					graphSettings: settings.graphSettings.value,
					outputSettings: settings.outputSettings.value,
				});
			}),
		);

		this.registerEvent(
			this.app.workspace.on("css-change", () => {
				this.state.theme.value = getTheme(document.body);
			}),
		);

		this.register(frame(() => this.update()));
	}

	saveSettings(settings: FieldRecorderSettingsPersistentV1): void {
		this.app.saveLocalStorage(LOCAL_STORAGE_KEY, settings);
	}

	loadSettings(): FieldRecorderSettings {
		type Result = Partial<FieldRecorderSettingsPersistentV1> | null;
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
		if (this.state.viewsVisible.peek() > 0) {
			this._closeView();
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

	private _closeView() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_FIELD_RECORDER);
	}

	async saveRecording(data: Uint8Array) {
		const { workspace, vault, fileManager } = this.app;

		const outputSettings = this.state.settings.outputSettings.peek();
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

	private _updateMicIndicator(mode: Mode) {
		this.ribbonIconEl!.toggleClass("is-active", mode !== "off");

		if (mode === "record") {
			this.statusBarItemEl = this.addStatusBarItem();
			const iconEl = this.statusBarItemEl.createEl("span");
			iconEl.toggleClass("status-bar-item-icon", true);
			setIcon(iconEl, "mic");
		} else if (this.statusBarItemEl) {
			this.statusBarItemEl.remove();
			this.statusBarItemEl = null;
		}
	}
}
