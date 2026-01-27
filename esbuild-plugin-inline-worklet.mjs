// Reference: https://github.com/mitschabaude/esbuild-plugin-inline-worker
// SPDX-License-Identifier: MIT

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { build } from "esbuild";
import findCacheDir from "find-cache-directory";

/** @import {BuildOptions, PluginBuild } from "esbuild"; */

const prod = process.argv[2] === "production";

/** @typedef {{buildOptions?: BuildOptions}} InlineWorkletPluginConfig */

/** @param {InlineWorkletPluginConfig} config */
export default function inlineWorkletPlugin(config = {}) {
	return {
		name: "esbuild-plugin-inline-worklet",

		/** @param {PluginBuild} build */
		setup(build) {
			build.onLoad({ filter: /\.worklet.(js|ts|mjs|mts)/ }, async ({ path: workletPath }) => {
				const workletCode = await buildWorklet(workletPath, config);
				return {
					contents: `const text = ${JSON.stringify(workletCode)};
					export default text;`,
					loader: "js",
				};
			});
		},
	};
}

const cacheDir = findCacheDir({ name: "esbuild-plugin-inline-worklet", create: true });

/**
 * @param {string} workletPath
 * @param {InlineWorkletPluginConfig} pluginConfig
 */
async function buildWorklet(workletPath, pluginConfig) {
	const scriptNameParts = path.basename(workletPath).split(".");
	scriptNameParts.pop();
	scriptNameParts.push("js");
	const scriptName = scriptNameParts.join(".");
	if (!cacheDir) {
		throw new Error("Cache not found, ensure 'find-cache-directory' is installed.");
	}
	const bundlePath = path.resolve(cacheDir, scriptName);

	if (pluginConfig.buildOptions) {
		delete pluginConfig.buildOptions.entryPoints;
		delete pluginConfig.buildOptions.outfile;
		delete pluginConfig.buildOptions.outdir;
	}

	await build({
		entryPoints: [workletPath],
		bundle: true,
		minify: prod,
		treeShaking: true,
		outfile: bundlePath,
		target: "es2018",
		format: "esm",
		...pluginConfig.buildOptions,
	});

	return readFile(bundlePath, { encoding: "utf-8" });
}
