import "@testing-library/jest-dom";
import { vi } from "vitest";

// MapLibre needs WebGL; stub it for tests
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// jsdom doesn't implement scrollIntoView
HTMLElement.prototype.scrollIntoView = vi.fn();