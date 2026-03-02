import type { FieldRecorderState } from "FieldRecorderState";
import { Component } from "obsidian";
import { getSampleBinIndex } from "./utils/audio";

const PAD = 4;

export type WaveformViewProps = {
	state: FieldRecorderState;
	canvasEl: HTMLCanvasElement;
};

export class WaveformView extends Component {
	state: FieldRecorderState;
	canvasEl: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;

	constructor(props: WaveformViewProps) {
		super();
		this.state = props.state;
		this.canvasEl = props.canvasEl;
		this.ctx = props.canvasEl.getContext("2d")!;
	}

	onload() {
		const resizeObserver = new ResizeObserver(() => this.onResize());
		resizeObserver.observe(this.canvasEl, { box: "content-box" });
		this.register(() => resizeObserver.disconnect());
		this.onResize();
	}

	update() {
		const { canvasEl, ctx, state } = this;
		const { width, height } = canvasEl;
		const mode = state.mode.peek();
		const theme = state.theme.peek();

		// background
		ctx.fillStyle = theme.bgColor;
		ctx.fillRect(0, 0, width, height);

		if (mode === "off") {
			return;
		}

		// waveform
		const { binCount, sampleLevels, sampleClips } = state.sampleWindow;
		const binSpacing = Math.ceil((width - 8) / binCount);
		const binWidth = Math.floor(binSpacing / 2);

		for (let i = 0; i < binCount; i++) {
			const index = getSampleBinIndex(i, state.sampleWindow);
			const volume = sampleLevels[index];
			const clipped = sampleClips[index];

			if (volume === 0) continue;

			const x = width - i * binSpacing - PAD - binWidth;
			const barHeight = Math.max((volume * height * 2) / 3, 4);
			ctx.fillStyle = clipped ? theme.clipColor : theme.fgColor;
			ctx.fillRect(x, height / 2 - barHeight / 2, binWidth, barHeight);
		}
	}

	onResize() {
		const canvasEl = this.canvasEl;
		const displayWidth = canvasEl.clientWidth;
		const displayHeight = canvasEl.clientHeight;
		if (canvasEl.width !== displayWidth || canvasEl.height !== displayHeight) {
			canvasEl.width = displayWidth;
			canvasEl.height = displayHeight;
		}
	}
}
