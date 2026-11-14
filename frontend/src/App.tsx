import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { StartPage } from './pages/StartPage'
import { WorkspaceRoute } from './pages/WorkspaceRoute'

/**
 * App routing (Alexandra task 1 + Alex/Joshua main shell).
 *
 * /                      → curated start button
 * /workspace/:specimenId → fetch Joshua’s API → Alex’s Workspace
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StartPage />} />
        <Route path="/workspace/:specimenId" element={<WorkspaceRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
