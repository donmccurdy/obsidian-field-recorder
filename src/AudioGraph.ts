import { Component } from "obsidian";
import type { InputSettings } from "./FieldRecorderSettings";

/**
 * AudioContext and associated audio nodes, meant to be destroyed and rebuilt
 * when low-level audio settings are changed. Arguably this class could be
 * rolled into the FieldRecorderModel to simplify, but I think there's a decent
 * chance I'll need to extend this later to support other audio features.
 */
export class AudioGraph extends Component {
	private sampleBuffer: Float32Array | null = null;

	private constructor(
		private readonly ctx: AudioContext,
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
			video: false,
			audio: {
				// Settings UI falls back to the default device, let the stream do the same.
				deviceId: { ideal: settings.deviceId },
				autoGainControl: { exact: settings.autoGainControl },
				noiseSuppression: { exact: settings.noiseSuppression },
				voiceIsolation: { exact: settings.voiceIsolation },
				echoCancellation: { exact: false },
			},
		});
		const ctx = new AudioContext();

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

	setMonitor(monitor: boolean): void {
		try {
			if (monitor) {
				this.gain.connect(this.ctx.destination);
			} else {
				this.gain.disconnect(this.ctx.destination);
			}
		} catch {
			// Cannot detect if already connected/disconnected; silence the error.
			// https://stackoverflow.com/q/43150875
		}
	}

	onunload(): void {
		const { ctx, stream } = this;
		void ctx.close();
		for (const track of stream.getAudioTracks()) {
			track.stop();
		}
	}

	getFloatTimeDomainData(buffers: Float32Array[]): void {
		if (!this.sampleBuffer || this.sampleBuffer.length !== this.analyser.fftSize) {
			this.sampleBuffer = new Float32Array(this.analyser.fftSize);
		}
		if (buffers[0] !== this.sampleBuffer) {
			buffers[0] = this.sampleBuffer;
		}
		this.analyser.getFloatTimeDomainData(this.sampleBuffer);
	}
}
