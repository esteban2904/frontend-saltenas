import { useState, useEffect } from 'react'
import axios from 'axios'
import { Html5QrcodeScanner } from "html5-qrcode"
import './App.css'

function App() {
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [scanResult, setScanResult] = useState(null)
  const [modo, setModo] = useState("VENTA") // "PRODUCCION" o "VENTA"
  
  // ¡PON TU URL CORRECTA AQUÍ!
  const API_URL = "https://api-saltenas.onrender.com" 

  useEffect(() => {
    obtenerInventario()
  }, [])

  // Configuración del Escáner
  useEffect(() => {
    // El escáner necesita un elemento con id "reader" para renderizarse
    // Solo lo iniciamos si no hay un resultado pendiente
    if (!scanResult) {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );
      
      scanner.render(onScanSuccess, onScanFailure);

      function onScanSuccess(decodedText) {
        // Cuando lee algo:
        console.log(`Código leído: ${decodedText}`);
        scanner.clear(); // Apagar cámara
        manejarLectura(decodedText); // Procesar
      }

      function onScanFailure(error) {
        // Pasa seguido mientras busca, no te preocupes
      }

      // Limpieza al desmontar
      return () => {
        scanner.clear().catch(error => console.error("Fallo al limpiar scanner", error));
      }
    }
  }, [scanResult, modo]) // Se reinicia si cambia el resultado o el modo

  const obtenerInventario = async () => {
    try {
      const response = await axios.get(`${API_URL}/inventario`)
      setProductos(response.data)
      setLoading(false)
    } catch (error) {
      console.error("Error cargando inventario:", error)
    }
  }

  const manejarLectura = async (productoNombre) => {
    setScanResult(`Procesando: ${productoNombre}...`)
    
    // Si estamos en VENTA restamos (-1), si es PRODUCCION sumamos (+1)
    const cantidad = modo === "VENTA" ? -1 : 1;

    try {
      await axios.post(`${API_URL}/registrar-movimiento`, {
        producto_nombre: productoNombre,
        cantidad: cantidad,
        tipo: modo
      })
      
      alert(`✅ Éxito: ${productoNombre} (${cantidad})`)
      setScanResult(null) // Reiniciar para escanear otro
      obtenerInventario() // Actualizar tabla visual
    } catch (error) {
      alert("❌ Error: Producto no encontrado o falla de red.")
      setScanResult(null)
      window.location.reload() // Recargar por si el scanner se traba
    }
  }

  return (
    <div className="container">
      <h1>🥟 Control de Salteñas</h1>
      
      {/* Selector de Modo */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button 
          style={{ backgroundColor: modo === "PRODUCCION" ? '#4CAF50' : '#ccc' }}
          onClick={() => setModo("PRODUCCION")}
        >
          🏭 Producción (+1)
        </button>
        <button 
          style={{ backgroundColor: modo === "VENTA" ? '#f44336' : '#ccc' }}
          onClick={() => setModo("VENTA")}
        >
          💰 Venta (-1)
        </button>
      </div>

      {/* Área de Cámara */}
      <div id="reader" width="100%"></div>

      {/* Lista de Inventario */}
      {loading ? <p>Cargando...</p> : (
        <div className="grid">
          {productos.map((prod) => (
            <div key={prod.id} className="card" style={{borderLeft: `5px solid ${prod.stock_actual < prod.stock_minimo ? 'red' : 'green'}`}}>
              <h3>{prod.nombre}</h3>
              <h2>{prod.stock_actual}</h2>
              <small>Mínimo: {prod.stock_minimo}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default App