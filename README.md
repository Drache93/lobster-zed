# Lobster for Zed

Zed support for the [Lobster](https://github.com/aardappel/lobster) language.

## What works

These come from the extension itself and work with any Lobster:

| Feature | Notes |
|---|---|
| Syntax highlighting | From a tree-sitter grammar written against `docs/source/language_spec.md`. Parses 211 of the 212 `.lobster` files in Lobster's samples, tests and modules (see [Grammar differences](#grammar-differences)). |
| Bracket matching, auto-indent | Indents after `:` and dedents for `else`, `elif` and `case`. |
| Outline panel, breadcrumbs | Functions, classes, structs, enums and their fields. |
| Text objects | Function, class and comment (in vim mode: `af`, `if`, `ac`, `ic`, `gc`). |
| ▶ Run buttons | On each file and on each `run_test("...")` block. They run `lobster`, which must be on `PATH`. |
| File icon | A lobster for `.lobster` files, in the "Zed + Lobster" icon theme (see [File icon](#file-icon)). |

These come from the Lobster language server (`dev/lsp` in a Lobster checkout):

| Feature | Upstream server | With the Lobster changes (see below) |
|---|---|---|
| Errors and warnings | Each file is compiled on its own, so a file that is only ever imported shows errors about names its program declares, and messages about other files land on the open one. Whole lines are marked. | Each file is checked as part of the program(s) that import it, found by following imports, with no settings, as you type. Each message shows in the file it is about, marking the name it quotes. While a program has errors, the warnings it had stay, moving with your edits. |
| Hover | Signatures and types; parameter types of functions nothing calls show as `undefined`. | Inferred types for called functions, declared ones otherwise, for parameters and locals too, and generic types like `dictionary<K, V>`. |
| Go to definition | Functions and globals, from the main file of a program. | Functions, variables, parameters, fields and types, in any file of the program. Builtins like `gl.read_texture` jump to their C++ source in the Lobster checkout. |
| Find references, rename | — | Functions, variables, parameters, fields, types and enum values, across all programs that include them. Not what Lobster's own modules declare. |
| Completion | Builtin functions only. | Also the variables in scope, globals, functions, types and enum values, and after a dot the fields and methods of the variable's class. |
| Signature help | — | Parameters of the call you're typing, for your functions and builtins. |
| Symbols | — | Document symbols, and workspace symbols (project-wide search for functions, types, fields and globals). |
| Unused code | Unused local variables (compiler warning). | Also unused functions (each overload), globals and imports, shown faded, once every program that includes the file has been checked. |
| Quick fix | `var` → `let` where the compiler suggests it. | Same. |

The Lobster changes are not in upstream Lobster yet. The first part (checking whole programs,
hover, definition and unused code) is proposed in
[aardappel/lobster#459](https://github.com/aardappel/lobster/pull/459) and open to discussion. The
rest (references, rename, completion, signature help, symbols, and the diagnostics changes) builds
on it, from a compiler option `--index` that writes a program's definitions and their uses, and
isn't proposed yet.

## What doesn't work (yet)

- Formatting: Lobster has no formatter or agreed layout to format to.
- Semantic highlighting from the server: highlighting comes from the grammar.
- Uses of a type in annotations (`x:Foo`) are found by name, so references and rename of a type
  also match an unrelated variable or field with the same name used without a dot.
- Diagnostics mark the name a message quotes, or else the line: the compiler reports lines, not
  columns.
- The extension isn't in Zed's extension registry: install it as a dev extension (below). It
  doesn't bundle Lobster or the language server: you need a Lobster checkout built from source,
  with the changes above for most of the server's features.

## Setup

1. Build Lobster and its language server in your Lobster checkout:

   ```sh
   cd ~/Dev/lobster/dev/lsp && npm ci && npm run webpack
   ```

2. Put Lobster's `bin` directory on your `PATH` (the run tasks call `lobster`, and the extension
   finds the language server next to the compiler, at `../dev/lsp/webpack-out/lobster_lsp.js`).
   Use the real directory, not a symlink to the binary.

   Or, instead of `PATH`, point the extension at it in Zed's `settings.json`:

   ```json
   "lsp": {
     "lobster-lsp": {
       "settings": {
         "executable": "/Users/you/Dev/lobster/bin/lobster",
         "imports": []
       }
     }
   }
   ```

   `lsp.lobster-lsp.binary.path` / `arguments` override the server command entirely.

3. In Zed: command palette → `zed: install dev extension` → pick this directory.

After rebuilding Lobster or its server, run `editor: restart language server` in Zed.

### File icon

Zed can't add one file type's icon to the default icon theme, so the extension comes with an
icon theme, "Zed + Lobster", which is Zed's default with a lobster for `.lobster` files. To use
it, run `icon theme selector: toggle` and pick "Zed + Lobster (Dark)" or "(Light)", or set it in
`settings.json`:

```json
"icon_theme": "Zed + Lobster (Dark)"
```

Zed draws icons from extensions in their own colours rather than tinting them with the colour
theme, so the lobster uses the icon colours of Zed's One Dark and One Light themes and can be a
shade off in other colour themes. It doesn't combine with other icon themes. It copies which icon the default theme gives each
file name and extension, so file types Zed adds icons for later show as plain files until
`icon_themes/lobster.json` is regenerated with `python3 scripts/update_icon_theme.py`.

## Working on the grammar

```sh
cd tree-sitter-lobster
tree-sitter generate
tree-sitter test
```

Zed builds the grammar from a commit of `repository` under `[grammars.lobster]` in
`extension.toml`, so after changing it: commit and push, then put the new commit's SHA in `rev`
and reinstall the dev extension. To try a grammar change before pushing, point `repository` at
your checkout with a `file://` URL.

### Grammar differences

The grammar decides by syntax alone where the reference parser consults its symbol table, so a
few things differ:

- `f x` is a call whenever a name is followed by something that starts an expression other
  than an operator (`a - 1` is a subtraction).
- `T {` is always a constructor; `f<T>(` with no space before `<` is tried as explicit type
  arguments, falling back to a comparison.
- A trailing block inside an unclosed bracket spanning lines (as in `modules/match.lobster`) is
  not supported.

## License

MIT, see [LICENSE](LICENSE).
