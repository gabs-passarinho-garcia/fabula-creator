# Proposal: High Level Character Creation and Level Up

## Why

In Fabula Ultima, characters can progress up to Level 50. Currently, the character creation tools only support starting at Level 5. Players and Game Masters need the capability to create higher level characters directly (from Level 5 up to Level 50) as well as level up existing characters after creation.

## What Changes

- Add support for high-level character creation (Level 5 to 50) in both random generation and step-by-step wizard/CLI.
- Implement the multiclasses active limit rule: maximum of 3 non-mastered active classes at any time. A class is mastered when reaching Level 10 in it.
- Grant 1 Heroic Power (chosen randomly or manually from class or universal lists) when a class is mastered (Level 10).
- Implement attribute die step increments at Level 20 and Level 40 (up to d12 ceiling), with automatic recalculation of HP, MP, Defense, Magic Defense, etc.
- Add a "Level Up" button and interface on character sheets to allow leveling up created characters (+1 level or multiple levels randomly/manually).
- Increase HP and MP by +1 for each level invested above starting base.

## Capabilities

### Modified Capabilities
- `character-creation`: Support starting level selection (5-50), level up system, 3-active-non-mastered class enforcement, Level 10 mastery heroic power unlocks, and Level 20/40 attribute boosts.

## Impact

- Web domain: `frontend/src/domain/characterCreation.ts`, `frontend/src/types.ts`, `frontend/src/App.tsx`.
- CLI: `src/index.ts`, `src/types.ts`.
- Data: `frontend/src/data/pt.json` and `frontend/src/data/en.json` (heroic powers data integration).
