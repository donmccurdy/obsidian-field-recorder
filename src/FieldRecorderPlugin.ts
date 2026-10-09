import { effect, signal } from "@preact/signals-core";
import {
	MarkdownView,
	Plugin,
	setIcon,
	type TFile,
	type Workspace,
	type WorkspaceLeaf,
} from "obsidian";
import { getDefaultFilename } from "utils/filesystem";
import { LOCAL_STORAGE_KEY, MIME_TYPE_TO_EXTENSION, VIEW_TYPE_FIELD_RECORDER } from "./constants";
import { FieldRecorderModel } from "./FieldRecorderModel";
import { FieldRecorderSettingTab } from "./FieldRecorderSettingTab";
import { createState, type FieldRecorderState } from "./FieldRecorderState";
import { FieldRecorderView } from "./FieldRecorderView";
import {
	DEFAULT_SETTINGS,
	type FieldRecorderSettings,
	type FieldRecorderSettingsFileStorage,
	type FieldRecorderSettingsLocalStorage,
	type FieldRecorderSettingsValues,
} from "./settings";
import type { Mode } from "./types";
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
	wakeLock: WakeLockSentinel | null = null;
	ribbonIconEl: HTMLElement | null = null;
	statusBarItemEl: HTMLElement | null = null;

	async onload() {
		this.state = createState(await this.loadSettings());
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

		this.addSettingTab(new FieldRecorderSettingTab(this.app, this));
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
		this.register(effect(() => void this._updateWakeLock(this.state.mode.value)));

		this.register(
			effect(() => {
				const mode = this.state.mode.value;
				const isViewActive = this.state.viewsActiveDebounced.value > 0;
				const isViewVisible = this.state.viewsVisibleDebounced.value > 0;

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
				void this.saveSettings({
					pluginSettings: settings.pluginSettings.value,
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

	async saveSettings(settings: FieldRecorderSettingsValues): Promise<void> {
		const { pluginSettings, inputSettings, graphSettings, outputSettings } = settings;

		await this.saveData({
			version: 1,
			pluginSettings,
		} satisfies FieldRecorderSettingsFileStorage);

		this.app.saveLocalStorage(LOCAL_STORAGE_KEY, {
			version: 1,
			inputSettings,
			graphSettings,
			outputSettings,
		} satisfies FieldRecorderSettingsLocalStorage);
	}

	async loadSettings(): Promise<FieldRecorderSettings> {
		type FileStorageResult = Partial<FieldRecorderSettingsFileStorage> | null;
		type LocalStorageResult = Partial<FieldRecorderSettingsLocalStorage> | null;

		const fileData = (await this.loadData()) as FileStorageResult;
		const localData = this.app.loadLocalStorage(LOCAL_STORAGE_KEY) as LocalStorageResult;

		return {
			pluginSettings: signal({
				...DEFAULT_SETTINGS.pluginSettings,
				...fileData?.pluginSettings,
			}),
			inputSettings: signal({
				...DEFAULT_SETTINGS.inputSettings,
				...localData?.inputSettings,
			}),
			graphSettings: signal({
				...DEFAULT_SETTINGS.graphSettings,
				...localData?.graphSettings,
			}),
			outputSettings: signal({
				...DEFAULT_SETTINGS.outputSettings,
				...localData?.outputSettings,
			}),
		};
	}

	async clearSettings(): Promise<void> {
		await this.saveData(null);
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
		const { vault, fileManager } = this.app;

		const { filenameTemplate } = this.state.settings.pluginSettings.peek();
		const outputSettings = this.state.settings.outputSettings.peek();

		const basename = outputSettings.filename || getDefaultFilename(filenameTemplate);
		const filename = `${basename}.${MIME_TYPE_TO_EXTENSION[outputSettings.mimeType]}`;
		const path = await fileManager.getAvailablePathForAttachment(filename);
		const file = await vault.createBinary(path, data);

		this.showRecording(file);
	}

	showRecording(file: TFile): void {
		const { workspace, fileManager } = this.app;
		const { embedPosition } = this.state.settings.pluginSettings.peek();

		const activeView = getActiveMarkdownView(this.app.workspace);

		if (!activeView?.file) {
			void workspace.getLeaf(true).openFile(file);
			return;
		}

		const markdownLink = fileManager.generateMarkdownLink(file, activeView.file.path);

		switch (embedPosition) {
			case "cursor":
				activeView.editor.replaceRange(`!${markdownLink}`, activeView.editor.getCursor());
				break;

			case "start":
				activeView.editor.replaceRange(`!${markdownLink}\n`, { line: 0, ch: 0 });
				break;

			case "end":
				activeView.editor.replaceRange(`\n!${markdownLink}`, {
					line: activeView.editor.lastLine(),
					ch: activeView.editor.getLine(activeView.editor.lastLine()).length,
				});
				break;
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

	private async _updateWakeLock(mode: Mode) {
		if (!("wakeLock" in navigator)) return;

		if (mode === "record" && !this.wakeLock) {
			try {
				this.wakeLock = await navigator.wakeLock.request("screen");
				this.wakeLock.addEventListener("release", () => {
					this.wakeLock = null;
				});
			} catch {
				// Permission denied; fail silently and allow recording.
			}
		} else if (mode !== "record" && this.wakeLock) {
			await this.wakeLock.release();
		}
	}
}

function getActiveMarkdownView(workspace: Workspace): MarkdownView | null {
	const leaf = workspace.getMostRecentLeaf();
	if (leaf && leaf.view instanceof MarkdownView && leaf.view.file) {
		return leaf.view;
	}
	return null;
}
