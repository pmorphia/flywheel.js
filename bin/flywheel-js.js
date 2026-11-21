#!/usr/bin/env node
/* flywheel-js — run Flywheel programs with flywheel.js from the command line.
 *
 *   flywheel-js run main.fw [-- args]      run a program (stdin feeds input())
 *   flywheel-js main.fw [args]             the same
 *   flywheel-js run -s 'print 6 * 7'       run code given on the command line
 *   flywheel-js check main.fw              parse only
 *   flywheel-js export main.fw out.json    write the value the program returns at top level
 *   flywheel-js debug main.fw              print the returned value and the run time
 *   flywheel-js serve page.fw [--port N]   serve the returned page at http://127.0.0.1:8000/
 *   flywheel-js desktop page.fw            write the returned page to a file and open it in a browser
 *   flywheel-js --error main.fw            print the last error main.fw stopped with (-E)
 *   flywheel-js repl                       interactive session
 *   flywheel-js help | version             usage, version
 *
 * Commands take the compiler's short aliases: r (run), c (check), e (export), db (debug),
 * s (serve), d (desktop), h (help), v (version).
 *
 * A top-level `return n` ends the program with status n. A program that returns an element (or
 * serves "/") prints the rendered HTML under `run`. */
"use strict";
const fs = require("fs");
const path = require("path");
const Flywheel = require("../flywheel.js");

const argv = process.argv.slice(2);
// Short aliases, as in the Flywheel compiler; fmt is the old name of format.
const aliases = { r: "run", b: "build", c: "check", d: "desktop", s: "serve", e: "export", db: "debug",
  t: "test", f: "format", fmt: "format", u: "update", h: "help", "-h": "help", "--help": "help",
  v: "version", "-v": "version", "--version": "version" };
const given = argv.shift();
const commands = new Set(["run", "build", "check", "desktop", "serve", "export", "debug", "test", "format", "doc",
  "lsp", "update", "help", "version", "repl"]);
let cmd = Object.hasOwn(aliases, given) ? aliases[given] : given;
if (given === "-E" || given === "--error") cmd = "error";
// `flywheel-js SOURCE [arguments]` runs SOURCE with every later argument; `flywheel-js -s CODE` runs code
if (given !== undefined && !commands.has(cmd) && cmd !== "error") {
  if (given === "-s" || given === "--source") argv.unshift(given);
  else if (!given.startsWith("-")) { argv.unshift(given, "--"); if (argv[2] === "--") argv.splice(2, 1); }
  else usage();
  cmd = "run";
}
const usageText =
  "usage: flywheel-js run|r, check|c, debug|db <file.fw | -s CODE> [-- args]\n" +
  "       flywheel-js export|e <file.fw | -s CODE> <output> [args]\n" +
  "       flywheel-js serve|s, desktop|d <file.fw> [--port N] [--host H]\n" +
  "       flywheel-js --error|-E <file.fw>   the last error file.fw stopped with (locations, no source)\n" +
  "       flywheel-js repl | help|h|--help | version|v|--version\n" +
  "`flywheel-js SOURCE [arguments]` runs SOURCE.\n" +
  "build (b), test (t), format (fmt, f), doc, lsp, and update (u) need the Flywheel compiler.";
const usage = () => {
  console.error(usageText);
  process.exit(2);
};
const readStdin = () => {
  if (process.stdin.isTTY) return [];
  try { return fs.readFileSync(0, "utf8").split(/\r?\n/).filter((l, i, a) => i < a.length - 1 || l !== ""); }
  catch { return []; }
};

// Splits `[-s CODE | file] [rest...] [-- args...]` into the source, its name and program arguments.
function source(args, { needOutput } = {}) {
  let code, name, path_, rest = args.slice();
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
    code = fs.readFileSync(p, "utf8"); name = p; path_ = p;
  }
  const output = needOutput ? rest.shift() : undefined;
  if (needOutput && output === undefined) usage();
  return { code, name, file: path_, output, args: rest.concat(after) };
}

/* Diagnostics: colored on a terminal (NO_COLOR turns it off, FORCE_COLOR on), with paths relative
 * to the working directory. The last error of each file is kept, without its source, in
 * $XDG_STATE_HOME/flywheel.js/errors (~/.local/state; %LOCALAPPDATA% on Windows) for --error. */
const envOn = n => !!process.env[n] && process.env[n] !== "0";
const color = process.env.NO_COLOR ? false : envOn("FORCE_COLOR") || envOn("CLICOLOR_FORCE") ? true :
  !!process.stderr.isTTY && process.env.TERM !== "dumb";
