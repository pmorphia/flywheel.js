# flywheel.js

The [Flywheel](https://github.com/fwlang/flywheel) language in JavaScript. One dependency-free file that runs Flywheel programs in a browser tab, a Web Worker or Node.

It powers the playground at **[flywheel.polymorphia.dev](https://flywheel.polymorphia.dev)**.

The real compiler is C++ on LLVM and produces native executables. flywheel.js is a tree-walking interpreter that follows the compiler's semantics and output formatting closely enough for learning and prototyping. It is version **2.14 (beta-14)**. It supports:

- classes with `constructor`/`destructor`, `public`/`private`/`protected` and `static` members, multiple inheritance (C3 order, `super.method`, `super.Base.method`), interfaces, decorators (`memoize function f`, `register class C`), and components, including `void component Icon = ...`, used like `<br>` as `<Icon name="star">` with no closing tag
- the built-in `vector2`, `vector3`, and `vector4` types (`vector3(1, 2, 3)`, `vector3(x=1, y=2, z=3)`, `<vector3 x=1 y=2 z=3>`, `<vector3 1 2.5 3>`; components are `double`s, Flywheel 2.30) with their moves (`up`/`north`, `forward`, `ana`, `movex(n)`, ...) and `a..b` ranges between them (a tuple; Flywheel 2.31); `slice`s (`a:b`, `a:b:step`, `text[:5]`, `xs[-2:]`, `xs[::-1]`, `operator :` and slices in `operator []`); named arguments (`f(1, step=2)`); `x .= f()` (`x = x.f()`), `x++`/`x--`, and `**`/`**=` (Flywheel 2.29)
- `struct` value types (copied on assignment: a field write stores a changed copy), `2 * v` with a struct's operator, and the `vecmath` library module (`Vec2`, `Vec3`, `Vec4`, `Mat4`, `Quat`)
- importing local modules under Node (or with a `readFile` option): `import helpers`, `import "lib/util.fw"`, relative imports (`import .rules`, `import ..shared.util`), the project root (`import @lib.ui`), groups (`import ui.{button, slider as s}`), and directory modules (`import ui` loads `ui/ui.fw`), with `private` declarations hidden from importers
- `x if condition else y`, and `spawn call` (no threads: the call runs at once and `join()` returns its result)
- `deep_copy(value)`, which copies everything a value reaches in one call (for saving and restoring a whole state; Flywheel 2.26), and `random.Generator(seed)`, a generator with its own state that gives the same numbers as the compiler's for the same seed
- the built-in names `__file__`, `__dir__`, `__line__`, `__args__`, `__version__` (this interpreter's version), `__flywheel__` (the Flywheel version it follows), `__impl__` (`"js"`), `__os__` (`"browser"` outside Node), and `__arch__`; `Flywheel.run(code, { file })` sets `__file__`, which otherwise is `name`
- the `math` and `random` modules, the `hot` module (`hot.reload()` and `hot.enabled()` are always `false`: hot reload is the compiler's `--hot`), and the `cogwheel` library module ([Cogwheel](https://github.com/pmorphia/cogwheel) Markdown configuration; `confile` and `save` need Node)
- enums with data, `match` statements and expressions (`case p => value`, Flywheel 2.24), `unless` (`if not`), `otherwise` null fallbacks (`a otherwise b`, formerly `??`, Flywheel 2.25), generics (erased) and nullable values
- closures, format specs (`{x:,.2f}`, `{n:#x}`, …), collections, `Result`s, `defer`, and error handling with typed and named errors (`throw "Name" with "message"`, `catch "Name" e`), and `assert`
- `<json>…</json>` literals, string imports (`import "math"`), top-level `return`, and the `json.load/dump/loads/dumps`, `time.delay/millis/elapsed/today/clock/timestamp` helpers
- units of measure (Flywheel 2.12): `unitns name`, `unit`, `unitconv`, quantity literals (`100m`, `0.32km`), quantity types of any numeric type (`int[time]`, `u8[data]`, `float[metric.length]`), `x in cm`, `type()`/`unit()`/`unitns()`, `unitconv 1length.ft = 0.3048metric.length.m` relations between namespaces (`1m + 1ft` is `1.3048m`), and the `metric`, `imperial`, and `time` unit libraries (`time.sleep` takes seconds or a time quantity, Flywheel 2.13), and `%` and `math.min`/`max`/`clamp`/`abs` on quantities (Flywheel 2.25); mixing namespaces is reported when the operation runs
- reactive variables (Flywheel 2.23): `reactive` and `computed` declarations, `when condition do ... else do ... end` and `when condition run f() else run g()`, conditions that read fields (`when player.health <= 0`) and call functions (`when far()`), `defer when` checked between statements, and negated aliases (`bool alive/dead = true`)
- one-call bodies after `run`, with no `end`: `if x > 5 run greet()`, `else if x > 2 run f()`, `else run g()`, `for i in items run print i`, `while ok run step()`; the parentheses are optional (`while ok run step`)
- native markup (`<div class={c}>…</div>`) with live event handlers, components qualified by module (`<cogwheel.heading>`), and void tags and components written without a closing tag inside an enclosing element (`<cogwheel.conf key="a" value="1">`)
- a browser-safe subset of the standard library, including `html`, `web.serve` routes and `desktop.window`

**Not included:** static type checking (programs the compiler would reject may still run), Flywheel 2.11's declared error types, plus processes, networking, databases, native imports (`import c`, `import++`, `import rust`, `import zig`), importing URLs, and importing files in a browser unless `readFile` is given. Native imports raise a catchable `NativeError`. File access (`json.load`, `json.dump`, `flywheel.run`, and `fs.read`, `fs.write`, `fs.exists`) works under Node only. Destructors run when the program ends, since JavaScript cannot tell when an object becomes unreachable. Install [Flywheel](https://flywheel.polymorphia.dev) for the rest.

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
npx flywheel-js --error main.fw                # the last error main.fw stopped with (-E)
```

An uncaught error prints a traceback in the Flywheel compiler's format: the error, then where it
was thrown and each call that led there, each with its source line and the failing range marked
(`^` under the operator, call, or member, `~` under the rest of its expression). Recursion is
folded, and output is colored on a terminal (`NO_COLOR=1` turns it off, `FORCE_COLOR=1` on):

```
Flywheel runtime error: NumericError: division by zero
  at main.fw:2:14 in divide
    2 | return a // b
      |        ~~^^~~
  at main.fw:13:7 in <module>
   13 | print divide(1, 0)
      |       ^^^^^^^^^^^^
```

`--error` prints the last error a file stopped with again, with its locations but not its source
lines. Records are kept in `$XDG_STATE_HOME/flywheel.js/errors` (by default `~/.local/state`;
`%LOCALAPPDATA%` on Windows); `-s` code is not recorded.

Commands take the compiler's short aliases: `r` (run), `c` (check), `e` (export), `db` (debug), `s` (serve), `d` (desktop), `h`/`help`/`--help`, and `v`/`version`/`--version` (`npx flywheel-js r main.fw`). `build`, `test`, `format`, `doc`, `lsp`, and `update` (and their aliases) need the Flywheel compiler and say so.

## API

| | |
|---|---|
| `Flywheel.run(code, opts)` | Runs a program and returns `{ status, value, html, text, served, window, interp }`. `value` is an element when the program returns one, serves `/`, or opens a `desktop.window`. Render it with `interp.render(value)`. |
| `opts` | `print(line)`, `error(line)`, `stdin` (array of lines for `input()`), `name` (file name used in messages), `args` (array for `os.args()`), `maxSteps`, `color` (ANSI colors in tracebacks), `diagnostic(report)` (receives tracebacks and compile errors as plain objects instead of `error` receiving their text), `file` (the program's absolute path: imports of local modules start there), `readFile(path)` (the text of a file, or `null`; Node's `fs` by default), `isDirectory(path)` and `listDirectory(path)` (for directory modules and suggestions of close names) |
| `Flywheel.formatDiagnostic(report, { color, source })` | The text of a report: `{ kind: "runtime" \| "compile", type, message, frames: [{ file, fn, line, col, sline, scol, eline, ecol, text }] }`, innermost frame first. `line:col` is the failing node, `sline:scol`..`eline:ecol` its expression, `text` the source line; `source: false` leaves the source lines out. |
| `Flywheel.parse(code, name)` | Parses only. Throws `Flywheel.CompileError` with `line` and `col`. |
| `new Flywheel.Session(opts)` | A REPL session whose `exec(code)` keeps its variables between calls. |
| `interp.callFromHost(fn, args)` | Calls a Flywheel function, such as an `onclick={f}` handler, after the run. It returns the error's traceback text (or passes the report to `opts.diagnostic`) or `null`. |
| `Flywheel.version` | `"2.14 (beta-14) flywheel.js"` |

## Tests

```
npm test             # runs examples/*.fw against test/expected snapshots
node test/run.js --update
```

The snapshots record flywheel.js's own output, so they catch regressions. They are not a comparison with the native compiler.

## License

MIT. See [LICENSE](LICENSE).
