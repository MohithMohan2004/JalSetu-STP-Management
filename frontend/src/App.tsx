import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { SessionProvider } from "./lib/session";
import { ToastProvider } from "./lib/toast";
import Landing from "./pages/Landing";

// Role dashboards load on demand so the landing page stays light.
const Demand = lazy(() => import("./pages/Demand"));
const Supply = lazy(() => import("./pages/Supply"));
const Tanker = lazy(() => import("./pages/Tanker"));
const Profile = lazy(() => import("./pages/Profile"));
const FleetReports = lazy(() => import("./pages/FleetReports"));
const StpRegister = lazy(() => import("./pages/register/StpRegister"));
const TankerChoice = lazy(() => import("./pages/register/TankerChoice"));
const TankerForm = lazy(() => import("./pages/register/TankerForm"));

function PageFallback() {
  return <div className="page-loading" aria-busy="true" />;
}

function NotFound() {
  // Anything else is a Flask page; let the server handle it.
  window.location.replace(window.location.href);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <ToastProvider>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/demand" element={<Demand />} />
              <Route path="/supply" element={<Supply />} />
              <Route path="/tanker" element={<Tanker />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/tanker/reports" element={<FleetReports />} />
              <Route path="/stp/register" element={<StpRegister />} />
              <Route path="/tanker/register" element={<TankerChoice />} />
              <Route path="/tanker/register/independent" element={<TankerForm key="independent" variant="independent" />} />
              <Route path="/tanker/register/contracted" element={<TankerForm key="contracted" variant="contracted" />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </SessionProvider>
    </BrowserRouter>
  );
}
