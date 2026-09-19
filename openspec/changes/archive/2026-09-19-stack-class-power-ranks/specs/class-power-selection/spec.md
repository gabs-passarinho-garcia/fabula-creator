## ADDED Requirements

### Requirement: Class levels become power purchases
The system MUST treat each level invested in a class as exactly one power purchase for that class. For a level-five starting character, the sum of all power ranks across all classes MUST equal 5, and for each class the sum of ranks of powers from that class MUST equal the levels invested in that class.

#### Scenario: Three levels in one class
- **GIVEN** the user invested 3 levels in Andarilho and 2 in another class
- **WHEN** power selection is complete
- **THEN** Andarilho powers' ranks sum to 3
- **AND** the other class's powers' ranks sum to 2
- **AND** the character's total rank sum is 5

### Requirement: Powers stack up to catalog maxLevel
The system MUST allow the same class power to be purchased more than once. The rank of a power MUST be an integer from 1 through `min(maxLevel, classLevel)` when present on the sheet. A power with `maxLevel` of 1 MUST not be purchasable more than once.

#### Scenario: Repeat Papo de Taverna
- **GIVEN** Andarilho with 3 class levels and Papo de Taverna `maxLevel` 3
- **WHEN** the user assigns rank 2 to Papo de Taverna and rank 1 to another Andarilho power
- **THEN** the sheet stores one Papo de Taverna entry with rank 2
- **AND** the remaining Andarilho purchase is spent on a different power

#### Scenario: Cap at maxLevel
- **GIVEN** a power with `maxLevel` 1 already at rank 1
- **WHEN** the user tries to increase its rank
- **THEN** the system MUST refuse the increase
- **AND** remaining purchases MUST still be assignable to other powers of that class

#### Scenario: Cap at class levels
- **GIVEN** Andarilho with 2 class levels and a power with `maxLevel` 5
- **WHEN** power selection is complete
- **THEN** that power's rank MUST be at most 2

### Requirement: Collapsed rank model
Owned powers MUST be stored as unique `(className, power.name)` rows with a `rank` field. The catalog `maxLevel` MUST remain the published ceiling and MUST NOT be overwritten with UI slot indexes.

#### Scenario: No duplicate names
- **GIVEN** Magia Elemental purchased twice
- **WHEN** the character sheet is assembled
- **THEN** `powers` contains a single Magia Elemental object
- **AND** `rank` is 2
- **AND** `power.maxLevel` is still the catalog value (10)

### Requirement: Guided web selection uses rank controls
The step-by-step web creator MUST present each class's powers with increment and decrement controls and a remaining-purchase counter for that class. Powers MUST stay visible after rank 1 so the user can stack them. The user MUST NOT proceed until every class has zero remaining purchases.

#### Scenario: Increment until class budget is spent
- **GIVEN** Elementalista with 2 levels
- **WHEN** the user increases Magia Elemental to rank 2
- **THEN** remaining purchases for Elementalista are 0
- **AND** other Elementalista powers cannot be increased until Magia Elemental is decreased

#### Scenario: Decrement frees budget
- **GIVEN** Magia Elemental at rank 2 with 0 remaining purchases
- **WHEN** the user decreases Magia Elemental to rank 1
- **THEN** remaining purchases become 1
- **AND** another power of that class can be increased

### Requirement: Guided CLI selection allows repeats until cap
The CLI power prompt MUST keep a power in the option list while its rank is below `min(maxLevel, remaining class levels including current pick)`. Each pick MUST increment rank (or insert rank 1) instead of excluding the name forever.

#### Scenario: Same power offered twice
- **GIVEN** Andarilho level 2 and Papo de Taverna `maxLevel` 3
- **WHEN** the user picks Papo de Taverna for the first purchase
- **THEN** Papo de Taverna remains available for the second purchase
- **AND** Viajante Experiente (`maxLevel` 1) disappears from the list after it is picked once

### Requirement: Random generation stacks ranks
Random character generation (web domain and CLI) MUST spend class levels as sequential purchases. Each purchase MUST choose uniformly among that class's powers whose current rank is below `maxLevel`. The result MUST use the collapsed rank model.

#### Scenario: Random can stack
- **GIVEN** a class with 3 levels and at least one power with `maxLevel` greater than 1
- **WHEN** random powers are selected
- **THEN** the sum of ranks for that class equals 3
- **AND** it is possible (across seeds) for a stackable power to have rank greater than 1
- **AND** no power exceeds its `maxLevel`

### Requirement: Spell picks scale with spell-power rank
For each owned power with `grantsSpell`, the system MUST require exactly `rank` distinct spells from that class's spell list. Catalog mechanics of one spell per power level MUST be honored (not two spells per rank). Lowering rank MUST drop excess spells granted by that power. Random spell selection MUST fill `rank` unique spells when the list is long enough, falling back to repeats only if the catalog has fewer spells than `rank`.

#### Scenario: Two ranks grant two spells
- **GIVEN** Magia Elemental at rank 2
- **WHEN** the user completes spell selection
- **THEN** the sheet has exactly two Elementalista spells granted by Magia Elemental
- **AND** those two spells have different names when at least two catalog spells exist

#### Scenario: Rank drop trims spells
- **GIVEN** Magia Elemental at rank 2 with two selected spells
- **WHEN** the user sets Magia Elemental to rank 1
- **THEN** exactly one spell granted by Magia Elemental remains

#### Scenario: Random spell count matches rank
- **GIVEN** a randomly generated character with a `grantsSpell` power of rank 2
- **WHEN** generation finishes
- **THEN** two spells are stored for that power (unique when the class has at least two spells)
