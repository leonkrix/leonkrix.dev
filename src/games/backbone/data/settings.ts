import type { Flow, Level, NetNode, NodeKind, ProfileId } from '../logic/types';

/**
 * Where a level takes place. A setting gives the nodes and the flows their names, so that the same
 * kind of network is a hospital in one level and a festival in another. Only names change here,
 * never numbers.
 */

export type SettingId =
  'office' | 'hospital' | 'campus' | 'festival' | 'datacentre' | 'drones' | 'provider';

interface Setting {
  id: SettingId;
  name: string;
  nodes: Partial<Record<NodeKind, readonly string[]>>;
  flows: Record<ProfileId, readonly string[]>;
}

export const settings: Readonly<Record<SettingId, Setting>> = {
  office: {
    id: 'office',
    name: 'Small office',
    nodes: {
      router: ['Gateway', 'Core', 'Floor 1', 'Floor 2', 'Annex', 'Hub', 'Edge', 'Spare'],
      switch: ['Switch A', 'Switch B', 'Switch C', 'Switch D'],
      server: ['File server', 'Mail server'],
      client: ['Reception', 'Sales', 'Design', 'Support', 'Kitchen', 'Meeting room', 'Print room'],
    },
    flows: {
      voice: ['Phone calls', 'Conference call', 'Desk phones'],
      control: ['Door locks', 'Fire alarm', 'Badge readers'],
      transaction: ['Invoices', 'Payroll', 'Order system'],
      video: ['Video meeting', 'Training video', 'Demo stream'],
      web: ['Web browsing', 'Cloud documents', 'Mail'],
      bulk: ['Nightly backup', 'Software updates', 'Photo archive'],
    },
  },
  hospital: {
    id: 'hospital',
    name: 'Hospital',
    nodes: {
      router: [
        'Core',
        'Ward hub',
        'Theatre hub',
        'North wing',
        'South wing',
        'Edge',
        'Spare',
        'Link',
      ],
      switch: ['Ward A', 'Ward B', 'Ward C', 'Ward D'],
      server: ['Records', 'Imaging store'],
      client: ['Radiology', 'Pharmacy', 'Theatre', 'Emergency', 'Lab', 'Reception', 'Clinic'],
    },
    flows: {
      voice: ['Nurse call', 'Telemedicine call', 'Paging'],
      control: ['Patient monitors', 'Infusion pumps', 'Ventilators'],
      transaction: ['Prescriptions', 'Patient records', 'Billing'],
      video: ['Remote consultation', 'Surgery camera', 'Training stream'],
      web: ['Staff intranet', 'Lab results', 'Appointments'],
      bulk: ['Scan archive', 'Record backup', 'Software updates'],
    },
  },
  campus: {
    id: 'campus',
    name: 'University campus',
    nodes: {
      router: ['Core', 'Library', 'Science', 'Arts', 'Gate', 'Annex', 'Edge', 'Spare'],
      switch: ['Hall A', 'Hall B', 'Hall C', 'Hall D'],
      server: ['Course portal', 'Research store'],
      client: ['Dorm 1', 'Dorm 2', 'Lecture hall', 'Canteen', 'Lab', 'Sports hall', 'Cafe'],
    },
    flows: {
      voice: ['Campus phones', 'Helpdesk calls', 'Emergency line'],
      control: ['Door access', 'Lab sensors', 'Fire alarm'],
      transaction: ['Exam submissions', 'Grades', 'Payments'],
      video: ['Lecture stream', 'Seminar call', 'Open day video'],
      web: ['Course portal', 'Library search', 'Student mail'],
      bulk: ['Research data', 'Backups', 'Software mirror'],
    },
  },
  festival: {
    id: 'festival',
    name: 'Music festival',
    nodes: {
      router: [
        'Control tent',
        'North field',
        'South field',
        'Camp',
        'Gate',
        'Stage hub',
        'Edge',
        'Spare',
      ],
      switch: ['Tent A', 'Tent B', 'Tent C', 'Tent D'],
      server: ['Ticket server', 'Stream encoder'],
      client: [
        'Main stage',
        'Food court',
        'Bar',
        'First aid',
        'Merch',
        'Gate scanners',
        'Camp office',
      ],
    },
    flows: {
      voice: ['Crew radio', 'Stage manager calls', 'Security calls'],
      control: ['Stage lights', 'Emergency lights', 'Gate barriers'],
      transaction: ['Ticket scans', 'Card payments', 'Merch till'],
      video: ['Live stream', 'Big screen feed', 'Camera feed'],
      web: ['Festival app', 'Social wall', 'Schedule page'],
      bulk: ['Photo uploads', 'Recording archive', 'Sales report'],
    },
  },
  datacentre: {
    id: 'datacentre',
    name: 'Data centre',
    nodes: {
      router: ['Spine 1', 'Spine 2', 'Leaf 1', 'Leaf 2', 'Leaf 3', 'Border', 'Edge', 'Spare'],
      switch: ['Rack A', 'Rack B', 'Rack C', 'Rack D'],
      server: ['Database', 'Storage'],
      client: ['Web tier', 'App tier', 'Batch', 'Cache', 'Queue', 'Monitor', 'Build farm'],
    },
    flows: {
      voice: ['Ops bridge', 'On-call calls', 'Alert pager'],
      control: ['Cluster heartbeat', 'Orchestrator', 'Failover signal'],
      transaction: ['Payments API', 'Database writes', 'Ledger'],
      video: ['Streaming service', 'Video encode', 'Live events'],
      web: ['Web requests', 'API calls', 'Search'],
      bulk: ['Nightly backup', 'Log shipping', 'Model training data'],
    },
  },
  drones: {
    id: 'drones',
    name: 'Drone swarm',
    nodes: {
      router: [
        'Relay 1',
        'Relay 2',
        'Relay 3',
        'Relay 4',
        'Relay 5',
        'Relay 6',
        'Relay 7',
        'Relay 8',
      ],
      radio: ['Scout 1', 'Scout 2', 'Scout 3', 'Scout 4'],
      switch: ['Hub A', 'Hub B', 'Hub C', 'Hub D'],
      server: ['Ground station', 'Command post'],
      client: ['Scout A', 'Scout B', 'Scout C', 'Scout D', 'Scout E', 'Scout F', 'Scout G'],
    },
    flows: {
      voice: ['Pilot voice', 'Crew radio', 'Relay chatter'],
      control: ['Flight commands', 'Collision alerts', 'Return-home signal'],
      transaction: ['Mission log', 'Waypoint update', 'Target report'],
      video: ['Camera feed', 'Thermal feed', 'Mapping stream'],
      web: ['Map tiles', 'Weather data', 'Status page'],
      bulk: ['Sensor dump', 'Flight logs', 'Firmware update'],
    },
  },
  provider: {
    id: 'provider',
    name: 'Regional provider',
    nodes: {
      router: ['Core 1', 'Core 2', 'Metro N', 'Metro S', 'Metro E', 'Metro W', 'Peering', 'Spare'],
      switch: ['Agg A', 'Agg B', 'Agg C', 'Agg D'],
      server: ['Peering point', 'Content cache'],
      client: ['Town A', 'Town B', 'Town C', 'Village', 'Business park', 'Campus', 'Harbour'],
    },
    flows: {
      voice: ['Phone service', 'Emergency calls', 'Business lines'],
      control: ['Signalling', 'Grid telemetry', 'Alarm service'],
      transaction: ['Bank links', 'Card network', 'Stock feed'],
      video: ['TV service', 'Video on demand', 'Live sports'],
      web: ['Home internet', 'Cloud access', 'Mail service'],
      bulk: ['Mirror sync', 'Backups', 'Software distribution'],
    },
  },
};

/** The same level with the names of a setting. Nodes and flows are named in order, one by one. */
export function dress(level: Level, setting: SettingId): Level {
  const chosen = settings[setting];
  const used = new Map<string, number>();
  const next = (key: string, pool: readonly string[] | undefined, fallback: string): string => {
    const count = used.get(key) ?? 0;
    used.set(key, count + 1);
    return pool?.[count] ?? `${fallback} ${String(count + 1)}`;
  };
  const nodes: NetNode[] = level.nodes.map((node) => ({
    ...node,
    name: next(`node:${node.kind}`, chosen.nodes[node.kind], node.kind),
  }));
  const flows: Flow[] = level.flows.map((flow) => ({
    ...flow,
    name: next(`flow:${flow.profile}`, chosen.flows[flow.profile], flow.profile),
  }));
  return { ...level, nodes, flows };
}
