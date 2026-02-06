import { WaveformView } from "WaveformView";
import { computed, effect, type Signal } from "@preact/signals-core";
import {
	type DropdownComponent,
	ItemView,
	type Setting,
	setIcon,
	type WorkspaceLeaf,
} from "obsidian";
import { getDefaultFilename } from "utils";
import {
	GRAPH_SETTING_KEYS,
	INPUT_SETTING_KEYS,
	OUTPUT_SETTING_KEYS,
	VIEW_TYPE_FIELD_RECORDER,
} from "./constants";
import type { FieldRecorderModel } from "./FieldRecorderModel";
import type { FieldRecorderPlugin } from "./FieldRecorderPlugin";
import { createSetting } from "./settings";
import type { GraphSettingKey, InputSettingKey, OutputSettingKey } from "./types";

type FieldRecorderViewProps = {
	plugin: FieldRecorderPlugin;
	model: FieldRecorderModel;
};

export class FieldRecorderView extends ItemView {
	private plugin: FieldRecorderPlugin;
	private model: FieldRecorderModel;
	private ui: {
		inputSettings: Partial<Record<InputSettingKey, Setting>>;
		graphSettings: Partial<Record<GraphSettingKey, Setting>>;
		outputSettings: Partial<Record<OutputSettingKey, Setting>>;
	} = { inputSettings: {}, graphSettings: {}, outputSettings: {} };
	private waveformView: WaveformView | null = null;
	inputOptions: Signal<Record<string, string>>;
	private formSubscriptions: (() => void)[] = [];

	constructor(leaf: WorkspaceLeaf, props: FieldRecorderViewProps) {
		super(leaf);
		this.plugin = props.plugin;
		this.model = props.model;

		this.inputOptions = computed(() =>
			Object.fromEntries(
				this.model.inputDevices.value.map((device) => {
					const label = device.label.replace(/\(.*\)/, "").trim();
					return [device.deviceId, label];
				}),
			),
		);
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
		// Notify plugin when view visibility changes. Affected by right split and tab changes,
		// and I'm not sure if Obsidian's API has events for these.
		const observer = new IntersectionObserver((entries) => {
			if (entries.some((entry) => entry.isIntersecting)) {
				this.plugin.viewsVisibleCount.value++;
			} else {
				this.plugin.viewsVisibleCount.value--;
			}
		});

		observer.observe(this.containerEl);

		this.register(() => {
			// TODO(bug): Need to check that this view was previously visible.
			this.plugin.viewsVisibleCount.value--;
			observer.disconnect();
		});

		this.register(
			effect(() => {
				const disabled = this.model.disabledSettings.inputSettings.value;
				for (const key of INPUT_SETTING_KEYS) {
					const setting = this.ui.inputSettings[key];
					setting?.setDisabled(disabled[key]);
					setting?.components[0]?.setDisabled(disabled[key]);
				}
			}),
		);

		this.register(
			effect(() => {
				const disabled = this.model.disabledSettings.graphSettings.value;
				for (const key of GRAPH_SETTING_KEYS) {
					const setting = this.ui.graphSettings[key];
					setting?.setDisabled(disabled[key]);
					setting?.components[0]?.setDisabled(disabled[key]);
				}
			}),
		);

		this.register(
			effect(() => {
				const disabled = this.model.disabledSettings.outputSettings.value;
				for (const key of OUTPUT_SETTING_KEYS) {
					const setting = this.ui.outputSettings[key];
					setting?.setDisabled(disabled[key]);
					setting?.components[0]?.setDisabled(disabled[key]);
				}
			}),
		);

		this.register(
			effect(() => {
				const inputDevices = this.inputOptions.value;
				const device = this.model.activeInput.value;
				const deviceSetting = this.ui.inputSettings.deviceId;
				const deviceDropdown = deviceSetting?.components[0] as DropdownComponent | null;
				if (deviceDropdown) {
					// TODO: No other way to clear dropdown options?
					deviceDropdown.selectEl.innerHTML = "";
					deviceDropdown.addOptions(inputDevices).setValue(device?.deviceId || "default");
				}
			}),
		);
	}

