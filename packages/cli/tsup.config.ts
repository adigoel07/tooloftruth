import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/status.ts", "src/monitor.ts"],
  format: ["esm"],
  clean: true,
  noExternal: [/@tooloftruth\/core/],
});
