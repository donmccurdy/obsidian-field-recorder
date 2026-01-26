export class Timer {
	private durationBeforeResumeMs = -1;
	private timeStartedOrResumedMs = -1;
	start() {
		this.durationBeforeResumeMs = 0;
		this.timeStartedOrResumedMs = Date.now();
	}
	pause() {
		this.durationBeforeResumeMs += Date.now() - this.timeStartedOrResumedMs;
	}
	stop() {
		this.durationBeforeResumeMs = -1;
		this.timeStartedOrResumedMs = -1;
	}
	getDurationMs() {
		return this.durationBeforeResumeMs + Date.now() - this.timeStartedOrResumedMs;
	}
}
