'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Fades + slides its children in shortly after mount.
 * Used to stagger page entrances (hero blocks, auth panels) so screens feel
 * polished without motion that depends on the user scrolling.
 *
 * Deliberately NOT scroll-triggered: scroll-linked reveals make pages feel
 * jumpy (content pops in mid-scroll, scrollbars appear as blocks reveal), so
 * this component plays once on load. If a future page really needs content to
 * animate as it enters the viewport, build that separately — don't change the
 * default here.
 *
 * - Animates via CSS transitions (opacity + translate-y), delayed by `delay` ms.
 * - Honors `prefers-reduced-motion`: transitions are scoped to `motion-safe:`
 *   and the reveal is applied immediately.
 */
export function Reveal({
  children,
  delay = 0,
  className = '',
  slide = true,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  slide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Apply the reveal on the next frame so the initial paint happens first
    // and the fade/slide-in is actually visible. Reduced-motion users see the
    // same instant reveal, just without a transition (motion-safe: below).
    const id = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const hidden = slide ? 'translate-y-5 opacity-0' : 'opacity-0';

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`${
        shown ? 'translate-y-0 opacity-100' : hidden
      } motion-safe:transition-all motion-safe:duration-700 motion-safe:ease-out ${className}`}
    >
      {children}
    </div>
  );
}
