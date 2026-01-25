import { ItemView, Setting, setIcon, type WorkspaceLeaf } from "obsidian";
import { getDefaultFilename } from "utils";
import { SUPPORTED_BITRATES, SUPPORTED_MIME_TYPES, VIEW_TYPE_FIELD_RECORDER } from "./constants";
import type FieldRecorderPlugin from "./main";

export type FieldRecorderItemViewProps = {
	plugin: FieldRecorderPlugin;
};

type FieldRecorderItemViewState = {
	state: "inactive" | "paused" | "recording";
};

export class FieldRecorderItemView extends ItemView {
	private props: FieldRecorderItemViewProps;
	private state: FieldRecorderItemViewState;
	//
	constructor(leaf: WorkspaceLeaf, props: FieldRecorderItemViewProps) {
		super(leaf);
		this.props = props;
		this.state = { state: "inactive" };
	}

	getViewType(): string {
		return VIEW_TYPE_FIELD_RECORDER;
	}

	getDisplayText(): string {
		return "Field recorder";
	}

	getIcon(): string {
		return "mic";
	}

	protected async onOpen(): Promise<void> {
		const { containerEl } = this;
		const { plugin } = this.props;

		containerEl.empty();

		const recordSectionEl = containerEl.createEl("section", {
			cls: ["fieldrec-section", "fieldrec-section-record"],
		});

		const filenameEl = recordSectionEl.createEl("input", {
			placeholder: getDefaultFilename(),
			cls: "fieldrec-input",
			attr: {
				type: "text",
				spellcheck: "false",
			},
		});
		// TODO: Needs cleanup?
		filenameEl.addEventListener("change", () => {
			plugin.settings.filename = filenameEl.value;
			void plugin.saveSettings();
		});

		const canvasEl = recordSectionEl.createEl("canvas", {
			attr: {
				width: 200,
				height: 100,
			},
		});
		const ctx = canvasEl.getContext("2d")!;
		const computedStyle = window.getComputedStyle(canvasEl);
		const accentColor = computedStyle.getPropertyValue("--interactive-accent");
		const backgroundColor = computedStyle.getPropertyValue("--background-modifier-form-field");
		ctx.fillStyle = backgroundColor;
		ctx.fillRect(0, 0, 200, 100);
		ctx.fillStyle = accentColor;
		ctx.fillRect(4, 4, 4, 4);

		const btnRowEl = recordSectionEl.createEl("div", { cls: "fieldrec-btn-row" });

		const recordBtnEl = btnRowEl.createEl("button", {
			title: "Start",
			cls: "fieldrec-btn-icon",
		});
		setIcon(recordBtnEl, "mic");

		const pauseBtnEl = btnRowEl.createEl("button", {
			title: "Pause",
			cls: "fieldrec-btn-icon",
			attr: { disabled: "" },
		});
		setIcon(pauseBtnEl, "pause");

		const stopBtnEl = btnRowEl.createEl("button", {
			title: "Stop",
			cls: "fieldrec-btn-icon",
			attr: { disabled: "" },
		});
		setIcon(stopBtnEl, "square");

		const discardBtnEl = btnRowEl.createEl("button", {
			title: "Discard",
			cls: "fieldrec-btn-icon",
			attr: { disabled: "" },
		});
		setIcon(discardBtnEl, "trash");

		const settingsSectionEl = containerEl.createEl("section", {
			cls: ["fieldrec-section", "fieldrec-section-settings"],
		});
		settingsSectionEl.createEl("h5", { text: "Audio settings" });

		new Setting(settingsSectionEl).setName("Quality").addDropdown((dropdown) =>
			dropdown
				.addOptions(SUPPORTED_BITRATES)
				.setValue(String(plugin.settings.bitrate / 1000))
				.onChange(async (value) => {
					plugin.settings.bitrate = Number(value) * 1000;
					await plugin.saveSettings();
				}),
		);

		new Setting(settingsSectionEl).setName("Format").addDropdown((dropdown) =>
			dropdown
				.addOptions(
					Object.fromEntries(SUPPORTED_MIME_TYPES.map((mimeType) => [mimeType, mimeType])),
				)
				.setValue(plugin.settings.mimeType)
				.onChange(async (value) => {
					plugin.settings.mimeType = value;
					await plugin.saveSettings();
				}),
		);

		new Setting(settingsSectionEl).setName("Auto gain control").addToggle((toggle) => {
			toggle.setValue(plugin.settings.autoGainControl).onChange(async (value) => {
				plugin.settings.autoGainControl = value;
				await plugin.saveSettings();
			});
		});

		new Setting(settingsSectionEl).setName("Noise suppression").addToggle((toggle) => {
			toggle.setValue(plugin.settings.noiseSuppression).onChange(async (value) => {
				plugin.settings.noiseSuppression = value;
				await plugin.saveSettings();
			});
		});

		new Setting(settingsSectionEl).setName("Echo cancellation").addToggle((toggle) => {
			toggle.setValue(plugin.settings.echoCancellation).onChange(async (value) => {
				plugin.settings.echoCancellation = value;
				await plugin.saveSettings();
			});
		});
	}

	async onClose(): Promise<void> {
		return Promise.resolve();
	}
}
