"use client";

import { useEffect, useRef, useState } from "react";
import { Logo, Wordmark } from "./Logo";
import { READING_SPEEDS, SpeedId } from "./StreamedText";

export type NavKey = "dashboard" | "conversazioni" | "kb";

export type ArchiveEntry = {
  id: string;
  kind: string;
  title: string | null;
  updatedAt: string;
};

const ICONS = {
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

function Icon({ path, size = 17 }: { path: string; size?: number }) {
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

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "adesso";
  if (min < 60) return `${min} min fa`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ${h === 1 ? "ora" : "ore"} fa`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} ${d === 1 ? "giorno" : "giorni"} fa`;
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    if (current === "light" || current === "dark") setTheme(current);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("vantage-theme", next);
    } catch {
      // storage non disponibile (private mode): il tema resta valido per la sessione.
    }
  }

  return { theme, toggle };
}

function SpeedControl({ speed, onChange }: { speed: SpeedId; onChange: (s: SpeedId) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="v-btn !px-2.5"
        title="Velocità di scrittura delle risposte"
        aria-label="Velocità di scrittura delle risposte"
        aria-expanded={open}
      >
        <Icon path={ICONS.gauge} size={15} />
      </button>
      {open && (
        <div className="v-panel animate-scale-in absolute top-full right-0 z-50 mt-2 w-60 rounded-xl p-1.5 shadow-2xl">
          <p className="px-2.5 pt-1.5 pb-2 text-[0.7rem] tracking-wide text-muted uppercase">
            Velocità di scrittura
          </p>
          {READING_SPEEDS.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                onChange(s.id);
                setOpen(false);
              }}
              className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                speed === s.id ? "bg-surface-hover" : "hover:bg-surface"
              }`}
            >
              <span className={`mt-1 text-[0.6rem] ${speed === s.id ? "text-gold" : "text-transparent"}`}>
                ◆
              </span>
              <span>
                <span className="block text-[0.82rem]">{s.label}</span>
                <span className="block text-[0.7rem] text-muted">{s.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
        active
          ? "bg-[color-mix(in_srgb,var(--brand-bright)_16%,transparent)] font-medium text-ink"
          : "text-muted hover:bg-surface hover:text-ink"
      }`}
    >
      <span className={active ? "text-brand-bright" : ""}>
        <Icon path={icon} />
      </span>
      {label}
    </button>
  );
}

export function ConversationRow({
  entry,
  onSelect,
  onRename,
  onDelete,
}: {
  entry: ArchiveEntry;
  onSelect: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.title ?? "");

  function commit() {
    const next = draft.trim();
    if (next && next !== entry.title) onRename(next);
    setEditing(false);
  }

  if (editing) {
    return (
      <li className="py-1">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="v-input !py-1.5 !text-[0.8rem]"
          aria-label="Nuovo nome della conversazione"
        />
      </li>
    );
  }

  return (
    <li className="group flex items-center gap-1 rounded-lg pr-1 transition-colors hover:bg-surface">
      <button onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2.5 py-2 text-left">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-muted">
          <Icon path={entry.kind === "explore" ? ICONS.sun : ICONS.chat} size={13} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.82rem] text-ink">{entry.title || "Senza titolo"}</span>
          <span className="block text-[0.7rem] text-muted">{relativeTime(entry.updatedAt)}</span>
        </span>
      </button>
      {/* Sempre visibili: nascoste dietro l'hover non le trovava nessuno. */}
      <span className="flex shrink-0 items-center gap-0.5">
        <button
          onClick={() => {
            setDraft(entry.title ?? "");
            setEditing(true);
          }}
          className="rounded p-1 text-muted transition-colors hover:text-ink"
          title="Rinomina"
          aria-label="Rinomina la conversazione"
        >
          <Icon path={ICONS.pencil} size={13} />
        </button>
        <button
          onClick={onDelete}
          className="rounded p-1 text-muted transition-colors hover:text-red-400"
          title="Elimina"
          aria-label="Elimina la conversazione"
        >
          <Icon path={ICONS.trash} size={13} />
        </button>
      </span>
    </li>
  );
}

