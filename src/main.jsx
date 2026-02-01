import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import GISMap from './components/GISMap/GISMap'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GISMap />
  </StrictMode>,
)
