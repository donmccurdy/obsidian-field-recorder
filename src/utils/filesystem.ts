import type { Vault } from "obsidian";

export function getDefaultFilename() {
	const date = new Date();
	const yyyy = date.getFullYear();
	const mm = String(date.getMonth() + 1).padStart(2, "0");
	const dd = String(date.getDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd} Recording`;
}

/**
 * Ensures the given vault-relative folder path exists, creating any missing
 * intermediate folders. No-op if the folder already exists.
 */
export async function ensureFolderExists(vault: Vault, folderPath: string): Promise<void> {
	if (!folderPath || vault.getAbstractFileByPath(folderPath)) return;
	try {
		await vault.createFolder(folderPath);
	} catch (error) {
		// Ignore "folder already exists" races; rethrow anything else.
		if (!vault.getAbstractFileByPath(folderPath)) throw error;
	}
}

/**
 * Finds an available (non-conflicting) path for a new file within the given
 * folder, appending a numeric suffix to the basename if needed.
 */
export function getAvailablePath(
	vault: Vault,
	folderPath: string,
	basename: string,
	extension: string,
): string {
	const join = (name: string) => (folderPath ? `${folderPath}/${name}.${extension}` : `${name}.${extension}`);

	let candidate = join(basename);
	let index = 1;
	while (vault.getAbstractFileByPath(candidate)) {
		candidate = join(`${basename} ${index}`);
		index++;
	}
	return candidate;
}
