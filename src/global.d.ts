/** biome-ignore-all lint/correctness/noUnusedVariables: Ambient declarations. */

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
