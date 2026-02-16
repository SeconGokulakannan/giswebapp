import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import GISMap from './components/GISMap/GISMap'
import { Toaster } from 'react-hot-toast'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GISMap />
    <Toaster
      position="top-right"
      reverseOrder={false}
      toastOptions={{
        style: {
          zIndex: 10000,
        },
      }}
      containerStyle={{
        zIndex: 10000,
      }}
    />
  </StrictMode>,
)
