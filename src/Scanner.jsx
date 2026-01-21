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
  
  // Estados para el modal de confirmación
  const [mostrarModal, setMostrarModal] = useState(false)
  const [productoEscaneado, setProductoEscaneado] = useState(null)
  const [cantidadInput, setCantidadInput] = useState(1)
  const [procesando, setProcesando] = useState(false)
  
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
    if (!scanResult && !mostrarModal) {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
      scanner.render(onScanSuccess, (err) => {});
      
      function onScanSuccess(txt) { 
        scanner.clear(); 
        manejarLectura(txt); 
      }
      
      return () => { scanner.clear().catch(e => console.error(e)); }
    }
  }, [scanResult, modo, productos, mostrarModal]) 

  const obtenerInventario = async () => {
    try {
      const response = await axios.get(`${API_URL}/inventario`)
      setProductos(response.data)
      setLoading(false)
    } catch (error) { setLoading(false) }
  }

  const manejarLectura = async (nombre) => {
    const productoInfo = productos.find(p => p.nombre.toLowerCase() === nombre.toLowerCase())
    
    if (!productoInfo) {
      alert(`❌ Error: El producto "${nombre}" no existe en el sistema. Revise el nombre exacto.`)
      setScanResult(null)
      return
    }

    // Abrir modal con el producto escaneado
    setProductoEscaneado(productoInfo)
    setCantidadInput(1) // Por defecto 1 unidad (bandeja o bolsa)
    setMostrarModal(true)
    setScanResult(`Producto detectado: ${nombre}`)
  }

  const confirmarMovimiento = async () => {
    if (!productoEscaneado || cantidadInput <= 0) {
      alert("⚠️ La cantidad debe ser mayor a 0")
      return
    }

    setProcesando(true)

    // Calcular las unidades totales según el modo
    let unidadesTotales = 0
    let unidadTexto = ""

    if (modo === "PRODUCCION") {
      // ENTRADA: Bandejas
      const unidadesPorBandeja = productoEscaneado.unidades_por_bandeja || 30
      unidadesTotales = cantidadInput * unidadesPorBandeja
      unidadTexto = `${cantidadInput} Bandeja${cantidadInput > 1 ? 's' : ''}`
    } else {
      // SALIDA: Bolsas (negativo)
      const unidadesPorBolsa = productoEscaneado.unidades_por_bolsa || 10
      unidadesTotales = -(cantidadInput * unidadesPorBolsa)
      unidadTexto = `${cantidadInput} Bolsa${cantidadInput > 1 ? 's' : ''}`
    }

    try {
      await axios.post(`${API_URL}/registrar-movimiento`, {
        producto_nombre: productoEscaneado.nombre,
        cantidad: unidadesTotales, 
        tipo: modo
      })
      
      const accion = modo === "VENTA" ? "Salida" : "Entrada";
      alert(`✅ ${accion} registrada:\n${unidadTexto} de ${productoEscaneado.nombre}\n(${Math.abs(unidadesTotales)} unidades)`)
      
      cerrarModal()
      obtenerInventario() 
    } catch (error) {
      alert("❌ Error de red o servidor.")
      setProcesando(false)
    }
  }

  const cancelarMovimiento = () => {
    cerrarModal()
  }

  const cerrarModal = () => {
    setMostrarModal(false)
    setProductoEscaneado(null)
    setCantidadInput(1)
    setScanResult(null)
    setProcesando(false)
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

      {/* MODAL DE CONFIRMACIÓN */}
      {mostrarModal && productoEscaneado && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '30px',
            maxWidth: '400px',
            width: '100%',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            animation: 'slideIn 0.3s ease-out'
          }}>
            {/* Header del Modal */}
            <div style={{
              textAlign: 'center',
              marginBottom: '25px',
              paddingBottom: '20px',
              borderBottom: '2px solid #f0f0f0'
            }}>
              <div style={{
                fontSize: '48px',
                marginBottom: '10px'
              }}>
                {modo === "PRODUCCION" ? "🏭" : "💰"}
              </div>
              <h2 style={{
                margin: '0 0 8px 0',
                color: '#333',
                fontSize: '24px'
              }}>
                {productoEscaneado.nombre}
              </h2>
              <p style={{
                margin: 0,
                color: '#666',
                fontSize: '14px'
              }}>
                {modo === "PRODUCCION" ? "Entrada de Producción" : "Salida de Venta"}
              </p>
            </div>

            {/* Información del Producto */}
            <div style={{
              backgroundColor: '#f8f9fa',
              padding: '15px',
              borderRadius: '10px',
              marginBottom: '20px'
            }}>
              <div style={{fontSize: '13px', color: '#666', marginBottom: '8px'}}>
                Stock actual: <strong style={{color: '#333', fontSize: '16px'}}>{productoEscaneado.stock_actual}</strong> unidades
              </div>
              <div style={{fontSize: '13px', color: '#666'}}>
                {modo === "PRODUCCION" 
                  ? `📦 Unidades por bandeja: ${productoEscaneado.unidades_por_bandeja || 30}`
                  : `🛍️ Unidades por bolsa: ${productoEscaneado.unidades_por_bolsa || 10}`
                }
              </div>
            </div>

            {/* Input de Cantidad */}
            <div style={{marginBottom: '25px'}}>
              <label style={{
                display: 'block',
                marginBottom: '10px',
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#333'
              }}>
                Cantidad de {modo === "PRODUCCION" ? "Bandejas" : "Bolsas"}:
              </label>
              <input
                type="number"
                min="1"
                value={cantidadInput}
                onChange={(e) => setCantidadInput(parseInt(e.target.value) || 1)}
                disabled={procesando}
                style={{
                  width: '100%',
                  padding: '15px',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  border: '2px solid #ddd',
                  borderRadius: '10px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = modo === "PRODUCCION" ? '#4CAF50' : '#f44336'}
                onBlur={(e) => e.target.style.borderColor = '#ddd'}
                autoFocus
              />
              
              {/* Vista previa del cálculo */}
              <div style={{
                marginTop: '12px',
                padding: '12px',
                backgroundColor: modo === "PRODUCCION" ? '#e8f5e9' : '#ffebee',
                borderRadius: '8px',
                textAlign: 'center',
                fontSize: '14px',
                color: '#333'
              }}>
                {modo === "PRODUCCION" 
                  ? `= ${cantidadInput * (productoEscaneado.unidades_por_bandeja || 30)} unidades a agregar`
                  : `= ${cantidadInput * (productoEscaneado.unidades_por_bolsa || 10)} unidades a restar`
                }
              </div>
            </div>

            {/* Botones de Acción */}
            <div style={{
              display: 'flex',
              gap: '12px'
            }}>
              <button
                onClick={cancelarMovimiento}
                disabled={procesando}
                style={{
                  flex: 1,
                  padding: '15px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  border: '2px solid #ddd',
                  borderRadius: '10px',
                  backgroundColor: 'white',
                  color: '#666',
                  cursor: procesando ? 'not-allowed' : 'pointer',
                  opacity: procesando ? 0.5 : 1,
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => !procesando && (e.target.style.backgroundColor = '#f5f5f5')}
                onMouseOut={(e) => !procesando && (e.target.style.backgroundColor = 'white')}
              >
                ✖️ Cancelar
              </button>
              
              <button
                onClick={confirmarMovimiento}
                disabled={procesando || cantidadInput <= 0}
                style={{
                  flex: 1,
                  padding: '15px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  border: 'none',
                  borderRadius: '10px',
                  backgroundColor: procesando ? '#ccc' : (modo === "PRODUCCION" ? '#4CAF50' : '#f44336'),
                  color: 'white',
                  cursor: procesando ? 'not-allowed' : 'pointer',
                  boxShadow: procesando ? 'none' : '0 4px 12px rgba(0,0,0,0.15)',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => !procesando && (e.target.style.transform = 'translateY(-2px)')}
                onMouseOut={(e) => !procesando && (e.target.style.transform = 'translateY(0)')}
              >
                {procesando ? '⏳ Procesando...' : '✔️ Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

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