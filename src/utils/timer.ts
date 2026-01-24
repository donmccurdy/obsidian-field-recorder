import { assert } from "./assert";

type TimerState = "stopped" | "paused" | "running";

/** Timer utility. Tracks runtime with start/pause/resume/stop API. */
export class Timer {
	private state: TimerState = "stopped";
	private durationBeforeCurrentRangeMs = Number.NEGATIVE_INFINITY;
	private currentRangeStartMs = Number.NEGATIVE_INFINITY;
	start() {
		assert(this.state === "stopped");
		this.durationBeforeCurrentRangeMs = 0;
		this.currentRangeStartMs = Date.now();
		this.state = "running";
	}
	pause() {
		assert(this.state === "running");
		this.durationBeforeCurrentRangeMs += Date.now() - this.currentRangeStartMs;
		this.currentRangeStartMs = Number.NEGATIVE_INFINITY;
		this.state = "paused";
	}
	resume() {
		assert(this.state === "paused");
		this.currentRangeStartMs = Date.now();
		this.state = "running";
	}
	stop() {
		assert(this.state === "running" || this.state === "paused");
		this.durationBeforeCurrentRangeMs = Number.NEGATIVE_INFINITY;
		this.currentRangeStartMs = Number.NEGATIVE_INFINITY;
		this.state = "stopped";
	}
	getDurationMs() {
		if (this.state === "paused") {
			return this.durationBeforeCurrentRangeMs;
		}
		return this.durationBeforeCurrentRangeMs + Date.now() - this.currentRangeStartMs;
	}
}
