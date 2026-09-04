import {
  Boxes,
  Package,
  ShieldCheck,
  ShoppingCart,
  TriangleAlert,
} from 'lucide-react';
import { Reveal } from '@/components/reveal';

const HIGHLIGHTS = [
  {
    icon: Package,
    title: 'Max buildable units',
    description:
      'Every product is exploded through its bill of materials against live stock — you see exactly how many you can ship and what holds you back.',
  },
  {
    icon: TriangleAlert,
    title: 'Shortage detection',
    description:
      'Sales orders become material requirements instantly, so shortages surface while you can still act — not after the line has stopped.',
  },
  {
    icon: ShoppingCart,
    title: 'Purchase recommendations',
    description:
      'Ranked buy suggestions with supplier lead times keep purchasing ahead of the shop floor, not behind it.',
  },
  {
    icon: ShieldCheck,
    title: 'Tenant-safe & role-based',
    description:
      'Postgres row-level security isolates every company; roles, argon2 auth, and a full audit log guard every action.',
  },
];

function BrandMark({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500">
        <Boxes className="h-5 w-5 text-white" />
      </div>
      <span
        className={`text-lg font-bold tracking-tight ${light ? 'text-white' : 'text-foreground'}`}
      >
        StockPilot
      </span>
    </div>
  );
}

export function AuthAbout() {
  return (
    <>
      {/* ── Mobile / narrow: compact brand intro above the card ── */}
      <div className="flex flex-col items-center gap-2 px-6 pt-8 lg:hidden">
        <Reveal>
          <BrandMark />
        </Reveal>
        <Reveal delay={120}>
          <p className="max-w-xs text-center text-sm text-muted-foreground">
            Inventory intelligence for small manufacturers.
          </p>
        </Reveal>
      </div>

      {/* ── Wide screens: full “about the platform” panel ── */}
      <aside className="relative hidden overflow-hidden bg-emerald-950 p-10 text-white lg:flex lg:w-[46%] lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:p-12">
        {/* Decorative texture + glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(rgba(255, 255, 255, 0.09) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-24 h-96 w-96 rounded-full bg-emerald-500/25 blur-[110px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-teal-400/15 blur-[110px]"
        />

        <div className="relative flex flex-1 flex-col">
          <Reveal>
            <BrandMark light />
          </Reveal>

          <div className="mt-10 space-y-4">
            <Reveal delay={100}>
              <h2 className="text-3xl leading-[1.15] font-extrabold tracking-tight xl:text-4xl">
                Know what you can build —{' '}
                <span className="text-emerald-300">before the line stops.</span>
              </h2>
            </Reveal>
            <Reveal delay={180}>
              <p className="max-w-md text-base leading-relaxed text-emerald-100/80">
                StockPilot turns products, materials, and bills of materials into
                an explainable plan — max buildable units, shortage warnings,
                purchase recommendations, and run-out dates. No spreadsheets, no
                guesswork.
              </p>
            </Reveal>
          </div>

          <ul className="mt-8 list-none space-y-4">
            {HIGHLIGHTS.map((h, i) => (
              <li key={h.title}>
                <Reveal delay={260 + i * 110}>
                  <div className="flex items-start gap-4">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                      <h.icon className="h-4.5 w-4.5 text-emerald-300" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">{h.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-emerald-100/70">
                        {h.description}
                      </p>
                    </div>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>

          <Reveal delay={700} className="mt-auto">
            <p className="mt-6 border-t border-white/10 pt-5 text-xs tracking-wide text-emerald-100/60 uppercase">
              Deterministic engine · No LLM in the core · Explainable answers
            </p>
          </Reveal>
        </div>
      </aside>
    </>
  );
}
