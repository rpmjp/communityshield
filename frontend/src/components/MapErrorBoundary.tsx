import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class MapErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    // Expected when WebGL is unavailable — Leaflet fallback handles it.
    // Logged at info level so it doesn't appear as an error in the console.
    if (!String(error.message).includes("WebGL")) {
      console.error("[MapErrorBoundary] Unexpected error:", error);
    } else {
      console.info("[MapErrorBoundary] WebGL unavailable, using Leaflet fallback");
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}