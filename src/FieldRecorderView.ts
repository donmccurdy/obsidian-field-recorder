import { effect } from "@preact/signals-core";
import { ItemView, Setting, setIcon, type WorkspaceLeaf } from "obsidian";
import { getDefaultFilename } from "utils";
import { SUPPORTED_BITRATES, SUPPORTED_MIME_TYPES, VIEW_TYPE_FIELD_RECORDER } from "./constants";
import type { FieldRecorderModel } from "./FieldRecorderModel";
import type FieldRecorderPlugin from "./main";

type FieldRecorderViewProps = {
	plugin: FieldRecorderPlugin;
	model: FieldRecorderModel;
};

type FieldRecorderViewState = {
	state: "inactive" | "paused" | "recording";
	inputDevices: MediaDeviceInfo[];
	supportedConstraints: MediaTrackSupportedConstraints;
};

export class FieldRecorderView extends ItemView {
	private props: FieldRecorderViewProps;
	private state: FieldRecorderViewState;
	private model: FieldRecorderModel;
	private subscriptions: (() => void)[] = [];

	constructor(leaf: WorkspaceLeaf, props: FieldRecorderViewProps) {
		super(leaf);
		this.props = props;
		this.state = {
			state: "inactive",
			inputDevices: [],
			supportedConstraints: {},
		};
		this.model = props.model;
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

		containerEl.toggleClass("fieldrec-view", true);
		containerEl.empty();

		const devices = await navigator.mediaDevices.enumerateDevices();
		this.state.inputDevices = devices.filter(({ kind }) => kind === "audioinput");
		// TODO: Needs cleanup? Needs better lifecycle?
		navigator.mediaDevices.addEventListener("devicechange", () => {
			if (this.state.state === "inactive") {
				void this.onOpen();
			}
		});

		this.state.supportedConstraints = navigator.mediaDevices.getSupportedConstraints();

		const recordSectionEl = containerEl.createEl("section", {
			cls: ["fieldrec-section", "fieldrec-section-record"],
		});

		const filenameEl = recordSectionEl.createEl("input", {
			value: plugin.settings.filename,
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
			cls: ["fieldrec-btn-icon", "-record"],
		});
		setIcon(recordBtnEl, "mic");
		recordBtnEl.addEventListener("click", () => {
			this.model.startRecording();
		});

		const pauseBtnEl = btnRowEl.createEl("button", {
			title: "Pause",
			cls: ["fieldrec-btn-icon", "-pause"],
			attr: { disabled: "" },
		});
		setIcon(pauseBtnEl, "pause");
		pauseBtnEl.addEventListener("click", () => {
			this.model.pauseRecording();
		});

		const stopBtnEl = btnRowEl.createEl("button", {
			title: "Stop",
			cls: ["fieldrec-btn-icon", "-stop"],
			attr: { disabled: "" },
		});
		setIcon(stopBtnEl, "square");
		stopBtnEl.addEventListener("click", () => {
			this.model.stopRecording();
		});

		// const discardBtnEl = btnRowEl.createEl("button", {
		// 	title: "Discard",
		// 	cls: "fieldrec-btn-icon",
		// 	attr: { disabled: "" },
		// });
		// setIcon(discardBtnEl, "trash");

		this.subscriptions.push(
			effect(() => {
				const state = this.model.state.value;
				recordBtnEl.disabled = state === "off" || state === "recording";
				pauseBtnEl.disabled = state !== "recording";
				stopBtnEl.disabled = state === "off" || state === "idle";
			}),
		);

		const settingsSectionEl = containerEl.createEl("section", {
			cls: ["fieldrec-section", "fieldrec-section-settings"],
		});
		settingsSectionEl.createEl("h5", { text: "Audio settings" });

		const inputOptions = Object.fromEntries(
			this.state.inputDevices.map((device) => {
				const label = device.label.replace(/\(.*\)/, "").trim();
				return [device.deviceId, label];
			}),
		);

		new Setting(settingsSectionEl).setName("Input").addDropdown((dropdown) =>
			dropdown
				.addOptions(inputOptions)
				.setValue(plugin.settings.inputDeviceId) // TODO: Prevent from syncing?
				.onChange(async (value) => {
					plugin.settings.inputDeviceId = value;
					await plugin.saveSettings();
				}),
		);

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

		const autoGainControlAvailable = this.state.supportedConstraints.autoGainControl === true;
		new Setting(settingsSectionEl)
			.setName("Auto gain control")
			.setDisabled(!autoGainControlAvailable)
			.setDesc(
				autoGainControlAvailable
					? "Manages gain to maintain a steady overall volume level."
					: "Unavailable on current device.",
			)
			.addToggle((toggle) => {
				toggle
					.setDisabled(!autoGainControlAvailable)
					.setValue(plugin.settings.autoGainControl)
					.onChange(async (value) => {
						plugin.settings.autoGainControl = value;
						await plugin.saveSettings();
					});
			});

		const noiseSuppressionAvailable = this.state.supportedConstraints.noiseSuppression === true;
		new Setting(settingsSectionEl)
			.setName("Noise suppression")
			.setDisabled(!noiseSuppressionAvailable)
			.setDesc(
				noiseSuppressionAvailable
					? "Filters audio to remove background noise."
					: "Unavailable on current device.",
			)
			.addToggle((toggle) => {
				toggle
					.setDisabled(!noiseSuppressionAvailable)
					.setValue(plugin.settings.noiseSuppression)
					.onChange(async (value) => {
						plugin.settings.noiseSuppression = value;
						await plugin.saveSettings();
					});
			});

		const echoCancellationAvailable = this.state.supportedConstraints.echoCancellation === true;
		new Setting(settingsSectionEl)
			.setName("Echo cancellation")
			.setDisabled(!echoCancellationAvailable)
			.setDesc(
				echoCancellationAvailable
					? "Reduces crosstalk between output and input devices."
					: "Unavailable on current device.",
			)
			.addToggle((toggle) =>
				toggle
					.setDisabled(!echoCancellationAvailable)
					.setValue(plugin.settings.echoCancellation)
					.onChange(async (value) => {
						plugin.settings.echoCancellation = value;
						await plugin.saveSettings();
					}),
			);

		await this.model.startMicrophone();
	}

	async onClose(): Promise<void> {
		this.model.stopMicrophone();
		for (const unsub of this.subscriptions) {
			unsub();
		}
	}
}
