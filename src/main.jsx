import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

// Importamos tus 3 pantallas
import Login from './Login.jsx'
import Scanner from './Scanner.jsx'
import Dashboard from './Dashboard.jsx'

// Importamos estilos globales (si no tienes index.css, comenta esta línea)
// import './index.css' 

console.log("🚀 Arrancando Main.jsx...")

const rootElement = document.getElementById('root')

if (!rootElement) {
  console.error("❌ ERROR CRÍTICO: No encuentro el elemento con id='root' en index.html")
} else {
  // ESTA ES LA PARTE QUE FALTABA: La orden de renderizar
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <BrowserRouter>
        <Routes>
          {/* Ruta 1: Login (Inicio) */}
          <Route path="/" element={<Login />} />
          
          {/* Ruta 2: Empleados */}
          <Route path="/scanner" element={<Scanner />} />
          
          {/* Ruta 3: Supervisores */}
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
    </React.StrictMode>,
  )
  console.log("✅ React inyectado en el DOM correctamente")
}