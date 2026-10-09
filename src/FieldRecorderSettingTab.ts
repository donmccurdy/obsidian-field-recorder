import {
	type App,
	PluginSettingTab,
	type SettingDefinitionItem,
	sanitizeHTMLToDom,
} from "obsidian";
import type { FieldRecorderPlugin } from "./FieldRecorderPlugin";
import { DEFAULT_FILENAME_TEMPLATE, DEFAULT_SETTINGS, type PluginSettings } from "./settings";
import type { EmbedPosition } from "./types";

export class FieldRecorderSettingTab extends PluginSettingTab {
	plugin: FieldRecorderPlugin;

	constructor(app: App, plugin: FieldRecorderPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getControlValue(key: string) {
		const pluginSettings = this.plugin.state.settings.pluginSettings.peek();
		return pluginSettings[key as keyof PluginSettings];
	}

	setControlValue(key: string, value: unknown) {
		const pluginSettings = this.plugin.state.settings.pluginSettings;
		pluginSettings.value = { ...pluginSettings.peek(), [key]: value };
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: "Default filename for new recordings",
				desc: sanitizeHTMLToDom(
					"Accepts date formats, like {{YYYY-MM-DD}}. See" +
						` <a href="https://momentjs.com/docs/#/displaying/format/">format reference</a>.`,
				),
				control: {
					type: "text",
					key: "filenameTemplate" satisfies keyof PluginSettings,
					defaultValue: DEFAULT_SETTINGS.pluginSettings.filenameTemplate,
					placeholder: DEFAULT_FILENAME_TEMPLATE,
					validate: (tpl: string) => {
						if (tpl.match(/{{/)?.length !== tpl.match(/}}/)?.length) {
							return "Mismatched brackets.";
						}
						return;
					},
				},
			},
			{
				name: "Embed position for new recordings",
				desc: "New recordings are embedded in the current note at the start, end, or cursor position.",
				control: {
					type: "dropdown",
					key: "embedPosition" satisfies keyof PluginSettings,
					defaultValue: DEFAULT_SETTINGS.pluginSettings.embedPosition,
					options: {
						cursor: "Cursor",
						start: "Start",
						end: "End",
					} satisfies Record<EmbedPosition, string>,
				},
			},
		];
	}
}
