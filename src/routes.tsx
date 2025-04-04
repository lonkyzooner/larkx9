import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

// Loading component
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#003087]"></div>
  </div>
);

// Lazy load components
const LarkChat = lazy(() => import('./components/LarkChat'));
const MirandaRights = lazy(() => import('./components/MirandaRights'));
const RSCodes = lazy(() => import('./components/RSCodes'));
const ThreatDetection = lazy(() => import('./components/ThreatDetection'));
const Tools = lazy(() => import('./components/Tools'));
const Settings = lazy(() => import('./components/Settings'));

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<LarkChat />} />
          <Route path="/miranda" element={<MirandaRights />} />
          <Route path="/statutes" element={<RSCodes />} />
          <Route path="/threats" element={<ThreatDetection />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default AppRoutes;
