# Migrations legacy (archive)

These SQL files come from the historical Survey / Corte multi-tenant evolution
(`old_applied`, `old_unused`, early COP fragments, etc.).

They are **not** applied by the Supabase CLI migration runner.

## Why archived

- File names and nesting did not match the standard `YYYYMMDDHHMMSS_name.sql` pipeline.
- Many scripts assume an already-rich municipal schema.
- Blank personal instances (e.g. project **JHN**) start from a clean baseline under
  `../migrations/`.

## How to reintroduce

1. Extract a coherent subset.
2. Create a **new** timestamped migration under `../migrations/` with additive SQL only.
3. `supabase db push` against the linked project.
4. Never re-enable this folder as the CLI migrations path.

## Active path

```text
apps/platform/supabase/migrations/   ← CLI applies these
apps/platform/supabase/migrations_legacy/  ← reference only
```
