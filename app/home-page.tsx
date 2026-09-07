'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight,
  Boxes,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileClock,
  Package,
  ShieldCheck,
  ShoppingCart,
  TriangleAlert,
  Zap,
} from 'lucide-react';

/* ── Data ───────────────────────────────────────────── */

const FEATURES = [
  {
    icon: Package,
    title: 'Max buildable units',
    description:
      'Pick a product and StockPilot walks its bill of materials against on-hand stock to tell you exactly how many you can build — and which material holds you back.',
  },
  {
    icon: TriangleAlert,
    title: 'Shortage detection',
    description:
      'Sales orders are exploded into material requirements so shortages surface before they delay a shipment — not after the line has already stopped.',
  },
  {
    icon: ShoppingCart,
    title: 'Purchase recommendations',
    description:
      'Automated buy suggestions with supplier ranking tell your purchasing team what to order, how much, and from whom — no spreadsheet archaeology.',
  },
  {
    icon: CalendarClock,
    title: 'Reorder points & run-out dates',
    description:
      'Lead-time demand plus safety stock sets the right buffer, and you see when a material runs out while there is still time to reorder.',
  },
  {
    icon: FileClock,
    title: 'Immutable stock ledger',
    description:
      'Every receipt, issue, and adjustment is recorded on an append-only ledger with concurrency-safe reservations, so two people can never silently disagree.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure by default',
    description:
      'Row-level security keeps every tenant isolated, roles gate every action, passwords are argon2-hashed, and sessions are server-side and revocable.',
  },
];

const ROLES = ['Owners', 'Production Managers', 'Purchasing', 'Warehouse Staff', 'Viewers'];

const STEPS = [
  {
    num: '1',
    title: 'Model your products',
    desc: 'Record products, materials, single-level bills of materials, warehouses, and suppliers — structured the way manufacturing actually works.',
  },
  {
    num: '2',
    title: 'Run the day as usual',
    desc: 'Log sales orders, receipts, and stock movements. StockPilot keeps an immutable ledger of every change, from every member of the team.',
  },
  {
    num: '3',
    title: 'Get the plan',
    desc: 'Max buildable units, shortage flags, buy lists with ranked suppliers, and reorder dates — recalculated as the day happens, fully explainable.',
  },
];

const FAQ = [
  {
    q: 'Is this another AI black box?',
    a: 'No. The core engine is fully deterministic — there is no LLM between your data and your answer. Every recommendation (max buildable, shortage, purchase order) can be traced back to the stock and BOM numbers that produced it.',
  },
  {
    q: 'What happens when two people touch the same stock at the same time?',
    a: 'Stock changes go through an immutable movement ledger, and reservations take row-level locks scoped to a single material and warehouse. Concurrent updates can\u2019t silently overwrite each other, so your counts stay trustworthy.',
  },
  {
    q: 'How is tenant data isolated?',
    a: 'Each company is a tenant. Isolation is enforced at the database layer with PostgreSQL row-level security \u2014 not just in application code \u2014 and every mutation is permission-checked through roles (Owner, Production Manager, Purchasing, Warehouse Staff, Viewer) and written to an append-only audit log.',
  },
  {
    q: 'How do we get started?',
    a: 'Sign up and StockPilot provisions your company with you as its owner. Invite your team, then start modeling products and materials \u2014 you can begin with one product and one warehouse, no big-bang migration required.',
  },
];

/* ── Component ──────────────────────────────────────── */

export function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="flex min-h-full flex-col bg-background text-foreground">
      {/* ── Nav ────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500">
              <Boxes className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">StockPilot</span>
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-muted-foreground text-sm transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#how-it-works" className="text-muted-foreground text-sm transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#faq" className="text-muted-foreground text-sm transition-colors hover:text-foreground">
              FAQ
            </a>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="text-secondary-foreground rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-emerald-600 hover:shadow-md"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-[-100px] left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-emerald-500/5 blur-[120px]" />
        </div>

        <div className="mx-auto max-w-4xl px-4 pt-24 pb-20 text-center sm:px-6 sm:pt-32 sm:pb-28">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <Zap className="h-3.5 w-3.5" />
            Inventory intelligence for small manufacturers
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            Know what you can build,{' '}
            <span className="bg-linear-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">
              what you&apos;re short on,
            </span>{' '}
            and what to buy.
          </h1>

          <p className="text-secondary-foreground mx-auto mt-6 max-w-2xl text-lg leading-relaxed">
            StockPilot turns your products, materials, and bills of materials into an explainable
            production plan — max buildable units, shortage warnings, purchase recommendations, and
            run-out dates. No spreadsheets. No guesswork. No black box.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:bg-emerald-600 hover:shadow-xl active:scale-[0.98]"
            >
              Start free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border bg-card px-6 py-3.5 text-sm font-semibold transition-all duration-200 hover:bg-muted"
            >
              Sign in
            </Link>
          </div>

          <div className="mt-12 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {['No credit card required', 'Deterministic & explainable', 'Tenant-isolated & role-based'].map((t) => (
              <div key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Team strip ─────────────────────────────── */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-6 text-xs font-medium tracking-wide text-muted-foreground sm:px-6">
          <span className="uppercase tracking-widest">Built for the whole team</span>
          {ROLES.map((role) => (
            <span
              key={role}
              className="rounded-full border bg-card px-3 py-1 text-muted-foreground"
            >
              {role}
            </span>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────── */}
      <section id="features" className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">Everything you need to plan production</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              StockPilot models the manufacturing domain directly — and answers your questions
              with calculations you can follow, not a black box.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-xl border bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/30 hover:shadow-lg"
              >
                <div className="mb-4 inline-flex rounded-lg bg-emerald-500/10 p-2.5 transition-colors group-hover:bg-emerald-500/20">
                  <f.icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────── */}
      <section id="how-it-works" className="border-t bg-muted/30 py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">Up and running this week</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Start with one product and one warehouse. No big-bang migration required.
            </p>
          </div>

          <div className="grid gap-10 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.num} className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {s.num}
                </div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────── */}
      <section id="faq" className="py-20 sm:py-28">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">Frequently asked questions</h2>
          </div>

          <div className="space-y-3">
            {FAQ.map((f, i) => (
              <div key={f.q} className="overflow-hidden rounded-xl border bg-card">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium transition-colors hover:bg-muted"
                >
                  {f.q}
                  {openFaq === i ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">{f.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────── */}
      <section className="border-t py-20 sm:py-28">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold sm:text-4xl">See your next shortage before it happens</h2>
          <p className="mt-4 text-muted-foreground">
            The moment two people touch inventory, spreadsheets start silently going wrong.
            Stop planning production from gut feel.
          </p>
          <div className="mt-8">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:bg-emerald-600"
            >
              Start free today
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────── */}
      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-emerald-500" />
            <span className="text-sm text-muted-foreground">StockPilot</span>
          </div>
          <div className="flex gap-6 text-xs text-muted-foreground">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#faq">FAQ</a>
          </div>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} StockPilot. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
