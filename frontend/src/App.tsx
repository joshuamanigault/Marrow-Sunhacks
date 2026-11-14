import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { WorkspaceRoute } from './pages/WorkspaceRoute'

/** Curated specimen id — opens workspace directly (no start-page entry). */
const CURATED_SPECIMEN_ID = 'ypm-vp-41198'

/**
 * App routing: Alexandra tasks 2–6 on Alex’s workspace + Joshua’s API.
 *
 * /                      → /workspace/ypm-vp-41198
 * /workspace/:specimenId → fetch specimen → Workspace
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Navigate to={`/workspace/${CURATED_SPECIMEN_ID}`} replace />}
        />
        <Route path="/workspace/:specimenId" element={<WorkspaceRoute />} />
        <Route
          path="*"
          element={<Navigate to={`/workspace/${CURATED_SPECIMEN_ID}`} replace />}
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
