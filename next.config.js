/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
	turbopack: {
		resolveExtensions: [".tsx", ".ts", ".jsx", ".js", ".json"],
	},
	webpack(config) {
		config.resolve.extensionAlias = {
			...config.resolve.extensionAlias,
			".js": [".js", ".ts", ".tsx"],
			".jsx": [".jsx", ".js", ".tsx", ".ts"],
		};
		return config;
	},
};

export default config;
