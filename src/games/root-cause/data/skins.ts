import { type NamePoolEntry, type Skin } from '../logic/skin';

/**
 * First names for Case file, at least one for most letters of the alphabet so that the labels
 * (the first letter) can all be different in a level of up to nine people.
 */
const names: readonly string[] = [
  'Ada',
  'Aiko',
  'Bruno',
  'Beth',
  'Chloe',
  'Carlos',
  'Dara',
  'Dmitri',
  'Elena',
  'Emre',
  'Felix',
  'Fatima',
  'Greta',
  'Gus',
  'Hana',
  'Hugo',
  'Iris',
  'Ivan',
  'Jonas',
  'Jade',
  'Kai',
  'Kira',
  'Lena',
  'Leo',
  'Mara',
  'Milo',
  'Nora',
  'Nils',
  'Omar',
  'Olga',
  'Pia',
  'Pablo',
  'Quinn',
  'Rosa',
  'Ravi',
  'Sven',
  'Sofia',
  'Tara',
  'Theo',
  'Uma',
  'Vera',
  'Viktor',
  'Wanda',
  'Walt',
  'Yara',
  'Zoe',
  'Zane',
];

const namePool: readonly NamePoolEntry[] = names.map((name) => ({
  name,
  label: name.charAt(0),
}));

/**
 * Detectives and suspects in tech workplaces. The objects are things that fit an office: chairs,
 * rugs and sofas to stand on, desks, screens, plants, shelves, crates and printers that block.
 */
export const caseFile: Skin = {
  id: 'case-file',
  kinds: {
    chair: { occupiable: true, cells: 1, weight: 4 },
    rug: { occupiable: true, cells: 1, weight: 2 },
    sofa: { occupiable: true, cells: 2, weight: 1 },
    desk: { occupiable: false, cells: 1, weight: 3 },
    screen: { occupiable: false, cells: 1, weight: 1 },
    plant: { occupiable: false, cells: 1, weight: 2 },
    shelf: { occupiable: false, cells: 1, weight: 2 },
    crate: { occupiable: false, cells: 1, weight: 1 },
    printer: { occupiable: false, cells: 1, weight: 1 },
  },
  roomTypes: [
    {
      id: 'open-office',
      name: 'Open office',
      weight: 3,
      affinity: { chair: 5, desk: 5, plant: 2, rug: 1, shelf: 1, printer: 2, screen: 2, sofa: 0.2 },
    },
    {
      id: 'meeting-room',
      name: 'Meeting room',
      weight: 2,
      affinity: { chair: 5, desk: 2, screen: 4, plant: 1, rug: 1, sofa: 0.3 },
    },
    {
      id: 'break-room',
      name: 'Break room',
      weight: 2,
      affinity: { sofa: 5, chair: 3, plant: 3, rug: 2, shelf: 1, desk: 0.2, printer: 0 },
    },
    {
      id: 'server-room',
      name: 'Server room',
      weight: 2,
      affinity: { shelf: 4, crate: 3, desk: 1, chair: 1, plant: 0, sofa: 0, rug: 0, printer: 0.5 },
    },
    {
      id: 'lab',
      name: 'Lab',
      weight: 1,
      affinity: { desk: 4, chair: 3, shelf: 3, crate: 2, screen: 2, plant: 0.3, sofa: 0 },
    },
    {
      id: 'archive',
      name: 'Archive',
      weight: 1,
      affinity: { shelf: 5, crate: 3, chair: 1, desk: 1, plant: 0.2, sofa: 0, rug: 0 },
    },
    {
      id: 'reception',
      name: 'Reception',
      weight: 1,
      affinity: { sofa: 3, chair: 2, plant: 3, rug: 3, desk: 3, screen: 1, printer: 0.5 },
    },
    {
      id: 'corridor',
      name: 'Corridor',
      weight: 1,
      corridor: true,
      affinity: { rug: 3, plant: 1, shelf: 1, chair: 1, crate: 1, sofa: 0, desk: 0 },
    },
  ],
  roles: ['developer', 'designer', 'tester', 'admin', 'manager', 'intern', 'analyst', 'architect'],
  victimRole: 'founder',
  naming: { style: 'people', pool: namePool },
};

/**
 * A network outage: the failed server is alone with the device that caused it. The rooms are the
 * places of a data center, the objects are racks, cable trays and the plant around them.
 */
export const outage: Skin = {
  id: 'outage',
  kinds: {
    rack: { occupiable: true, cells: 1, weight: 4 },
    tray: { occupiable: true, cells: 2, weight: 1 },
    patch: { occupiable: true, cells: 1, weight: 2 },
    radiator: { occupiable: false, cells: 1, weight: 2 },
    fan: { occupiable: false, cells: 1, weight: 2 },
    ups: { occupiable: false, cells: 1, weight: 1 },
    cabinet: { occupiable: false, cells: 1, weight: 2 },
  },
  roomTypes: [
    {
      id: 'server-room',
      name: 'Server room',
      weight: 3,
      affinity: { rack: 6, fan: 3, ups: 1, cabinet: 1, tray: 2, patch: 1, radiator: 0.3 },
    },
    {
      id: 'network-closet',
      name: 'Network closet',
      weight: 2,
      affinity: { patch: 5, rack: 3, cabinet: 3, tray: 2, fan: 1, ups: 0.5, radiator: 0.2 },
    },
    {
      id: 'data-hall',
      name: 'Data hall',
      weight: 2,
      affinity: { rack: 6, fan: 4, tray: 3, ups: 1, patch: 1, cabinet: 0.5, radiator: 0 },
    },
    {
      id: 'ups-room',
      name: 'UPS room',
      weight: 1,
      affinity: { ups: 5, cabinet: 2, fan: 2, rack: 1, radiator: 0.5, patch: 0.3, tray: 0.5 },
    },
    {
      id: 'cabling-room',
      name: 'Cabling room',
      weight: 1,
      affinity: { tray: 5, patch: 4, cabinet: 2, rack: 1, fan: 0.5, radiator: 0.3, ups: 0 },
    },
    {
      id: 'edge-site',
      name: 'Edge site',
      weight: 1,
      affinity: { rack: 3, radiator: 2, fan: 2, cabinet: 2, ups: 1, patch: 1, tray: 1 },
    },
    {
      id: 'cooling-room',
      name: 'Cooling room',
      weight: 1,
      affinity: { fan: 4, radiator: 3, ups: 1, cabinet: 1, rack: 0.3, patch: 0, tray: 0.3 },
    },
    {
      id: 'cable-corridor',
      name: 'Cable corridor',
      weight: 1,
      corridor: true,
      affinity: { tray: 3, cabinet: 1, radiator: 1, fan: 1, patch: 1, rack: 0.5, ups: 0 },
    },
  ],
  roles: ['switch', 'router', 'firewall', 'nas', 'accesspoint', 'balancer', 'proxy', 'dns'],
  victimRole: 'server',
  naming: {
    style: 'devices',
    prefixes: {
      switch: 'sw',
      router: 'rtr',
      firewall: 'fw',
      nas: 'nas',
      accesspoint: 'ap',
      balancer: 'lb',
      proxy: 'px',
      dns: 'dns',
      server: 'srv',
    },
  },
};

export const skins: Readonly<Record<Skin['id'], Skin>> = {
  'case-file': caseFile,
  outage,
};
