import { RingDial } from "@donmccurdy/ring-dial";
import { ValueComponent } from "obsidian";

export class RingDialComponent extends ValueComponent<number> {
	private el: RingDial;

	constructor(parentEl: HTMLElement) {
		super();
		this.el = parentEl.appendChild(new RingDial());
	}

	setDisabled(disabled: boolean): this {
		this.el.disabled = disabled;
		super.setDisabled(disabled);
		return this;
	}

	getValue(): number {
		return this.el.value;
	}

	setValue(value: number): this {
		this.el.value = value;
		return this;
	}

	setMin(min: number): this {
		this.el.min = min;
		return this;
	}

	setMax(max: number): this {
		this.el.max = max;
		return this;
	}

	setStep(step: number): this {
		this.el.step = step;
		return this;
	}

	onChange(cb: (value: number) => void): this {
		this.el.addEventListener("input", () => cb(this.getValue()));
		return this;
	}
}
