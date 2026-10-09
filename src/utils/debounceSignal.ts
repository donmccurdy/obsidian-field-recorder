import { effect, type Signal, signal } from "@preact/signals-core";

/**
 * See: https://github.com/preactjs/signals/discussions/492
 */
export const debounceSignal = <T>(targetSignal: Signal<T>, timeoutMs = 0): Signal<T> => {
	const debounceSignal = signal<T>(targetSignal.value);

	effect(() => {
		const value = targetSignal.value;
		const timeout = setTimeout(() => {
			debounceSignal.value = value;
		}, timeoutMs);
		return () => {
			clearTimeout(timeout);
		};
	});

	return debounceSignal;
};
