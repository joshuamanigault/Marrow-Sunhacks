import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Explore, Landing, Upload } from './Landing'
import { WorkspaceRoute } from './pages/WorkspaceRoute'

// Deployment note: the host must serve index.html for every path (SPA
// fallback), or refreshing /explore or a /workspace link returns its 404.
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/workspace/:specimenId" element={<WorkspaceRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
