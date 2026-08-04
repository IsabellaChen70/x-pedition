// Registers the jest-dom matchers (toBeInTheDocument, toHaveAttribute, ...) with
// Vitest's expect. Loaded via `setupFiles` in vite.config.ts. The existing
// node-environment unit tests load this too; jest-dom only extends `expect` at
// import time, so it stays inert until a DOM assertion actually runs.
import '@testing-library/jest-dom/vitest';
