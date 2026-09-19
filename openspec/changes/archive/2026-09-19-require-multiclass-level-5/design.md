## Context

In Fabula Ultima, starting characters at Level 5 must select at least 2 distinct classes (and at most 3 classes). Currently, the codebase allows selecting 1 class with 5 levels in both manual wizard and random generation.

## Goals / Non-Goals

**Goals:**
- Enforce `classCount` to be in `[2, 3]` for random character generation across both web domain (`frontend/src/domain/characterCreation.ts`) and CLI (`src/index.ts`).
- Restrict manual class count selection in `App.tsx` wizard step 3 to `[2, 3]`.
- Update CLI prompts to disallow selecting only 1 class.
- Update tests to verify `sheet.classes.length >= 2 && sheet.classes.length <= 3`.

**Non-Goals:**
- Changing class level caps or total character level (stays at level 5).
- Supporting characters with level > 5 or single-class rules for higher levels.

## Decisions

### 1. Class Count Randomization
- Change `classCount` generation from `Math.floor(random.next() * 3) + 1` (1..3) to `Math.floor(random.next() * 2) + 2` (2..3).
- Ensures random characters always meet the multiclass requirement of 2 or 3 classes.

### 2. Web Manual Wizard Options
- Update the class count selection buttons in `App.tsx` from `[1, 2, 3]` to `[2, 3]`.
- Set the default `classCount` state to `2`.
- Update step 3 validation condition `(selectedClasses.length < 2 || sumLevels() !== 5)` so users cannot advance to step 4 with fewer than 2 classes selected.

### 3. CLI Prompts & Validation
- Update `src/index.ts` class count prompt to restrict choice to 2 or 3 classes.
- Ensure CLI random character generation uses the same `[2, 3]` bounds.

## Risks / Trade-offs

- Existing tests expecting `classes.length >= 1` need to be updated to expect `>= 2`.
- Low risk of breaking existing saved sheets as level 5 sheets with 1 class already saved will still render fine, but new sheets created will follow the multiclass rule.