function SidebarContent({
  nav,
  onNav,
  conversations,
  kbDomains,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
}: {
  nav: NavKey;
  onNav: (k: NavKey) => void;
  conversations: ArchiveEntry[];
  kbDomains: string[];
  onSelectConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  onDeleteConversation: (id: string) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between px-5 py-5">
        <Wordmark size={28} />
        <span className="text-gold" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 32 32" fill="currentColor">
            <path d="M16 6q1.4 5.4 10 7-8.6 1.6-10 7-1.4-5.4-10-7 8.6-1.6 10-7Z" />
          </svg>
        </span>
      </div>

      <nav className="flex flex-col gap-1 px-3">
        <NavItem
          icon={ICONS.dashboard}
          label="Dashboard"
          active={nav === "dashboard"}
          onClick={() => onNav("dashboard")}
        />
        <NavItem
          icon={ICONS.chat}
          label="Conversazioni"
          active={nav === "conversazioni"}
          onClick={() => onNav("conversazioni")}
        />
        <NavItem
          icon={ICONS.book}
          label="Knowledge Base"
          active={nav === "kb"}
          onClick={() => onNav("kb")}
        />
      </nav>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        <h2 className="font-display text-[0.8rem] font-semibold tracking-wide">Conversazioni Recenti</h2>
        <ul className="mt-2.5 flex flex-col gap-0.5">
          {conversations.length === 0 && (
            <li className="py-1.5 text-xs text-muted">Nessuna conversazione salvata.</li>
          )}
          {conversations.slice(0, 8).map((c) => (
            <ConversationRow
              key={c.id}
              entry={c}
              onSelect={() => onSelectConversation(c.id)}
              onRename={(title) => onRenameConversation(c.id, title)}
              onDelete={() => onDeleteConversation(c.id)}
            />
          ))}
        </ul>

        <h2 className="mt-6 font-display text-[0.8rem] font-semibold tracking-wide">Knowledge Base</h2>
        <ul className="mt-2.5 flex flex-col gap-0.5">
          {kbDomains.length === 0 && <li className="py-1.5 text-xs text-muted">Nessun ambito ancora.</li>}
          {kbDomains.slice(0, 6).map((d) => (
            <li key={d} className="flex items-center gap-2.5 py-1.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-line text-muted">
                <Icon path={ICONS.book} size={13} />
              </span>
              <span className="truncate text-[0.82rem] text-muted">{d}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export function AppShell({
  nav,
  onNav,
  conversations,
  kbDomains,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
  onNewConversation,
  speed,
  onSpeedChange,
  children,
}: {
  nav: NavKey;
  onNav: (k: NavKey) => void;
  conversations: ArchiveEntry[];
  kbDomains: string[];
  onSelectConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  onDeleteConversation: (id: string) => void;
  onNewConversation: () => void;
  speed: SpeedId;
  onSpeedChange: (s: SpeedId) => void;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { theme, toggle } = useTheme();

  function navAndClose(k: NavKey) {
    onNav(k);
    setDrawerOpen(false);
  }

  function selectAndClose(id: string) {
    onSelectConversation(id);
    setDrawerOpen(false);
  }

  return (
    <div className="app-root flex h-dvh overflow-hidden">
      <aside className="v-panel hidden w-[268px] shrink-0 flex-col border-y-0 border-l-0 lg:flex">
        <SidebarContent
          nav={nav}
          onNav={onNav}
          conversations={conversations}
          kbDomains={kbDomains}
          onSelectConversation={onSelectConversation}
          onRenameConversation={onRenameConversation}
          onDeleteConversation={onDeleteConversation}
        />
      </aside>

      {drawerOpen && (
        <div
          className="animate-fade-in fixed inset-0 z-50 bg-black/55 backdrop-blur-sm lg:hidden"
          onClick={() => setDrawerOpen(false)}
        >
          <aside
            className="v-panel animate-slide-in-left flex h-full w-[280px] max-w-[85vw] flex-col border-y-0 border-l-0"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarContent
              nav={nav}
              onNav={navAndClose}
              conversations={conversations}
              kbDomains={kbDomains}
              onSelectConversation={selectAndClose}
              onRenameConversation={onRenameConversation}
              onDeleteConversation={onDeleteConversation}
            />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line px-4 sm:px-6">
          <button
            onClick={() => setDrawerOpen(true)}
            className="text-muted transition-colors hover:text-ink lg:hidden"
            aria-label="Apri il menu"
          >
            <Icon path={ICONS.menu} size={22} />
          </button>

          <span className="flex items-center gap-2 lg:hidden">
            <Logo size={24} />
            <span className="font-display text-base font-bold tracking-tight">Vantage</span>
          </span>

          <div className="ml-auto flex items-center gap-2">
            <button onClick={onNewConversation} className="v-btn" title="Avvia una nuova analisi">
              <Icon path={ICONS.plus} size={15} />
              <span className="hidden sm:inline">Nuova analisi</span>
            </button>
            <SpeedControl speed={speed} onChange={onSpeedChange} />
            <button
              onClick={toggle}
              className="v-btn !px-2.5"
              title={theme === "dark" ? "Passa al tema chiaro" : "Passa al tema scuro"}
              aria-label={theme === "dark" ? "Passa al tema chiaro" : "Passa al tema scuro"}
            >
              <Icon path={theme === "dark" ? ICONS.sun : ICONS.moon} size={15} />
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
