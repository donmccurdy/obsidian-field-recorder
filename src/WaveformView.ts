import { Component } from "obsidian";
import type { FieldRecorderModel } from "./FieldRecorderModel";

export type WaveformViewProps = {
	canvasEl: HTMLCanvasElement;
	accentColor: string;
	backgroundColor: string;
	model: FieldRecorderModel;
};

export class WaveformView extends Component {
	model: FieldRecorderModel;
	canvasEl: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
	accentColor: string;
	backgroundColor: string;
	byteTimeDomainData: Uint8Array;

	constructor(props: WaveformViewProps) {
		super();
		this.model = props.model;
		this.canvasEl = props.canvasEl;
		this.ctx = props.canvasEl.getContext("2d")!;
		this.accentColor = props.accentColor;
		this.backgroundColor = props.backgroundColor;
	}

	onload() {
		let handle: number;
		const animate = (time: DOMHighResTimeStamp) => {
			handle = requestAnimationFrame(animate);
			this.render(time);
		};
		handle = requestAnimationFrame(animate);
		this.register(() => cancelAnimationFrame(handle));

		const resizeObserver = new ResizeObserver(() => this.onResize());
		resizeObserver.observe(this.canvasEl, { box: "content-box" });
		this.register(() => resizeObserver.disconnect());
		this.onResize();
	}

	render(time: DOMHighResTimeStamp) {
		const { model, canvasEl, ctx, backgroundColor, accentColor } = this;
		const { width, height } = canvasEl;
		const state = model.state.peek();

		// background
		ctx.fillStyle = backgroundColor;
		ctx.fillRect(0, 0, width, height);

		if (state === "off") {
			return;
		}

		// timestamp
		ctx.fillStyle = accentColor;
		ctx.fillText(time.toFixed(2), 4, height - 4);

		// waveform
		this.byteTimeDomainData ||= new Uint8Array(model.analyzerNode!.fftSize);
		const array = this.byteTimeDomainData;
		model.analyzerNode!.getByteTimeDomainData(array);

		ctx.lineWidth = 2;
		ctx.strokeStyle = accentColor;

		ctx.beginPath();

		const sliceWidth = (width - 8) / array.length;
		let x = 4;

		for (let i = 0; i < array.length; i++) {
			const v = array[i]! / 128.0;
			const y = (v * height) / 2;

			if (i === 0) {
				ctx.moveTo(x, y);
			} else {
				ctx.lineTo(x, y);
			}

			x += sliceWidth;
		}

		ctx.lineTo(width - 4, height / 2);
		ctx.stroke();
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
