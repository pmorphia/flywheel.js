# flywheel.js

The [Flywheel](https://github.com/fwlang/flywheel) language in JavaScript. One dependency-free file that runs Flywheel programs in a browser tab, a Web Worker or Node.

It powers the playground at **[flywheel.polymorphia.dev](https://flywheel.polymorphia.dev)**.

The real compiler is C++ on LLVM and produces native executables. flywheel.js is a tree-walking interpreter that follows the compiler's semantics and output formatting closely enough for learning and prototyping. It is version **2.6 (beta-6)**. It supports:

- classes with `constructor`/`destructor`, `public`/`private`/`protected` and `static` members, multiple inheritance (C3 order, `super.method`, `super.Base.method`), interfaces, decorators (`memoize function f`, `register class C`), and components, including `void component Icon = ...`, used like `<br>` as `<Icon name="star">` with no closing tag
- `x if condition else y`, and `spawn call` (no threads: the call runs at once and `join()` returns its result)
- the `math` and `random` modules
- enums with data, `match`, generics (erased) and nullable values
- closures, format specs (`{x:,.2f}`, `{n:#x}`, …), collections, `Result`s, `defer`, and error handling with typed and named errors (`throw "Name" with "message"`, `catch "Name" e`), and `assert`
- `<json>…</json>` literals, string imports (`import "math"`), top-level `return`, and the `json.load/dump/loads/dumps`, `time.delay/millis/elapsed/today/clock/timestamp` helpers
- units of measure (Flywheel 2.12): `unitns name`, `unit`, `unitconv`, quantity literals (`100m`, `0.32km`), quantity types of any numeric type (`int[time]`, `u8[data]`, `float[metric.length]`), `x in cm`, `type()`/`unit()`/`unitns()`, `unitconv 1length.ft = 0.3048metric.length.m` relations between namespaces (`1m + 1ft` is `1.3048m`), and the `metric`, `imperial`, and `time` unit libraries (`time.sleep` takes seconds or a time quantity, Flywheel 2.13); mixing namespaces is reported when the operation runs
- one-call bodies after `run`, with no `end`: `if x > 5 run greet()`, `else if x > 2 run f()`, `else run g()`, `for i in items run print i`, `while ok run step()`; the parentheses are optional (`while ok run step`)
- native markup (`<div class={c}>…</div>`) with live event handlers
- a browser-safe subset of the standard library, including `html`, `web.serve` routes and `desktop.window`

**Not included:** static type checking (programs the compiler would reject may still run), Flywheel 2.11's declared error types, reactive variables (`when`, including `when ... run`) and negated aliases, plus processes, networking, databases, native imports (`import c`, `import++`, `import rust`, `import zig`) and importing files or URLs. Native imports raise a catchable `NativeError`. File access (`json.load`, `json.dump`, `flywheel.run`) works under Node only. Destructors run when the program ends, since JavaScript cannot tell when an object becomes unreachable. Install [Flywheel](https://flywheel.polymorphia.dev) for the rest.

## Browser

```html
<script src="flywheel.js"></script>
<script>
  const r = Flywheel.run('print "Hello from {1 + 1} worlds"', {
    print: s => console.log(s),
    error: s => console.error(s),
  });
  console.log(r.status); // 0
</script>
```

To keep a runaway loop from freezing the page, load it in a worker with `importScripts("flywheel.js")` and stop the run with `worker.terminate()`. You can also pass `maxSteps` to stop long runs.

## Node

```js
const Flywheel = require("flywheel.js");   // or require("./flywheel.js")
Flywheel.run(code, { name: "main.fw", stdin: ["Ada"] });
```

The CLI:

```
npx flywheel-js run examples/hello.fw
npx flywheel-js examples/hello.fw              # the same: `flywheel-js SOURCE [arguments]` runs it
npx flywheel-js run -s 'print 6 * 7'           # code from the command line
npx flywheel-js check main.fw
npx flywheel-js export report.fw report.html   # write the value the program returns
npx flywheel-js debug main.fw                  # print the returned value and run time
npx flywheel-js serve page.fw --port 8080      # serve the returned page
npx flywheel-js repl
```

Commands take the compiler's short aliases: `r` (run), `c` (check), `e` (export), `db` (debug), `s` (serve), `d` (desktop), `h`/`help`/`--help`, and `v`/`version`/`--version` (`npx flywheel-js r main.fw`). `build`, `test`, `format`, `doc`, `lsp`, and `update` (and their aliases) need the Flywheel compiler and say so.

## API

| | |
|---|---|
| `Flywheel.run(code, opts)` | Runs a program and returns `{ status, value, html, text, served, window, interp }`. `value` is an element when the program returns one, serves `/`, or opens a `desktop.window`. Render it with `interp.render(value)`. |
| `opts` | `print(line)`, `error(line)`, `stdin` (array of lines for `input()`), `name` (file name used in messages), `args` (array for `os.args()`), `maxSteps` |
| `Flywheel.parse(code, name)` | Parses only. Throws `Flywheel.CompileError` with `line` and `col`. |
| `new Flywheel.Session(opts)` | A REPL session whose `exec(code)` keeps its variables between calls. |
| `interp.callFromHost(fn, args)` | Calls a Flywheel function, such as an `onclick={f}` handler, after the run. It returns an error string or `null`. |
| `Flywheel.version` | `"2.6 (beta-6) flywheel.js"` |

## Tests

```
npm test             # runs examples/*.fw against test/expected snapshots
node test/run.js --update
```

The snapshots record flywheel.js's own output, so they catch regressions. They are not a comparison with the native compiler.

## License

MIT. See [LICENSE](LICENSE).
