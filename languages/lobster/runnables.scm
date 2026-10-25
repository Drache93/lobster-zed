; A run button on the first statement of every file: Lobster files are programs.
(
  (source_file
    .
    (_) @run)
  (#set! tag lobster-file)
)

; `run_test("name"): ...` blocks from modules/testing.lobster.
(
  (call
    function: (identifier) @_fn
    arguments: (argument_list (string (string_content) @LOBSTER_TEST_NAME))) @run
  (#eq? @_fn "run_test")
  (#set! tag lobster-test)
)
