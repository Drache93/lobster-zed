/**
 * @file Lobster grammar for tree-sitter
 * @license MIT
 *
 * Follows docs/source/language_spec.md of https://github.com/aardappel/lobster.
 * Where the reference parser decides by symbol table lookups (is `f` a function,
 * an enum, a variable?) this grammar decides by syntax alone, see the notes at
 * `call_noparen` and `constructor`.
 */


const PREC = {
  noparen_call: -1,
  statement: 1, // a one-line body ends before `,`
  assign: 2, // but not before `=`
  logical: 3, // and or
  not: 4,
  equality: 5,
  compare: 6,
  bitwise: 7,
  shift: 8,
  additive: 9,
  multiplicative: 10,
  is: 11,
  unary: 12,
  postfix: 13,
  call: 14,
};

const commaSep1 = (rule) => seq(rule, repeat(seq(',', rule)));
const commaSep = (rule) => optional(commaSep1(rule));

module.exports = grammar({
  name: 'lobster',

  externals: ($) => [
    $._newline,
    $._indent,
    $._dedent,
    // Never produced: the scanner only checks whether they are valid, to know
    // when it is inside brackets (where line breaks are insignificant).
    ')',
    ']',
    '}',
    $._error_sentinel,
    $._float_trailing_dot,
  ],

  extras: ($) => [/[ \t\r\f\n]/, $.comment],

  word: ($) => $.identifier,

  supertypes: ($) => [$._expression, $._type],

  inline: ($) => [$._simple_type, $._body],

  conflicts: ($) => [
    [$.binary_expression, $.conditional_declaration],
    // `a<b`: comparison, explicit type arguments of a call, or a generic
    // type being constructed.
    [$._primary, $.generic_call, $._type_identifier],
    [$.generic_call, $._type_identifier],
    // `if f(x): ...`: the `:` belongs to the `if`, not a trailing function.
    [$.call],
    [$.generic_call],
    [$.method_call],
    [$.super_call],
    // `for (x) y:` parenthesized iterable with loop variables, or `for` with
    // an expression iterable.
    [$.parenthesized_expression, $.for_statement],
  ],

  rules: {
    source_file: ($) => repeat($._statement),

    _statement: ($) => seq($._stmt, $._newline),

    // A statement without its line terminator, also usable as a one-line body.
    _stmt: ($) =>
      choice(
        $.expression_statement,
        $.assignment,
        $.multiple_assignment,
        $.variable_declaration,
        $.static_declaration,
        $.member_declaration,
        $.nonlocal_declaration,
        $.function_definition,
        $.class_definition,
        $.union_definition,
        $.enum_definition,
        $.import_statement,
        $.namespace_statement,
        $.attribute,
        $.for_statement,
        $.while_statement,
        $.guard_statement,
        $.return_statement,
        $.break_statement,
        $.continue_statement,
      ),

    block: ($) => seq($._indent, repeat1($._statement), $._dedent),

    _body: ($) => choice($.block, $._inline_stmt),

    // What may follow `:` on the same line.
    _inline_stmt: ($) =>
      choice(
        $.expression_statement,
        $.assignment,
        $.multiple_assignment,
        $.for_statement,
        $.while_statement,
        $.return_statement,
        $.break_statement,
        $.continue_statement,
      ),

    // In a one-line body, a `,` after the expression ends the body.
    expression_statement: ($) => prec(PREC.statement, $._expression),

    // ---------------------------------------------------------------------
    // Declarations

    variable_declaration: ($) =>
      seq(
        optional('private'),
        choice('let', 'var'),
        commaSep1($._binding),
        optional(seq('=', field('value', $._expression_list))),
      ),

    _binding: ($) =>
      seq(
        field('name', choice($.identifier, $.qualified_name)),
        optional(seq(':', field('type', $._type))),
      ),

    _expression_list: ($) => prec.right(commaSep1($._expression)),

    static_declaration: ($) =>
      seq(
        choice('static', 'static_frame'),
        $._binding,
        '=',
        field('value', $._expression),
      ),

    member_declaration: ($) =>
      seq(
        choice('member', 'member_frame'),
        $._binding,
        '=',
        field('value', $._expression),
      ),

    nonlocal_declaration: ($) =>
      seq(
        'nonlocal',
        choice($.variable_declaration, seq('from', commaSep1($.identifier))),
      ),

    function_definition: ($) =>
      seq(
        optional('private'),
        choice('def', 'constructor'),
        field('name', choice($.identifier, $.qualified_name, $.operator_name)),
        optional(field('type_parameters', $.type_parameters)),
        field('parameters', $.parameter_list),
        optional(field('free_variables', $.free_variable_list)),
        optional(seq('->', field('return_type', $.return_types))),
        optional(seq(':', field('body', $._body))),
      ),

    qualified_name: ($) => prec.right(1, seq($.identifier, repeat1(seq(".", $.identifier)))),

    operator_name: ($) =>
      seq(
        'operator',
        choice(
          '+', '-', '*', '/', '%', '++', '--', '==', '!=', $._open_angle, '>', '<=', '>=',
          '&', '|', '^', '~', '<<', '>>', '=',
          '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=',
          seq('[', ']'),
        ),
      ),

    type_parameters: ($) => seq($._open_angle, commaSep1($._type_identifier), '>'),

    parameter_list: ($) => seq($._open_paren, commaSep($.parameter), ')'),

    parameter: ($) =>
      seq(
        field('name', $.identifier),
        optional(seq(choice(':', '::'), field('type', $._type))),
        optional(seq('=', field('default', $._expression))),
      ),

    free_variable_list: ($) => seq('[', commaSep1($._binding), ']'),

    return_types: ($) => commaSep1($._type),

    class_definition: ($) =>
      seq(
        optional('private'),
        optional('abstract'),
        choice('class', 'struct'),
        field('name', $._type_identifier),
        optional(field('type_parameters', $.type_parameters)),
        optional(
          choice(
            seq(
              ':',
              optional(field('superclass', $._simple_type)),
              optional(field('body', $.class_body)),
            ),
            seq('=', field('specializes', $.generic_type)),
          ),
        ),
      ),

    class_body: ($) => seq($._indent, repeat1(seq($._member, $._newline)), $._dedent),

    _member: ($) => choice($.field_declaration, $.function_definition, $.attribute),

    field_declaration: ($) =>
      seq(
        optional('private'),
        field('name', $.identifier),
        optional(seq(':', field('type', $._type))),
        optional(seq('=', field('default', $._expression))),
      ),

    union_definition: ($) =>
      seq(
        optional('private'),
        'union',
        choice('class', 'struct'),
        field('name', $._type_identifier),
        ':',
        field('body', $.union_body),
      ),

    union_body: ($) =>
      seq($._indent, repeat1(seq($.union_member, $._newline)), $._dedent),

    union_member: ($) =>
      seq(
        field('name', $._type_identifier),
        optional(seq($._open_paren, commaSep($.field_declaration), ')')),
      ),

    enum_definition: ($) =>
      seq(
        optional('private'),
        choice('enum', 'enum_flags'),
        field('name', $._type_identifier),
        ':',
        field('body', choice($.enum_body, commaSep1($.enumerator))),
      ),

    enum_body: ($) =>
      seq($._indent, repeat1(seq(commaSep1($.enumerator), optional(','), $._newline)), $._dedent),

    enumerator: ($) =>
      seq(field('name', $.identifier), optional(seq('=', field('value', $._expression)))),

    import_statement: ($) =>
      seq(
        'import',
        choice(
          field('module', $.module_path),
          field('path', $.string),
          seq('from', field('directory', $.string)),
        ),
      ),

    module_path: ($) => seq(optional('.'), $.identifier, repeat(seq('.', $.identifier))),

    namespace_statement: ($) =>
      prec.right(seq('namespace', optional(field('name', $.module_path)))),

    attribute: ($) =>
      seq('attribute', field('name', $.identifier), optional(seq('=', field('value', $._expression)))),

    // ---------------------------------------------------------------------
    // Statements

    assignment: ($) =>
      prec.right(
        PREC.assign,
        seq(
          field('left', $._expression),
          field(
            'operator',
            choice('=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>='),
          ),
          field('right', choice($._expression, $.assignment)),
        ),
      ),

    multiple_assignment: ($) =>
      seq(
        field('left', seq($._expression, repeat1(seq(',', $._expression)))),
        '=',
        field('right', $._expression_list),
      ),

    for_statement: ($) =>
      seq(
        'for',
        choice(
          seq(
            '(',
            field('iterable', $._expression),
            ')',
            optional(field('variables', $.loop_variables)),
          ),
          field('iterable', $._expression),
        ),
        ':',
        field('body', $._body),
      ),

    loop_variables: ($) =>
      choice(commaSep1($.identifier), seq('(', commaSep1($.parameter), ')')),

    while_statement: ($) =>
      seq('while', field('condition', $._expression), ':', field('body', $._body)),

    guard_statement: ($) =>
      seq('guard', field('condition', $._condition), optional(seq(':', field('body', $._body)))),

    return_statement: ($) =>
      prec.right(
        seq(
          'return',
          optional($._expression_list),
          optional(seq('from', field('from', choice($.identifier, 'program')))),
        ),
      ),

    break_statement: (_) => 'break',

    continue_statement: (_) => 'continue',

    _condition: ($) =>
      choice(
        $._expression,
        prec.right(seq($.conditional_declaration, repeat(seq('and', $.conditional_declaration)))),
      ),

    // In `let a = x and let b = y` the `and` may continue the value or the
    // chain; the parser tries both.
    conditional_declaration: ($) =>
      prec(PREC.logical, seq(choice('let', 'var'), $._binding, '=', field('value', $._expression))),

    // ---------------------------------------------------------------------
    // Expressions

    _expression: ($) =>
      choice(
        $.binary_expression,
        $.unary_expression,
        $.not_expression,
        $.is_expression,
        $.call_noparen,
        $._primary,
      ),

    binary_expression: ($) => {
      const table = [
        [PREC.multiplicative, choice('*', '/', '%')],
        [PREC.additive, choice('+', '-')],
        [PREC.shift, choice('<<', '>>')],
        [PREC.bitwise, choice('&', '|', '^')],
        [PREC.compare, choice('<', $._open_angle, '>', '<=', '>=')],
        [PREC.equality, choice('==', '!=')],
        [PREC.logical, choice('and', 'or')],
      ];
      return choice(
        ...table.map(([p, op]) =>
          prec.left(
            /** @type {number} */ (p),
            seq(field('left', $._expression), field('operator', op), field('right', $._expression)),
          ),
        ),
      );
    },

    unary_expression: ($) =>
      prec(
        PREC.unary,
        seq(field('operator', choice('-', '~', '++', '--')), field('argument', $._expression)),
      ),

    not_expression: ($) => prec(PREC.not, seq('not', field('argument', $._expression))),

    is_expression: ($) =>
      prec.left(PREC.is, seq(field('value', $._expression), 'is', field('type', $._type))),

    _primary: ($) =>
      choice(
        $.identifier,
        $.integer,
        $.float,
        alias($._float_trailing_dot, $.float),
        $.string,
        $.character,
        $.nil,
        $.parenthesized_expression,
        $.vector,
        $.constructor,
        $.call,
        $.generic_call,
        $.method_call,
        $.member_expression,
        $.index_expression,
        $.update_expression,
        $.lambda,
        $.if_expression,
        $.switch_expression,
        $.typeof_expression,
        $.super_call,
        $.pakfile_expression,
        $.assert_expression,
        $.type_conversion,
      ),

    nil: ($) => prec.right(seq('nil', optional(seq('::', field('type', $._type))))),

    parenthesized_expression: ($) =>
      seq('(', choice($._expression, $.assignment), repeat(seq(',', $._expression)), ')'),

    vector: ($) =>
      prec.right(
        seq(
          '[',
          commaSep($._expression),
          optional(','),
          ']',
          optional(seq('::', field('element_type', $._type))),
        ),
      ),

    // `T { ... }`. A name directly followed by `{` is always taken to be a type.
    constructor: ($) =>
      seq(
        optional(
          field(
            'type',
            choice(
              $._type_identifier,
              alias($._generic_type_immediate, $.generic_type),
            ),
          ),
        ),
        '{',
        commaSep($.initializer),
        optional(','),
        '}',
      ),

    _generic_type_immediate: ($) =>
      seq(field('name', $._type_identifier), alias($._type_arguments_immediate, $.type_arguments)),

    initializer: ($) =>
      choice(seq(field('field', $.identifier), ':', field('value', $._expression)), $._expression),

    call: ($) =>
      prec(
        PREC.call,
        seq(
          field('function', $.identifier),
          field('arguments', $.argument_list),
          repeat($._trailing_function),
        ),
      ),

    // `f<T>(...)`: only without whitespace before `<`, and even then `f<a`
    // may be a comparison, which the parser keeps open until one fails.
    generic_call: ($) =>
      seq(
        field('function', $.identifier),
        field('type_arguments', alias($._type_arguments_immediate, $.type_arguments)),
        field('arguments', $.argument_list),
        repeat($._trailing_function),
      ),

    // `f x`: a call of a function with a single argument, without parentheses.
    // The reference parser only does this when `f` names a function and not a
    // variable; here any name followed by something that starts an expression
    // (other than an operator) is taken to be such a call.
    call_noparen: ($) =>
      prec.right(
        PREC.noparen_call,
        seq(
          field('function', choice($.identifier, $.member_expression)),
          field('argument', $._expression),
          repeat($._trailing_function),
        ),
      ),

    method_call: ($) =>
      prec(
        PREC.call,
        seq(
          field('object', $._primary),
          '.',
          field('method', $.identifier),
          optional(field('type_arguments', alias($._type_arguments_immediate, $.type_arguments))),
          field('arguments', $.argument_list),
          repeat($._trailing_function),
        ),
      ),

    member_expression: ($) =>
      prec(PREC.postfix, seq(field('object', $._primary), '.', field('field', $.identifier))),

    index_expression: ($) =>
      prec(
        PREC.postfix,
        seq(field('object', $._primary), token.immediate('['), field('index', $._expression), ']'),
      ),

    update_expression: ($) =>
      prec(PREC.postfix, seq(field('argument', $._primary), field('operator', choice('++', '--')))),

    super_call: ($) =>
      seq(
        'super',
        field('method', $.identifier),
        field('arguments', $.argument_list),
        repeat($._trailing_function),
      ),

    type_conversion: ($) =>
      seq(field('type', alias(choice('int', 'float', 'string', 'any'), $.primitive_type)), field('arguments', $.argument_list)),

    typeof_expression: ($) => seq('typeof', field('type', $._type)),

    pakfile_expression: ($) => seq('pakfile', $.string),

    assert_expression: ($) => prec.right(seq('assert', field('condition', $._condition))),

    argument_list: ($) =>
      seq($._call_paren, commaSep(choice($._expression, $.assignment)), ')'),

    // A function value passed after the argument list of a call.
    _trailing_function: ($) =>
      choice(
        alias($._trailing_block, $.lambda),
        alias($._trailing_named, $.lambda),
        alias($._trailing_typed, $.lambda),
        $.lambda,
      ),

    _trailing_block: ($) => seq(':', field('body', $._body)),

    _trailing_named: ($) =>
      seq(field('parameters', alias($._lambda_names, $.parameter_list)), ':', field('body', $._body)),

    _trailing_typed: ($) =>
      seq(
        field('parameters', $.parameter_list),
        optional(seq('->', field('return_type', $._type))),
        ':',
        field('body', $._body),
      ),

    lambda: ($) =>
      seq(
        'fn',
        optional(
          choice(
            seq(
              field('parameters', $.parameter_list),
              optional(seq('->', field('return_type', $._type))),
            ),
            field('parameters', alias($._lambda_names, $.parameter_list)),
          ),
        ),
        ':',
        field('body', $._body),
      ),

    _lambda_names: ($) => commaSep1(alias($._lambda_name, $.parameter)),

    _lambda_name: ($) => field('name', $.identifier),

    if_expression: ($) =>
      prec.right(
        seq(
          'if',
          field('condition', $._condition),
          ':',
          field('consequence', $._body),
          repeat(field('alternative', $.elif_clause)),
          optional(field('alternative', $.else_clause)),
        ),
      ),

    elif_clause: ($) =>
      seq('elif', field('condition', $._expression), ':', field('consequence', $._body)),

    else_clause: ($) => seq('else', ':', field('body', $._body)),

    switch_expression: ($) =>
      seq(
        'switch',
        field('value', $._expression),
        ':',
        field('body', $.switch_body),
      ),

    switch_body: ($) =>
      seq($._indent, repeat1(seq(choice($.case_clause, $.default_clause), $._newline)), $._dedent),

    case_clause: ($) =>
      seq(
        'case',
        choice(
          seq(commaSep1(field('pattern', choice($._pattern, $.range_pattern))), ':'),
          seq(field('pattern', $._type_identifier), '::'),
          seq(
            field('pattern', $._type_identifier),
            $._open_paren,
            commaSep(field('binding', $.identifier)),
            ')',
            ':',
          ),
        ),
        field('body', $._body),
      ),

    default_clause: ($) =>
      seq(choice('default', 'out_of_range'), ':', field('body', $._body)),

    _pattern: ($) => choice($.unary_expression, $._primary),

    range_pattern: ($) => seq($._pattern, '..', $._pattern),

    // ---------------------------------------------------------------------
    // Types

    _type: ($) =>
      choice($._simple_type, $.vector_type, $.nilable_type, $.resource_type),

    _simple_type: ($) =>
      choice($.primitive_type, $._type_identifier, alias($.qualified_name, $.qualified_type), $.generic_type),

    primitive_type: (_) => choice('int', 'float', 'string', 'void', 'any'),

    _type_identifier: ($) => alias($.identifier, $.type_identifier),

    generic_type: ($) =>
      prec(1, seq(field('name', choice($._type_identifier, $.primitive_type)), $.type_arguments)),

    // Integers are bit widths, as in `x:int<32>`.
    type_arguments: ($) => seq($._open_angle, commaSep1(choice($._type, $.integer)), '>'),

    _type_arguments_immediate: ($) =>
      seq(alias(token.immediate('<'), '<'), commaSep1(choice($._type, $.integer)), '>'),

    vector_type: ($) => seq('[', field('element', $._type), ']'),

    nilable_type: ($) => seq($._type, '?'),

    resource_type: ($) => seq('resource', $._open_angle, $.identifier, '>'),

    // ---------------------------------------------------------------------
    // Tokens

    // `f(` is an argument list, `f (` starts a parenthesized single argument.
    _call_paren: (_) => alias(token.immediate('('), '('),

    _open_paren: (_) => choice('(', alias(token.immediate('('), '(')),

    _open_angle: (_) => choice('<', alias(token.immediate('<'), '<')),

    identifier: (_) => /[a-zA-Z_\u0080-\uffff][a-zA-Z0-9_\u0080-\uffff]*/,

    integer: (_) => token(choice(/0[xX][0-9a-fA-F]+/, /[0-9]+/)),

    // `1.` (no digits after the dot) comes from the scanner.
    float: (_) =>
      token(
        choice(
          /[0-9]+\.[0-9]+([eE][+-]?[0-9]+)?/,
          /\.[0-9]+([eE][+-]?[0-9]+)?/,
          'inf',
          'infinity',
          'nan',
        ),
      ),

    character: (_) => token(seq("'", repeat(choice(/[^'\\\n]/, /\\./, /\\x[0-9a-fA-F]{2}/)), "'")),

    string: ($) =>
      choice(
        seq(
          '"',
          repeat(
            choice(
              $.string_content,
              $.escape_sequence,
              alias(choice('{{', '}}'), $.escape_sequence),
              $.interpolation,
            ),
          ),
          token.immediate('"'),
        ),
        $._multiline_string,
      ),

    _multiline_string: ($) =>
      seq(alias('"""', '"'), optional(alias($._multiline_content, $.string_content)), alias('"""', '"')),

    _multiline_content: (_) => token(repeat1(choice(/[^"]/, /"[^"]/, /""[^"]/))),

    string_content: (_) => token.immediate(prec(1, /[^"\\{}\n]+/)),

    escape_sequence: (_) =>
      token.immediate(choice(/\\x[0-9a-fA-F]{2}/, /\\u[0-9a-fA-F]{4}/, /\\[ntr\\"'{}]/)),

    interpolation: ($) => seq('{', field('expression', $._expression), '}'),

    comment: (_) =>
      token(choice(seq('//', /[^\n]*/), seq('/*', /[^*]*\*+([^/*][^*]*\*+)*/, '/'))),
  },
});
