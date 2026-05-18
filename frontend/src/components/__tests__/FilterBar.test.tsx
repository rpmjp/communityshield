import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import FilterBar from "../FilterBar";
import type { HeatmapFilters } from "../../types";

const filters: HeatmapFilters = {
  city_slug: "chicago",
  year: 2024,
  hour_min: 0,
  hour_max: 23,
  primary_type: null,
};

describe("FilterBar", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([
        { primary_type: "THEFT", incident_count: 100 },
      ]),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls onReset when reset is clicked", async () => {
    const onChange = vi.fn();
    const onReset = vi.fn();

    render(
      <FilterBar
        filters={filters}
        cities={[{
          slug: "chicago",
          name: "Chicago",
          beat_count: 274,
          bounds: { min_lat: 41, max_lat: 42, min_lng: -88, max_lng: -87 },
          center: { lat: 41.8, lng: -87.6 },
        }]}
        onChange={onChange}
        onReset={onReset}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /reset/i }));

    expect(onReset).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText("THEFT")).toBeInTheDocument());
  });
});
