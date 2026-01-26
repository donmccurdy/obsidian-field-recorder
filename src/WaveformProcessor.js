// TODO: Need to update build system so I can reuse this code.
const BinLayout = {
	TIMESTAMP_U32: 0,
	VOLUME_F32: 4,
	CLIPPED_U8: 8,
};

const WINDOW_MS = 4000;
const BIN_COUNT = 32;
const BIN_SIZE_MS = WINDOW_MS / BIN_COUNT;
const BIN_BYTE_LENGTH = BinLayout.CLIPPED_U8 + 4;
const CLIP_LEVEL = 0.98;

const HeaderLayout = {
	BIN_COUNT_U32: 0,
	BIN_INDEX_ACTIVE_U32: 4,
};
const HEADER_BYTE_LENGTH = 8;

/**
 * Audio processor for measuring volume and detecting clipping. This file is
 * intentionally written in JavaScript, to be inlined into builds.
 *
 * References:
 * - https://github.com/cwilso/volume-meter
 * - https://github.com/esonderegger/web-audio-peak-meter
 */
class WaveformProcessor extends AudioWorkletProcessor {
	arrayBuffer = new SharedArrayBuffer(HEADER_BYTE_LENGTH + BIN_COUNT * BIN_BYTE_LENGTH);
	view = new DataView(this.arrayBuffer);

	// https://github.com/WebAudio/web-audio-api/issues/2413
	startTimeMs = Date.now();

	constructor() {
		super();
		this.init();
		this.view.setUint32(HeaderLayout.BIN_COUNT_U32, BIN_COUNT, true);
	}

	init() {
		this.port.onmessage = (msg) => {
			if (msg.data.type === "worklet-init") {
				this.port.postMessage({ type: "worklet-init", buffer: this.arrayBuffer });
			}
		};
	}

	/**
	 * @param {Float32Array[][]} inputs
	 * @param {Float32Array[][]} _outputs
	 * @param {unknown} _parameters
	 */
	process(inputs, _outputs, _parameters) {
		const view = this.view;
		const input = inputs[0][0];
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
			const sample = Math.abs(input[i]);
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
		return true;
	}
}

registerProcessor("waveform-processor", WaveformProcessor);
