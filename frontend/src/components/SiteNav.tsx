"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, ArrowLeftRight, Trophy, User, Menu, X } from "lucide-react";

import { CustomConnectButton } from "@/components/CustomConnectButton";

const TABS = [
  { href: "/vault", label: "Vault", Icon: ShieldCheck },
  { href: "/trade", label: "Venue", Icon: ArrowLeftRight },
  { href: "/leaderboard", label: "Leaderboard", Icon: Trophy },
  { href: "/profile", label: "Profile", Icon: User },
] as const;

/**
 * Responsive primary navigation shared by every page.
 * - ≥ md: the floating pill with inline tabs (+ optional `children`, e.g. price badges).
 * - < md: logo + wallet + a hamburger that discloses the tabs in a dropdown.
 * Keyboard: Escape closes and returns focus to the toggle; focus moves to the
 * first item on open; a click outside closes. Active tab carries aria-current.
 */
export function SiteNav({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname() || "";
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLAnchorElement>(null);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  // Close on navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape to close + click/tap outside to close, only while open.
  useEffect(() => {
    if (!open) return;
    firstItemRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <nav className="levitating-nav" aria-label="Primary">
      <Link
        href="/"
        className="flex items-center gap-2 pl-1.5 pr-1 shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-[var(--color-hz-gold-deep)]"
        aria-label="Private Vault — home"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="" width={28} height={28} className="w-7 h-7" />
        <span className="font-display font-bold tracking-[-0.01em] text-[var(--color-hz-navy)] text-[16px] hidden sm:block">
          Private Vault
        </span>
      </Link>

      <span
        title="Running on Horizen Testnet — test tokens only, no real funds"
        className="shrink-0 text-[10px] font-mono font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-ink-3)]"
      >
        Testnet
      </span>

      {/* Desktop tabs */}
      <div className="hidden md:flex gap-0.5 border-l border-r border-[var(--color-border)] px-2 mx-1">
        {TABS.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-[var(--color-hz-gold-deep)] ${
                active
                  ? "bg-[var(--color-hz-gold)]/20 text-[var(--color-hz-navy)]"
                  : "text-[var(--color-ink-2)] hover:text-[var(--color-hz-navy)]"
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>

      {/* Desktop-only extras (e.g. price badges) */}
      {children ? (
        <div className="hidden md:flex items-center gap-2 border-r border-[var(--color-border)] pr-3 mr-1">
          {children}
        </div>
      ) : null}

      <div className="ml-auto md:ml-0 shrink-0">
        <CustomConnectButton />
      </div>

      {/* Mobile hamburger */}
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="site-nav-mobile"
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        className="md:hidden w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-[var(--color-hz-navy)] hover:bg-[var(--color-surface-2)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-hz-gold-deep)]"
      >
        {open ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
      </button>

      {/* Mobile dropdown */}
      {open ? (
        <div
          ref={panelRef}
          id="site-nav-mobile"
          className="md:hidden absolute top-full right-0 mt-2 w-56 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_12px_34px_-12px_rgba(3,14,36,0.28)] p-1.5 flex flex-col animate-fadeIn"
        >
          {TABS.map(({ href, label, Icon }, i) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                ref={i === 0 ? firstItemRef : undefined}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`px-3 py-3 rounded-xl text-sm font-medium flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-[var(--color-hz-gold-deep)] ${
                  active
                    ? "bg-[var(--color-hz-gold)]/20 text-[var(--color-hz-navy)]"
                    : "text-[var(--color-ink-2)] hover:bg-[var(--color-surface-2)]"
                }`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </nav>
  );
}
