# Network game "Backbone": concept, draft 2 (2026-10-17)

Status: **built on 2026-10-18 (see PLAN.md, 4.5, and the README of the game), the text below is the concept as agreed and then refined**; **agreed in the main lines with Leon on 2026-10-17** (the decisions are in section 15). Nothing is built yet. The only code written so far is a throw-away experiment (outside the repository) whose results are in section 9. Draft 2 adds the **service profiles** of the flows (section 4) and the **scenarios** of a level (section 7) after Leon's remark that flows have different requirements (low latency, low error and so on).

What Leon asked for, in his words: a completely new game that is not like the others, about networks (packets, routing, load balancing, whatever is good), rich and complex, with a difficulty that grows. A mix of the three directions that were offered (routing under load, building a network under a budget, reliability through redundancy), perhaps with more topics, and with the subnet idea as a possible extra. A fixed campaign that adds content step by step, plus generated levels. Planning in turns, then a live test. Several tries. The result judged in stars, next to two simple heuristics (shortest path and load balanced). Minimal and very well designed, with fitting animations, not a terminal look. Easy and quick levels at first, longer ones with many mechanics later. Mouse, touch and keyboard.

## 1. The pitch

You are the network engineer. A level is a small network and a list of things that have to travel through it. You **build** (sometimes), you **route**, and then you watch a **stress test** run: traffic bursts, a link is cut, a link is lossy. Your plan is scored, you get stars, and you see your result next to what a simple heuristic does and what the best possible plan would have done. You may try as often as you like.

It is not a word game, not a logic grid and not a grouping game. It is a **planning game with a simulation as the judge**: you decide, then the world answers, and the answer teaches you something for the next try.

## 2. Name

Working name **Backbone**. Other candidates: **Bottleneck** (what you always fight), **Failover** (what you always prepare), **Packet Storm**. The name has to be our own and is checked against trademarks before it is final. Tag in the registry: `Network` (it exists already).

## 3. The three phases of a level

1. **Build** (only in levels that have a budget). Lay cables between nodes and choose their size. Everything costs; the budget is a bar.
2. **Route.** For every flow you choose how it travels: the path, optionally a second path and how the traffic is split between them, a backup path, a rate limit for bulk traffic, and the amount of redundancy. This is the phase where you think, undo, try, and where nothing is judged yet.
3. **Stress test.** Press "Run". A timeline of 6 to 16 steps plays, animated: packets travel, links fill up, a failure happens, loss happens. Afterwards the result is shown: the score, the stars, a breakdown per flow, and the ghosts (section 6). Then back to Route with your plan still there, and a better idea.

The first chapters are only phase 2 and 3. Phase 1 appears in the middle of the campaign.

## 4. The model

Everything that follows is **deterministic**: the same plan gives the same result, every time. There are no dice. A level has a seed only for the generator, never for the stress test.

**The network.** Nodes (with a kind: router, switch, server, firewall, radio) and links between them. A link has a **capacity** (a whole number of units per step), a **delay** (a whole number), a **loss** (0 or a small percentage) and, in the budget levels, a **cost**. Links are undirected.

**Flows and service profiles.** A flow has a source, a destination, a **demand per step** (a short list, so there are peaks) and a **service profile**. Flows do not all want the same thing, and this is what makes routing a real decision: a profile says what the flow cares about. A profile has a weight, a latency budget with a steepness, a loss sensitivity, a queue class and a flag whether it can be held back:

- **Weight:** how much one unit of delivered traffic is worth.
- **Latency budget and steepness:** how late the flow may be, and how fast its value falls when it is later (steep for voice, flat for a backup).
- **Loss sensitivity:** an exponent on the delivered share. Value is `delivered ^ k`: a video call with k = 1.5 forgives little, a bank transaction with k = 4 is nearly worthless if anything is lost, a backup with k = 1 only loses what was lost.
- **Queue class** (priority on a link): high, middle or low.

The profiles of the game (names are plain descriptions, not products):

| Profile                              | Wants                       | Does not care about    | Queue                         |
| ------------------------------------ | --------------------------- | ---------------------- | ----------------------------- |
| **Voice**                            | low latency, steady         | bandwidth (small)      | high                          |
| **Control** (drone commands, alarms) | must arrive, low latency    | bandwidth (tiny)       | high                          |
| **Transaction** (payments, database) | no loss at all              | latency (moderate)     | middle                        |
| **Video**                            | bandwidth, low loss, steady | a little latency       | middle                        |
| **Web**                              | a balance of everything     |                        | middle                        |
| **Bulk** (backup, updates)           | bandwidth                   | latency, a little loss | low (and it can be throttled) |

