import { Component } from "obsidian";
import type { FieldRecorderModel } from "./FieldRecorderModel";
import { formatDuration } from "./utils";

// TODO: Need to update build system so I can reuse this code.
const BinLayout = {
	TIMESTAMP_U32: 0,
	VOLUME_F32: 4,
	CLIPPED_U8: 8,
};
const BIN_BYTE_LENGTH = BinLayout.CLIPPED_U8 + 4;

const HeaderLayout = {
	BIN_COUNT_U32: 0,
	BIN_INDEX_ACTIVE_U32: 4,
};
const HEADER_BYTE_LENGTH = 8;

const PAD = 4;

export type WaveformViewProps = {
	canvasEl: HTMLCanvasElement;
	model: FieldRecorderModel;
};

type WaveformPalette = {
	fgColor: string;
	bgColor: string;
	clipColor: string;
};

export class WaveformView extends Component {
	model: FieldRecorderModel;
	canvasEl: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
	palette: WaveformPalette;

	constructor(props: WaveformViewProps) {
		super();
		this.model = props.model;
		this.canvasEl = props.canvasEl;
		this.ctx = props.canvasEl.getContext("2d")!;

		// TODO: Make reactive.
		const computedStyle = window.getComputedStyle(props.canvasEl);
		this.palette = {
			fgColor: computedStyle.getPropertyValue("--interactive-accent"),
			bgColor: computedStyle.getPropertyValue("--background-modifier-form-field"),
			clipColor: computedStyle.getPropertyValue("--color-red"),
		};
	}

	onload() {
		let handle: number;
		const animate = () => {
			handle = requestAnimationFrame(animate);
			this.render();
		};
		handle = requestAnimationFrame(animate);
		this.register(() => cancelAnimationFrame(handle));

		const resizeObserver = new ResizeObserver(() => this.onResize());
		resizeObserver.observe(this.canvasEl, { box: "content-box" });
		this.register(() => resizeObserver.disconnect());
		this.onResize();
	}

	render() {
		const { model, canvasEl, ctx, palette } = this;
		const { width, height } = canvasEl;
		const state = model.state.peek();

		// background
		ctx.fillStyle = palette.bgColor;
		ctx.fillRect(0, 0, width, height);

		if (state === "off") {
			return;
		}

		// timestamp
		if (state === "recording" || state === "paused") {
			const durationMs = model.timer.getDurationMs();
			ctx.fillStyle = palette.fgColor;
			ctx.textAlign = "right";
			ctx.font = "12px monospace";
			ctx.fillText(formatDuration(durationMs), width - PAD * 2, height - PAD * 2);
		}

		// waveform
		if (model.workletView) {
			const binCount = model.workletView.getUint32(HeaderLayout.BIN_COUNT_U32, true);
			const binIndexActive = model.workletView.getUint32(HeaderLayout.BIN_INDEX_ACTIVE_U32, true);
			const binSpacing = Math.ceil((width - 8) / binCount);
			const binWidth = Math.floor(binSpacing / 2);
			for (let i = 0; i < binCount; i++) {
				const binIndex =
					binIndexActive - i >= 0 ? binIndexActive - i : binCount + binIndexActive - i;
				const byteOffset = HEADER_BYTE_LENGTH + binIndex * BIN_BYTE_LENGTH;
				const volume = model.workletView.getFloat32(byteOffset + BinLayout.VOLUME_F32, true);
				const clipped = model.workletView.getUint8(byteOffset + BinLayout.CLIPPED_U8);

				if (volume === 0) continue;

				const x = width - i * binSpacing - PAD - binWidth;
				const barHeight = Math.max((volume * height * 2) / 3, 4);
				ctx.fillStyle = clipped ? palette.clipColor : palette.fgColor;
				ctx.fillRect(x, height / 2 - barHeight / 2, binWidth, barHeight);
			}
		}
	}

	onResize() {
		const canvasEl = this.canvasEl;
		const displayWidth = canvasEl.clientWidth;
		const displayHeight = canvasEl.clientHeight;
		const needResize = canvasEl.width !== displayWidth || canvasEl.height !== displayHeight;

		if (needResize) {
			canvasEl.width = displayWidth;
			canvasEl.height = displayHeight;
		}
	}
}
