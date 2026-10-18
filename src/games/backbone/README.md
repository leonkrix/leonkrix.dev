# Backbone

A planning game about networks: you route traffic through a small network, then a stress test judges the plan. Our own game, our own levels, texts and drawings. The concept (the reasoning behind every rule) is in [docs/network-game-concept.md](../../../docs/network-game-concept.md).

Status: **built, hidden** (`status: 'hidden'` in the registry; it is playable in `pnpm dev` at `/games/backbone/`). Done: the model, the stress test, the exact solver, the level generator and the campaign pool, the interface. Still open: the Build phase and zones (chapters 7 and 10), random levels, the note, the browser tests and the Lighthouse budget (see PLAN.md, 4.5).

## Rules

- A level is a **network** (nodes and cables with a capacity, a delay and sometimes a loss), a list of **flows** and one to three **situations**.
- A flow goes from a node to a node and has a **service profile** (`logic/profiles.ts`): voice must be fast, control must arrive, a transaction cannot lose anything, video wants steady bandwidth, web wants a bit of everything, bulk does not care. A profile is a weight, a latency budget with a steepness, a loss exponent, a queue class and whether it can be held back.
- You draw a path for every flow. Options appear with the chapters: **split** a flow over up to three paths in quarters, a **backup** path that is taken at once when the path in use is cut, **redundancy** (0, 25 or 50 percent extra coded packets that recover loss), **throttling** of bulk traffic, and a **change of path at a step**.
- The **stress test** (`logic/simulate.ts`) is deterministic. In every step the flows send along their paths; on every cable the queues are served in order (voice and control, then the middle class, then bulk) and what does not fit is dropped; a flow is as fast as the narrowest cable on its path. A flow earns `weight x demand x delivered^k x timeliness` per step. A cut cable loses the traffic of the flows on it for two steps unless they have a backup, then the network reroutes them.
- The **score** of a plan is the mean of its situations with the worst one counted twice, from 0 to 100.
- **Stars** (`logic/stars.ts`): one star for at least the shortest path, two for beating both simple strategies and being 40 percent of the way to the best plan, three for coming within 5 percent of the distance to the best plan. A level is only admitted when those steps are real (`isAdmissible`).
- **Helpers** ("Shortest for all", "Balance for me") fill in the plan; a run with a helper earns no stars. A solved level can load the best plan.
- Unlimited tries, nothing is saved.

## Design decisions

- **The solver proves the best plan** (`logic/solver.ts`): branch and bound over the flows. It relies on one property of the model, tested in `simulate.test.ts`: extra traffic never helps a flow that is already in the plan, so what the placed flows earn in a partial plan is an upper bound. `logic/fast.ts` is the same stress test on arrays for the solver; a test compares it with the readable one on 120 random plans. The solver is tested against trying every combination (`solver.test.ts`).
- **The rules of a level decide the options** (`Level.rules`): the interface shows only those, and the solver only looks at plans that use only those, so a level of chapter 3 is proven with the options of chapter 3.
- **The two simple strategies** (`logic/baselines.ts`) know nothing about failures, loss or priorities: one path per flow, no extras.
- **Levels come from a generator and are admitted by the solver.** `logic/generate.ts` makes a well formed level from a spec and a seed (a planar network of one of four families, flows of the given profiles, situations). `data/campaign-plan.ts` is the plan of the campaign (chapters, level titles and stories, the spec, and which options the best plan has to use so that the new rule of a chapter matters). `pnpm levels-backbone` searches a seed for every level, proves the best plan and writes `data/levels.json`.
- **Drawing:** the map is an SVG for the cables, the paths and the packets, with real buttons on top for the nodes (focus, keyboard, touch target of 44 pixels). The load of a cable is a color, a dashed line when it is over capacity, and always a number. The packets are moved by the component frame by frame; with reduced motion the stress test is still frames.
- **Layout never moves:** a skeleton with the same boxes is rendered on the server (`BackboneSkeleton.tsx`), the panel on the right has a fixed height and scrolls inside.
- **Data:** the level pool (`data/levels.json`) is fetched after the page has been painted (`data/load.ts`), like the data of Word Radar.

## Data (sources and licenses)

Everything is our own. Icons are from Lucide (ISC, see THIRD_PARTY.md), copied into `data/icons.ts`. The names in the settings (`data/settings.ts`) are plain words.

## How to add levels

1. Add an entry to `LEVEL_PLAN` in `data/campaign-plan.ts` (id `c<chapter>-<number>`, setting, title, story, shape, `requires`).
2. Run `LEVELS=c3-5 pnpm levels-backbone`. Existing levels are kept unless `LEVELS_FORCE=1`. `LEVELS_OUT`, `LEVELS_CANDIDATES`, `LEVELS_PROOF_MS` and `LEVELS_JOIN` are described at the top of `scripts/generate-backbone-levels.gen.ts` (several runs can work in parallel and be merged).
3. Look at the level in `pnpm dev` and play it.

## Tests

Unit tests for the model (`simulate.test.ts`: every rule, the monotonicity the solver needs, the fast stress test), the plan moves (`play.test.ts`), the solver (`solver.test.ts`), the generator (`generate.test.ts`), the stars (`stars.test.ts`) and the drawing logic (`view.test.ts`).
