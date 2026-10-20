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
      firewall: ['Firewall', 'Gatekeeper'],
      router: ['Gateway', 'Core', 'Floor 1', 'Floor 2', 'Annex', 'Hub', 'Edge', 'Spare'],
      switch: ['Switch A', 'Switch B', 'Switch C', 'Switch D'],
      server: ['File server', 'Mail server'],
      client: ['Reception', 'Sales', 'Design', 'Support', 'Kitchen', 'Meeting room', 'Print room'],
    },
    flows: {
      voice: ['Phone calls', 'Conference call', 'Desk phones', 'Reception line', 'Call centre'],
      control: ['Door locks', 'Fire alarm', 'Badge readers', 'Lift control', 'Heating control'],
      transaction: ['Invoices', 'Payroll', 'Order system', 'Expense claims', 'Bank transfers'],
      video: ['Video meeting', 'Training video', 'Demo stream', 'Team stand-up', 'Webinar'],
      web: ['Web browsing', 'Cloud documents', 'Mail', 'Wiki', 'Calendar'],
      bulk: ['Nightly backup', 'Software updates', 'Photo archive', 'Archive sync', 'Scan uploads'],
    },
  },
  hospital: {
    id: 'hospital',
    name: 'Hospital',
    nodes: {
      firewall: ['Patient firewall', 'Gatekeeper'],
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
      voice: ['Nurse call', 'Telemedicine call', 'Paging', 'Ward intercom', 'Ambulance radio'],
      control: ['Patient monitors', 'Infusion pumps', 'Ventilators', 'Oxygen supply', 'Bed alarms'],
      transaction: [
        'Prescriptions',
        'Patient records',
        'Billing',
        'Insurance claims',
        'Pharmacy orders',
      ],
      video: [
        'Remote consultation',
        'Surgery camera',
        'Training stream',
        'Ward round stream',
        'Lecture hall feed',
      ],
      web: ['Staff intranet', 'Lab results', 'Appointments', 'Visitor portal', 'Rota planner'],
      bulk: [
        'Scan archive',
        'Record backup',
        'Software updates',
        'Image archive',
        'Research export',
      ],
    },
  },
  campus: {
    id: 'campus',
    name: 'University campus',
    nodes: {
      firewall: ['Campus firewall', 'Gatekeeper'],
      router: ['Core', 'Library', 'Science', 'Arts', 'Gate', 'Annex', 'Edge', 'Spare'],
      switch: ['Hall A', 'Hall B', 'Hall C', 'Hall D'],
      server: ['Course portal', 'Research store'],
      client: ['Dorm 1', 'Dorm 2', 'Lecture hall', 'Canteen', 'Lab', 'Sports hall', 'Cafe'],
    },
    flows: {
      voice: ['Campus phones', 'Helpdesk calls', 'Emergency line', 'Security calls', 'Dorm phones'],
      control: [
        'Door access',
        'Lab sensors',
        'Fire alarm',
        'Lecture hall locks',
        'Climate control',
      ],
      transaction: ['Exam submissions', 'Grades', 'Payments', 'Course fees', 'Canteen cards'],
      video: [
        'Lecture stream',
        'Seminar call',
        'Open day video',
        'Graduation stream',
        'Lab camera',
      ],
      web: ['Course portal', 'Library search', 'Student mail', 'Timetable', 'Alumni site'],
      bulk: ['Research data', 'Backups', 'Software mirror', 'Thesis archive', 'Dataset copies'],
    },
  },
  festival: {
    id: 'festival',
    name: 'Music festival',
    nodes: {
      firewall: ['Gate firewall', 'Gatekeeper'],
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
      voice: [
        'Crew radio',
        'Stage manager calls',
        'Security calls',
        'Medic calls',
        'Parking radio',
      ],
      control: [
        'Stage lights',
        'Emergency lights',
        'Gate barriers',
        'Fence alarms',
        'Stage hydraulics',
      ],
      transaction: ['Ticket scans', 'Card payments', 'Merch till', 'Bar tabs', 'Wristband top-ups'],
      video: ['Live stream', 'Big screen feed', 'Camera feed', 'Artist cam', 'Sponsor wall'],
      web: ['Festival app', 'Social wall', 'Schedule page', 'Line-up page', 'Ticket shop'],
      bulk: ['Photo uploads', 'Recording archive', 'Sales report', 'Crowd counts', 'Press photos'],
    },
  },
  datacentre: {
    id: 'datacentre',
    name: 'Data centre',
    nodes: {
      firewall: ['Edge firewall', 'Gatekeeper'],
      router: ['Spine 1', 'Spine 2', 'Leaf 1', 'Leaf 2', 'Leaf 3', 'Border', 'Edge', 'Spare'],
      switch: ['Rack A', 'Rack B', 'Rack C', 'Rack D'],
      server: ['Database', 'Storage'],
      client: ['Web tier', 'App tier', 'Batch', 'Cache', 'Queue', 'Monitor', 'Build farm'],
    },
    flows: {
      voice: ['Ops bridge', 'On-call calls', 'Alert pager', 'Incident bridge', 'Vendor calls'],
      control: [
        'Cluster heartbeat',
        'Orchestrator',
        'Failover signal',
        'Cooling loop',
        'Power failover',
      ],
      transaction: ['Payments API', 'Database writes', 'Ledger', 'Order queue', 'Audit trail'],
      video: [
        'Streaming service',
        'Video encode',
        'Live events',
        'Customer demo',
        'All-hands stream',
      ],
      web: ['Web requests', 'API calls', 'Search', 'Dashboard', 'Docs site'],
      bulk: [
        'Nightly backup',
        'Log shipping',
        'Model training data',
        'Cold storage copy',
        'Snapshot export',
      ],
    },
  },
  drones: {
    id: 'drones',
    name: 'Drone swarm',
    nodes: {
      firewall: ['Ground filter', 'Gatekeeper'],
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
      voice: ['Pilot voice', 'Crew radio', 'Relay chatter', 'Ground crew radio', 'Medevac call'],
      control: [
        'Flight commands',
        'Collision alerts',
        'Return-home signal',
        'Gimbal control',
        'Landing beacon',
      ],
      transaction: [
        'Mission log',
        'Waypoint update',
        'Target report',
        'Inventory scan',
        'Fuel report',
      ],
      video: [
        'Camera feed',
        'Thermal feed',
        'Mapping stream',
        'Night vision feed',
        'Survey stream',
      ],
      web: ['Map tiles', 'Weather data', 'Status page', 'Terrain data', 'Fleet portal'],
      bulk: ['Sensor dump', 'Flight logs', 'Firmware update', 'Photo mosaic', 'Black box data'],
    },
  },
  provider: {
    id: 'provider',
    name: 'Regional provider',
    nodes: {
      firewall: ['Border firewall', 'Gatekeeper'],
      router: ['Core 1', 'Core 2', 'Metro N', 'Metro S', 'Metro E', 'Metro W', 'Peering', 'Spare'],
      switch: ['Agg A', 'Agg B', 'Agg C', 'Agg D'],
      server: ['Peering point', 'Content cache'],
      client: ['Town A', 'Town B', 'Town C', 'Village', 'Business park', 'Campus', 'Harbour'],
    },
    flows: {
      voice: [
        'Phone service',
        'Emergency calls',
        'Business lines',
        'Voicemail',
        'Conference bridge',
      ],
      control: [
        'Signalling',
        'Grid telemetry',
        'Alarm service',
        'Cell tower control',
        'Switch config',
      ],
      transaction: [
        'Bank links',
        'Card network',
        'Stock feed',
        'Roaming billing',
        'Payment gateway',
      ],
      video: ['TV service', 'Video on demand', 'Live sports', 'News channel', 'Pay-per-view'],
      web: ['Home internet', 'Cloud access', 'Mail service', 'Customer portal', 'Status page'],
      bulk: ['Mirror sync', 'Backups', 'Software distribution', 'Content delivery', 'Log archive'],
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
