// External scanner for Lobster's layout rules (see "Lines, indentation and
// blocks" in docs/source/language_spec.md).
//
// All three layout tokens are zero-width and sit at the end of a line, so they
// can be produced in any order the grammar asks for: a block's last statement
// takes a NEWLINE, the block takes a DEDENT, and the statement that owned the
// block takes another NEWLINE, all at the same position.
//
// Differences from the reference lexer that keep the grammar LR(1):
// - no NEWLINE before a line starting with `elif`, `else` or `fn` at the same
//   indentation, so if/elif chains and trailing `fn` values need no lookahead;
// - continuation tokens need no special casing: after one, the grammar does
//   not accept NEWLINE, so the line break is skipped as whitespace.

#include "tree_sitter/array.h"
#include "tree_sitter/parser.h"

#include <stdint.h>
#include <string.h>

enum TokenType {
    NEWLINE,
    INDENT,
    DEDENT,
    CLOSE_PAREN,
    CLOSE_BRACKET,
    CLOSE_BRACE,
    ERROR_SENTINEL,
    FLOAT_TRAILING_DOT,
};

typedef struct {
    Array(uint16_t) indents;
} Scanner;

static inline void skip(TSLexer *lexer) { lexer->advance(lexer, true); }

static bool is_ident_char(int32_t c) {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') ||
           c == '_' || c >= 0x80;
}

static bool is_digit(int32_t c) { return c >= '0' && c <= '9'; }

// `1.` is a float only when the character after the `.` is neither `.` nor
// an identifier character (`1..2` is a range, `1.abs` a call), which a
// regular expression cannot express. Leading spaces are skipped.
typedef enum { NO_NUMBER, FLOAT_FOUND, OTHER_NUMBER } FloatScan;

static FloatScan scan_float_trailing_dot(TSLexer *lexer) {
    while (lexer->lookahead == ' ' || lexer->lookahead == '\t') skip(lexer);
    if (!is_digit(lexer->lookahead)) return NO_NUMBER;
    while (is_digit(lexer->lookahead)) lexer->advance(lexer, false);
    if (lexer->lookahead != '.') return OTHER_NUMBER;
    lexer->advance(lexer, false);
    if (lexer->lookahead == '.' || is_ident_char(lexer->lookahead)) return OTHER_NUMBER;
    lexer->mark_end(lexer);
    lexer->result_symbol = FLOAT_TRAILING_DOT;
    return FLOAT_FOUND;
}

// Reads the word at the lookahead (consuming it) and reports whether it is one
// that continues the previous line's construct.
static bool continues_construct(TSLexer *lexer) {
    char word[8];
    unsigned len = 0;
    while (is_ident_char(lexer->lookahead)) {
        if (len == sizeof(word) - 1) return false;
        word[len++] = (char)lexer->lookahead;
        skip(lexer);
    }
    word[len] = 0;
    return strcmp(word, "elif") == 0 || strcmp(word, "else") == 0 || strcmp(word, "fn") == 0;
}

