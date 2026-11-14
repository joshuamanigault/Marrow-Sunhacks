import Workspace from './workspace/Workspace'
import { stubSpecimen } from './workspace/specimen'

function App() {
  // The 3D canvas replaces this placeholder; the specimen comes from the API.
  const scene = (
    <div style={{ display: 'grid', placeItems: 'center', height: '100%', opacity: 0.5 }}>
      3D scene mounts here
    </div>
  )
  return <Workspace specimen={stubSpecimen} scene={scene} />
}

export default App
