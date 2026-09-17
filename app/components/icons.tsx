// Tratti condivisi fra sidebar, knowledge base e pannelli: stessa icona per
// la stessa azione, ovunque compaia.
export const ICONS = {
  dashboard: "M3 10.2 12 3l9 7.2V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.8Z",
  chat: "M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12Z",
  book: "M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5A2.5 2.5 0 0 0 4 20.5v-16ZM4 20.5A2.5 2.5 0 0 1 6.5 18H20v4H6.5A2.5 2.5 0 0 1 4 20.5Z",
  plus: "M12 5v14M5 12h14",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6L6 18",
  pencil: "M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z",
  trash: "M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13",
  sun: "M12 4V2m0 20v-2m8-8h2M2 12h2m13.7-5.7 1.4-1.4M4.9 19.1l1.4-1.4m0-11.4L4.9 4.9m14.2 14.2-1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  moon: "M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z",
  gauge: "M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm1.5-3.5L17 7M4.5 18a9 9 0 1 1 15 0",
} as const;

export function Icon({ path, size = 17 }: { path: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

/** Matita ed eliminazione in coda a una riga, sempre visibili. */
export function RowActions({
  onRename,
  onDelete,
  renameLabel,
  deleteLabel,
}: {
  onRename?: () => void;
  onDelete: () => void;
  renameLabel: string;
  deleteLabel: string;
}) {
  return (
    <span className="flex shrink-0 items-center gap-0.5">
      {onRename && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRename();
          }}
          className="rounded p-1 text-muted transition-colors hover:text-ink"
          title={renameLabel}
          aria-label={renameLabel}
        >
          <Icon path={ICONS.pencil} size={13} />
        </button>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="rounded p-1 text-muted transition-colors hover:text-red-400"
        title={deleteLabel}
        aria-label={deleteLabel}
      >
        <Icon path={ICONS.trash} size={13} />
      </button>
    </span>
  );
}