bool tree_sitter_lobster_external_scanner_scan(void *payload, TSLexer *lexer,
                                               const bool *valid_symbols) {
    Scanner *scanner = (Scanner *)payload;

    bool error_recovery_mode = valid_symbols[ERROR_SENTINEL];
    if (valid_symbols[FLOAT_TRAILING_DOT] && !error_recovery_mode &&
        (lexer->lookahead == ' ' || lexer->lookahead == '\t' || is_digit(lexer->lookahead))) {
        FloatScan result = scan_float_trailing_dot(lexer);
        // Any other number is left to the grammar's own tokens.
        if (result != NO_NUMBER) return result == FLOAT_FOUND;
    }

    bool within_brackets =
        valid_symbols[CLOSE_PAREN] || valid_symbols[CLOSE_BRACKET] || valid_symbols[CLOSE_BRACE];
    if (within_brackets && !error_recovery_mode) return false;

    lexer->mark_end(lexer);

    bool found_end_of_line = false;
    uint16_t indent_length = 0;
    for (;;) {
        if (lexer->lookahead == '\n') {
            found_end_of_line = true;
            indent_length = 0;
            skip(lexer);
        } else if (lexer->lookahead == ' ' || lexer->lookahead == '\t') {
            indent_length++;
            skip(lexer);
        } else if (lexer->lookahead == '\r' || lexer->lookahead == '\f') {
            skip(lexer);
        } else if (lexer->lookahead == '/') {
            // A comment after code on the same line is left to the grammar's
            // extras; we get called again at the line end.
            if (!found_end_of_line) return false;
            skip(lexer);
            if (lexer->lookahead == '/') {
                while (lexer->lookahead && lexer->lookahead != '\n') skip(lexer);
            } else if (lexer->lookahead == '*') {
                skip(lexer);
                for (;;) {
                    if (lexer->eof(lexer)) break;
                    if (lexer->lookahead == '\n') indent_length = 0;
                    if (lexer->lookahead == '*') {
                        skip(lexer);
                        if (lexer->lookahead == '/') {
                            skip(lexer);
                            break;
                        }
                    } else {
                        skip(lexer);
                    }
                }
            } else {
                break;
            }
        } else if (lexer->eof(lexer)) {
            indent_length = 0;
            found_end_of_line = true;
            break;
        } else {
            break;
        }
    }

    if (!found_end_of_line) return false;

    uint16_t current_indent_length = *array_back(&scanner->indents);

    // A line starting with `.` continues a method chain (but `..` does not).
    if (lexer->lookahead == '.' && !lexer->eof(lexer)) {
        skip(lexer);
        if (lexer->lookahead != '.') return false;
    }

    if (valid_symbols[INDENT] && indent_length > current_indent_length) {
        array_push(&scanner->indents, indent_length);
        lexer->result_symbol = INDENT;
        return true;
    }

    if ((valid_symbols[DEDENT] || (!valid_symbols[NEWLINE] && !within_brackets)) &&
        indent_length < current_indent_length) {
        array_pop(&scanner->indents);
        lexer->result_symbol = DEDENT;
        return true;
    }

    if (valid_symbols[NEWLINE] && !error_recovery_mode) {
        // A deeper line that opens no block continues an expression whose
        // first line ended in a continuation token (`let x =` and an `if` on
        // the next line), so it counts as the current level.
        if (indent_length >= current_indent_length && continues_construct(lexer)) return false;
        lexer->result_symbol = NEWLINE;
        return true;
    }

    return false;
}

void *tree_sitter_lobster_external_scanner_create(void) {
    Scanner *scanner = ts_calloc(1, sizeof(Scanner));
    array_init(&scanner->indents);
    array_push(&scanner->indents, 0);
    return scanner;
}

void tree_sitter_lobster_external_scanner_destroy(void *payload) {
    Scanner *scanner = (Scanner *)payload;
    array_delete(&scanner->indents);
    ts_free(scanner);
}

unsigned tree_sitter_lobster_external_scanner_serialize(void *payload, char *buffer) {
    Scanner *scanner = (Scanner *)payload;
    unsigned size = 0;
    // Index 0 is always the base level 0, so it is implied.
    for (uint32_t i = 1; i < scanner->indents.size; i++) {
        if (size + sizeof(uint16_t) > TREE_SITTER_SERIALIZATION_BUFFER_SIZE) break;
        memcpy(&buffer[size], array_get(&scanner->indents, i), sizeof(uint16_t));
        size += sizeof(uint16_t);
    }
    return size;
}

void tree_sitter_lobster_external_scanner_deserialize(void *payload, const char *buffer,
                                                      unsigned length) {
    Scanner *scanner = (Scanner *)payload;
    array_clear(&scanner->indents);
    array_push(&scanner->indents, 0);
    for (unsigned i = 0; i + sizeof(uint16_t) <= length; i += sizeof(uint16_t)) {
        uint16_t indent;
        memcpy(&indent, &buffer[i], sizeof(uint16_t));
        array_push(&scanner->indents, indent);
    }
}
