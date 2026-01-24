import {App, PluginSettingTab, Setting} from "obsidian";
import FieldRecorderPlugin from "./main";

export interface FieldRecorderPluginSettings {
	bitrate: number;
}

export const DEFAULT_SETTINGS: FieldRecorderPluginSettings = {
	bitrate: 192
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
		    .setName('Audio recording quality')
		    .addDropdown((dropdown) =>
		       dropdown
		          .addOption('32', '32 kb/s')   // lowest
		          .addOption('96', '96 kb/s')   // low
		          .addOption('128', '128 kb/s') // medium-low
		          .addOption('160', '160 kb/s') // medium
		          .addOption('192', '192 kb/s') // medium-high
		          .addOption('256', '256 kb/s') // high
		          .addOption('320', '320 kb/s') // highest
		          .setValue(String(this.plugin.settings.bitrate))
		          .onChange(async (value) => {
		             this.plugin.settings.bitrate = Number(value);
		             await this.plugin.saveSettings();
		          })
		    );
	}
}
