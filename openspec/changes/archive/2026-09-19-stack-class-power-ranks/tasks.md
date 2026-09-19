## 1. Domain model

- [x] 1.1 Add `rank` to `SelectedPower` and `grantIndex` to `SelectedSpell` in `frontend/src/types.ts` and `src/types.ts` (keep both trees in sync).
- [x] 1.2 Add a pure helper module (web domain, reusable shape for CLI) with JSDoc for remaining purchases, `canIncrease` / `canDecrease`, `adjustRank`, and `trimSpellsForPowerRanks`.
- [x] 1.3 Cover the helper with tests using a `setup()` factory: budget sums, maxLevel cap, class-level cap, rank 0 removes the entry, spell trim on rank drop.

## 2. Random generation

- [x] 2.1 Replace unique `slice` / `sampleSize` power picks in `frontend/src/domain/characterCreation.ts` and `src/index.ts` with sequential purchases among powers below `maxLevel`, emitting collapsed ranks.
- [x] 2.2 Select `rank` distinct spells per `grantsSpell` power (fallback repeat only if the catalog is smaller than rank); set `grantIndex`.
- [x] 2.3 Update `characterCreation.test.ts`: `sum(ranks) === 5`, unique `(className, name)` rows, no `rank > maxLevel`, and at least one fixture/seed path for rank > 1 and matching spell counts.

## 3. Web guided creation

- [x] 3.1 Replace slot UI and `maxLevel: levelIdx` hijack in `frontend/src/App.tsx` with per-power +/− controls, remaining-purchase copy (pt/en), and next-step lock until each class budget is spent.
- [x] 3.2 Gate increment on `rank < maxLevel` and remaining purchases; decrement from 1 removes the power and trims spells.
- [x] 3.3 Render `rank` spell pickers per `grantsSpell` power with `grantIndex`; require distinct spells when the class list allows; keep finish disabled until all slots are filled.

## 4. CLI guided creation

- [x] 4.1 Update `promptPowerSelection` so a power stays listed until `rank === maxLevel`; each pick increments collapsed rank; option labels show NP current/max.
- [x] 4.2 Update CLI spell prompts to ask `rank` times per `grantsSpell` power with `grantIndex`, unique names when possible.
- [x] 4.3 Show NP current/max on CLI character output for each power.

## 5. Sheet and i18n

- [x] 5.1 Show one card per power in `CharacterSheetView` with localized NP `rank/maxLevel`.
- [x] 5.2 Confirm JSON export includes `rank` and nested catalog `maxLevel`, plus `grantIndex` on spells.
- [x] 5.3 Add/adjust pt and en strings for remaining purchases, rank steppers, and NP labels (web + CLI i18n modules).

## 6. Verification

- [x] 6.1 Run the relevant unit tests (`bun test`) and typecheck; fix failures caused by `powers.length === 5` uniqueness assumptions.
- [x] 6.2 Browser-check step-by-step: stack a `maxLevel` > 1 power, hit the cap, decrement, fill remaining with another power, take Magia Elemental rank 2 and pick two different spells, then confirm the sheet and a random hero.
