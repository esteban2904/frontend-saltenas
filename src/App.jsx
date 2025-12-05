import { useState, useEffect } from 'react'
import axios from 'axios'
import { Html5QrcodeScanner } from "html5-qrcode"
import { Link } from 'react-router-dom' // Importante para la navegación
import './App.css'

function App() {
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [scanResult, setScanResult] = useState(null)
  const [modo, setModo] = useState("VENTA") // "PRODUCCION" o "VENTA"
  
  // ⚠️ ASEGÚRATE QUE ESTA SEA TU URL DE RENDER EXACTA (Sin /docs, sin espacios)
  const API_URL = "https://api-saltenas.onrender.com" 

  useEffect(() => {
    obtenerInventario()
  }, [])

  // --- CONFIGURACIÓN DEL ESCÁNER DE CÁMARA ---
  useEffect(() => {
    // Solo iniciamos el escáner si no estamos procesando un resultado
    if (!scanResult) {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );
      
      scanner.render(onScanSuccess, onScanFailure);

      function onScanSuccess(decodedText) {
        console.log(`Código leído: ${decodedText}`);
        scanner.clear(); // Apagar cámara temporalmente
        manejarLectura(decodedText); // Enviar a la API
      }

      function onScanFailure(error) {
        // Es normal que falle mientras busca un QR, no hacemos nada aquí
      }

      // Limpieza: Apagar la cámara si cambiamos de página
      return () => {
        scanner.clear().catch(error => console.error("Fallo al limpiar scanner", error));
      }
    }
  }, [scanResult, modo]) 

  // --- FUNCIONES DE LÓGICA ---

  const obtenerInventario = async () => {
    try {
      const response = await axios.get(`${API_URL}/inventario`)
      setProductos(response.data)
      setLoading(false)
    } catch (error) {
      console.error("Error cargando inventario:", error)
      setLoading(false)
    }
  }

  const manejarLectura = async (productoNombre) => {
    setScanResult(`Procesando: ${productoNombre}...`)
    
    // Lógica de negocio: Venta resta, Producción suma
    const cantidad = modo === "VENTA" ? -1 : 1;

    try {
      await axios.post(`${API_URL}/registrar-movimiento`, {
        producto_nombre: productoNombre,
        cantidad: cantidad,
        tipo: modo
      })
      
      alert(`✅ Éxito: ${productoNombre} (${cantidad})`)
      setScanResult(null) // Reiniciar para permitir nuevo escaneo
      obtenerInventario() // Actualizar la tabla visualmente
    } catch (error) {
      alert("❌ Error: Producto no encontrado o problema de conexión.")
      setScanResult(null) // Reiniciar cámara
      // window.location.reload() // Descomentar si la cámara se traba mucho
    }
  }

  return (
    <div className="container">
      <h1>🥟 Control de Salteñas</h1>
      
      {/* 1. BOTONES DE MODO (Vender vs Producir) */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button 
          style={{ backgroundColor: modo === "PRODUCCION" ? '#4CAF50' : '#ccc', color: 'white' }}
          onClick={() => setModo("PRODUCCION")}
        >
          🏭 Producción (+1)
        </button>
        <button 
          style={{ backgroundColor: modo === "VENTA" ? '#f44336' : '#ccc', color: 'white' }}
          onClick={() => setModo("VENTA")}
        >
          💰 Venta (-1)
        </button>
      </div>

      {/* 2. ÁREA DE CÁMARA (Aquí se dibuja el video) */}
      <div id="reader" width="100%"></div>

      {/* 3. LISTA DE INVENTARIO */}
      {loading ? <p>Cargando inventario...</p> : (
        <div className="grid">
          {productos.map((prod) => (
            <div 
              key={prod.id} 
              className="card" 
              style={{
                borderLeft: `5px solid ${prod.stock_actual < prod.stock_minimo ? 'red' : 'green'}`,
                position: 'relative'
              }}
            >
              <h3>{prod.nombre}</h3>
              <h2 style={{ margin: '10px 0' }}>{prod.stock_actual}</h2>
              <small style={{ color: '#666' }}>Mínimo: {prod.stock_minimo}</small>
              
              {/* Etiqueta de Alerta */}
              {prod.stock_actual < prod.stock_minimo && (
                <span className="alerta" style={{
                  position: 'absolute', top: '10px', right: '10px', background: 'red', color: 'white', padding: '2px 5px', borderRadius: '4px', fontSize: '0.7em'
                }}>
                  BAJO STOCK
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* 4. ENLACE AL ÁREA DE SUPERVISOR */}
      <div style={{ marginTop: '40px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
        <Link to="/login" style={{ color: '#007bff', textDecoration: 'none', fontWeight: 'bold' }}>
          🔐 Soy Supervisor (Ir al Dashboard)
        </Link>
      </div>
    </div>
  )
}

export default App