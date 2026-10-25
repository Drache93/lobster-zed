; Later patterns take precedence in Zed, so general ones come first.

(identifier) @variable

; Implicit lambda and loop arguments: `_`, `_a`, ...
((identifier) @variable.special
  (#match? @variable.special "^_"))

((identifier) @variable.special
  (#eq? @variable.special "this"))

; Constants by convention: ALL_CAPS.
((identifier) @constant
  (#match? @constant "^[A-Z][A-Z0-9_]+$"))

; Types

(type_identifier) @type
(qualified_type) @type
(primitive_type) @type.builtin
(resource_type "resource" @type.builtin)

(class_definition name: (type_identifier) @type)
(union_member name: (type_identifier) @type)
(enum_definition name: (type_identifier) @enum)
(enumerator name: (identifier) @variant)

; Declarations

(function_definition name: (identifier) @function)
(function_definition name: (qualified_name (identifier) @function .))
(operator_name) @function

(parameter name: (identifier) @variable.parameter)
(loop_variables (identifier) @variable.parameter)
(case_clause binding: (identifier) @variable.parameter)

(field_declaration name: (identifier) @property)
(member_expression field: (identifier) @property)
(initializer field: (identifier) @property)

(attribute name: (identifier) @attribute)

; Calls

(call function: (identifier) @function)
(generic_call function: (identifier) @function)
(call_noparen function: (identifier) @function)
(call_noparen function: (member_expression field: (identifier) @function))
(method_call method: (identifier) @function.method)
(super_call method: (identifier) @function.method)

(constructor type: (type_identifier) @constructor)
(constructor type: (generic_type name: (type_identifier) @constructor))
(type_conversion type: (primitive_type) @type.builtin)

; Literals

(integer) @number
(float) @number

(string) @string
(string_content) @string
(escape_sequence) @string.escape
(character) @string.special

(nil) @constant.builtin
((identifier) @boolean
  (#any-of? @boolean "true" "false"))

(comment) @comment

; Imports and namespaces

(module_path (identifier) @namespace)
(namespace_statement name: (module_path (identifier) @namespace))

; Keywords

[
  "abstract"
  "attribute"
  "class"
  "constructor"
  "def"
  "enum"
  "enum_flags"
  "fn"
  "let"
  "member"
  "member_frame"
  "nonlocal"
  "private"
  "static"
  "static_frame"
  "struct"
  "union"
  "var"
] @keyword

[
  "import"
  "namespace"
  "from"
  "pakfile"
] @keyword

[
  "if"
  "elif"
  "else"
  "guard"
  "switch"
  "case"
  "default"
  "out_of_range"
  "for"
  "while"
  "return"
  "program"
] @keyword

[
  "and"
  "or"
  "not"
  "is"
  "typeof"
  "assert"
  "super"
  "operator"
] @keyword

(nil "nil" @constant.builtin)

[(break_statement) (continue_statement)] @keyword

; Operators and punctuation

[
  "+" "-" "*" "/" "%" "++" "--"
  "==" "!=" "<" ">" "<=" ">="
  "&" "|" "^" "~" "<<" ">>"
  "=" "+=" "-=" "*=" "/=" "%=" "&=" "|=" "^=" "<<=" ">>="
  "->" "::" ".."
] @operator

(nilable_type "?" @operator)

["(" ")" "[" "]"] @punctuation.bracket
(constructor ["{" "}"] @punctuation.bracket)
(type_arguments ["<" ">"] @punctuation.bracket)
(type_parameters ["<" ">"] @punctuation.bracket)

["," "." ":"] @punctuation.delimiter

(interpolation
  "{" @punctuation.special
  "}" @punctuation.special) @embedded
