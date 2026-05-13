import { defineConfig } from "bunup";

export default defineConfig({
	entry: ["src/index.ts", "src/testing.ts"],
	format: "esm",
	dts: true,
	exports: true,
});
