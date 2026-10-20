import type { SettingId } from './settings';

/** The names of the settings, apart from the long lists of names in `settings.ts` */
export const settingNames: Readonly<Record<SettingId, string>> = {
  office: 'Small office',
  hospital: 'Hospital',
  campus: 'University campus',
  festival: 'Music festival',
  datacentre: 'Data centre',
  drones: 'Drone swarm',
  provider: 'Regional provider',
};
