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

| Feature | Upstream server | With the `lsp-whole-program` changes |
|---|---|---|
| Errors and warnings | Each file is compiled on its own, so a file that is only ever imported shows errors about names its program declares, and messages about other files land on the open one. | Each file is checked as part of the program(s) that import it, found by following imports, with no settings. Each message shows in the file and line it is about, as you type. |
| Hover | Signatures and types; parameter types of functions nothing calls show as `undefined`. | Declared types everywhere, including parameters and locals and generic types like `dictionary<K, V>`. |
| Go to definition | Functions and globals, from the main file of a program. | Functions, variables, parameters, fields and types, in any file of the program. Builtins like `gl.read_texture` jump to their C++ source in the Lobster checkout. |
| Unused code | Unused local variables (compiler warning). | Also unused functions (each overload), globals and imports, shown faded, once every program that includes the file has been checked. |
| Completion | Builtin functions only. | Same. |
| Quick fix | `var` → `let` where the compiler suggests it. | Same. |

The `lsp-whole-program` changes are not in upstream Lobster yet. They're proposed in
[aardappel/lobster#459](https://github.com/aardappel/lobster/pull/459) and open to discussion.

## What doesn't work (yet)

- Completion of your own functions, variables, fields and types: only builtins complete.
- Find references, rename, signature help, formatting, document and workspace symbols from the
  server (the outline panel works from the grammar), semantic highlighting.
- Diagnostics mark whole lines: the compiler reports lines, not columns.
- After an error, the compiler stops reporting some warnings, and nothing is marked unused,
  until the error is fixed.
- The extension isn't in Zed's extension registry: install it as a dev extension (below). It
  doesn't bundle Lobster or the language server: you need a Lobster checkout built from source.

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
