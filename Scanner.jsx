import { useState, useEffect } from 'react'
import axios from 'axios'
import { Html5QrcodeScanner } from "html5-qrcode"
import { supabase } from './supabaseClient'
import { useNavigate } from 'react-router-dom'

function Scanner() {
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [scanResult, setScanResult] = useState(null)
  const [modo, setModo] = useState("VENTA") 
  const navigate = useNavigate()
  
  // ⚠️ TU URL DE RENDER
  const API_URL = "https://api-saltenas.onrender.com" 

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) navigate('/') 
    }
    checkAuth()
    obtenerInventario()
  }, [])

  // --- CONFIGURACIÓN DEL ESCÁNER ---
  useEffect(() => {
    // Solo iniciamos si no hay un proceso pendiente
    if (!scanResult) {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
      scanner.render(onScanSuccess, (err) => {});
      
      function onScanSuccess(txt) { 
        scanner.clear(); 
        manejarLectura(txt); 
      }
      
      return () => { scanner.clear().catch(e => console.error(e)); }
    }
  }, [scanResult, modo, productos]) // Dependemos de 'productos' para leer las reglas

  const obtenerInventario = async () => {
    try {
      const response = await axios.get(`${API_URL}/inventario`)
      setProductos(response.data)
      setLoading(false)
    } catch (error) { setLoading(false) }
  }

  const manejarLectura = async (nombre) => {
    setScanResult(`Procesando ${nombre}...`)
    
    // 1. Buscamos el producto en la memoria para saber sus reglas (cuántos trae la bandeja/bolsa)
    const productoInfo = productos.find(p => p.nombre.toLowerCase() === nombre.toLowerCase())
    
    if (!productoInfo) {
      alert(`❌ Error: El producto "${nombre}" no existe en el sistema. Revise el nombre exacto.`)
      setScanResult(null)
      return
    }

    // 2. Calculamos la cantidad real de UNIDADES
    let cantidad = 0
    let unidadTexto = ""

    if (modo === "PRODUCCION") {
      // Regla: Entra 1 BANDEJA
      cantidad = productoInfo.unidades_por_bandeja || 30 // (30 por defecto si no se configuró)
      unidadTexto = "1 Bandeja"
    } else {
      // Regla: Sale 1 BOLSA
      cantidad = -(productoInfo.unidades_por_bolsa || 10) // (10 por defecto)
      unidadTexto = "1 Bolsa"
    }

    try {
      // Enviamos el movimiento al backend
      await axios.post(`${API_URL}/registrar-movimiento`, {
        producto_nombre: productoInfo.nombre, // Usamos el nombre oficial de la DB
        cantidad: cantidad, 
        tipo: modo
      })
      
      const accion = modo === "VENTA" ? "Salida" : "Entrada";
      alert(`✅ ${accion}: ${unidadTexto} de ${productoInfo.nombre}\n(${Math.abs(cantidad)} unidades registradas)`)
      
      setScanResult(null)
      obtenerInventario() // Actualizamos la lista visual
    } catch (error) {
      alert("❌ Error de red o servidor.")
      setScanResult(null)
    }
  }

  return (
    <div className="container" style={{padding: '15px', maxWidth: '600px', margin: '0 auto'}}>
      
      {/* HEADER */}
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
        <div>
          <h3 style={{margin: 0}}>📱 Empleado</h3>
          <small style={{color: '#666'}}>Control de Bandejas y Bolsas</small>
        </div>
        <button onClick={async () => { await supabase.auth.signOut(); navigate('/') }} style={{padding: '8px 12px', background: '#333', color: 'white', border: 'none', borderRadius: '5px'}}>Salir</button>
      </div>
      
      {/* BOTONES DE MODO */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button 
          style={{ 
            backgroundColor: modo === "PRODUCCION" ? '#4CAF50' : '#e0e0e0', 
            color: modo === "PRODUCCION" ? 'white' : '#555',
            flex: 1, padding: '15px', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px'
          }}
          onClick={() => setModo("PRODUCCION")}
        >
          🏭 Entra Bandeja
        </button>
        <button 
          style={{ 
            backgroundColor: modo === "VENTA" ? '#f44336' : '#e0e0e0', 
            color: modo === "VENTA" ? 'white' : '#555',
            flex: 1, padding: '15px', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px'
          }}
          onClick={() => setModo("VENTA")}
        >
          💰 Sale Bolsa
        </button>
      </div>

      {/* CÁMARA */}
      <div id="reader" style={{borderRadius: '10px', overflow: 'hidden', border: '2px solid #ddd'}}></div>

      {/* LISTA DE STOCK */}
      <h4 style={{marginTop: '20px', marginBottom: '10px', color: '#444'}}>📦 Inventario Actual (Unidades)</h4>
      
      {loading ? <p>Cargando...</p> : (
        <div className="grid">
          {productos.map((prod) => (
            <div key={prod.id} className="card" style={{
              borderLeft: `5px solid ${prod.stock_actual < prod.stock_minimo ? 'red' : 'green'}`,
              textAlign: 'left',
              padding: '15px',
              marginBottom: '10px',
              background: 'white',
              boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{margin: '0', color: '#333'}}>{prod.nombre}</h3>
              
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px'}}>
                 {/* Stock Grande */}
                 <div>
                   <span style={{fontSize: '0.8em', color: '#666', textTransform: 'uppercase', letterSpacing: '1px'}}>Stock Total</span>
                   <div style={{fontSize: '2em', fontWeight: 'bold', color: '#222'}}>{prod.stock_actual}</div>
                 </div>
                 
                 {/* Cálculos visuales de ayuda */}
                 <div style={{textAlign: 'right', fontSize: '0.9em', color: '#555', background: '#f5f5f5', padding: '8px', borderRadius: '8px'}}>
                   <div>🏭 <strong>{Math.floor(prod.stock_actual / prod.unidades_por_bandeja)}</strong> Bandejas</div>
                   <div>💰 <strong>{Math.floor(prod.stock_actual / prod.unidades_por_bolsa)}</strong> Bolsas</div>
                 </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
export default Scanner