# Tasks for require-multiclass-level-5

- [x] Update domain random character creation logic in `frontend/src/domain/characterCreation.ts` to pick between 2 and 3 classes.
- [x] Update web manual creation wizard in `frontend/src/App.tsx` (default `classCount = 2`, buttons `[2, 3]`, and validation requiring `selectedClasses.length >= 2`).
- [x] Update CLI guided and random selection in `src/index.ts` to enforce 2 to 3 classes.
- [x] Update unit tests in `frontend/src/domain/characterCreation.test.ts` to assert `classes.length >= 2` and `classes.length <= 3`.
- [x] Run test suite (`bun test`) to verify all domain tests pass.
