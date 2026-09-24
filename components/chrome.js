"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth, useCart } from "@/components/providers";
import { formatPrice } from "@/lib/format";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/galleries", label: "Galleries" },
  { href: "/teams", label: "For Teams" },
  { href: "/quote", label: "Quote" },
  { href: "/contact", label: "Contact" },
];

export const SOCIALS = [
  {
    label: "Instagram",
    handle: "@homickflicks",
    href: "https://instagram.com/homickflicks",
  },
  {
    label: "Snapchat",
    handle: "noah_homick",
    href: "https://snapchat.com/add/noah_homick",
  },
  {
    label: "Email",
    handle: "noah@homick.com",
    href: "mailto:noah@homick.com",
  },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { items, subtotalCents } = useCart();
  const { user, ready, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);

  const isActive = (href) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="site-header">
      <Link href="/" className="brand" aria-label="Homick Flicks — home">
        <img src="/logo-mark.png" alt="Homick Flicks" />
      </Link>

      <nav className={`site-nav ${open ? "is-open" : ""}`}>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={isActive(item.href) ? "is-active" : ""}
            onClick={() => setOpen(false)}
          >
            {item.label}
          </Link>
        ))}
        {isAdmin && (
          <Link
            href="/admin"
            className={isActive("/admin") ? "is-active" : ""}
            onClick={() => setOpen(false)}
          >
            Admin
          </Link>
        )}
      </nav>

      <div className="header-actions">
        <Link
          href="/cart"
          className={`cart-button ${items.length > 0 ? "has-items" : ""}`}
          aria-label={
            items.length > 0
              ? `Cart, ${items.length} photos, ${formatPrice(subtotalCents)}`
              : "Cart"
          }
        >
          <span>Cart</span>
          {items.length > 0 && (
            <>
              <span className="cart-count">{items.length}</span>
              <span className="cart-total-chip">
                {formatPrice(subtotalCents)}
              </span>
            </>
          )}
        </Link>
        {ready &&
          (user ? (
            <Link
              href="/signin"
              className="account-chip"
              title={`Signed in as ${user.email || user.uid}`}
              aria-label={`Account — signed in as ${user.email || user.uid}`}
            >
              {(user.email || "?").charAt(0).toUpperCase()}
            </Link>
          ) : (
            <Link href="/signin" className="signin-link">
              Sign in
            </Link>
          ))}
        <button
          className="nav-toggle"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}

export function SocialRail() {
  return (
    <div className="social-rail">
      {SOCIALS.filter((s) => s.label !== "Email").map((s) => (
        <a key={s.label} href={s.href} target="_blank" rel="noreferrer">
          {s.label}
        </a>
      ))}
    </div>
  );
}

// The big follow block that sits above the footer on buyer-facing pages.
export function SocialBlock() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;

  return (
    <section className="section social-block">
      <div className="wrap">
        <p className="eyebrow">Follow along</p>
        <h2>Game day, every week.</h2>
        <p className="lede">
          Shots go up here first, then to socials. Message me on either if you
          want your game covered.
        </p>
        <div className="social-cards">
          {SOCIALS.map((s) => (
            <a
              key={s.label}
              className="social-card"
              href={s.href}
              target={s.href.startsWith("mailto:") ? undefined : "_blank"}
              rel="noreferrer"
            >
              <span className="eyebrow">{s.label}</span>
              <span className="social-handle">{s.handle}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <p className="footer-mark">Homick Flicks</p>
        <p className="muted">Sports photography — Midland, Ontario</p>
      </div>
      <div className="footer-links">
        <Link href="/galleries">Galleries</Link>
        <Link href="/teams">For Teams</Link>
        <Link href="/contact">Contact</Link>
        {SOCIALS.map((s) => (
          <a
            key={s.label}
            href={s.href}
            target={s.href.startsWith("mailto:") ? undefined : "_blank"}
            rel="noreferrer"
          >
            {s.handle}
          </a>
        ))}
      </div>
      <p className="muted small">
        © {new Date().getFullYear()} Noah Homick. All images protected by
        copyright.
      </p>
    </footer>
  );
}
