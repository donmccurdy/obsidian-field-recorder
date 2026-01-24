import {App, PluginSettingTab, Setting} from "obsidian";
import FieldRecorderPlugin from "./main";
import { SUPPORTED_BITRATE_MODES, SUPPORTED_BITRATES, SUPPORTED_MIME_TYPES } from "./constants";

export interface FieldRecorderPluginSettings {
	/** Audio recording quality (bits / second). */
	bitrate: number;
	/** Audio recording bitrate mode. */
	bitrateMode: 'variable' | 'constant';
	/** Audio recording format. */
	mimeType: string;
}

export const DEFAULT_SETTINGS: FieldRecorderPluginSettings = {
	bitrate: 192000,
	bitrateMode: 'variable',
	mimeType: SUPPORTED_MIME_TYPES.includes('audio/mp4') ? 'audio/mp4' : SUPPORTED_MIME_TYPES[0] as string,
}

export class FieldRecorderSettingTab extends PluginSettingTab {
	plugin: FieldRecorderPlugin;

	constructor(app: App, plugin: FieldRecorderPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
		    .setName('Audio quality')
		    .addDropdown((dropdown) =>
		       dropdown
				.addOptions(SUPPORTED_BITRATES)
	          	.setValue(String(this.plugin.settings.bitrate / 1000))
		          .onChange(async (value) => {
	             	this.plugin.settings.bitrate = Number(value) * 1000;
		             await this.plugin.saveSettings();
	         	 })
		    );

		new Setting(containerEl)
		    .setName('Audio quality mode')
		    .addDropdown((dropdown) =>
		       dropdown
				.addOptions(SUPPORTED_BITRATE_MODES)
	          	.setValue(this.plugin.settings.bitrateMode)
		          .onChange(async (value: 'variable' | 'constant') => {
	             	this.plugin.settings.bitrateMode = value;
		             await this.plugin.saveSettings();
	         	 })
		    );

		new Setting(containerEl)
			.setName('Audio format')
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(Object.fromEntries(SUPPORTED_MIME_TYPES.map((mimeType) =>[mimeType, mimeType])))
					.setValue(this.plugin.settings.mimeType)
					.onChange(async (value) => {
       					this.plugin.settings.mimeType = value;
            			await this.plugin.saveSettings();
					})
			);
	}
}
