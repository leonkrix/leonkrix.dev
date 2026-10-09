# Root Cause

A logic puzzle of placement and deduction: work out who was alone with the victim. Our own game, our own levels, characters and texts. The rules follow the kind of "murder mystery" puzzles from puzzle books; nothing is copied from any book.

Status: the **engine** is built (this folder's `logic/`), the game is still `hidden` in the registry. Next come the level pool, the interface and the skins' words and pictures (see PLAN.md, 4.2b to 4.2d).

## Rules

- The board is a square of **N by N** cells (4 by 4 up to 9 by 9). Exactly **N people** stand on it, **one in every row and one in every column**: N minus 1 suspects and the **victim**.
- The board is divided into **rooms**. The **culprit is the suspect who is alone with the victim in a room**: the room of the victim holds the victim and exactly one suspect.
- **Every room has a type and a name** that fit together ("Server room", "Break room", "Open office" in Case file, "Server room", "Network closet", "Data hall" in Outage). Several rooms can have the same type on one map, then they are numbered ("Server room 1", "Server room 2"), and clues can speak about the type ("was in no server room").
- **Rooms** are connected and have at least two cells. The number of rooms has a lower limit that grows with the board (2 for 4 by 4 and 5 by 5, 3 for 6 by 6 and 7 by 7, 4 for 8 by 8 and 9 by 9) and a generous upper limit (4, 5, 7, 8, 9, 9). Within the limits every count is possible on every level, the tier only leans: easy levels towards more rooms, hard levels towards fewer. The rooms are compact, but about one map in three has a **corridor**, a straight strip (never more than one per map, and no other room is a strip).
- Cells can hold **objects**. Some can be stood on (chair, rug, sofa that covers two cells in Case file; rack, patch panel, cable tray in Outage), the others block their cell (desk, screen, plant, shelf, crate, printer; radiator, fan, UPS, cabinet). **Objects fit the room**: a sofa is likely in a break room and never in a server room. The tier changes how much of the map is usable: **easy maps have more places to stand and more blocked cells** (less free space, so it is clearer where people can be), **hard maps have fewer of both and more open floor**. A **window** (a vent in Outage) sits on a wall, on the edge of the board or on a room boundary.
- **Clues** say something true about a suspect (a clue about a person), or about the map as a whole (a **neutral** clue). **The victim never gets a clue and is never named.** Neutral clues count everybody, the victim included. Clues are rare: as few as needed, every suspect has at least one, and the kinds of clues differ from person to person and from level to level.
- The player puts people on cells, crosses cells out and writes notes. The game recognizes a solution only when everybody is placed correctly, then the culprit is revealed.
- A wall is the edge of the board or a room boundary. **Next to** means the four directly adjacent cells (never diagonal) in the **same room**.

### The clues

Every clue has a level that says how hard it is to use (a few depend on their numbers). Easy levels use only level 1 clues, medium levels level 1 and 2, hard levels all three. A level can have 0 to 3 neutral clues: easy 0 to 1, medium 0 to 2, hard 1 to 3. A neutral clue only stays when it is needed.

About a suspect:

| Level | Clue                                                                                                                                                        |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | in room X, in a room of type X, in a room with a window, in a room that has an object of a kind, on an object of a kind, on any piece of furniture          |
| 1     | in front of a window, in a corner, in the first, last or middle row or column, in the same room as another person, alone in the room, with n others         |
| 2     | not in room X, not in a room of type X, not on an object of a kind, on the bare floor, the only person on a kind of object, in the smallest or largest room |
| 2     | next to or not next to an object of a kind, next to or not next to a wall, not in the same room as another person                                           |
| 2     | an object of a kind in the same row or column, in the same room or in another room                                                                          |
| 2     | south-west (or any of the eight directions) of an object of a kind, in the same room, in another room or anywhere                                           |
| 2     | with at least, exactly or none of a role in the room (a role is a job in Case file and a device type in Outage)                                             |
| 2     | exactly one step or anywhere north, south, east, west, north-east, north-west, south-east or south-west of another person, diagonally adjacent              |
| 2     | **two clues in one (and)**, for example "next to a plant and on a sofa" or "in a corner and south of X"                                                     |
| 3     | **one of two clues (or)**, between two other people (rows or columns), exactly n cells away from another person                                             |

About the whole map (neutral):

| Level | Clue                                                                                                                                                                                                  |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | nobody is on an object of a kind, nobody of a role is next to an object of a kind                                                                                                                     |
| 2     | no room is empty, a room is empty or holds exactly n people, at least or exactly n people are on a kind of object, no two people of a role share a room, these suspects are in different rooms        |
| 3     | exactly n rooms are empty, exactly n objects of a kind are free, every room holds a different number of people, every room has exactly n people on a kind of object, exactly n people are in a corner |

More types can be added without touching the solvers: a type needs an entry in `logic/types.ts`, a check in `logic/clues.ts` (true, false or not decided yet for a placement that is not complete), a level, a test, and (later) a text per skin. The generator offers every type and the pruning removes what is not needed; **play-testing decides which types stay**.

## Design decisions

- **The engine knows nothing about looks.** An object is a kind that is occupiable or not, a room has a type, a person has a role, a label and a name. A skin (`data/skins.ts`) supplies the kinds, the room types (with how well each kind of object fits), the roles and the names: **Case file** (detectives and suspects in tech workplaces, random first names, the role is a job) and **Outage** (the failed server is alone with the device that caused it, devices are numbered like `sw-01`, `sw-02`, `fw-01` and the victim is `srv-01`).
- **Four pieces, two solvers.**
  - `logic/clues.ts`: what a clue means. Every check answers true, false or "not decided yet", so a search can drop a branch as soon as a clue says no.
  - `logic/solver.ts`: solves by **search** (the person with the fewest possible cells first) and counts solutions. The cells that the clues about one person allow are worked out once.
  - `logic/propagation.ts`: solves **the way a person does**: sets of possible cells and rules that strike cells. It is the **rater** (what reasoning does a puzzle need?) and a second solver that shares no search code with `solver.ts`.
  - `logic/generator.ts`: makes puzzles and checks levels (`problemsOf`). `logic/layout.ts` makes the maps.
- **Difficulty is measured, not guessed.** The rater reports the highest reasoning that was needed: 1 singles and clues about one person, 2 clues that relate people, empty rooms, counting people on a kind of object and the rule about the victim, 3 "what if" (try a cell and find a contradiction). A puzzle that needs more than that is rejected as too hard for a player. The tier of a puzzle is the harder of its reasoning and its clues.
- **Generated by construction.** The generator chooses a map, a solution, and then clues until the rater can solve the puzzle at the wanted level, then takes away every clue that is not needed, keeping one for every suspect. The same seed always gives the same puzzle.
- **A mixed set of clues.** Clues are picked with a weight (distance and between are picked rarely, they are strong but tiring to read), kinds that were used already are less likely, and a level is rejected unless it has at least three kinds, no kind takes up more than a third of six or more clues, and the hardest clues are not more than 40 percent.
- **Verified before it counts.** `problemsOf(level)` checks the structure (people, labels, names, room names, rows and columns, blocked cells, every suspect has a clue, nobody mentions the victim) and then needs **both solvers** to find exactly one solution, equal to the stored one. Generated levels in the tests and, later, every level of the pool pass it.

## Measured (2026-10-09, Case file)

Time to make a puzzle: easy 4 by 4 to 7 by 7 in well under a second up to a few seconds, medium up to 9 by 9 in a few seconds, hard up to 9 by 9 in seconds to a few minutes. That is fine for the level pool, which is made once and committed; making puzzles in the browser needs small boards, a pool, or a worker (decided with the interface). Easy puzzles on 8 by 8 and 9 by 9 are rare because easy clues alone rarely suffice, so easy levels go up to 6 by 6 or 7 by 7.

## How to test

`pnpm test` runs, next to the other tests:

- `logic/clues.test.ts` and `logic/clues-more.test.ts`: every clue type true and false on hand-made puzzles (`logic/fixtures.ts`), partial placements, the rule about the victim, the levels and the numbers of the clues.
- `logic/solver.test.ts` and `logic/propagation.test.ts`: both solvers on the hand-made puzzle, and for 100+ combinations of clues they must **agree** on the number of solutions; the rater on easy and hard sets.
- `logic/layout.test.ts`: maps for every size, tier and skin (room counts, connected and compact rooms, one corridor at most, windows on walls, objects that fit the rooms, enough room to stand, room names).
- `logic/generator.test.ts`: names and labels, solutions, the list of clues, a mixed set of clues, verified puzzles of every tier in both skins, neutral clues per tier, determinism, and that `problemsOf` notices a wrong level.
