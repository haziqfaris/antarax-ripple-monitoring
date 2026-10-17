"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export interface NavItem { href: string; label: string; count?: number; loud?: boolean }
export interface NavGroup { title: string; items: NavItem[] }

/** The sidebar and the page. On phones the sidebar is a drawer, opened by the top bar's menu button. */
export function ShellFrame(p: { children: React.ReactNode; side: React.ReactNode; foot: React.ReactNode; groups: NavGroup[] }) {
  const path = usePathname();
  const toggle = useRef<HTMLInputElement>(null);
  useEffect(() => { if (toggle.current) toggle.current.checked = false; }, [path]);
  return (
    <>
      <input ref={toggle} type="checkbox" id="menu-toggle" className="menu-toggle sr-only" aria-hidden="true" tabIndex={-1} />
      <div className="shell">
        <aside className="side" aria-label="Menu">
          {p.side}
          <nav className="only" aria-label="Outcomes only">
            <span className="only-head">Outcomes only</span>
            {p.groups.map((g) => (
              <div key={g.title} role="group" aria-label={g.title}>
                <span className="group-h">{g.title}</span>
                {g.items.map((i) => {
                  const on = path === i.href || path.startsWith(i.href + "/");
                  return (
                    <Link key={i.href} href={i.href} className="nav-item" aria-current={on ? "page" : undefined}>
                      <span className="lbl">{i.label}</span>
                      {i.count ? <span className={`count${i.loud ? " loud" : ""}`} aria-label={`${i.count} ${i.loud ? "need a person" : "in total"}`}>{i.count}</span> : null}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          {p.foot}
        </aside>
        <div className="main">{p.children}</div>
      </div>
    </>
  );
}
