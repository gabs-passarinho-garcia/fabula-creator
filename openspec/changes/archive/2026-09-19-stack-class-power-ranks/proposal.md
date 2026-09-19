## Why

Fabula Ultima lets many class skills be purchased more than once: each class level is a purchase, and `maxLevel` is the skill-rank cap (NP). The creator currently treats every power as unique, so manual, CLI, and random creation cannot build legal stacked ranks (Papo de Taverna NP 3, Magia Elemental NP 2, and so on).

## What Changes

- Allow the same class power to be bought again during character creation, up to `min(maxLevel, levels invested in that class)`.
- Represent owned powers as a **collapsed rank** (`rank` / NP), not duplicate rows of the same name.
- Stop using catalog `maxLevel` as a UI slot index; keep it as the published rank ceiling.
- Step-by-step web UI: increment/decrement rank per power with a remaining-purchase counter (no unique-only disable).
- CLI manual prompts: a power stays available until its rank cap is reached.
- Random generation (web domain + CLI): sequential purchases among powers that still have rank room.
- Spell picks scale with rank of `grantsSpell` powers (one distinct spell per rank, matching catalog copy: “A cada nível, aprenda um feitiço”).
- Character sheet (web, CLI printout if any, JSON export) shows one line per power with NP, e.g. `Papo de Taverna NP 2/3`.
- **BREAKING** (sheet JSON / `SelectedPower`): persisted sheets gain `rank`; duplicate same-name entries are no longer the model.

## Capabilities

### New Capabilities

- `class-power-selection`: Rules for spending class levels on powers, stacking rank up to `maxLevel`, random and guided selection, and spell slots granted by ranked spell powers.

### Modified Capabilities

- `character-sheet`: Display and export collapsed power ranks (NP current / max) instead of one unnamed copy per purchase.

## Impact

- Domain types: `SelectedPower` in `frontend/src/types.ts` and `src/types.ts`.
- Web: `frontend/src/App.tsx` power/spell steps; `frontend/src/domain/characterCreation.ts` and tests; `CharacterSheetView`.
- CLI: `src/index.ts` (`selectPowers`, `promptPowerSelection`, spell prompts).
- i18n copy for power/spell prompts (pt/en, web + CLI).
- JSON export of the sheet (rank field). Catalog JSON (`maxLevel`, `grantsSpell`) stays the source of truth; no catalog rewrite required unless a power’s spell count is wrong in copy.
- Existing tests that assume five unique power names or `powers.length === 5` as unique names must assert five **purchases** (sum of ranks = 5) and collapsed list length ≤ 5.
