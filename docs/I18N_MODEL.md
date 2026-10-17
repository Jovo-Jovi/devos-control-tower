# TOWER — i18n model

Precedence 6.

## 1. Locales — **Assumption, for the owner to confirm at B0 approval**

| Locale | Direction | Default | `<html>` |
|---|---|---|---|
| `en` | `ltr` | yes (the only one) | `lang="en" dir="ltr"` derived from `defaultLocale`, never a literal |

The seed and the decisions say nothing about the Tower's language; the Tower is a private tool for one
owner who reads the method, the code and GitHub in English. v1 therefore has **one locale**. Adding `ar`
(the pilot's default) later is a scope amendment: the structure below is kept so that it is a catalogue
and a route change, not a rewrite.

## 2. Where the locale comes from

Nowhere at runtime: `src/i18n/config.ts` exports `locales = ["en"] as const`, `defaultLocale = "en"`,
`directionOf()`. No `[locale]` route segment, no `Accept-Language`, no cookie, nothing stored. The root
layout sets `lang` and `dir` from the config.

## 3. Strings

- One catalogue: `src/i18n/messages/en.json`, typed by `src/i18n/messages.ts` (`getMessages()`).
- No interface text as a literal in components (`guard:literals` as copied; the reviewer checks the rest).
- Data from the database (keys, repos, shas, model ids, contract values) is rendered as data, never
  translated; contract words (`pass`, `reported`, `stale`) appear through the catalogue so a second locale
  can label them.

## 4. Direction and isolation

Logical CSS properties only (`guard:design`), so an `rtl` locale needs no style change. Bidi isolation
(`<bdi>`) around repo names, logins and evidence paths.

## 5. `guard:i18n` deviation (configuration, recorded in `B0-BOOTSTRAP.md` §4)

The pilot's `scripts/guards/i18n.mjs` hard-codes two catalogues (`ar`, `en`). The Tower's copy sets
`CATALOGUES = { en: "src/i18n/messages/en.json" }`; the key-parity loop runs over the catalogues present
(one), the empty-value check and the hard-coded-`lang` scan stay. Three lines, commented with this
section. A second locale restores the pilot's constant.

## 6. Evidence

`pnpm guards` with `i18n: PASS` naming the key count; the reviewer greps `src/` for quoted interface
text outside the catalogue and states the command.
