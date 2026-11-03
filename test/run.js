/* Snapshot tests: runs every examples/*.fw and compares stdout, stderr and the rendered app
 * with test/expected/<name>.txt.  `node test/run.js --update` rewrites the snapshots. */
"use strict";
const fs = require("fs");
const path = require("path");
const Flywheel = require("../flywheel.js");

const root = path.join(__dirname, "..");
const exDir = path.join(root, "examples"), expDir = path.join(__dirname, "expected");
const update = process.argv.includes("--update");
fs.mkdirSync(expDir, { recursive: true });

function capture(file) {
  const lines = [];
  const code = fs.readFileSync(path.join(exDir, file), "utf8");
  const r = Flywheel.run(code, { name: file, print: s => lines.push(s), error: s => lines.push("! " + s), maxSteps: 5e7 });
  lines.push(`-- exit ${r.status}`);
  if (r.value instanceof Flywheel.FwElement) lines.push("-- app", r.interp.render(r.value));
  else if (r.html != null) lines.push("-- html", r.html);
  else if (r.text != null) lines.push("-- text", r.text);
  return lines.join("\n") + "\n";
}

let failed = 0, n = 0;
for (const file of fs.readdirSync(exDir).filter(f => f.endsWith(".fw")).sort()) {
  n++;
  const got = capture(file), snap = path.join(expDir, file.replace(/\.fw$/, ".txt"));
  if (update || !fs.existsSync(snap)) { fs.writeFileSync(snap, got); console.log(`wrote ${path.relative(root, snap)}`); continue; }
  const want = fs.readFileSync(snap, "utf8");
  if (got === want) console.log(`ok   ${file}`);
  else {
    failed++;
    console.log(`FAIL ${file}`);
    const a = want.split("\n"), b = got.split("\n");
    const i = a.findIndex((l, k) => l !== b[k]);
    console.log(`  first difference at line ${i + 1}:\n  - ${a[i]}\n  + ${b[i]}`);
  }
}
console.log(`\n${n - failed}/${n} passed`);
process.exit(failed ? 1 : 0);
