#!/usr/bin/env node
/* flywheel-js — run Flywheel programs with flywheel.js from the command line.
 *
 *   flywheel-js run main.fw [-- args]      run a program (stdin feeds input())
 *   flywheel-js run -s 'print 6 * 7'       run code given on the command line
 *   flywheel-js check main.fw              parse only
 *   flywheel-js export main.fw out.json    write the value the program returns at top level
 *   flywheel-js debug main.fw              print the returned value and the run time
 *   flywheel-js serve page.fw [--port N]   serve the returned page at http://127.0.0.1:8000/
 *   flywheel-js desktop page.fw            write the returned page to a file and open it in a browser
 *   flywheel-js repl                       interactive session
 *   flywheel-js --version
 *
 * A top-level `return n` ends the program with status n. A program that returns an element (or
 * serves "/") prints the rendered HTML under `run`. */
"use strict";
const fs = require("fs");
const path = require("path");
const Flywheel = require("../flywheel.js");

const argv = process.argv.slice(2);
const cmd = argv.shift();
const usage = () => {
  console.error("usage: flywheel-js run|check|debug <file.fw | -s CODE> [-- args] | export <file.fw | -s CODE> <output> [args] |\n" +
    "       serve|desktop <file.fw> [--port N] [--host H] | repl | --version");
  process.exit(2);
};
const readStdin = () => {
  if (process.stdin.isTTY) return [];
  try { return fs.readFileSync(0, "utf8").split(/\r?\n/).filter((l, i, a) => i < a.length - 1 || l !== ""); }
  catch { return []; }
};

// Splits `[-s CODE | file] [rest...] [-- args...]` into the source, its name and program arguments.
function source(args, { needOutput } = {}) {
  let code, name, rest = args.slice();
  const dd = rest.indexOf("--");
  const after = dd >= 0 ? rest.splice(dd).slice(1) : [];
  const si = rest.findIndex(a => a === "-s" || a === "--source");
  if (si >= 0) { code = rest[si + 1]; if (code === undefined) usage(); rest.splice(si, 2); name = "<source>"; }
  else {
    const file = rest.shift();
    if (!file) usage();
    if (/^(ws|wss):\/\//i.test(file)) { console.error("flywheel-js: ws:// and wss:// name message streams, not files"); process.exit(1); }
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(file) && !/^file:\/\//i.test(file)) { console.error("flywheel-js: URLs are not available in flywheel.js; install Flywheel to run code from a URL"); process.exit(1); }
    const p = file.replace(/^file:\/\//i, "");
    code = fs.readFileSync(p, "utf8"); name = path.basename(p);
  }
  const output = needOutput ? rest.shift() : undefined;
  if (needOutput && output === undefined) usage();
  return { code, name, output, args: rest.concat(after) };
}
const render = r => r.value instanceof Flywheel.FwElement ? r.interp.render(r.value) : r.html != null ? r.html : null;
const flag = (args, f, d) => { const i = args.indexOf(f); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };

if (cmd === "--version" || cmd === "-v" || cmd === "version") {
  console.log("flywheel " + Flywheel.version);
} else if (cmd === "check") {
  const { code, name } = source(argv);
  try { Flywheel.parse(code, name); console.log(`${name} parses`); }
  catch (e) {
    if (e instanceof Flywheel.CompileError) { console.error(`${name}:${e.line}:${e.col}: error: ${e.message}`); process.exit(1); }
    throw e;
  }
} else if (cmd === "run") {
  const s = source(argv);
  const r = Flywheel.run(s.code, { name: s.name, stdin: readStdin(), args: s.args });
  const html = render(r);
  if (html != null) console.log(html);
  else if (r.text != null) console.log(r.text);
  process.exitCode = r.status || 0;
} else if (cmd === "export") {
  const s = source(argv, { needOutput: true });
  const r = Flywheel.run(s.code, { name: s.name, stdin: readStdin(), args: s.args });
  if (r.status !== 0 && (r.value === null || r.value === undefined)) process.exit(r.status);
  const html = render(r);
  let text;
  if (html != null) text = html;
  else if (typeof r.value === "string") text = r.value;
  else if (r.value !== null && r.value !== undefined) text = JSON.stringify(r.interp.toJson(r.value));
  else { console.error(`flywheel-js: ${s.name} returned no value`); process.exit(1); }
  fs.writeFileSync(s.output, text);
} else if (cmd === "debug") {
  const s = source(argv);
  const t = process.hrtime.bigint();
  const r = Flywheel.run(s.code, { name: s.name, stdin: readStdin(), args: s.args });
  const ms = Number(process.hrtime.bigint() - t) / 1e6;
  const val = r.value === null || r.value === undefined ? null : render(r) ?? JSON.stringify(r.interp.toJson(r.value));
  const short = val && val.length > 120 ? val.slice(0, 117) + "..." : val;
  console.error(val === null ? `[debug] no return value, exit status ${r.status || 0} in ${ms.toFixed(2)} ms` : `[debug] returned ${short} in ${ms.toFixed(2)} ms`);
  process.exitCode = r.status || 0;
} else if (cmd === "serve" || cmd === "desktop") {
  const port = Number(flag(argv, "--port", 8000)), host = flag(argv, "--host", "127.0.0.1");
  const s = source(argv);
  const r = Flywheel.run(s.code, { name: s.name, stdin: readStdin(), args: s.args });
  const html = render(r);
  if (r.status !== 0 && html == null) process.exit(r.status);
  if (html == null) { console.error(`flywheel-js: ${s.name} ended without returning an element or fragment`); process.exit(1); }
  if (cmd === "desktop") {
    const out = path.join(require("os").tmpdir(), `flywheel-${process.pid}.html`);
    fs.writeFileSync(out, html);
    console.log(`flywheel.js has no native window; the page was written to ${out}`);
    const open = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    try { require("child_process").spawn(open, [out], { stdio: "ignore", detached: true, shell: process.platform === "win32" }).unref(); } catch { /* ignore */ }
  } else {
    const server = require("http").createServer((req, res) => {
      if (req.url.split("?")[0] !== "/") { res.writeHead(404, { "content-type": "text/plain" }); res.end("not found"); return; }
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(html);
    });
    server.listen(port, host, () => console.log(`Serving at http://${host}:${server.address().port}/`));
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
