/**
 * The title and the short story of every level of the pool, by level id. A story names the
 * victim by role or device (the plan says who it is) and says that exactly one suspect shared a
 * room with the victim. It never names a suspect or a room (nor a kind of room such as an
 * office): those are made by the generator, and the player must not look for them on the map.
 * It also never says that the culprit was alone anywhere else: only the victim's room counts.
 */
export interface Story {
  title: string;
  story: string;
}

export const STORIES: Readonly<Record<string, Story>> = {
  'easy-1': {
    title: 'The late shift',
    story:
      'The founder stayed late to ship a release, and afterwards everything was broken. The team was spread through the building, but exactly one suspect shared a room with the founder. Find out who.',
  },
  'easy-2': {
    title: 'One restart too many',
    story:
      'srv-01 crashed during the night. Looking back at where everything was, exactly one other device shared a room with it. That device is your root cause.',
  },
  'easy-3': {
    title: 'Friday deploy',
    story:
      'Everyone warned against deploying on a Friday. The developer did it anyway, and by the evening the release was broken. Only one suspect had been in the same room as the developer. Who is to blame?',
  },
  'easy-4': {
    title: 'Lost writes',
    story:
      'db-01 stopped accepting writes at 3 a.m. At that moment exactly one other device shared a room with it. Find the one that caused it.',
  },
  'easy-5': {
    title: 'The code freeze',
    story:
      'A code freeze, a locked repository and a CTO who wanted one last fix. Minutes later the change had broken everything. Of all the suspects, exactly one shared a room with the CTO. Who was it?',
  },
  'easy-6': {
    title: 'Cable salad',
    story:
      'After the last maintenance window nobody trusted the cabling any more. When nas-01 stopped answering, exactly one other device shared a room with it. Which one?',
  },
  'medium-1': {
    title: 'Cold start',
    story:
      'The cooling failed, srv-01 overheated and shut itself down. Only one of the other devices was in the same room with it. Work out which one.',
  },
  'medium-2': {
    title: 'Offsite retro',
    story:
      'The retrospective ended early, and the designer was not seen again that evening. In the end only one colleague had shared a room with the designer. Find out who.',
  },
  'medium-3': {
    title: 'Split brain',
    story:
      'Two nodes both believed they were in charge, then db-01 dropped out of the cluster. Only one device shared a room with it. Which one split the brain?',
  },
  'medium-4': {
    title: 'Due diligence',
    story:
      'The investor asked for a private look at the numbers before the funding round, and afterwards the deal fell apart. Exactly one suspect shared a room with the investor. Who?',
  },
  'medium-5': {
    title: 'Config drift',
    story:
      'A change nobody wrote down spread through the network. When rtr-01 failed, exactly one other device shared a room with it. Find the one that caused it.',
  },
  'medium-6': {
    title: 'Standup',
    story:
      'The daily standup never took place: the manager had disappeared. Later it turned out that exactly one suspect had shared a room with the manager. Who was it?',
  },
  'hard-1': {
    title: 'Postmortem',
    story:
      'The postmortem says "human error" and nothing else. The auditor had been going through the books, and only one suspect shared a room with the auditor. The clues are all you have.',
  },
  'hard-2': {
    title: 'The big outage',
    story:
      'Half of the rooms lost power and srv-01 went down with them. Every device has an excuse, but only one shared a room with srv-01. Which one?',
  },
  'hard-3': {
    title: 'Release night',
    story:
      'A big launch, a building full of people and a CEO who disappeared before the champagne. Of all the suspects, only one shared a room with the CEO. Who?',
  },
  'hard-4': {
    title: 'Failover that did not',
    story:
      'fw-01 should have been taken over by its standby, and it was not. Only one other device shared a room with it when it failed. Find that device.',
  },
  'hard-5': {
    title: 'The all-hands',
    story:
      'Everyone came to the all-hands and nobody can say where anyone stood. The admin ended up sharing a room with exactly one suspect. The clues are scarce, so read them carefully.',
  },
  'hard-6': {
    title: 'Root cause unknown',
    story:
      'The incident channel has hundreds of messages and no answer. Out of all these devices, exactly one shared a room with lb-01 when it went down. Find it.',
  },
};
