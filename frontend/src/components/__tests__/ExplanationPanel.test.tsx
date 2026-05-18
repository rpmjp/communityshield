import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ExplanationPanel from "../ExplanationPanel";

describe("ExplanationPanel", () => {
  const explanation = {
    base_value: -0.5,
    prediction_value: -2.0,
    contributions: [
      { feature: "type_enc", label: "Crime type", value: 31, shap: -1.5 },
      { feature: "location_enc", label: "Location type", value: 28, shap: -0.7 },
      { feature: "hour", label: "Hour of day", value: 22, shap: 0.3 },
    ],
  };

  it("renders the title", () => {
    render(<ExplanationPanel title="Arrest" explanation={explanation} />);
    expect(screen.getByText(/Why\?.*Arrest/i)).toBeInTheDocument();
  });

  it("renders all contributions", () => {
    render(<ExplanationPanel title="Arrest" explanation={explanation} />);
    expect(screen.getByText("Crime type")).toBeInTheDocument();
    expect(screen.getByText("Location type")).toBeInTheDocument();
    expect(screen.getByText("Hour of day")).toBeInTheDocument();
  });

  it("shows SHAP values formatted", () => {
    render(<ExplanationPanel title="Arrest" explanation={explanation} />);
    expect(screen.getByText("-1.50")).toBeInTheDocument();
    expect(screen.getByText("-0.70")).toBeInTheDocument();
    expect(screen.getByText("+0.30")).toBeInTheDocument();
  });
});