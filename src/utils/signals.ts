/**
 * Runs the given callback once per frame, and returns a cleanup function.
 */
export function frame(fn: () => void): () => void {
	let handle: number;
	const animate = () => {
		handle = window.requestAnimationFrame(animate);
		fn();
	};
	handle = window.requestAnimationFrame(animate);
	return () => window.cancelAnimationFrame(handle);
}
