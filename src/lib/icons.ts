/** Minimal shape of an Iconify JSON icon set (e.g. @iconify-json/lucide). */
export interface IconData {
  body: string;
  width?: number;
  height?: number;
}

export interface IconAlias extends Partial<IconData> {
  parent: string;
}

export interface IconSet {
  icons: Record<string, IconData>;
  aliases?: Record<string, IconAlias>;
  width?: number;
  height?: number;
}

export interface ResolvedIcon {
  body: string;
  width: number;
  height: number;
}

const DEFAULT_SIZE = 16;

/**
 * Looks up an icon like "lucide:arrow-up-right" in the given icon sets.
 * Throws for unknown icons so a typo fails the build instead of rendering nothing.
 */
export function resolveIcon(sets: Record<string, IconSet>, name: string): ResolvedIcon {
  const [prefix, iconName] = name.split(':');
  const set = prefix === undefined ? undefined : sets[prefix];

  if (set === undefined || iconName === undefined) {
    throw new Error(`Unknown icon "${name}": expected "<set>:<name>" with a known set.`);
  }

  const alias = set.aliases?.[iconName];
  const data = set.icons[alias?.parent ?? iconName];

  if (data === undefined) {
    throw new Error(`Unknown icon "${name}".`);
  }

  return {
    body: data.body,
    width: alias?.width ?? data.width ?? set.width ?? DEFAULT_SIZE,
    height: alias?.height ?? data.height ?? set.height ?? DEFAULT_SIZE,
  };
}
