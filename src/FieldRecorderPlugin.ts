import { FieldRecorderModel } from "FieldRecorderModel";
import { effect } from "@preact/signals-core";
import { Plugin, setIcon, type WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_FIELD_RECORDER } from "./constants";
import { FieldRecorderView } from "./FieldRecorderView";
import { DEFAULT_SETTINGS, type FieldRecorderPluginSettings } from "./settings";

export class FieldRecorderPlugin extends Plugin {
	model: FieldRecorderModel;
	settings: FieldRecorderPluginSettings;

	ribbonIconEl: HTMLElement | null = null;
	statusBarItemEl: HTMLElement | null = null;

	subscriptions: (() => void)[] = [];

	async onload() {
		await this.loadSettings();

		this.model = new FieldRecorderModel(this.app, this.settings);
		await this.model.onload();

		this.ribbonIconEl = this.addRibbonIcon("mic", "Open/close field recorder", async () => {
			await this.toggleView();
		});

		this.addCommand({
			id: "open",
			name: "Open",
			callback: async () => {
				await this.activateView();
			},
		});

		this.addCommand({
			id: "close",
			name: "Close",
			checkCallback: (checking) => {
				if (checking) {
					const state = this.model.state.peek();
					return state === "off" || state === "idle";
				}
				void this.deactivateView();
				return true;
			},
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

		this.registerView(
			VIEW_TYPE_FIELD_RECORDER,
			(leaf: WorkspaceLeaf) => new FieldRecorderView(leaf, { plugin: this, model: this.model }),
		);

		this.subscriptions.push(
			effect(() => {
				if (this.model.state.value === "recording") {
					this.showRecordingIndicator();
				} else {
					this.hideRecordingIndicator();
				}
			}),
		);
	}

	onunload() {
		this.model.onunload();
		this.subscriptions.forEach((unsub) => void unsub());
		this.subscriptions.length = 0;
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

	async toggleView() {
		if (this.app.workspace.getLeavesOfType(VIEW_TYPE_FIELD_RECORDER).length > 0) {
			await this.deactivateView();
		} else {
			await this.activateView();
		}
	}

	async activateView() {
		await this.app.workspace.ensureSideLeaf(VIEW_TYPE_FIELD_RECORDER, "right");
	}

	async deactivateView() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_FIELD_RECORDER);
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
		if (this.statusBarItemEl) {
			this.statusBarItemEl.remove();
			this.statusBarItemEl = null;
			this.ribbonIconEl!.toggleClass("is-active", false);
		}
	}

	onError(e: unknown) {
		console.error(e);
	}
}