New profiles come with the chapters (a flow with a latency budget in chapter 4, the low queue class and throttling in chapter 5, a flow that cannot lose anything in chapter 8). A level is therefore not "move N units from A to B", but "this flow needs speed, that one needs certainty, and that one only needs room".

**Capacity and priority.** On every link, in every step, the queue classes are served in order of priority: high first, then middle, then low. What does not fit is **dropped**, and a flow is as fast as the narrowest link on its path: the share of it that arrives is the smallest share any link of the path grants it (built and tested in `logic/simulate.ts`, 2026-10-17; the first idea, to multiply the shares of all links, punished a bottleneck twice). Overload is not forbidden, it is **punished**: dropped traffic is lost value, and lost value is lost score.

**Latency.** The latency of a flow is the sum of the delays of its links plus a queue term that grows with the load of each link. A flow that is later than its budget loses value according to the steepness of its profile.

**Splitting.** A flow can be split over two or three paths in steps of a quarter ("ECMP").

**Failures.** Some levels cut a link for some steps. A flow with a **backup path** switches to it at once. A flow without one is repaired by the network after a delay of two steps, on the shortest path that is left, and loses the traffic of those steps.

**Loss and redundancy.** Some links lose a part of the traffic. A flow can carry **redundancy** (coded packets, in the spirit of the Tetrys protocol of the bachelor thesis): 0, 25 or 50 percent more traffic, which recovers a loss of up to that size. The redundancy needs capacity, and it counts as traffic on every link of the path. So the question is always: how much safety can I afford?

**Moving links** (the chapter inspired by the master thesis). The capacity or the existence of a link follows a schedule: a link is there in steps 0 to 5 and gone afterwards, or the other way round. The player may give a flow **a second path with a switch time**: path A until step s, path B afterwards. Planning over time.

**Zones and policy.** Nodes belong to zones (office, guests, servers, outside). A policy says what may pass where: guest traffic must go through a firewall node, some links may not carry some classes. A flow that breaks the policy is blocked and its value is lost; the game says which rule it broke.

**What must stay true of the model** (a test checks it, because the solver depends on it): adding traffic to a plan never helps a flow that is already in it. This makes "the value of the flows placed so far, with the others left out" an upper bound, which is what makes the exact solver fast (section 9).

## 5. The score

For every step and every flow: `weight x demand x delivered share ^ loss sensitivity x timeliness`, summed over the steps. The sum is divided by the best that could ever be (everything delivered on time), so a score is a number from 0 to 100. In the budget levels the cost of the network is subtracted in the same unit, so that building too much is a mistake too. The result screen explains the score per flow: how much was dropped, how much was lost, how late it was, and on which link.

## 6. Stars and the two ghosts

For every level, the game works out three plans:

- **Shortest path** (`SP`): every flow on its fastest path, no splitting, no redundancy.
- **Load balanced** (`LB`): the flows one after the other, heaviest first, each on the path with the lowest load at that moment.
- **Best** (`OPT`): the exact optimum, found by the solver.

Stars: **one star** when your plan is at least as good as the shortest path, **two** when it is at least as good as the better of the two heuristics (`H`), **three** when it reaches the optimum, within 2 percent of the distance between `H` and `OPT`. A level is only shown when the three thresholds are really different (`OPT` is at least 8 percent above `H`), so every star means something.

After a run, the result screen shows **you, SP, LB and Best side by side** as small maps (links coloured by their load), each with its score. "Best" is also something you can **watch** (the plan that gets three stars), but **only once the level is solved** (at least one star), because the optimum is the solution (decided with Leon). Until then the result screen shows the two heuristics and, as the only help, the worst link and the flow that lost the most.

## 7. The campaign

A campaign of chapters, **each one adds one rule**. Every level of every chapter is open from the start (nothing is stored on the device, so there is nothing to unlock; the order is a recommendation, shown in the overview). A chapter has four to six levels that grow from easy to hard, the last one is a small boss that mixes the new rule with the old ones.

