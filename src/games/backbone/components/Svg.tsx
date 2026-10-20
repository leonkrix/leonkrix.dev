import { NODE_ICONS, PROFILE_ICONS, UI_ICONS } from '../data/icons';

type Set = 'node' | 'profile' | 'ui';

const SETS: Readonly<Record<Set, Readonly<Record<string, string>>>> = {
  node: NODE_ICONS,
  profile: PROFILE_ICONS,
  ui: UI_ICONS,
};

interface SvgProps {
  set: Set;
  name: string;
  className?: string;
}

/** A Lucide icon from `data/icons.ts`. Decoration only: the meaning is always in the text next to it. */
export function Svg({ set, name, className = 'bb-icon' }: SvgProps) {
  const markup = SETS[set][name];
  if (markup === undefined) {
    return null;
  }
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
      // The markup is one of the constants of data/icons.ts, never text from outside
      // eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

/** A filled or empty star. */
export function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="bb-star"
      data-filled={filled}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.5l-5.9 3.2 1.2-6.6L2.5 9.5l6.6-.9z" />
    </svg>
  );
}
