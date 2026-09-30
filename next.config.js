/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
	// Client route-cache TTLs in seconds. Investigation §7.5 (staleTimes unset
	// → dynamic client route cache entries used once), §11 (all authenticated
	// routes are dynamic, so every soft-nav re-validated), §18.12 (optional
	// optimization #12). Owner override of spec FC-003 ("staleTimes out of
	// scope") — explicit owner instruction: fix the cache problem across the
	// project; §6.7's blanket invalidation was already removed. Conservative
	// 15 s dynamic value; `revalidatePath` scoping (T031) remains the
	// invalidation authority.
	experimental: {
		staleTimes: {
			dynamic: 15,
			static: 30,
		},
	},
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