| #   | Chapter           | New rule                                                 | Feels like                                 |
| --- | ----------------- | -------------------------------------------------------- | ------------------------------------------ |
| 1   | First packets     | Capacity: a path, a demand, overload is dropped          | learning the controls                      |
| 2   | Sharing           | Several flows compete for the same links                 | spotting the bottleneck                    |
| 3   | Splitting         | One flow over two or three paths                         | load balancing                             |
| 4   | Latency           | Delays and a latency budget (the Voice profile)          | the shortest path is not the fastest       |
| 5   | Priorities        | Queue classes, Bulk and throttling                       | who goes first                             |
| 6   | When things break | A link is cut: backup paths                              | redundancy has a price                     |
| 7   | Budget            | The Build phase: cables and sizes under a budget         | design                                     |
| 8   | Loss              | Lossy links and redundancy (coded packets)               | reliability against capacity               |
| 9   | On the move       | Links that come and go, a switch time for a path         | planning over time (the airborne networks) |
| 10  | Zones             | Zones, firewalls, policies                               | segmentation                               |
| 11  | Everything        | All rules together, in larger networks, with long events | the capstone, with a few named scenarios   |

**Scenarios.** Every level has a setting and a story in a few lines (a small office, a hospital, a data centre, a university campus, a regional provider, a swarm of drones, a festival), written to fit the setting and sometimes with a dry joke. The setting decides the node kinds, the mix of service profiles (a hospital has control and transaction flows, a festival has video and a lot of web) and the names of the flows. From chapter 6 on a level can also have **two or three situations** that the same plan has to survive: the quiet evening, the rush, the cut cable. The plan is run through every situation and the score is the mean of the situations, with the worst one counting double, so a plan that is brilliant on a good day and broken on a bad day does not get three stars. A situation is a list of events (a burst of demand, a link down, a link lossy, a link moving), not a different engine.

**An optional last chapter, "Address plan".** This is the subnet idea (option D). It does not belong to the routing model, but it fits the zones: after routing, give every zone a block of addresses so that the blocks do not overlap and the routes between them can be summarised. It is a different kind of puzzle (packing blocks into a binary tree, exact and quick to solve), and it could be a late chapter, a puzzle type inside the capstone, or a game of its own later. Leon decides (question 2).

**Generated levels (sandbox).** A tab "Random": choose a difficulty from 1 to 5 (which rules are on and how big the network is), the game makes a level from a seed, **proves the optimum in a Web Worker** and only shows the level when it passes the same gate as the campaign. The seed is in the address, so a level can be shared.

## 8. Difficulty

Difficulty rises in three ways at once: **more rules** (the chapters), **bigger networks and more flows** (from 5 nodes and 2 flows to about 12 nodes and 8 flows), and **less obvious optimum** (the gap between the heuristics and the best plan, and how many of the options matter). The solver's effort (the number of plans it had to look at) rates a level, as in Root Cause, so that the generator can aim at a tier.

## 9. The solver, and what a first experiment says

The exact solver works like the one of Root Cause in spirit: it must **prove** that the best plan is the best, not guess. Plan: for every flow a list of candidate paths (the six best by delay), the options of a flow are its path, its redundancy level (and later splits, backups and throttles), and a **branch and bound** search over the flows, heaviest first. The bound is the one from section 4: the value of the placed flows with the others left out, plus the best each remaining flow could get alone.

A throw-away experiment (not in the repository, a few hundred lines, unoptimised) tried exactly this on random networks with three classes, a failure, lossy links and three redundancy levels. Median times of the exact solver:

| Network  | Flows | Median | 90th percentile | Slowest of 20 |
| -------- | ----- | ------ | --------------- | ------------- |
| 6 nodes  | 3     | 3 ms   | 8 ms            | 8 ms          |
| 8 nodes  | 4     | 14 ms  | 42 ms           | 153 ms        |
| 10 nodes | 5     | 50 ms  | 645 ms          | 1.5 s         |
| 12 nodes | 6     | 117 ms | 2.5 s           | 2.5 s         |
| 14 nodes | 7     | 0.7 s  | 8 s             | 17.5 s        |

Reading it: **exact proof is realistic up to about 12 nodes and 6 to 8 flows**, and with an optimised solver (incremental simulation, better bounds, sorting of options, shared work between branches) there is room of a factor of ten or more. Larger campaign levels are solved **offline** by a script, as the pool of Root Cause is, and their results stored; generated levels have a time limit in the browser and are only shown when the proof finishes in time.

