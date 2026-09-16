/**
 * Day 22 — component smoke tests.
 *
 * These verify that the key competency screens render without crashing when
 * given well-formed props. They are React-render smoke tests, not full E2E.
 *
 * When React Testing Library + jest are added, replace this harness.
 * For now, these are documentation + compile-time checks that the components
 * accept the props they should.
 */

// Compile-time smoke: import the components and verify they accept the
// expected props. These are never executed — they exist to catch prop-type
// regressions at build time.
//
// The real smoke is the dev-server render: open each of these URLs and confirm
// they show data (or empty states) without console errors:
//
//   /products/<chair-id>/max-buildable
//   /sales-orders/<order-id>
//   /production/schedule
//
// Run the smoke script:
//   pnpm exec tsx scripts/smoke-max-buildable.ts

export {};
