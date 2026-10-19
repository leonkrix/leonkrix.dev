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
    rule: 'Voice must arrive fast. Every cable shows its delay in milliseconds under its load, and a full cable is slower. Add up the cables of your route: a call is fine up to 30 ms, loses value after that and is worth nothing after 50 ms. The shortest path on the map is not always the fastest one.',
  },
  {
    number: 5,
    title: 'Priorities',
    rule: 'On a full link, voice goes first and bulk goes last: what does not fit is dropped from the back. But a full cable is slow for everybody, and bulk that is dropped further on has still used the cables before that. Hold bulk traffic (backups, uploads: it can wait) back to keep the cables free for what matters; what you hold back earns nothing, so look for the most you can send.',
  },
  {
    number: 6,
    title: 'Queues',
    rule: 'Every cable has a queue, as big as the cable is: it holds what the cable carries in one minute. A burst that does not fit waits in the queue and goes on a moment later, at the price of waiting time. The queue is served by priority, voice and control first, then web, video and payments, then bulk, and when it is full, the least important traffic is dropped first. Under the load of every cable a small bar and a number show how full it is: Q 3/5 means 3 wait, 5 fit. New traffic: video is big and steady and does not like loss.',
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
    rule: 'Some links lose packets: a small label above the cable says how many ("10 % lost" all the time, "20 % at times" in some situations). Redundancy sends extra coded packets to recover them, but they use capacity too. New traffic: payments (transactions) must not lose a single packet.',
  },
  {
    number: 10,
    title: 'On the move',
    rule: 'Radio links come into range and go out of it. A cable that is out of range is drawn dashed in amber and carries nothing. Backup paths are not offered here, because the links around you change: plan a change of path for the moment a link appears or disappears.',
  },
  {
    number: 11,
    title: 'Zones',
    rule: 'Guests may not talk to the servers directly. Their traffic has to pass the firewall, so the shortest path is no longer allowed.',
  },
  {
    number: 12,
    title: 'Under attack',
    rule: 'A flood of useless traffic hits a server. It fills the cables on its way and the queues behind them, until a firewall stops it. Keep your own traffic out of its way, or send it in a class that is served first. New traffic: control (alarms, door locks) is small but must always get through.',
  },
  {
    number: 13,
    title: 'Everything',
    rule: 'All of it at once, in bigger networks, with more than one bad day to survive.',
  },
];
