import { effect } from "@preact/signals-core";
import { Component } from "obsidian";
import type { PluginSettings } from "./types";

export class FieldRecorderAudioGraph extends Component {
	private sampleBuffer: Float32Array | null = null;

	private constructor(
		private readonly settings: PluginSettings,
		public readonly ctx: AudioContext,
		public readonly stream: MediaStream,
		public readonly source: MediaStreamAudioSourceNode,
		public readonly destination: MediaStreamAudioDestinationNode,
		private readonly gain: GainNode,
		private readonly analyser: AnalyserNode,
	) {
		super();
		void this.debug();
	}

	static async createGraph(settings: PluginSettings): Promise<FieldRecorderAudioGraph> {
		// TODO: On iOS we can't get the device list until after calling getUserMedia. Which,
		// is frustrating, given we need to pass a deviceId _into_ getUserMedia. But OK.
		const constraints = settings.inputSettings.peek();
		const stream = await navigator.mediaDevices.getUserMedia({ audio: { ...constraints } });
		const ctx = new AudioContext({ sinkId: { type: "none" } });

		const source = ctx.createMediaStreamSource(stream);
		const gain = ctx.createGain();
		const analyser = ctx.createAnalyser();
		const destination = ctx.createMediaStreamDestination();

		source.connect(gain);
		gain.connect(analyser);
		gain.connect(destination);

		return new FieldRecorderAudioGraph(settings, ctx, stream, source, destination, gain, analyser);
	}

	onload(): void {
		// TODO: GainNode not working on iOS?
		// https://bugs.webkit.org/show_bug.cgi?id=180696
		this.register(
			effect(() => {
				const { autoGainControl } = this.settings.inputSettings.value;
				const { gain } = this.settings.graphSettings.value;
				this.gain.gain.value = autoGainControl ? 1.0 : gain;
			}),
		);

		this.register(
			effect(() => {
				const inputSettings = this.settings.inputSettings.value;
				Promise.all(
					this.stream.getAudioTracks().map((track) => {
						return track.applyConstraints({ ...inputSettings });
					}),
				)
					.then(() => this.debug())
					.catch((e) => console.error(e));
			}),
		);
	}

	onunload(): void {
		const { ctx, stream } = this;
		void ctx.close();
		for (const track of stream.getAudioTracks()) {
			track.stop();
		}
	}

	async debug(): Promise<void> {
		for (const track of this.stream.getAudioTracks()) {
			const capabilities = track.getCapabilities();
			const settings = track.getSettings();
			const constraints = track.getConstraints();
			console.debug("AudioGraph::debug", { track, settings, constraints, capabilities });
		}
	}

	getFloatTimeDomainData(): Float32Array {
		if (!this.sampleBuffer || this.sampleBuffer.length !== this.analyser.fftSize) {
			this.sampleBuffer = new Float32Array(this.analyser.fftSize);
		}
		this.analyser.getFloatTimeDomainData(this.sampleBuffer);
		return this.sampleBuffer;
	}
}
