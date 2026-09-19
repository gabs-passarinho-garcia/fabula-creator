## Context

Character creation (web step-by-step, web random, CLI guided, CLI random) currently enforces unique power names per class. Catalog data already stores `maxLevel` (skill rank cap / NP) and `grantsSpell`. The web UI additionally overwrites `maxLevel` with a zero-based slot index to remember which “Slot Power N” was filled — so the field cannot mean both “ceiling” and “which slot”.

Fabula Creator always builds a **level 5** hero: five purchases total, split across 1–3 classes. Official-adjacent copy in `pt.json` / `en.json` says spell-granting skills teach **one** spell per level, so rank 2 means two spell picks, not four.

## Goals / Non-Goals

**Goals:**

- Shared domain rules: purchases = class levels; rank ≤ `maxLevel`; collapsed `(className, powerName, rank)`.
- Web UI: +/− ranks and remaining purchases (no unique-only disable, no slot-index abuse).
- CLI: same stacking rules for prompts and `sampleSize`-style random.
- Spells: `grantsSpell` powers require `rank` distinct spells; lowering rank drops extras.
- Sheet and JSON: one row per power with NP current/max.

**Non-Goals:**

- Changing catalog `maxLevel` values or adding new classes/powers.
- Teaching two spells per rank (Core book vs this catalog); keep one per rank unless data copy is updated later.
- Post-creation leveling (level 6+), retraining, or multi-class sharing of the same power name across different classes.
- Migrating old exported JSON that used duplicated rows or slot-stamped `maxLevel` (creation-only tool; no persisted user DB).

## Decisions

### 1. Collapsed `SelectedPower.rank` instead of duplicate rows

```ts
interface SelectedPower {
  power: ClassPower; // maxLevel stays catalog ceiling
  className: string;
  rank: number;      // NP, 1..maxLevel
}
```

- **Rationale:** Matches how the sheet should read (one skill, NP 3) and how `(NP)` mechanics are written. Sum of ranks is the purchase budget.
- **Alternative considered:** N duplicate `SelectedPower` entries. Easier for “one pick = one spell” but forces the sheet to group, and reintroduces the uniqueness bugs. Rejected per product choice.

Purchases for a class: `sum(p.rank for p in powers if p.className === class)`.

Helper (pure, shared if practical; otherwise duplicated carefully in web domain + CLI):

- `remainingPurchases(classLevel, powersForClass)`
- `canIncrease(power, currentRank, remaining)` → `currentRank < power.maxLevel && remaining > 0`
- `setRank` / `adjustRank`

Keep `frontend/src/types.ts` and `src/types.ts` in sync (existing dual-tree pattern).

### 2. Web UI: rank steppers, not slots

Replace “Slot Power 1..N” grids with one row per catalog power of the selected class:

```
Papo de Taverna    NP [−] 2 / 3 [+]
Viajante Experiente NP [−] 0 / 1 [+]   (0 = not owned; omit from sheet)
Remaining: 1 / 3
```

- Rank 0 means not owned (absent from `selectedPowers`).
- Increment inserts `{ rank: 1 }` or bumps `rank`.
- Decrement from 1 removes the entry.
- Changing class levels still clears powers and spells (current behavior) so ranks cannot exceed the new budget without a second pass.

**Alternative considered:** Keep slots but allow the same name in multiple slots, then collapse at finish. More clicks, still needs a real slot id (must not reuse `maxLevel`). Rejected.

### 3. Stop hijacking `maxLevel`

Slot matching `p.power.maxLevel === levelIdx` and `{ ...power, maxLevel: levelIdx }` MUST be deleted. If a transient UI key is needed, use `power.name` + `className` only.

### 4. CLI prompts

`promptPowerSelection` currently builds `pickedNames` and filters them out. Change to a rank map:

- Options = powers where `rank < maxLevel` **and** (implicit) there is a remaining purchase this iteration (the loop still runs `level` times).
- After pick: increment rank on the collapsed list.
- Labels should show `NP current/max` so stacking is obvious.

Random CLI `selectPowers` (`sampleSize(powers, level)`) and web `selectRandomPowers` (`shuffled().slice(0, level)`) both become:

```
for each class:
  ranks = empty map
  repeat `level` times:
    eligible = powers where ranks[name] < maxLevel
    pick one uniformly
    increment ranks[name]
  emit SelectedPower[] with rank
```

If `eligible` is empty (pathological: all maxLevel 0), skip — catalog today always has enough room because five purchases vs many skills with max ≥ 1.

### 5. Spells keyed by power name + grant index

`SelectedSpell` gains `grantIndex: number` in `0 .. rank-1` so two spells from the same power are distinct without overloading `grantedByPower`.

- Web step 5: `rank` prompt rows (or a list of `rank` selectors) per `grantsSpell` power.
- Continue to require unique spell names per class when the catalog is large enough.
- On rank decrease: keep `grantIndex < newRank`, drop the rest.
- Random: `rank` draws from remaining unlearned spells, same fallback as today if the list is exhausted.

**Alternative considered:** Infer count from `filter(grantedByPower).length` without `grantIndex`. Fragile when replacing a single spell. Rejected.

Do **not** change `grantsSpell` to imply two spells per rank; JSON mechanics already say one per level.

### 6. Sheet presentation

`CharacterSheetView` (and CLI sheet text if it lists powers): one card/line, badge `NP {rank}/{maxLevel}`. Mechanics text can stay as catalog `(NP)` — the rank badge is the resolved NP.

JSON export is the `CharacterSheet` object; adding `rank` (and `grantIndex` on spells) is the breaking shape change.

### 7. Tests

- Domain: `sum(ranks) === 5`; per-class sum equals class level; never `rank > maxLevel`; random seed that can produce rank > 1 (inject `RandomSource`).
- Replace `expect(sheet.powers.length).toBe(5)` with `expect(sumRanks).toBe(5)` and `unique names === powers.length`.
- Spell: rank 2 ⇒ two spells with distinct names when catalog allows.
- Prefer a `setup()` factory per project test rule; no `any`.

Web UI: if no Playwright in-repo, verify +/− and remaining counter in the browser during apply (user rule). CLI covered by logic tests if prompts stay hard to unit-test; extract rank-update helpers so CLI is not a logic island.

## Risks / Trade-offs

- **[Dual trees web + CLI drift]** → Same helper semantics documented in tasks; change both in one apply pass.
- **[Old JSON backups]** → No loader compatibility; document breaking field in proposal. Rank missing ⇒ treat as 1 only if we add import later (out of scope).
- **[Empty eligible set]** → Unlikely with current data; if it happens, stop purchasing and fail generation loudly in tests.
- **[UX: rank 0 vs hidden]** → Showing 0/max keeps + available; slightly noisier than hiding unused powers. Chosen for stacking discoverability.
- **[Spell uniqueness vs small lists]** → Fallback repeat only when catalog size < rank; creation max rank is ≤ 5 and caster lists are larger.

## Migration Plan

- Ship as a single app version: new characters only.
- No database. Rollback = revert the change branch.
- Exported JSON from this version is not interchangeable with pre-rank sheets; that is accepted.

## Open Questions

None blocking. Spell count per rank follows **this repo’s catalog** (one per NP), not a silent Core-book “two spells” house rule.
