import { Component, type ReactNode } from "react";
import LeafletMap from "./LeafletMap";
import type { City, HeatmapFilters } from "../types";

interface Props {
  filters: HeatmapFilters;
  cities: City[];
  selectedBeat: string | null;
  onSelectBeat: (beatNumber: string | null) => void;
}

// Inner error boundary in case Leaflet also fails — fall through to table view
class LeafletBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: Error) { console.error("[LeafletBoundary]", err); }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}


export default function MapFallback(props: Props) {
  return (
    <LeafletBoundary fallback={<TableFallback />}>
      <LeafletMap {...props} />
    </LeafletBoundary>
  );
}


function TableFallback() {
  return (
    <div className="h-full overflow-y-auto bg-brand-900 text-brand-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-4 mb-6">
          <div className="font-bold text-amber-200 mb-1">
            Map view unavailable
          </div>
          <div className="text-sm text-amber-100/80">
            Both the interactive map renderers failed to load. The data is shown
            below as a sortable table instead.
          </div>
        </div>
        <p className="text-brand-300 text-sm">
          (Reduced view — please try another browser or check console.)
        </p>
      </div>
    </div>
  );
}