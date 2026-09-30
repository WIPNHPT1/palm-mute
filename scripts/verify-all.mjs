// `npm run verify`: the four verify suites run side by side (they're independent), so the whole run takes as
// long as the slowest one. Each suite's output is printed in order once it finishes; any failure fails the run.
import { spawn } from "node:child_process";

const SUITES = ["verify-data-layer", "verify-voicings", "verify-critic", "verify-melody"];
const started = Date.now();
const runs = SUITES.map(
  (name) =>
    new Promise((resolve) => {
      const child = spawn("npx", ["tsx", `scripts/${name}.ts`], { stdio: ["ignore", "pipe", "pipe"] });
      let out = "";
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (out += d));
      child.on("close", (code) => resolve({ name, code, out }));
    }),
);
let failed = 0;
for (const run of runs) {
  const { name, code, out } = await run;
  process.stdout.write(out);
  if (code !== 0) {
    failed++;
    console.error(`\n✗ ${name} failed (exit ${code})`);
  }
}
console.log(`\nverify: ${SUITES.length - failed} of ${SUITES.length} suites passed in ${Math.round((Date.now() - started) / 1000)} s.`);
process.exit(failed ? 1 : 0);
