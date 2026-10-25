# Lobster for Zed

Zed support for the [Lobster](https://github.com/aardappel/lobster) language:

- syntax highlighting, from a tree-sitter grammar written against `docs/source/language_spec.md`
- bracket matching, auto-indent, outline panel, function/class text objects
- a ▶ run button on each file and on `run_test("...")` blocks
- the Lobster language server (`dev/lsp` in the Lobster repo): errors, completion, hover,
  go to definition

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

## Working on the grammar

```sh
cd tree-sitter-lobster
tree-sitter generate
tree-sitter test
```

Zed builds the grammar from a git commit, so after changing it: commit, then put the new
commit's SHA in `rev` under `[grammars.lobster]` in `extension.toml` and reinstall the dev
extension.

The grammar decides by syntax alone where the reference parser consults its symbol table, so a
few things differ:

- `f x` is a call whenever a name is followed by something that starts an expression other
  than an operator (`a - 1` is a subtraction).
- `T {` is always a constructor; `f<T>(` with no space before `<` is tried as explicit type
  arguments, falling back to a comparison.
- A trailing block inside an unclosed bracket spanning lines (as in `modules/match.lobster`) is
  not supported.
