/**
 * The chapters of the campaign: a title and what is new in each. Small and separate from the plan
 * of the levels (`campaign-plan.ts`, which holds every story), so that the game can show the
 * overview without loading the plan.
 */

export interface Chapter {
  number: number;
  title: string;
  /** What is new in this chapter, one or two sentences */
  rule: string;
}

export const chapters: readonly Chapter[] = [
  {
    number: 1,
    title: 'First packets',
    rule: 'Every link carries only so much. Send each flow along a path and keep the traffic under the capacity, or the rest is dropped.',
  },
  {
    number: 2,
    title: 'Sharing',
    rule: 'Flows share links. When two of them want the same cable, one of them has to take another way.',
  },
  {
    number: 3,
    title: 'Splitting',
    rule: 'One flow can use several paths at once. Split it in quarters to fill the roads that are free.',
  },
  {
    number: 4,
    title: 'Latency',
    rule: 'Voice must arrive fast. The shortest path on the map is not always the fastest one when it is full.',
  },
  {
    number: 5,
    title: 'Priorities',
    rule: 'On a full link, voice goes first and bulk goes last. Hold bulk traffic back to make room for what matters.',
  },
  {
    number: 6,
    title: 'Queues',
    rule: 'Links have buffers. A burst that does not fit waits in the buffer and goes on a moment later, at the price of waiting time. A full buffer drops what comes next. Look at the number after the q on a cable.',
  },
  {
    number: 7,
    title: 'When things break',
    rule: 'A cable will be cut. Give a flow a backup path and it switches at once; without one it is lost for a while.',
  },
  {
    number: 8,
    title: 'Budget',
    rule: 'Some cables do not exist yet. Build the ones that matter within the budget, then route the traffic over what you built.',
  },
  {
    number: 9,
    title: 'Loss',
    rule: 'Some links lose packets. Redundancy sends extra coded packets to recover them, but they use capacity too.',
  },
  {
    number: 10,
    title: 'On the move',
    rule: 'Links come and go. Plan a change of path for the moment a link appears or disappears.',
  },
  {
    number: 11,
    title: 'Zones',
    rule: 'Guests may not talk to the servers directly. Their traffic has to pass the firewall, so the shortest path is no longer allowed.',
  },
  {
    number: 12,
    title: 'Under attack',
    rule: 'A flood of useless traffic hits a server. It fills the cables on its way and the queues behind them, until a firewall stops it. Keep your own traffic out of its way, or send it in a class that is served first.',
  },
  {
    number: 13,
    title: 'Everything',
    rule: 'All of it at once, in bigger networks, with more than one bad day to survive.',
  },
];
