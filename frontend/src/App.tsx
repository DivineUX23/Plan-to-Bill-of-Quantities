import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProjectsPage } from './pages/ProjectsPage';
import { TakeoffPage } from './pages/TakeoffPage';
import { TakeoffSummaryPage } from './pages/TakeoffSummaryPage';
import { BoqPage } from './pages/BoqPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<TakeoffPage />} />
        <Route path="/projects/:projectId/takeoff-sheet" element={<TakeoffSummaryPage />} />
        <Route path="/projects/:projectId/boq" element={<BoqPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
