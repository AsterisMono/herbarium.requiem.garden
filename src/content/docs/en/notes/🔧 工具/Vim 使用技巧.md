---
title: Vim Usage Tips
editUrl: false
slug: en/vim-tips-and-tricks
lastUpdated: 2026-01-17T00:00:00.000Z
draft: false
banner:
  content: This content is translated by an LLM and may contain inaccuracies.
---

## Essential Vim

* Recording macros:
  * `q{c}` starts recording a macro; pressing `q` again stops it.
  * Use `@{c}` to replay the macro actions.
* Quickly search for the word under the cursor: `*`.
* `. Paradigm`: move with one key, modify with another (`.`).
  * The key is to cleverly construct the modification so that each movement’s destination can be directly modified using `.` again.
* Numbers operation:
  * Basic knowledge: use `C^A` and `C^X` to increment/decrement the number under the cursor.
  * If there’s no number under the cursor, it will automatically increment/decrement the first preceding number.
  * Used with a count, you can do operations like `180C^A`.
* Change case: `gu/gU`/g\~ (toggle) followed by a range (aw, ap, w…), repeat the whole line with gUU.
* Handle indentation: `<` reduces indent, `>` increases it, `=` auto-formats.
* Handling text in insert mode:
  * `C^h` deletes a character.
  * `C^w` deletes a word.
  * `C^u` deletes to the beginning of the line. (These commands also work in bash.)
* ESC alternative: `C^[`
* Use `zz` to redraw the window and center the current line.
* Merge two lines: `J` for join
* Paste in insert mode: `C^R` followed by register number.
  * `C^R=` allows you to write an expression for arithmetic calculations.

## VimTutor Notes

* Change to end of line/delete to end of line: `c$/d$` instead of `ct$`. (C works too.)
  * For replacing to the end of the line, using `R` is recommended: it can continuously replace multiple characters.
  * To change the entire line while in the line: `S`. `s` replaces the current character and enters insert mode.
* Undo commands: `u` undoes a single change, `U` undoes changes to the entire line; `C^R` redoes undone actions.
* Find next/previous: `n` and `N`.
  * For `f` initiated character searches, use `;` and `,`.
  * Use `?` instead of `/` for reverse search.
* Important: Jump to previous or next location, often used for large jumps or searches
  * `C^o` jumps back, `C^I` jumps forward
  * Double-tap the tilde key to jump between recent locations
* Find and replace:
  * `:s/abc/def` replaces the first occurrence
  * `:s/abc/def/g` replaces the whole line
  * `:%s/abc/def/g` replaces in the entire text; `/gc` prompts before replacing
* Execute external commands: `:!ls`
  * Read external command result: `:r !ls`
* Save to file: `:w FILE`
  * Can be used in visual mode with `:w` to save the selected range
  * Used with `:r` for file extraction and merging
* Toggle case-insensitive search: `:set ic` / `:set noic`

## Keynotes

* Replace word under the cursor: ciw
* Clear search highlight: `:noh`
* Delete specified line: `:70d`
* Switch windows: C^W + direction
* Open file manager: `sf`, use `<C^T>` to open a file in a new tab