The same experiment counted how often a random level is **interesting**: the optimum was more than 10 percent above the better heuristic in only **25 to 50 percent** of the random levels. So a generator has to **filter** (as the plan always said), and the campaign levels are designed by hand with the generator's help, so that each one teaches the point of its chapter. The two heuristics also differ from each other in about as many levels, which is good: neither is always the better one.

## 10. How you play (interaction)

The aim is that every action can be done with a pointer, with a finger **and** with the keyboard, and that the first one is the one that feels natural.

**Choosing what to route.** A list of the flows sits next to the map (on a phone, below it). Click a flow in the list, or click its source node, or press Tab; the flow is highlighted on the map, with its demand and its class shown as a small badge at the source and the destination.

**Building a path.** Three ways, which can be mixed:

- **Click** the nodes one after the other along the links; every click extends the path.
- **Drag** from the source across the nodes to the destination and let go.
- **Suggest and bend:** click "route" for the shortest path, then drag a point of the line to another node; the path bends through it.

**Keyboard.** Tab goes through the flows and the nodes; the arrow keys move from a node to its neighbours (the next neighbour in the direction of the arrow); Enter adds the node to the path; Backspace takes the last one back; letters select the options (S: split, B: backup, R: redundancy, T: throttle). Everything is announced in a live region ("Flow 2 now goes A, C, F, load on C-F 9 of 10").

**Options of a flow** sit in a panel under the list: split (a segmented control with the shares), backup, redundancy (0, 25, 50 percent), throttle (for bulk). Only what the chapter has introduced is shown, so the panel is short at first.

**Build phase.** Drag between two nodes to lay a cable, click a cable to change its size or to remove it; the budget bar moves as you do.

**Everywhere:** undo and redo, "reset the plan", "Run", "Run again". The plan stays when you come back from the stress test. **Helpers** are available and honest: "shortest path for all" and "balance for me" fill in the plan like the two heuristics do; using one marks the run as assisted (no stars for that run), so the stars stay worth something.

**Touch.** The map scales to the width of the screen, nodes have a target of at least 44 pixels, and path building by taps works without dragging. The biggest networks are laid out so that they stay readable on a phone in landscape and are scrollable on a small one.

## 11. How it looks and moves

Minimal, calm and dark, in the colours of the site, with one accent for the network and one for the load. No terminal look.

- **The map** is a clean diagram on the page background (no box with a loud border, the `edge` style of the site). Nodes are small rounded squares with a Lucide glyph for their kind (router, server, shield for a firewall, radio) and a one-letter label. Links are thin lines whose **width shows the capacity**.
- **Load** colours the line from cool blue through cyan to amber and red, and is also written as a small number on the link and drawn as a **pattern** (dashed when overloaded), so colour is never the only signal.
- **Flows** have a class shape for their packets: a dot for critical, a diamond for standard, a square for bulk. The packets are small, move along the lines in the stress test and **fade out** where they are dropped. Redundancy packets are drawn smaller and paler behind the real ones.
- **Events** are visible: a cut link flashes and breaks into two stubs; a lossy link has a faint noise; a moving link slides in and out with a soft glow; a zone is a barely tinted region with a label in a corner.
- **The timeline** is a thin bar with markers for the events and a playhead you can drag (scrub), with 1x, 2x and skip.
- **The result** appears in place, not on another page: the stars fill one after the other, the score counts up, and the ghosts show as small multiples next to your own map.
- **Reduced motion:** no moving packets; the stress test is a set of still frames you step through with the scrubber or the arrow keys; the stars appear at once.

Everything is SVG and CSS, plus a small amount of script for the timeline. No canvas, no library, no request to another server.

## 12. Accessibility

A diagram is nothing for a screen reader, so the game has a **text equivalent that is complete**, not a note: the flows as a list with their paths ("A, C, F"), their options and their result; the links as a table with capacity, load per step and state; the events as a list. The path can be built from the keyboard alone (section 10). The result is announced. Colour is never alone (width, number, pattern, shape). Reduced motion is honoured. The page is exactly as high before the game as after it (the skeleton rule and the layout guard of the site, at every width from 296 pixels).

## 13. Architecture and tests

Like the other games: `src/games/<slug>/` with `logic/` (pure TypeScript, no DOM, no React), `data/`, `components/` (the React island), a README and a note in "Behind the scenes".

