import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";

const App = lazy(() => import("./App"));
const Methodology = lazy(() => import("./pages/Methodology"));

function RouteLoading() {
  return (
    <div className="min-h-screen bg-brand-900 text-brand-200 flex items-center justify-center text-sm">
      Loading CommunityShield...
    </div>
  );
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/methodology" element={<Methodology />} />
      </Routes>
    </Suspense>
  );
}
