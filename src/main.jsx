import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import GISMap from './components/GISMap/GISMap'
import { Toaster } from 'react-hot-toast'
import { MapProvider } from './context/MapContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MapProvider>
      <GISMap />
    </MapProvider>
    <Toaster
      position="top-right"
      reverseOrder={false}
      toastOptions={{
        style: {
          zIndex: 20000,
        },
      }}
      containerStyle={{
        zIndex: 20000,
      }}
    />
  </StrictMode>,
)
