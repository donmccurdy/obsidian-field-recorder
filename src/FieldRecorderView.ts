import { computed, effect, type Signal, signal } from "@preact/signals-core";
import {
	type DropdownComponent,
	ItemView,
	Platform,
	type Setting,
	setIcon,
	type WorkspaceLeaf,
} from "obsidian";
import { VIEW_TYPE_FIELD_RECORDER } from "./constants";
import type { FieldRecorderModel } from "./FieldRecorderModel";
import {
	createSetting,
	type GraphSettings,
	type InputSettings,
	type OutputSettings,
} from "./FieldRecorderSettings";
import type { FieldRecorderState } from "./FieldRecorderState";
import { getDefaultFilename } from "./utils/filesystem";
import { WaveformView } from "./WaveformView";

type FieldRecorderViewProps = {
	state: FieldRecorderState;
	model: FieldRecorderModel;
};

export class FieldRecorderView extends ItemView {
	private state: FieldRecorderState;
	private model: FieldRecorderModel;
	private visible = signal(false);
	private ui: {
		inputSettings: Partial<Record<keyof InputSettings, Setting>>;
		graphSettings: Partial<Record<keyof GraphSettings, Setting>>;
		outputSettings: Partial<Record<keyof OutputSettings, Setting>>;
	} = { inputSettings: {}, graphSettings: {}, outputSettings: {} };
	private waveformView: WaveformView | null = null;
	inputOptions: Signal<Record<string, string>>;
	private formSubscriptions: (() => void)[] = [];

	constructor(leaf: WorkspaceLeaf, props: FieldRecorderViewProps) {
		super(leaf);

		this.state = props.state;
		this.model = props.model;

		this.inputOptions = computed(() =>
			Object.fromEntries(
				this.state.inputDevices.value.map((device) => {
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
		// To avoid sending counter to -1, skip update on first effect run.
		let creatingVisibleEffect = true;
		this.register(
			effect(() => {
				const visible = this.visible.value;
				const viewsVisible = this.state.viewsVisible;
				if (!creatingVisibleEffect) {
					viewsVisible.value = viewsVisible.peek() + (visible ? +1 : -1);
				}
			}),
		);
		creatingVisibleEffect = false;

		// Notify plugin when view visibility changes. Affected by right split and tab changes,
		// and I'm not sure if Obsidian's API has events for these.
		const observer = new IntersectionObserver((entries) => {
			this.visible.value = entries.some((entry) => entry.isIntersecting);
		});

		observer.observe(this.containerEl);

		this.register(() => {
			observer.disconnect();
			this.visible.value = false;
		});

		this.register(
			effect(() => {
				const disabled = this.state.settingsDisabled.inputSettings.value;
				for (const key in this.ui.inputSettings) {
					const settingKey = key as keyof InputSettings;
					const setting = this.ui.inputSettings[settingKey];
					setting?.setDisabled(disabled[settingKey]);
					setting?.components[0]?.setDisabled(disabled[settingKey]);
				}
			}),
		);

		this.register(
			effect(() => {
				const disabled = this.state.settingsDisabled.graphSettings.value;
				for (const key in this.ui.graphSettings) {
					const settingKey = key as keyof GraphSettings;
					const setting = this.ui.graphSettings[settingKey];
					setting?.setDisabled(disabled[settingKey]);
					setting?.components[0]?.setDisabled(disabled[settingKey]);
				}
			}),
		);

		this.register(
			effect(() => {
				const disabled = this.state.settingsDisabled.outputSettings.value;
				for (const key in this.ui.outputSettings) {
					const settingKey = key as keyof OutputSettings;
					const setting = this.ui.outputSettings[settingKey];
					setting?.setDisabled(disabled[settingKey]);
					setting?.components[0]?.setDisabled(disabled[settingKey]);
				}
			}),
		);

		this.register(
			effect(() => {
				const inputDevices = this.inputOptions.value;
				const device = this.state.activeInput.value;
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

	update() {
		this.waveformView!.update();
	}

	protected async onOpen() {
		const { state, model, containerEl } = this;

		const { inputSettings, graphSettings, outputSettings } = state.settings;

		containerEl.toggleClass("fieldrec-view", true);
		containerEl.empty();

		const recordSectionEl = containerEl.createEl("section", {
			cls: ["fieldrec-section", "-record"],
		});

		// TODO: Default filename (date) could change while plugin is open?
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

		this.waveformView = this.addChild(new WaveformView({ state, canvasEl }));

		const btnRowEl = recordSectionEl.createEl("div", { cls: "fieldrec-btn-row" });

		const recordBtnEl = btnRowEl.createEl("button", {
			title: "Record",
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
				const mode = this.state.mode.value;
				recordBtnEl.disabled = mode === "off" || mode === "record";
				pauseBtnEl.disabled = mode !== "record";
				stopBtnEl.disabled = mode === "off" || mode === "monitor";
			}),
		);

		const settingsSectionEl = containerEl.createEl("section", {
			cls: ["fieldrec-section", "-settings"],
		});

		const el = settingsSectionEl;

		this.ui.inputSettings.deviceId = createSetting(el, "deviceId", inputSettings, {
			options: this.inputOptions.peek(),
		});

		if (Platform.isDesktop) {
			this.ui.graphSettings.monitor = createSetting(el, "monitor", graphSettings);
		}

		this.ui.outputSettings.mimeType = createSetting(el, "mimeType", outputSettings);
		this.ui.outputSettings.bitrate = createSetting(el, "bitrate", outputSettings);

		if (!Platform.isIosApp) {
			this.ui.inputSettings.autoGainControl = createSetting(el, "autoGainControl", inputSettings);
			this.ui.graphSettings.gain = createSetting(el, "gain", graphSettings);
			this.ui.inputSettings.noiseSuppression = createSetting(el, "noiseSuppression", inputSettings);
			this.ui.inputSettings.voiceIsolation = createSetting(el, "voiceIsolation", inputSettings);
		}

		this.state.viewsActive.value++;

		await Promise.resolve(); // For ESLint.
	}

	async onClose() {
		this.formSubscriptions.forEach((unsub) => void unsub());
		this.formSubscriptions.length = 0;
		if (this.waveformView) {
			this.removeChild(this.waveformView);
		}
		this.state.viewsActive.value--;

		await Promise.resolve(); // For ESLint.
	}
}
