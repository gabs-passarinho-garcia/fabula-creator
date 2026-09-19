# Tasks for high-level-character-creation-and-level-up

- [x] Update `types.ts` (web and CLI) to support `HeroicPower`, `level`, and level-up metadata in `CharacterSheet`.
- [x] Implement core multiclass & level-up domain logic in `frontend/src/domain/characterCreation.ts`:
  - [x] Maximum 3 active non-mastered classes validation.
  - [x] Mastery detection at Level 10 and Heroic Power selection logic.
  - [x] Level 20 and Level 40 attribute step-up & derived stats recalculation.
  - [x] Random high-level character generator (Levels 5 to 50).
- [x] Add Level Up UI button and interactive modal in `frontend/src/App.tsx`.
- [x] Update character creation flow in `frontend/src/App.tsx` and `TitleScreen.tsx` to allow picking a starting level between 5 and 50.
- [x] Update CLI creation flow in `src/index.ts` to support `level` field in `CharacterSheet`.
- [x] Add domain unit tests in `frontend/src/domain/characterCreation.test.ts` verifying high level rules (mastery, heroic powers, level 20/40 attribute boosts, PV/PM recalculation).
- [x] Run test suite (`bun test`) to confirm clean execution.

## Follow-up (missing high-level flows)

- [x] Add domain helpers for manual high level allocation in `frontend/src/domain/characterCreation.ts`: level constants, class level cap, allocation validation, random auto-distribution, attribute boost count/application, heroic power option lists.
- [x] Add `update` to `CharacterRepository` (interface, LocalStorage, Tauri) and make `save` return the inserted record id.
- [x] Add `update_character` Tauri command + `CharacterDatabase::update` in Rust with unit test.
- [x] Wire `HeroGallery` `onOpen`/`onLevelUp` callbacks with the record id and persist the evolved sheet in `App.tsx` (including legacy sheets without `level`).
- [x] Allow manual character creation to pick a starting level from 5 to 50 (level budget, 10 levels per class cap, max 3 non-mastered classes, auto-distribute helper).
- [x] Add manual mastery (heroic power picks) and level 20/40 attribute boosts to the manual creation wizard, including random fill shortcuts.
- [x] Persist `level` and `heroicPowers` in manually created sheets (fixes missing `level` type error) and recalculate derived stats with the real total level.
- [x] Add manual class/power selection to the Level Up modal.
- [x] Cover the new helpers and repository `update` with unit tests and keep `bun test` + `tsc -p tsconfig.app.json` clean.
