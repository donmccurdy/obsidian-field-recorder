import { type App, PluginSettingTab, type SettingDefinitionItem } from "obsidian";
import { DEFAULT_FILENAME_TEMPLATE } from "./constants";
import type { FieldRecorderPlugin } from "./FieldRecorderPlugin";
import { DEFAULT_SETTINGS, type PluginSettings } from "./settings";
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
				desc: "Accepts a date format, like {{YYYY-MM-DD}}, or {{NOTE}} for title of the current note.",
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
				desc:
					"New recordings may be embedded at the top or bottom " +
					" of the current note, or at the cursor position.",
				control: {
					type: "dropdown",
					key: "embedPosition" satisfies keyof PluginSettings,
					defaultValue: DEFAULT_SETTINGS.pluginSettings.embedPosition,
					options: {
						cursor: "Cursor",
						top: "Top",
						bottom: "Bottom",
					} satisfies Record<EmbedPosition, string>,
				},
			},
		];
	}
}
