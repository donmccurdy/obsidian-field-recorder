import type { Theme } from "../types";

/** Returns common colors from the current theme. */
export function getTheme(rootEl: HTMLElement): Theme {
	const computedStyle = window.getComputedStyle(rootEl);
	return {
		fgColor: computedStyle.getPropertyValue("--interactive-accent"),
		bgColor: computedStyle.getPropertyValue("--background-modifier-form-field"),
		clipColor: computedStyle.getPropertyValue("--color-red"),
	};
}
