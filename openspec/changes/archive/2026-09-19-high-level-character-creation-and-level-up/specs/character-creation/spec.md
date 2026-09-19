# Spec: Character Creation and Progression

## Purpose

Defines the requirements for creating characters above the classic starting level and for evolving already created heroes.

---

## ADDED Requirements

### Requirement: Starting Level Selection
Character creation MUST allow a starting total level between 5 and 50 in both the random generator and the manual wizard.

#### Scenario: Random character above level 5
- **WHEN** the player picks a starting level between 5 and 50 on the title screen and starts a random creation
- **THEN** the generated sheet has `level` equal to the chosen level
- **AND** the sum of the class levels equals the total level
- **AND** the allocated power ranks equal the total level

#### Scenario: Manual wizard level budget
- **WHEN** the player sets a starting level in the class selection step
- **THEN** the wizard distributes that budget across the chosen classes
- **AND** the step only advances when the allocated levels sum exactly to the target level

#### Scenario: Class level cap and active class limit
- **WHEN** the player allocates levels in the manual wizard
- **THEN** no class can exceed 10 levels
- **AND** at most 3 classes below 10 levels may be active at the same time
- **AND** the number of selectable classes grows with the target level

#### Scenario: Automatic level distribution
- **WHEN** the player requests the random distribution shortcut
- **THEN** the budget is spread over the chosen classes without exceeding 10 levels per class

---

### Requirement: Class Mastery Grants Heroic Power
A class that reaches level 10 MUST be considered mastered and MUST grant one Heroic Power, chosen from the class list or the universal list.

#### Scenario: Mastery on level up
- **WHEN** a level up takes a class to exactly level 10
- **THEN** the sheet receives one Heroic Power tagged with that class or `Universal`

#### Scenario: Manual mastery selection
- **WHEN** the manual wizard contains a class with 10 levels
- **THEN** the power step requires one Heroic Power to be picked for that class
- **AND** the step cannot advance until every mastered class has a power

---

### Requirement: Attribute Boosts at Levels 20 and 40
Reaching level 20 and level 40 MUST grant one attribute step-up each, capped at d12, and MUST recalculate derived statistics.

#### Scenario: Level 20 boost
- **WHEN** the manual wizard target level is 20 or higher
- **THEN** exactly one attribute step-up is required
- **AND** the chosen attribute die moves one step up the d6 → d8 → d10 → d12 ladder

#### Scenario: Level 40 boost and die ceiling
- **WHEN** the target level is 40 or higher
- **THEN** two attribute step-ups are required
- **AND** no attribute die can exceed d12

---

### Requirement: Derived Stats Scale With Total Level
Hit Points and Mana Points MUST be calculated from the character total level, not from a fixed level 5 baseline.

#### Scenario: High level derived stats
- **WHEN** a sheet is created or evolved at level N
- **THEN** HP and MP include +N from the level contribution
- **AND** defense, magic defense and initiative use the boosted attribute dice

---

### Requirement: Level Up Existing Characters
The character sheet MUST offer a level up action for heroes below level 50, supporting a random step, a manually chosen class and power step, and a jump to a target level.

#### Scenario: Random level up
- **WHEN** the player confirms a random level up
- **THEN** the sheet gains one level following the multiclass, mastery and boost rules

#### Scenario: Manual level up
- **WHEN** the player selects a class and a power in the level up dialog
- **THEN** the level is invested in that class and the selected power rank is purchased

#### Scenario: Jump to target level
- **WHEN** the player requests a jump to a level between the current level and 50
- **THEN** every intermediate level up is simulated and applied to the sheet

#### Scenario: Level ceiling
- **WHEN** the character already has 50 levels
- **THEN** the level up action is not offered

---

### Requirement: Evolved Heroes Persist In Place
Leveling up a hero loaded from the gallery MUST update the stored record instead of creating a new one.

#### Scenario: Level up from the hero gallery
- **WHEN** the player levels up a hero using the gallery action
- **THEN** the persisted record keeps its id and creation date
- **AND** the gallery list reflects the new level without duplicates

#### Scenario: Re-saving a loaded hero
- **WHEN** the player saves a sheet that was opened from the gallery
- **THEN** the existing record is overwritten

#### Scenario: Legacy sheets without level metadata
- **WHEN** a persisted sheet has no `level` field
- **THEN** it is treated as level 5 with no Heroic Powers before being evolved or saved
