/** A small picture for each look of the game (simple line drawings in the style of the site's icons) */
export function SkinIcon({ skin }: { skin: 'case-file' | 'outage' }) {
  return (
    <svg viewBox="0 0 24 24" className="rc-skin-icon" aria-hidden="true" focusable="false">
      {skin === 'case-file' ? (
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </>
      ) : (
        <>
          <rect x="3" y="3" width="18" height="7" rx="2" />
          <rect x="3" y="14" width="18" height="7" rx="2" />
          <path d="M7 6.5h.01M7 17.5h.01" />
        </>
      )}
    </svg>
  );
}
