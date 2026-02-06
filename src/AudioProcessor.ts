import { Component, Platform } from "obsidian";
import type { FieldRecorderModel } from "./FieldRecorderModel";

export const BinLayout = {
	TIMESTAMP_U32: 0,
	VOLUME_F32: 4,
	CLIPPED_U8: 8,
};

export type AudioProcessorProps = {
	model: FieldRecorderModel;
};

export class AudioProcessor extends Component {
	private model: FieldRecorderModel;
	private output: DataView<ArrayBuffer> | null = null;
	private startTimeMs = Date.now();

	public binCount = 32;
	public binSizeMs = 125;
	public binByteLength = BinLayout.CLIPPED_U8 + 4;
	public binIndexCurrent = 0;

	public clipLevel = 0.98;

	// TODO: Better way to determine reference level?
	public referenceLevelDb = Platform.isIosApp ? -60 : -40;

	constructor(props: AudioProcessorProps) {
		super();
		this.model = props.model;
	}

	onload() {
		this.output = new DataView(new ArrayBuffer(this.binCount * this.binByteLength));
	}

	onunload(): void {
		this.output = null;
	}

	getBinVolume(i: number): number {
		const binByteOffset = this._getBinIndex(i) * this.binByteLength;
		return this.output!.getFloat32(binByteOffset + BinLayout.VOLUME_F32, true);
	}

	getBinClipped(i: number): boolean {
		const binByteOffset = this._getBinIndex(i) * this.binByteLength;
		return this.output!.getUint8(binByteOffset + BinLayout.CLIPPED_U8) === 1;
	}

	private _getBinIndex(i: number): number {
		return this.binIndexCurrent - i >= 0
			? this.binIndexCurrent - i
			: this.binCount + this.binIndexCurrent - i;
	}

	tick() {
		const state = this.model.state.peek();
		const output = this.output!;

		const timeMs = Date.now() - this.startTimeMs;
		const binIndex = Math.floor(timeMs / this.binSizeMs) % this.binCount;
		const byteOffset = binIndex * this.binByteLength;
		const binTimeMs = output.getUint32(byteOffset + BinLayout.TIMESTAMP_U32, true);

		this.binIndexCurrent = binIndex;

		if (state === "off" || timeMs - binTimeMs > this.binSizeMs) {
			output.setUint32(byteOffset + BinLayout.TIMESTAMP_U32, timeMs, true);
			output.setFloat32(byteOffset + BinLayout.VOLUME_F32, 0, true);
			output.setUint8(byteOffset + BinLayout.CLIPPED_U8, 0);
		}

		if (state === "off") {
			return;
		}

		const input = this.model.graph!.getFloatTimeDomainData();

		// TODO: Simplify and just have multiple arrays.
		let binVolume = output.getFloat32(byteOffset + BinLayout.VOLUME_F32, true);
		let clipped = output.getUint8(byteOffset + BinLayout.CLIPPED_U8) === 1;
		let peakInstantPower = 0;

		for (let i = 0; i < input.length; i++) {
			peakInstantPower = Math.max(input[i] ** 2, peakInstantPower);
			if (Math.abs(input[i]) > 1) {
				clipped = true;
			}
		}

		// https://stackoverflow.com/questions/44360301/web-audio-api-creating-a-peak-meter-with-analysernode
		const peakInstantPowerDecibels = Math.max(10 * Math.log10(Math.max(peakInstantPower, 1e-6)));
		const sampleVolume = remap(peakInstantPowerDecibels, this.referenceLevelDb, 0, 0, 1);
		binVolume = Math.max(sampleVolume, binVolume, 1e-4);
		clipped ||= sampleVolume > this.clipLevel;

		output.setFloat32(byteOffset + BinLayout.VOLUME_F32, binVolume, true);
		output.setUint8(byteOffset + BinLayout.CLIPPED_U8, clipped ? 1 : 0);
	}
}

function remap(value: number, low1: number, high1: number, low2: number, high2: number) {
	return low2 + ((high2 - low2) * (value - low1)) / (high1 - low1);
}
