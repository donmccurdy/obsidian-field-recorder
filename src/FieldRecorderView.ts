import { effect } from "@preact/signals-core";
import { ItemView, Setting, setIcon, type WorkspaceLeaf } from "obsidian";
import { getDefaultFilename } from "utils";
import {
	MIME_TYPE_TO_FORMAT,
	SUPPORTED_BITRATES,
	SUPPORTED_MIME_TYPES,
	VIEW_TYPE_FIELD_RECORDER,
} from "./constants";
import type { FieldRecorderModel } from "./FieldRecorderModel";
import type { FieldRecorderPlugin } from "./FieldRecorderPlugin";

type FieldRecorderViewProps = {
	plugin: FieldRecorderPlugin;
	model: FieldRecorderModel;
};

export class FieldRecorderView extends ItemView {
	private plugin: FieldRecorderPlugin;
	private model: FieldRecorderModel;
	private formSubscriptions: (() => void)[] = [];

	constructor(leaf: WorkspaceLeaf, props: FieldRecorderViewProps) {
		super(leaf);
		this.plugin = props.plugin;
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

	onload() {
		this.register(this.model.inputDevices.subscribe(() => void this.onOpen()));
		this.register(this.model.supportedConstraints.subscribe(() => void this.onOpen()));
	}

	protected async onOpen(): Promise<void> {
		const { plugin, containerEl } = this;

		containerEl.toggleClass("fieldrec-view", true);
		containerEl.empty();

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

		const onFilenameChange = () => {
			plugin.settings.filename = filenameEl.value;
			void plugin.saveSettings();
		};
		filenameEl.addEventListener("change", onFilenameChange);
		this.formSubscriptions.push(() => filenameEl.removeEventListener("change", onFilenameChange));

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

		const onRecord = () => this.model.startRecording();
		recordBtnEl.addEventListener("click", onRecord);
		this.formSubscriptions.push(() => recordBtnEl.removeEventListener("click", onRecord));

		const pauseBtnEl = btnRowEl.createEl("button", {
			title: "Pause",
			cls: ["fieldrec-btn-icon", "-pause"],
			attr: { disabled: "" },
		});
		setIcon(pauseBtnEl, "pause");
		const onPause = () => this.model.pauseRecording();
		pauseBtnEl.addEventListener("click", onPause);
		this.formSubscriptions.push(() => pauseBtnEl.removeEventListener("click", onPause));

		const stopBtnEl = btnRowEl.createEl("button", {
			title: "Stop",
			cls: ["fieldrec-btn-icon", "-stop"],
			attr: { disabled: "" },
		});
		setIcon(stopBtnEl, "square");
		const onStop = () => this.model.stopRecording();
		stopBtnEl.addEventListener("click", onStop);
		this.formSubscriptions.push(() => stopBtnEl.removeEventListener("click", onStop));

		this.formSubscriptions.push(
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

		const supportedConstraints = this.model.supportedConstraints.peek();
		const inputDevices = this.model.inputDevices.peek();

		const inputOptions = Object.fromEntries(
			inputDevices.map((device) => {
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
					Object.fromEntries(
						SUPPORTED_MIME_TYPES.map((mimeType) => [mimeType, MIME_TYPE_TO_FORMAT[mimeType]!]),
					),
				)
				.setValue(plugin.settings.mimeType)
				.onChange(async (value) => {
					plugin.settings.mimeType = value;
					await plugin.saveSettings();
				}),
		);

		const autoGainControlAvailable = supportedConstraints.autoGainControl === true;
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

		new Setting(settingsSectionEl).setName("Gain").addSlider((slider) => {
			slider
				.setInstant(true)
				.setLimits(-5, +5, 0.05)
				.setDynamicTooltip()
				.setValue(plugin.settings.gain)
				.onChange(async (value) => {
					plugin.settings.gain = value;
					await plugin.saveSettings();
				});
		});

		// TODO: Has no effect if voice isolation is on, and should be disabled.
		const noiseSuppressionAvailable = supportedConstraints.noiseSuppression === true;
		new Setting(settingsSectionEl)
			.setName("Noise suppression")
			.setDisabled(!noiseSuppressionAvailable)
			.setDesc(
				noiseSuppressionAvailable ? "Removes background noise." : "Unavailable on current device.",
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

		const voiceIsolationAvailable = supportedConstraints.voiceIsolation === true;
		new Setting(settingsSectionEl)
			.setName("Voice isolation")
			.setDisabled(!voiceIsolationAvailable)
			.setDesc(
				voiceIsolationAvailable
					? "Removes non-vocal noise; stronger form of noise suppression."
					: "Unavailable on current device.",
			)
			.addToggle((toggle) => {
				toggle
					.setDisabled(!voiceIsolationAvailable)
					.setValue(plugin.settings.voiceIsolation)
					.onChange(async (value) => {
						plugin.settings.voiceIsolation = value;
						await plugin.saveSettings();
					});
			});

		const echoCancellationAvailable = supportedConstraints.echoCancellation === true;
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
		this.plugin.updateViewIndicator();
	}

	async onClose(): Promise<void> {
		this.model.stopAll();
		this.formSubscriptions.forEach((unsub) => void unsub());
		this.formSubscriptions.length = 0;
		this.plugin.updateViewIndicator();
	}
}
