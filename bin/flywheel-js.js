#!/usr/bin/env node
/* flywheel-js — run Flywheel programs with flywheel.js from the command line.
 *
 *   flywheel-js run main.fw     run a program (stdin feeds input())
 *   flywheel-js check main.fw   parse only
 *   flywheel-js repl            interactive session
 *   flywheel-js --version
 *
 * A program that returns an element (or serves "/") prints the rendered HTML. */
"use strict";
const fs = require("fs");
const path = require("path");
const Flywheel = require("../flywheel.js");

const [cmd, file] = process.argv.slice(2);
const usage = () => {
  console.error("usage: flywheel-js run <file.fw> | check <file.fw> | repl | --version");
  process.exit(2);
};
const readStdin = () => {
  if (process.stdin.isTTY) return [];
  try { return fs.readFileSync(0, "utf8").split(/\r?\n/).filter((l, i, a) => i < a.length - 1 || l !== ""); }
  catch { return []; }
};

if (cmd === "--version" || cmd === "-v" || cmd === "version") {
  console.log("flywheel " + Flywheel.version);
} else if (cmd === "run" || cmd === "check") {
  if (!file) usage();
  const code = fs.readFileSync(file, "utf8");
  const name = path.basename(file);
  if (cmd === "check") {
    try { Flywheel.parse(code, name); console.log(`${name} parses`); }
    catch (e) {
      if (e instanceof Flywheel.CompileError) { console.error(`${name}:${e.line}:${e.col}: error: ${e.message}`); process.exit(1); }
      throw e;
    }
  } else {
    const r = Flywheel.run(code, { name, stdin: readStdin() });
    if (r.value instanceof Flywheel.FwElement) console.log(r.interp.render(r.value));
    else if (r.html != null) console.log(r.html);
    else if (r.text != null) console.log(r.text);
    process.exitCode = r.status || 0;
  }
} else if (cmd === "repl") {
  const readline = require("readline");
  const session = new Flywheel.Session({});
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "fw> " });
  let buf = [];
  // blocks (if/while/function/class ...) continue until their `end`
  const OPEN = /^\s*(if|while|for|function|class|component|interface|enum|match|try|do)\b/;
  let depth = 0;
  console.log(`flywheel ${Flywheel.version} — :q to quit`);
  rl.prompt();
  rl.on("line", line => {
    if (!buf.length && line.trim() === ":q") return rl.close();
    if (OPEN.test(line)) depth++;
    if (/^\s*end\b/.test(line)) depth--;
    buf.push(line);
    if (depth > 0) { rl.setPrompt("..> "); return rl.prompt(); }
    depth = 0;
    const code = buf.join("\n"); buf = [];
    if (code.trim()) session.exec(code);
    rl.setPrompt("fw> "); rl.prompt();
  });
  rl.on("close", () => process.stdout.write("\n"));
} else usage();
