#!/usr/bin/env node
// Copies the library modules written in Flywheel into flywheel.js (FW_LIBRARIES).
// Usage: node tools/sync-libraries.js [path/to/flywheel/stdlib/fw]
"use strict";
const fs = require("fs"), path = require("path");
const dir = process.argv[2] || path.join(__dirname, "..", "..", "wednesware", "fw", "stdlib", "fw");
const LIBRARIES = ["cogwheel"];
const file = path.join(__dirname, "..", "flywheel.js");
const src = fs.readFileSync(file, "utf8");
const begin = "/* BEGIN LIBRARIES */\n", end = "/* END LIBRARIES */";
const a = src.indexOf(begin), b = src.indexOf(end);
if (a < 0 || b < a) throw new Error("FW_LIBRARIES markers not found in flywheel.js");
const body = LIBRARIES.map(n => `  ${n}: ${JSON.stringify(fs.readFileSync(path.join(dir, n + ".fw"), "utf8"))},\n`).join("");
fs.writeFileSync(file, src.slice(0, a + begin.length) + body + src.slice(b));
console.log(`synced ${LIBRARIES.join(", ")} from ${dir}`);
