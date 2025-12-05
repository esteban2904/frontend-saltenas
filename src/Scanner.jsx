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
    verificarSesion()
    obtenerInventario()
  }, [])

  const verificarSesion = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) navigate('/') 
  }

  // --- CONFIGURACIÓN DEL ESCÁNER ---
  useEffect(() => {
    if (!scanResult) {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );
      scanner.render(onScanSuccess, (err) => {});

      function onScanSuccess(decodedText) {
        scanner.clear();
        manejarLectura(decodedText);
      }
      return () => { scanner.clear().catch(e => console.error(e)); }
    }
  }, [scanResult, modo]) 

  const obtenerInventario = async () => {
    try {
      const response = await axios.get(`${API_URL}/inventario`)
      setProductos(response.data)
      setLoading(false)
    } catch (error) { setLoading(false) }
  }

  const manejarLectura = async (productoNombre) => {
    setScanResult(`Procesando...`)
    // 1 significa 1 BOLSA
    const cantidad = modo === "VENTA" ? -1 : 1;
    
    try {
      await axios.post(`${API_URL}/registrar-movimiento`, {
        producto_nombre: productoNombre,
        cantidad: cantidad,
        tipo: modo
      })
      
      const accion = modo === "VENTA" ? "Salida" : "Entrada";
      alert(`✅ ${accion}: 1 Bolsa de ${productoNombre}`)
      
      setScanResult(null)
      obtenerInventario()
    } catch (error) {
      alert("❌ Error: Producto no encontrado.")
      setScanResult(null)
    }
  }

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div className="container" style={{padding: '15px'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
        <h3>📱 Empleado (Bolsas)</h3>
        <button onClick={cerrarSesion} style={{padding: '5px 10px', fontSize: '12px', background: '#333'}}>Salir</button>
      </div>
      
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button 
          style={{ backgroundColor: modo === "PRODUCCION" ? '#4CAF50' : '#ccc', flex: 1 }}
          onClick={() => setModo("PRODUCCION")}
        >
          🏭 Entra Bolsa (+1)
        </button>
        <button 
          style={{ backgroundColor: modo === "VENTA" ? '#f44336' : '#ccc', flex: 1 }}
          onClick={() => setModo("VENTA")}
        >
          💰 Sale Bolsa (-1)
        </button>
      </div>

      <div id="reader" width="100%"></div>

      {loading ? <p>Cargando inventario...</p> : (
        <div className="grid">
          {productos.map((prod) => (
            <div key={prod.id} className="card" style={{
              borderLeft: `5px solid ${prod.stock_actual < prod.stock_minimo ? 'red' : 'green'}`,
              textAlign: 'left'
            }}>
              <h3 style={{margin: '0 0 5px 0'}}>{prod.nombre}</h3>
              
              <div style={{display: 'flex', alignItems: 'baseline', gap: '10px'}}>
                <h2 style={{margin: 0, fontSize: '2em'}}>{prod.stock_actual}</h2>
                <span style={{color: '#666', fontWeight: 'bold'}}>Bolsas</span>
              </div>
              
              {/* Aquí hacemos la multiplicación visual: 1 Bolsa = 10 Unidades */}
              <p style={{margin: '5px 0 0 0', color: '#888', fontSize: '0.9em'}}>
                📦 Total aprox: <strong>{prod.stock_actual * 10}</strong> salteñas
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
export default Scanner