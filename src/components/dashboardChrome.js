"use client";

import Link from "next/link";
import { Logo, LogoMark } from "@/components/Logo";
import { StarOrnamentIcon, AlertIcon, LogOutIcon } from "@/components/icons";

// The frame the dashboards sit in.
//
// /admin and /couple grew their own headers and login screens independently,
// so the same two things looked different depending on which door you came
// through — and neither carried the mark. Both now share these, which is also
// what keeps them matching the public site rather than drifting from it.

/**
 * The gate. Renders whatever fields the page passes as children, so the admin's
 * single password and the couple's username-and-password use one screen.
 */
export function LoginScreen({ title, hint, error, loading, onSubmit, submitLabel, children }) {
  return (
    <main className="min-h-screen flex flex-col" style={{ background: "var(--paper)" }}>
      <DashboardHeader />

      <div className="flex-1 flex items-center justify-center p-5">
        <form
          onSubmit={onSubmit}
          className="card-ornate w-full max-w-sm p-8 flex flex-col gap-4 text-center da3wa-fade-in"
        >
          <div className="ornament-divider" aria-hidden="true">
            <StarOrnamentIcon size={14} />
          </div>

          <h1 className="title-lg" style={{ color: "var(--gold-600)" }}>{title}</h1>
          {hint && <p className="meta">{hint}</p>}

          {children}

          {error && (
            <p className="error flex items-center justify-center gap-2" role="alert">
              <AlertIcon size={16} />
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="pill-btn w-full">
            {loading ? "جارٍ الدخول..." : submitLabel || "تسجيل الدخول"}
          </button>
        </form>
      </div>
    </main>
  );
}

/**
 * The bar across the top of every dashboard screen. `onLogout` turns the
 * sign-out button on; without it this is just the mark, which is what the
 * login screens want.
 */
export function DashboardHeader({ title, subtitle, onLogout }) {
  return (
    <header className="site-header">
      <div
        className="wrap flex items-center justify-between gap-4 flex-wrap"
        style={{ padding: "0.7rem 1.25rem" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" aria-label="دعوة" style={{ color: "var(--gold-300)" }}>
            {title ? <LogoMark size={32} /> : <Logo size={32} />}
          </Link>
          {title && (
            <div className="min-w-0">
              <h1
                className="truncate"
                style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "#f4ede0" }}
              >
                {title}
              </h1>
              {subtitle && (
                <p className="truncate" style={{ fontSize: "var(--text-xs)", color: "rgba(244,237,224,0.6)" }}>
                  {subtitle}
                </p>
              )}
            </div>
          )}
        </div>

        {onLogout && (
          <button onClick={onLogout} className="pill-btn-ghost pill-btn-sm" style={{ color: "rgba(244,237,224,0.75)" }}>
            <LogOutIcon size={15} />
            خروج
          </button>
        )}
      </div>
    </header>
  );
}
