import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { StartPage } from "./pages/StartPage"
import { WorkspacePage } from "./pages/WorkspacePage"

/**
 * App shell: routing only.
 *
 * /                         → StartPage (curated Open button)
 * /workspace/:specimenId    → WorkspacePage (loads Joshua’s id)
 *
 * Advances spec §2 “Opens the specimen” + Alexandra roadmap task 1.
 */
function App() {
  return (
    // BrowserRouter enables URL paths like /workspace/ypm-vp-41198
    <BrowserRouter>
      <Routes>
        {/* Start screen with one curated button */}
        <Route path="/" element={<StartPage />} />

        {/* Workspace keyed by specimen id from the URL */}
        <Route path="/workspace/:specimenId" element={<WorkspacePage />} />

        {/* Unknown paths send the visitor back to start */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
