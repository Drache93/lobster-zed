(class_definition
  "abstract"? @context
  ["class" "struct"] @context
  name: (_) @name) @item

(union_definition
  "union" @context
  ["class" "struct"] @context
  name: (_) @name) @item

(union_member
  name: (_) @name) @item

(enum_definition
  ["enum" "enum_flags"] @context
  name: (_) @name) @item

(function_definition
  ["def" "constructor"] @context
  name: (_) @name) @item

(field_declaration
  name: (_) @name) @item

; Top-level variables only.
(source_file
  (variable_declaration
    ["let" "var"] @context
    name: (_) @name) @item)

(comment) @annotation
