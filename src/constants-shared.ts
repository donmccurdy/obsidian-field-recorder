export const BinLayout = {
	TIMESTAMP_U32: 0,
	VOLUME_F32: 4,
	CLIPPED_U8: 8,
};

export const WINDOW_MS = 4000;
export const BIN_COUNT = 32;
export const BIN_SIZE_MS = WINDOW_MS / BIN_COUNT;
export const BIN_BYTE_LENGTH = BinLayout.CLIPPED_U8 + 4;
export const CLIP_LEVEL = 0.98;

export const HeaderLayout = {
	BIN_COUNT_U32: 0,
	BIN_INDEX_ACTIVE_U32: 4,
};
export const HEADER_BYTE_LENGTH = 8;

export type WaveformProcessorMessage =
	| { data: { type: "worklet-load" } }
	| { data: { type: "worklet-buffer"; buffer: SharedArrayBuffer } }
	| { data: { type: "worklet-unload" } };
