import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom' // Importamos el enrutador
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Envolvemos toda la App con BrowserRouter para que funcionen las páginas */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)