- `logic/model.ts`: the types and the level format. `logic/simulate.ts`: the stress test. `logic/baselines.ts`: shortest path and load balanced. `logic/solver.ts`: the exact search. `logic/rate.ts`: the rating of a level by the effort of the proof. `logic/generate.ts`: the families of networks (ring, grid campus, hub and spoke, mesh backbone, a cluster of drones) and the flows and events on them. `logic/policy.ts`: zones and rules.
- `data/campaign.json`: the levels of the chapters, made by a script (`pnpm levels-net`, through vitest as the Root Cause one is), with the optimum stored. `data/chapters.ts`: texts, scenarios and the plan.
- A **Web Worker** for the generator and the proof of the random levels (as Root Cause does).
- **Tests:** the model (conservation: dropped plus delivered equals offered; determinism; the **monotonicity** the solver needs), the baselines, the solver against a brute-force search on tiny levels and against random plans (nothing may beat it), the generator over many seeds, the **level gate** in CI (every level of the campaign: the solver proves the optimum, the optimum is at least 8 percent above the heuristics, the stars differ, the text equivalent is complete), end-to-end tests that play the first chapter with the keyboard and with a drag, the stress test, the stars, the axe scans, reduced motion, the layout guard and a width sweep as for Word Radar.
- **Size:** the logic and the interface are the biggest of the games, but the script budget of 130 KB should hold (React and the interface in the first file, the campaign data and the solver in files that are loaded after the first paint, as the rules of the site ask). A budget entry in `scripts/lighthouse.mjs`.
- **Privacy:** nothing changes. Nothing is stored (progress, stars and the plan live only until the page is left), nothing is sent.

## 14. How to build it, in steps

The game is built in several commits on one branch, **one pull request with the whole game** (decided with Leon), and stays `hidden` in the registry until Leon says go.

1. **4.5a Model.** Types, level format, the stress test, the two baselines, with tests. (No interface yet.)
2. **4.5b Solver.** The exact search, the rating, the proof that it works against brute force.
3. **4.5c First levels.** Chapters 1 to 5 as data, with the level gate, made by the script.
4. **4.5d Interface v1.** Route and stress test, the result and the ghosts, keyboard, touch, skeleton, tests, tile preview. (Decided: no release in between, see section 15.)
5. **4.5e Chapters 6 to 9.** Backups, the Build phase, redundancy, moving links: more data, more interface.
6. **4.5f Zones** (and, if Leon wants it, the address plan).
7. **4.5g Random levels.** The generator and the worker.
8. **4.5h The note and the polish.** The note in "Behind the scenes" (with figures made from the real code of the game), README, the preview, the last animation and the balance.

## 15. Decisions (Leon, 2026-10-17)

1. **Name:** Backbone.
2. **Subnets / address plan:** not now. Later, either as a puzzle at the end of a level or as a game of its own. Zones and firewalls stay in (chapter 10).
3. **Release:** everything at once, as **one pull request** with the whole game, built in several commits. The game stays `hidden` until Leon says go. Work is therefore ordered by the steps of section 14, but nothing goes live in between.
4. **Helpers** ("shortest path for all", "balance for me"): yes, a run that used one is marked as assisted and gets no stars, like the hints of the other games.
5. **Stars:** as proposed (1 = shortest path, 2 = both heuristics, 3 = optimum within 2 percent of the gap). Look at it again when real levels exist.
6. **Story texts:** yes, fitting the setting, humour allowed. Tone is my choice (dry and short, a joke now and then).
7. **Phones:** not blocked. The game should work on a phone where it can, and recommends a larger screen when a level is big (a notice, not a wall).
8. **Watching Best:** only once the level is solved (at least one star).

Open questions are asked during the work, at the step where they matter.

## 16. Risks and what answers them

- **Scope.** It is the biggest game. Answer: the steps in section 14, a first release with the first chapters, and every later chapter is data.
- **Solver speed on large levels.** Answer: offline proofs for the campaign, a time limit and the gate for random levels, an optimised solver (the experiment was not optimised at all).
- **Balance and understanding.** A simulation can feel like homework. Answer: the chapters add one rule at a time, the first levels take a minute, the result screen explains the score in words, and the two ghosts show what a heuristic does.
- **Dragging on touch screens and with a keyboard.** Answer: three ways to build a path, two of them without dragging, and the keyboard model from the start.
- **Performance of the animation.** Answer: a few hundred small SVG shapes at most, moved by one timeline, and a frame-by-frame mode.
- **Similarity to the other games.** It has no words, no grid, no grouping, and the judge is a simulation, not a rule check.
