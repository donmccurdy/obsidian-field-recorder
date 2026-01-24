/**
 * Runs the given callback once per frame, and returns a cleanup function.
 */
export function frame(fn: () => void): () => void {
	let handle: number;
	const animate = () => {
		handle = requestAnimationFrame(animate);
		fn();
	};
	handle = requestAnimationFrame(animate);
	return () => cancelAnimationFrame(handle);
}
