/**
 * The words of the two skins that the clue texts and the legend need: what a kind of object and a
 * role are called, and how the people of the skin are called (people in Case file, devices in
 * Outage). The engine never sees them.
 */
export interface Noun {
  /** With the article: "a chair" */
  one: string;
  plural: string;
  /** What somebody does on it, for clues about a person on an object: "sits on" */
  on?: string;
  /** The same, said the other way round: "does not sit on" */
  notOn?: string;
  /** For the legend: how it is used, for an object that can be occupied */
  use?: string;
}

export interface SkinWords {
  kinds: Readonly<Record<string, Noun>>;
  roles: Readonly<Record<string, Noun>>;
  /** What the board is called in texts about the whole map, for example "map" */
  place: string;
  /** What the people on the board are: "person" and "people", or "device" and "devices" */
  person: string;
  people: string;
  /** For the start of a sentence: "Nobody" or "No device" */
  nobody: string;
  /** What the roles share when they are the same: "with the same role", "of the same type" */
  sameRole: string;
  /** What the victim is called in headlines */
  victim: string;
  /** What the culprit is called in the result */
  culprit: string;
  /** The stamp when a level is solved */
  solved: string;
  /** A short description of the skin for the choice page */
  about: string;
}

export const caseFileWords: SkinWords = {
  kinds: {
    chair: {
      one: 'a chair',
      plural: 'chairs',
      on: 'sits on',
      notOn: 'does not sit on',
      use: 'people can sit here',
    },
    rug: {
      one: 'a rug',
      plural: 'rugs',
      on: 'stands on',
      notOn: 'does not stand on',
      use: 'people can stand on it',
    },
    sofa: {
      one: 'a sofa',
      plural: 'sofas',
      on: 'sits on',
      notOn: 'does not sit on',
      use: 'people can sit here (it covers two cells)',
    },
    desk: { one: 'a desk', plural: 'desks' },
    screen: { one: 'a screen', plural: 'screens' },
    plant: { one: 'a plant', plural: 'plants' },
    shelf: { one: 'a shelf', plural: 'shelves' },
    crate: { one: 'a crate', plural: 'crates' },
    printer: { one: 'a printer', plural: 'printers' },
  },
  roles: {
    developer: { one: 'a developer', plural: 'developers' },
    designer: { one: 'a designer', plural: 'designers' },
    tester: { one: 'a tester', plural: 'testers' },
    admin: { one: 'an admin', plural: 'admins' },
    manager: { one: 'a manager', plural: 'managers' },
    intern: { one: 'an intern', plural: 'interns' },
    analyst: { one: 'an analyst', plural: 'analysts' },
    architect: { one: 'an architect', plural: 'architects' },
    founder: { one: 'the founder', plural: 'founders' },
    ceo: { one: 'the CEO', plural: 'CEOs' },
    cto: { one: 'the CTO', plural: 'CTOs' },
    investor: { one: 'the investor', plural: 'investors' },
    auditor: { one: 'the auditor', plural: 'auditors' },
  },
  place: 'map',
  person: 'person',
  people: 'people',
  nobody: 'Nobody',
  sameRole: 'with the same role',
  victim: 'victim',
  culprit: 'culprit',
  solved: 'Case closed',
  about:
    'Detectives and suspects in a tech company. Somebody was found with exactly one suspect in a room.',
};

export const outageWords: SkinWords = {
  kinds: {
    rack: {
      one: 'a rack',
      plural: 'racks',
      on: 'is mounted in',
      notOn: 'is not mounted in',
      use: 'devices can be mounted here',
    },
    tray: {
      one: 'a cable tray',
      plural: 'cable trays',
      on: 'sits on',
      notOn: 'does not sit on',
      use: 'devices can sit on it (it covers two cells)',
    },
    patch: {
      one: 'a patch panel',
      plural: 'patch panels',
      on: 'is plugged into',
      notOn: 'is not plugged into',
      use: 'devices can be plugged in here',
    },
    radiator: { one: 'a radiator', plural: 'radiators' },
    fan: { one: 'a fan', plural: 'fans' },
    ups: { one: 'a UPS', plural: 'UPS units' },
    cabinet: { one: 'a cabinet', plural: 'cabinets' },
  },
  roles: {
    switch: { one: 'a switch', plural: 'switches' },
    router: { one: 'a router', plural: 'routers' },
    firewall: { one: 'a firewall', plural: 'firewalls' },
    nas: { one: 'a NAS', plural: 'NAS devices' },
    accesspoint: { one: 'an access point', plural: 'access points' },
    balancer: { one: 'a load balancer', plural: 'load balancers' },
    proxy: { one: 'a proxy', plural: 'proxies' },
    dns: { one: 'a DNS server', plural: 'DNS servers' },
    server: { one: 'a server', plural: 'servers' },
    database: { one: 'a database', plural: 'databases' },
  },
  place: 'map',
  person: 'device',
  people: 'devices',
  nobody: 'No device',
  sameRole: 'of the same type',
  victim: 'failed device',
  culprit: 'root cause',
  solved: 'Root cause found',
  about:
    'A network outage. The failed device shared a room with exactly one other device, and that one is the root cause.',
};

export const skinWords = {
  'case-file': caseFileWords,
  outage: outageWords,
} as const;