	tick() {
		this.waveformView!.tick();
	}

	protected async onOpen(): Promise<void> {
		const { plugin, model, containerEl } = this;
		const { palette, processor } = plugin;

		const { inputSettings, graphSettings, outputSettings } = model.settings;

		containerEl.toggleClass("fieldrec-view", true);
		containerEl.empty();

		const recordSectionEl = containerEl.createEl("section", {
			cls: ["fieldrec-section", "fieldrec-section-record"],
		});

		const filenameEl = recordSectionEl.createEl("input", {
			value: outputSettings.peek().filename,
			placeholder: getDefaultFilename(),
			cls: "fieldrec-input",
			attr: {
				type: "text",
				spellcheck: "false",
			},
		});

		filenameEl.addEventListener("change", () => {
			const filename = filenameEl.value;
			outputSettings.value = { ...outputSettings.peek(), filename };
		});

		const canvasEl = recordSectionEl.createEl("canvas", { attr: { width: 200, height: 100 } });

		this.waveformView = this.addChild(new WaveformView({ model, canvasEl, processor, palette }));

		const btnRowEl = recordSectionEl.createEl("div", { cls: "fieldrec-btn-row" });

		const recordBtnEl = btnRowEl.createEl("button", {
			title: "Start",
			cls: ["fieldrec-btn-icon", "-record"],
		});
		setIcon(recordBtnEl, "mic");

		recordBtnEl.addEventListener("click", () => model.startRecording());

		const pauseBtnEl = btnRowEl.createEl("button", {
			title: "Pause",
			cls: ["fieldrec-btn-icon", "-pause"],
			attr: { disabled: "" },
		});
		setIcon(pauseBtnEl, "pause");
		pauseBtnEl.addEventListener("click", () => model.pauseRecording());

		const stopBtnEl = btnRowEl.createEl("button", {
			title: "Stop",
			cls: ["fieldrec-btn-icon", "-stop"],
			attr: { disabled: "" },
		});
		setIcon(stopBtnEl, "square");
		stopBtnEl.addEventListener("click", () => model.stopRecording());

		this.formSubscriptions.push(
			effect(() => {
				const state = model.state.value;
				recordBtnEl.disabled = state === "off" || state === "recording";
				pauseBtnEl.disabled = state !== "recording";
				stopBtnEl.disabled = state === "off" || state === "idle";
			}),
		);

		const settingsSectionEl = containerEl.createEl("section", {
			cls: ["fieldrec-section", "fieldrec-section-settings"],
		});

		const el = settingsSectionEl;

		this.ui.inputSettings.deviceId = createSetting(el, "deviceId", inputSettings, {
			options: this.inputOptions.peek(),
		});
		this.ui.outputSettings.bitrate = createSetting(el, "bitrate", outputSettings);
		this.ui.outputSettings.mimeType = createSetting(el, "mimeType", outputSettings);
		this.ui.inputSettings.autoGainControl = createSetting(el, "autoGainControl", inputSettings);
		this.ui.graphSettings.gain = createSetting(el, "gain", graphSettings);
		this.ui.inputSettings.noiseSuppression = createSetting(el, "noiseSuppression", inputSettings);
		this.ui.inputSettings.voiceIsolation = createSetting(el, "voiceIsolation", inputSettings);
		this.ui.inputSettings.echoCancellation = createSetting(el, "echoCancellation", inputSettings);

		this.plugin.viewsActiveCount.value++;
	}

	async onClose(): Promise<void> {
		this.formSubscriptions.forEach((unsub) => void unsub());
		this.formSubscriptions.length = 0;
		if (this.waveformView) {
			this.removeChild(this.waveformView);
		}
		this.plugin.viewsActiveCount.value--;
	}
}
