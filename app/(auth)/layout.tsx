// Shared shell for /login and /signup: an "about the platform" brand panel on
// the left (with staggered fade/slide reveals) and the form column on the
// right. The panel compresses to a compact intro header on small screens.
//
// Scroll policy: the shell is locked to the viewport on desktop (lg:h-dvh +
// overflow-hidden), so the window never scrolls on auth screens. Any overflow
// scrolls inside the panel / form columns themselves. Entrance animations play
// on mount only — never scroll-triggered (see components/reveal.tsx).
import { AuthAbout } from '@/components/auth-about';
import { Reveal } from '@/components/reveal';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col lg:h-dvh lg:flex-row lg:overflow-hidden">
      <AuthAbout />

      {/* Form column — fades in a beat after the panel starts its reveal. */}
      <Reveal delay={300} slide={false} className="flex min-h-full flex-1 flex-col lg:min-h-0">
        {children}
      </Reveal>
    </div>
  );
}
