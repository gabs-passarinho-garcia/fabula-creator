# Design: High Level Character Creation and Level Up

## Architecture & Data Flow

### 1. Data Structures (`types.ts`)
- Extend `CharacterSheet` to include:
  - `level`: Total character level (5..50).
  - `heroicPowers`: List of chosen `HeroicPower` items.
  - `masteredClasses`: Array of class names that have reached level 10.
  - `attributeBoosts`: Tracking attribute increases at level 20 and level 40.

### 2. Level Up & Multiclass Engine (`characterCreation.ts`)
- Function `canAddOrAdvanceClass`: Checks active non-mastered classes count (< 3) before opening a new class.
- Function `applyLevelUpStep`:
  - Increments character level by 1.
  - Adds +1 HP and +1 MP.
  - Selects class to advance or open.
  - Grants rank power / spell.
  - Triggers Mastery if class reaches Level 10: selects a Heroic Power (Class-specific or Universal).
  - Triggers Attribute Boost if level reaches 20 or 40: steps up chosen attribute die (d6->d8->d10->d12) and recalculates derived stats.

### 3. UI Integration (`App.tsx`)
- Character Sheet UI: Add a "Level Up" button.
- Level Up Modal / Drawer:
  - Option to Level Up Randomly (+1 level or target level N).
  - Option to Level Up Manually step-by-step.
- Creation Flow: Add starting level selector (Level 5 up to Level 50).
