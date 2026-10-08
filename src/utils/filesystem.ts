import { DEFAULT_FILENAME_TEMPLATE } from "../settings";
import { formatTemplate } from "./format";

export function getDefaultFilename(filenameTemplate: string) {
	return formatTemplate(filenameTemplate || DEFAULT_FILENAME_TEMPLATE, { date: new Date() });
}
