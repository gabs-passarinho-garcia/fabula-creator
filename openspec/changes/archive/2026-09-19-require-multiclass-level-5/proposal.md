## Why

In Fabula Ultima rules for starting level 5 character creation, characters must be multiclassed with at least 2 classes (and up to 3 classes). Currently, both the random character generator and the manual wizard allow single-class level 5 characters (1 class with 5 levels), which violates starting character creation rules.

## What Changes

- Update random character creation logic (web domain & CLI) to pick between **2 and 3 classes** instead of 1 to 3.
- Update the step-by-step manual creation Wizard in the web frontend (`App.tsx`) to restrict class count options to `[2, 3]` and require selecting at least 2 classes before advancing to Step 4.
- Update CLI guided creation to enforce a minimum of 2 classes for level 5 creation.
- Update domain unit tests (`characterCreation.test.ts`) to verify that generated characters always have between 2 and 3 classes.

## Capabilities

### Modified Capabilities

- `character-creation`: Update class selection constraints to enforce a minimum of 2 classes (and maximum of 3) for starting level 5 characters.

## Impact

- Web: `frontend/src/domain/characterCreation.ts`, `frontend/src/App.tsx`, and `frontend/src/domain/characterCreation.test.ts`.
- CLI: `src/index.ts` class count prompt and random selection logic.
- i18n copy: Update `classCount` prompts or UI labels if applicable in `pt` and `en` (web + CLI).
