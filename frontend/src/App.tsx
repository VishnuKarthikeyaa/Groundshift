import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { OverviewPage } from './pages/OverviewPage';
import { GlobalExplorerPage } from './pages/GlobalExplorerPage';
import { DatasetExplorerPage } from './pages/DatasetExplorerPage';
import { SARProcessingPage } from './pages/SARProcessingPage';
import { MissionComparisonPage } from './pages/MissionComparisonPage';
import { ValidationLaboratoryPage } from './pages/ValidationLaboratoryPage';
import { DeformationAnalysisPage } from './pages/DeformationAnalysisPage';
import { ResearchReportsPage } from './pages/ResearchReportsPage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/global-explorer" element={<GlobalExplorerPage />} />
          <Route path="/datasets" element={<DatasetExplorerPage />} />
          <Route path="/processing" element={<SARProcessingPage />} />
          <Route path="/mission-comparison" element={<MissionComparisonPage />} />
          <Route path="/validation-lab" element={<ValidationLaboratoryPage />} />
          <Route path="/deformation" element={<DeformationAnalysisPage />} />
          <Route path="/reports" element={<ResearchReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />

          {/* Legacy route redirects */}
          <Route path="/explorer" element={<Navigate to="/global-explorer" replace />} />
          <Route path="/study-areas" element={<Navigate to="/global-explorer" replace />} />
          <Route path="/missions" element={<Navigate to="/mission-comparison" replace />} />
          <Route path="/validation-workbench" element={<Navigate to="/validation-lab" replace />} />
          <Route path="/decomposition" element={<Navigate to="/validation-lab" replace />} />
          <Route path="/triplet-audit" element={<Navigate to="/validation-lab" replace />} />
          <Route path="/benchmarks" element={<Navigate to="/deformation" replace />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
};

export default App;
