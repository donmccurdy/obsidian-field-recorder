import type { Signal } from "@preact/signals-core";
import { Component } from "obsidian";
import type { AudioProcessor } from "./AudioProcessor";
import type { FieldRecorderModel } from "./FieldRecorderModel";
import { formatDuration, type Palette } from "./utils";

const PAD = 4;

export type WaveformViewProps = {
	canvasEl: HTMLCanvasElement;
	model: FieldRecorderModel;
	processor: AudioProcessor;
	palette: Signal<Palette>;
};

export class WaveformView extends Component {
	model: FieldRecorderModel;
	processor: AudioProcessor;
	canvasEl: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
	palette: Signal<Palette>;

	constructor(props: WaveformViewProps) {
		super();
		this.model = props.model;
		this.processor = props.processor;
		this.palette = props.palette;
		this.canvasEl = props.canvasEl;
		this.ctx = props.canvasEl.getContext("2d")!;
	}

	onload() {
		// Start resize observer.
		const resizeObserver = new ResizeObserver(() => this.onResize());
		resizeObserver.observe(this.canvasEl, { box: "content-box" });
		this.register(() => resizeObserver.disconnect());
		this.onResize();
	}

	tick() {
		const { model, canvasEl, ctx } = this;
		const { width, height } = canvasEl;
		const state = model.state.peek();
		const palette = this.palette.peek();

		if (!palette) {
			return;
		}

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
		const { binCount } = this.processor;
		const binSpacing = Math.ceil((width - 8) / binCount);
		const binWidth = Math.floor(binSpacing / 2);

		for (let i = 0; i < binCount; i++) {
			const volume = this.processor.getBinVolume(i);
			const clipped = this.processor.getBinClipped(i);

			if (volume === 0) continue;

			const x = width - i * binSpacing - PAD - binWidth;
			const barHeight = Math.max((volume * height * 2) / 3, 4);
			ctx.fillStyle = clipped ? palette.clipColor : palette.fgColor;
			ctx.fillRect(x, height / 2 - barHeight / 2, binWidth, barHeight);
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