const shownPath = p => {
  if (!path.isAbsolute(p)) return p;
  const rel = path.relative(process.cwd(), p);
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel) ? rel : p;
};
function recordFile(file) {
  const base = process.platform === "win32" ? process.env.LOCALAPPDATA :
    process.env.XDG_STATE_HOME || (process.env.HOME && path.join(process.env.HOME, ".local", "state"));
  if (!base) return null;
  let abs = path.resolve(file);
  try { abs = fs.realpathSync(abs); } catch { /* a file that is gone keeps its path */ }
  let h = 0xcbf29ce484222325n;
  for (const b of Buffer.from(abs, "utf8")) h = BigInt.asUintN(64, (h ^ BigInt(b)) * 0x100000001b3n);
  return { abs, path: path.join(base, "flywheel.js", "errors", h.toString(16).padStart(16, "0") + ".txt") };
}
const esc = t => String(t).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/\t/g, "\\t").replace(/\r/g, "");
const unesc = t => t.replace(/\\(.)/g, (m, c) => c === "n" ? "\n" : c === "t" ? "\t" : c);
function record(file, r) {
  const where = file && recordFile(file);
  if (!where) return;
  const lines = ["flywheel-error 1", `source ${esc(where.abs)}`, `time ${Math.floor(Date.now() / 1000)}`,
    `kind ${r.kind === "compile" ? "compile" : r.bare ? "bare" : "runtime"}`, `type ${esc(r.type || "")}`, `message ${esc(r.message || "")}`];
  if (r.omitted) lines.push(`omitted ${r.omittedAt} ${r.omitted}`);
  for (const f of r.frames || [])
    lines.push(`frame ${f.line} ${f.col} ${f.sline} ${f.scol} ${f.eline} ${f.ecol}\t ${esc(f.file.startsWith("<") ? f.file : path.resolve(f.file))}`, `fn ${esc(f.fn || "")}`);
  try {
    fs.mkdirSync(path.dirname(where.path), { recursive: true });
    fs.writeFileSync(where.path + ".tmp", lines.join("\n") + "\n");
    fs.renameSync(where.path + ".tmp", where.path);
  } catch { /* the record is a convenience */ }
}
function showLast(file) {
  const where = file && recordFile(fs.existsSync(file) && fs.statSync(file).isDirectory() ? path.join(file, "source.fw") : file);
  let text;
  try { text = fs.readFileSync(where.path, "utf8"); } catch { console.error(`flywheel-js: no error recorded for ${file}`); return 1; }
  const r = { kind: "runtime", type: "", message: "", frames: [], omitted: 0, omittedAt: 0 };
  let when = 0, frame = null;
  for (const line of text.split("\n")) {
    const sp = line.indexOf(" "), key = sp < 0 ? line : line.slice(0, sp), value = sp < 0 ? "" : line.slice(sp + 1);
    if (key === "time") when = Number(value);
    else if (key === "kind") { r.kind = value === "compile" ? "compile" : "runtime"; r.bare = value === "bare"; }
    else if (key === "type") r.type = unesc(value);
    else if (key === "message") r.message = unesc(value);
    else if (key === "omitted") [r.omittedAt, r.omitted] = value.split(" ").map(Number);
    else if (key === "frame") {
      const [nums, f] = value.split("\t ");
      const [l, c, sl, sc, el, ec] = nums.split(" ").map(Number);
      frame = { file: unesc(f || ""), fn: "", line: l, col: c, sline: sl, scol: sc, eline: el, ecol: ec, text: "" };
      r.frames.push(frame);
    } else if (key === "fn" && frame) frame.fn = unesc(value);
  }
  const d = new Date(when * 1000), two = n => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
  const intro = `last error of ${shownPath(where.abs)}, ${stamp}:`;
  console.error((color ? "\x1b[2m" + intro + "\x1b[0m" : intro) + "\n" + Flywheel.formatDiagnostic(r, { color, source: false, shownPath }));
  return 0;
}
// Run options: diagnostics are printed here and recorded for --error.
const runOptions = s => ({ name: s.name, file: s.file ? path.resolve(s.file) : s.name, stdin: readStdin(), args: s.args, color,
  diagnostic: r => { console.error(Flywheel.formatDiagnostic(r, { color, shownPath })); record(s.file, r); } });
const render = r => r.value instanceof Flywheel.FwElement ? r.interp.render(r.value) : r.html != null ? r.html : null;
const flag = (args, f, d) => { const i = args.indexOf(f); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };

if (cmd === "error") {
  if (!argv[0]) { console.error("flywheel-js: --error needs a source file: flywheel-js --error main.fw"); process.exit(2); }
  process.exitCode = showLast(argv[0]);
} else if (cmd === "version") {
  console.log("flywheel " + Flywheel.version);
} else if (cmd === "help") {
  console.log(usageText);
} else if (["build", "test", "format", "doc", "lsp", "update"].includes(cmd)) {
  console.error(`flywheel-js: \`${cmd}\` needs the Flywheel compiler: use \`flywheel ${cmd}\``);
  process.exit(2);
} else if (cmd === "check") {
  const s = source(argv);
  try { Flywheel.parse(s.code, s.name); console.log(`${s.name} parses`); }
  catch (e) {
    if (e instanceof Flywheel.CompileError) { runOptions(s).diagnostic(Flywheel.compileReport(e, s.name, s.code)); process.exit(1); }
    throw e;
  }
} else if (cmd === "run") {
  const s = source(argv);
  const r = Flywheel.run(s.code, runOptions(s));
  const html = render(r);
  if (html != null) console.log(html);
  else if (r.text != null) console.log(r.text);
  process.exitCode = r.status || 0;
} else if (cmd === "export") {
  const s = source(argv, { needOutput: true });
  const r = Flywheel.run(s.code, runOptions(s));
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
  const r = Flywheel.run(s.code, runOptions(s));
  const ms = Number(process.hrtime.bigint() - t) / 1e6;
  const val = r.value === null || r.value === undefined ? null : render(r) ?? JSON.stringify(r.interp.toJson(r.value));
  const short = val && val.length > 120 ? val.slice(0, 117) + "..." : val;
  console.error(val === null ? `[debug] no return value, exit status ${r.status || 0} in ${ms.toFixed(2)} ms` : `[debug] returned ${short} in ${ms.toFixed(2)} ms`);
  process.exitCode = r.status || 0;
} else if (cmd === "serve" || cmd === "desktop") {
  const port = Number(flag(argv, "--port", 8000)), host = flag(argv, "--host", "127.0.0.1");
  const s = source(argv);
  const r = Flywheel.run(s.code, runOptions(s));
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
