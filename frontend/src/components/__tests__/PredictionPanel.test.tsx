import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PredictionPanel from "../PredictionPanel";

// Mock the API call
vi.mock("../../api/predict", () => ({
  predictAll: vi.fn(),
}));

import { predictAll } from "../../api/predict";

describe("PredictionPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the form with default values", () => {
    render(<PredictionPanel />);
    expect(screen.getByText(/Beat Risk Prediction/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Run prediction/i })).toBeInTheDocument();
  });

  it("shows empty state before running prediction", () => {
    render(<PredictionPanel />);
    expect(screen.getByText(/Set the visible model features/i)).toBeInTheDocument();
  });

  it("seeds form from initial prop", () => {
    render(
      <PredictionPanel
        initial={{
          beat_num: 1234,
          district: "12",
          latitude: 41.9,
          longitude: -87.6,
          primary_type: "BATTERY",
        }}
      />
    );
    expect(screen.getByDisplayValue("1234")).toBeInTheDocument();
    expect(screen.getByDisplayValue("12")).toBeInTheDocument();
  });

  it("calls predictAll and shows results when button clicked", async () => {
    const mockResult = {
      arrest: { model: "arrest", probability: 0.42, prediction: 0, threshold: 0.5 },
      domestic: { model: "domestic", probability: 0.18, prediction: 0, threshold: 0.5 },
      property_binary: {
        model: "property_binary", probability: 0.67, prediction: 1, threshold: 0.5,
      },
      crime_type: {
        top_k: [
          { class: "THEFT", probability: 0.35 },
          { class: "BATTERY", probability: 0.20 },
        ],
      },
    };
    vi.mocked(predictAll).mockResolvedValue(mockResult as never);

    render(<PredictionPanel />);
    fireEvent.click(screen.getByRole("button", { name: /Run prediction/i }));
    await waitFor(() => {
      expect(predictAll).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByText(/42.0%/)).toBeInTheDocument();
    });
  });

  it("clears stale result when input changes", async () => {
    const mockResult = {
      arrest: { model: "arrest", probability: 0.42, prediction: 0, threshold: 0.5 },
      domestic: { model: "domestic", probability: 0.18, prediction: 0, threshold: 0.5 },
      property_binary: {
        model: "property_binary", probability: 0.67, prediction: 1, threshold: 0.5,
      },
      crime_type: { top_k: [] },
    };
    vi.mocked(predictAll).mockResolvedValue(mockResult as never);

    render(<PredictionPanel />);
    fireEvent.click(screen.getByRole("button", { name: /Run prediction/i }));
    await waitFor(() => expect(screen.getByText(/42.0%/)).toBeInTheDocument());

    // Change hour input
    const hourInput = screen.getByDisplayValue("22");
    fireEvent.change(hourInput, { target: { value: "10" } });

    // Stale result should be cleared
    expect(screen.queryByText(/42.0%/)).not.toBeInTheDocument();
    expect(screen.getByText(/Set the visible model features/i)).toBeInTheDocument();
  });

  it("validates feature inputs before calling the API", () => {
    render(<PredictionPanel />);
    const hourInput = screen.getByDisplayValue("22");
    fireEvent.change(hourInput, { target: { value: "30" } });

    fireEvent.click(screen.getByRole("button", { name: /Run prediction/i }));

    expect(screen.getByText(/Hour must be a whole number/i)).toBeInTheDocument();
    expect(predictAll).not.toHaveBeenCalled();
  });
});
