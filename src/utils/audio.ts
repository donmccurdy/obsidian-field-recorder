import type { Mode, SampleWindow } from "../types";

/**
 * For index i ∈ [0, binCount], where zero is "now", returns the corresponding
 * index in the circular sample buffer.
 */
export function getSampleBinIndex(i: number, window: SampleWindow): number {
	return window.binIndex - i >= 0 ? window.binIndex - i : window.binCount + window.binIndex - i;
}

/**
 * Updates the sample window, writing timestamp, level, and clipping status
 * to the current sample bin. This function can be called many times per
 * 125ms sample bin and will aggregate data into the bin incrementally.
 */
export function updateSampleWindow(mode: Mode, window: SampleWindow) {
	const { startTimeMs, binCount, binSizeMs } = window;

	// TODO: Could use timer instead, pause waveform when paused. Needs meter.
	const timeMs = Date.now() - startTimeMs;
	const binIndex = Math.floor(timeMs / binSizeMs) % binCount;
	const binTimeMs = window.sampleTimestamps[binIndex];

	window.binIndex = binIndex;

	if (mode === "off" || timeMs - binTimeMs > binSizeMs) {
		window.sampleTimestamps[binIndex] = timeMs;
		window.sampleLevels[binIndex] = 0;
		window.sampleClips[binIndex] = 0;
	}

	if (mode === "off") {
		return;
	}

	const input = window.timeDomainData[0];

	let level = window.sampleLevels[binIndex];
	let clipped = window.sampleClips[binIndex] === 1;
	let peakInstantPower = 0;

	for (let i = 0; i < input.length; i++) {
		peakInstantPower = Math.max(input[i] ** 2, peakInstantPower);
		if (Math.abs(input[i]) > 1) {
			clipped = true;
		}
	}

	// https://stackoverflow.com/questions/44360301/web-audio-api-creating-a-peak-meter-with-analysernode
	const peakInstantPowerDecibels = Math.max(10 * Math.log10(Math.max(peakInstantPower, 1e-6)));
	const sampleLevel = remap(peakInstantPowerDecibels, window.referenceLevelDb, 0, 0, 1);
	level = Math.max(sampleLevel, level, 1e-4);
	clipped ||= sampleLevel > window.clipLevel;

	window.sampleLevels[binIndex] = level;
	window.sampleClips[binIndex] = clipped ? 1 : 0;
}

function remap(value: number, low1: number, high1: number, low2: number, high2: number) {
	return low2 + ((high2 - low2) * (value - low1)) / (high1 - low1);
}

/**
 * Resets sample window to default state.
 */
export function resetSampleWindow(window: SampleWindow) {
	window.binIndex = 0;
	window.startTimeMs = Date.now();
	window.sampleTimestamps.fill(0);
	window.sampleLevels.fill(0);
	window.sampleClips.fill(0);
}
