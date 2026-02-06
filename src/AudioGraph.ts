import { Component } from "obsidian";
import type { InputSettings } from "./types";

export class AudioGraph extends Component {
	private sampleBuffer: Float32Array | null = null;

	private constructor(
		public readonly ctx: AudioContext,
		public readonly stream: MediaStream,
		public readonly source: MediaStreamAudioSourceNode,
		public readonly destination: MediaStreamAudioDestinationNode,
		private readonly gain: GainNode,
		private readonly analyser: AnalyserNode,
	) {
		super();
	}

	static async createGraph(settings: InputSettings): Promise<AudioGraph> {
		const stream = await navigator.mediaDevices.getUserMedia({
			audio: {
				...settings,
				noiseSuppression: { exact: settings.noiseSuppression },
				voiceIsolation: { exact: settings.voiceIsolation },
			},
		});
		const ctx = new AudioContext({ sinkId: { type: "none" } });

		const source = ctx.createMediaStreamSource(stream);
		const gain = ctx.createGain();
		const analyser = ctx.createAnalyser();
		const destination = ctx.createMediaStreamDestination();

		source.connect(gain);
		gain.connect(analyser);
		gain.connect(destination);

		return new AudioGraph(ctx, stream, source, destination, gain, analyser);
	}

	setGain(gain: number): void {
		this.gain.gain.value = gain;
	}

	onunload(): void {
		const { ctx, stream } = this;
		void ctx.close();
		for (const track of stream.getAudioTracks()) {
			track.stop();
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
