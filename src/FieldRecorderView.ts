import { WaveformView } from "WaveformView";
import { effect } from "@preact/signals-core";
import { ItemView, type Setting, setIcon, type WorkspaceLeaf } from "obsidian";
import { getDefaultFilename } from "utils";
import { VIEW_TYPE_FIELD_RECORDER } from "./constants";
import type { FieldRecorderModel } from "./FieldRecorderModel";
import type { FieldRecorderPlugin } from "./FieldRecorderPlugin";
import { createSetting, type SettingKey } from "./settings";

type FieldRecorderViewProps = {
	plugin: FieldRecorderPlugin;
	model: FieldRecorderModel;
};

export class FieldRecorderView extends ItemView {
	private plugin: FieldRecorderPlugin;
	private model: FieldRecorderModel;
	// TODO: Not partial?
	private settings: Partial<Record<SettingKey, Setting>> | null = null;
	private waveformView: WaveformView | null = null;
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
	}

	tick() {
		this.waveformView!.tick();
	}

	protected async onOpen(): Promise<void> {
		const { plugin, model, containerEl } = this;
		const { palette, processor } = plugin;

		const { inputSettings, graphSettings, outputSettings } = plugin.settings;

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

		const supportedConstraints = {} as Record<string, boolean>; // TODO: model.supportedConstraints.peek();
		const inputDevices = [] as MediaDeviceInfo[]; // TODO: model.inputDevices.peek();

		const inputOptions = Object.fromEntries(
			inputDevices.map((device) => {
				const label = device.label.replace(/\(.*\)/, "").trim();
				return [device.deviceId, label];
			}),
		);

		const el = settingsSectionEl;

		this.settings = {
			deviceId: createSetting(el, "deviceId", inputSettings, { options: inputOptions }),
			bitrate: createSetting(el, "bitrate", outputSettings),
			mimeType: createSetting(el, "mimeType", outputSettings),
			autoGainControl: createSetting(el, "autoGainControl", inputSettings),
			gain: createSetting(el, "gain", graphSettings),
			noiseSuppression: createSetting(el, "noiseSuppression", inputSettings),
			voiceIsolation: createSetting(el, "voiceIsolation", inputSettings),
			echoCancellation: createSetting(el, "echoCancellation", inputSettings),
		};

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
