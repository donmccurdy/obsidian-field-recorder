/** biome-ignore-all lint/correctness/noUnusedVariables: Ambient declarations. */

///////////////////////////////////////////////////////////////////////////////
// DEFINES

declare module "*?inline" {
	const text: string;
	export default text;
}

///////////////////////////////////////////////////////////////////////////////
// BROWSER APIS

interface MediaRecorder {
	audioBitrateMode: "variable" | "constant";
}

interface MediaRecorderOptions {
	audioBitrateMode: "variable" | "constant";
}

interface MediaTrackConstraints {
	voiceIsolation?: ConstrainBoolean;
}

interface MediaTrackSupportedConstraints {
	voiceIsolation?: boolean;
}

interface AudioContextOptions {
	sinkId?: string | { type: "none" };
}

interface AudioWorkletProcessor {
	readonly port: MessagePort;
	process(
		inputs: Float32Array[][],
		outputs: Float32Array[][],
		parameters: Record<string, Float32Array>,
	): boolean;
}

declare const AudioWorkletProcessor: {
	prototype: AudioWorkletProcessor;
	new (options?: AudioWorkletNodeOptions): AudioWorkletProcessor;
};

interface AudioParamDescriptor {
	type: unknown;
}

declare function registerProcessor(
	name: string,
	processorCtor: (new (
		options?: AudioWorkletNodeOptions,
	) => AudioWorkletProcessor) & {
		parameterDescriptors?: AudioParamDescriptor[];
	},
): void;
