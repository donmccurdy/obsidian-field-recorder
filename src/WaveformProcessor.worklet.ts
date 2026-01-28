import {
	BIN_BYTE_LENGTH,
	BIN_COUNT,
	BIN_SIZE_MS,
	BinLayout,
	CLIP_LEVEL,
	HEADER_BYTE_LENGTH,
	HeaderLayout,
	type WaveformProcessorMessage,
} from "./constants-shared";

/**
 * Audio processor for measuring volume and detecting clipping. Module should
 * avoid importing other code with rare exceptions (`./layout.ts`), see
 * `esbuild-plugin-inline-worklet.mjs`.
 *
 * References:
 * - https://github.com/cwilso/volume-meter
 * - https://github.com/esonderegger/web-audio-peak-meter
 * - https://stackoverflow.com/questions/44360301/web-audio-api-creating-a-peak-meter-with-analysernode
 */
class WaveformProcessor extends AudioWorkletProcessor {
	arrayBuffer = new SharedArrayBuffer(HEADER_BYTE_LENGTH + BIN_COUNT * BIN_BYTE_LENGTH);
	view = new DataView(this.arrayBuffer);
	startTimeMs = Date.now();
	keepAlive = true;

	constructor() {
		super();
		this.init();
		this.view.setUint32(HeaderLayout.BIN_COUNT_U32, BIN_COUNT, true);
	}

	init() {
		this.port.onmessage = (request: WaveformProcessorMessage) => {
			if (request.data.type === "worklet-load") {
				const response = { type: "worklet-buffer", buffer: this.arrayBuffer };
				this.port.postMessage(response as WaveformProcessorMessage["data"]);
			}
			if (request.data.type === "worklet-unload") {
				this.keepAlive = false;
			}
		};
	}

	process(inputs: Float32Array[][], _outputs: Float32Array[][], _parameters: unknown): boolean {
		const view = this.view;
		const input = inputs[0]![0]!;
		const inputLength = input.length;

		const timeMs = Date.now() - this.startTimeMs;
		const binIndex = Math.floor(timeMs / BIN_SIZE_MS) % BIN_COUNT;
		const byteOffset = HEADER_BYTE_LENGTH + binIndex * BIN_BYTE_LENGTH;

		const binTimeMs = view.getUint32(byteOffset + BinLayout.TIMESTAMP_U32, true);
		if (timeMs - binTimeMs > BIN_SIZE_MS) {
			view.setUint32(byteOffset + BinLayout.TIMESTAMP_U32, timeMs, true);
			view.setFloat32(byteOffset + BinLayout.VOLUME_F32, 0, true);
			view.setUint8(byteOffset + BinLayout.CLIPPED_U8, 0);
		}

		let volume = view.getFloat32(byteOffset + BinLayout.VOLUME_F32, true);
		let clipped = view.getUint8(byteOffset + BinLayout.CLIPPED_U8) === 1;

		for (let i = 0; i < inputLength; i++) {
			const sample = Math.abs(input[i]!);
			if (sample >= CLIP_LEVEL) {
				clipped = true;
				volume = 1;
				break;
			}
			volume = Math.max(volume, sample);
		}

		view.setUint32(HeaderLayout.BIN_INDEX_ACTIVE_U32, binIndex, true);
		view.setFloat32(byteOffset + BinLayout.VOLUME_F32, volume, true);
		view.setUint8(byteOffset + BinLayout.CLIPPED_U8, clipped ? 1 : 0);

		// See: https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process
		return this.keepAlive;
	}
}

registerProcessor("waveform-processor", WaveformProcessor);
