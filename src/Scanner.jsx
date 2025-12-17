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
    if (!scanResult) {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
      scanner.render(onScanSuccess, (err) => {});
      
      function onScanSuccess(txt) { 
        scanner.clear(); 
        manejarLectura(txt); 
      }
      
      return () => { scanner.clear().catch(e => console.error(e)); }
    }
  }, [scanResult, modo, productos]) 

  const obtenerInventario = async () => {
    try {
      const response = await axios.get(`${API_URL}/inventario`)
      setProductos(response.data)
      setLoading(false)
    } catch (error) { setLoading(false) }
  }

  const manejarLectura = async (nombre) => {
    setScanResult(`Procesando ${nombre}...`)
    
    const productoInfo = productos.find(p => p.nombre.toLowerCase() === nombre.toLowerCase())
    
    if (!productoInfo) {
      alert(`❌ Error: El producto "${nombre}" no existe en el sistema. Revise el nombre exacto.`)
      setScanResult(null)
      return
    }

    // --- LÓGICA DE UNIDADES (Bandeja vs Bolsa) ---
    let cantidad = 0
    let unidadTexto = ""

    if (modo === "PRODUCCION") {
      // ENTRADA: Usamos reglas de BANDEJA
      // Si no tiene regla configurada, asume 30 por defecto
      cantidad = productoInfo.unidades_por_bandeja || 30 
      unidadTexto = "1 Bandeja"
    } else {
      // SALIDA: Usamos reglas de BOLSA (Negativo)
      // Si no tiene regla configurada, asume 10 por defecto
      cantidad = -(productoInfo.unidades_por_bolsa || 10) 
      unidadTexto = "1 Bolsa"
    }

    try {
      await axios.post(`${API_URL}/registrar-movimiento`, {
        producto_nombre: productoInfo.nombre,
        cantidad: cantidad, 
        tipo: modo
      })
      
      const accion = modo === "VENTA" ? "Salida" : "Entrada";
      alert(`✅ ${accion}: ${unidadTexto} de ${productoInfo.nombre}\n(${Math.abs(cantidad)} unidades registradas)`)
      
      setScanResult(null)
      obtenerInventario() 
    } catch (error) {
      alert("❌ Error de red o servidor.")
      setScanResult(null)
    }
  }

  return (
    <div className="container" style={{padding: '15px', maxWidth: '600px', margin: '0 auto'}}>
      
      {/* HEADER CON BOTÓN AL DASHBOARD */}
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
        <div>
          <h3 style={{margin: 0}}>📱 Empleado</h3>
          <small style={{color: '#666'}}>Control de Inventario</small>
        </div>
        <div style={{display: 'flex', gap: '8px'}}>
          {/* --- AQUÍ ESTÁ EL BOTÓN DE ADMIN --- */}
          <button 
            onClick={() => navigate('/dashboard')} 
            style={{padding: '8px 12px', background: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold'}}
          >
            📊 Admin
          </button>
          
          <button 
            onClick={async () => { await supabase.auth.signOut(); navigate('/') }} 
            style={{padding: '8px 12px', background: '#333', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer'}}
          >
            Salir
          </button>
        </div>
      </div>
      
      {/* BOTONES DE MODO (Etiquetas Correctas) */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button 
          style={{ 
            backgroundColor: modo === "PRODUCCION" ? '#4CAF50' : '#e0e0e0', 
            color: modo === "PRODUCCION" ? 'white' : '#555',
            flex: 1, padding: '15px', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer'
          }}
          onClick={() => setModo("PRODUCCION")}
        >
          🏭 Entra Bandeja
        </button>
        <button 
          style={{ 
            backgroundColor: modo === "VENTA" ? '#f44336' : '#e0e0e0', 
            color: modo === "VENTA" ? 'white' : '#555',
            flex: 1, padding: '15px', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer'
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
                 
                 {/* Cálculos visuales de ayuda para el empleado */}
                 <div style={{textAlign: 'right', fontSize: '0.9em', color: '#555', background: '#f5f5f5', padding: '8px', borderRadius: '8px'}}>
                   <div>🏭 <strong>{Math.floor(prod.stock_actual / (prod.unidades_por_bandeja || 30))}</strong> Bandejas</div>
                   <div>💰 <strong>{Math.floor(prod.stock_actual / (prod.unidades_por_bolsa || 10))}</strong> Bolsas</div>
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