import { useState, useEffect } from 'react'
import axios from 'axios'
import { Html5Qrcode } from "html5-qrcode"
import { supabase } from './supabaseClient'
import { useNavigate } from 'react-router-dom'
import { 
  Button, 
  Tile, 
  NumberInput,
  Modal,
  Grid,
  Column,
  Toggle,
  InlineNotification
} from '@carbon/react'
import { Logout, Dashboard, CheckmarkFilled, CloseFilled, WarningAltFilled } from '@carbon/icons-react'

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
  
  // Estados para el scanner
  const [scannerIniciado, setScannerIniciado] = useState(false)
  const [html5QrCode, setHtml5QrCode] = useState(null)
  
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

  // --- INICIALIZACIÓN DEL ESCÁNER ---
  useEffect(() => {
    const qrCode = new Html5Qrcode("reader");
    setHtml5QrCode(qrCode);
    
    return () => {
      if (qrCode.isScanning) {
        qrCode.stop().catch(err => console.log(err));
      }
    };
  }, []);

  // --- INICIAR SCANNER ---
  const iniciarScanner = async () => {
    if (!html5QrCode || scannerIniciado) return;
    
    try {
      // Obtener todas las cámaras
      const devices = await Html5Qrcode.getCameras();
      
      if (devices && devices.length > 0) {
        // Buscar la cámara trasera (environment)
        let camaraId = devices[0].id;
        
        // Intentar encontrar la cámara trasera
        const camaraTrasera = devices.find(device => 
          device.label.toLowerCase().includes('back') || 
          device.label.toLowerCase().includes('rear') ||
          device.label.toLowerCase().includes('trasera') ||
          device.label.toLowerCase().includes('environment')
        );
        
        if (camaraTrasera) {
          camaraId = camaraTrasera.id;
        } else if (devices.length > 1) {
          // Si hay más de una cámara y no encontramos "back", usar la segunda (generalmente es la trasera)
          camaraId = devices[devices.length - 1].id;
        }
        
        // Iniciar el scanner con la cámara seleccionada
        await html5QrCode.start(
          camaraId,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          (decodedText) => {
            // Detener scanner y procesar QR
            html5QrCode.pause(true);
            manejarLectura(decodedText);
          },
          (errorMessage) => {
            // Errores de escaneo (ignorar)
          }
        );
        
        setScannerIniciado(true);
      }
    } catch (err) {
      console.error("Error al iniciar scanner:", err);
      alert("Error al iniciar la cámara. Por favor, verifica los permisos.");
    }
  };

  // --- DETENER SCANNER ---
  const detenerScanner = async () => {
    if (html5QrCode && scannerIniciado) {
      try {
        await html5QrCode.stop();
        setScannerIniciado(false);
      } catch (err) {
        console.error("Error al detener scanner:", err);
      }
    }
  }; 

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
    if (!productoEscaneado) {
      return
    }
    
    if (cantidadInput <= 0) {
      alert("⚠️ Error: La cantidad debe ser mayor a 0\n\nPor favor ingresa un número válido (1-9 o más)")
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

  const cerrarModal = async () => {
    setMostrarModal(false)
    setProductoEscaneado(null)
    setCantidadInput(1)
    setScanResult(null)
    setProcesando(false)
    
    // Reiniciar el scanner
    if (html5QrCode && scannerIniciado) {
      html5QrCode.resume();
    }
  }

  return (
    <div style={{padding: '2rem', maxWidth: '800px', margin: '0 auto', background: '#f4f4f4', minHeight: '100vh'}}>
      
      {/* HEADER */}
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', background: 'white', padding: '1.5rem', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)'}}>
        <div>
          <h1 style={{margin: 0, fontSize: '2rem', fontWeight: '400', color: '#161616'}}>Scanner QR</h1>
          <p style={{margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: '#525252'}}>Control de Inventario</p>
        </div>
        <div style={{display: 'flex', gap: '0.5rem'}}>
          <Button 
            kind="tertiary" 
            renderIcon={Dashboard}
            onClick={() => navigate('/dashboard')}
          >
            Admin
          </Button>
          
          <Button 
            kind="danger--tertiary" 
            renderIcon={Logout}
            onClick={async () => { await supabase.auth.signOut(); navigate('/') }}
          >
            Salir
          </Button>
        </div>
      </div>
      
      {/* SELECTOR DE MODO */}
      <Tile style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
        <h4 style={{margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '600', color: '#161616'}}>Modo de Operación</h4>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Button 
            kind={modo === "PRODUCCION" ? "primary" : "secondary"}
            style={{ flex: 1, minHeight: '3rem' }}
            onClick={() => setModo("PRODUCCION")}
          >
            🏭 Entra Bandeja
          </Button>
          <Button 
            kind={modo === "VENTA" ? "danger" : "secondary"}
            style={{ flex: 1, minHeight: '3rem' }}
            onClick={() => setModo("VENTA")}
          >
            💰 Sale Bolsa
          </Button>
        </div>
        <div style={{ marginTop: '1rem', padding: '0.75rem', background: modo === "PRODUCCION" ? '#e5f6ff' : '#fff1f1', borderRadius: '4px', fontSize: '0.875rem', color: '#161616' }}>
          {modo === "PRODUCCION" 
            ? "📦 Modo activo: Entrada de producción (suma unidades)" 
            : "🛍️ Modo activo: Salida de ventas (resta unidades)"}
        </div>
      </Tile>

      {/* CÁMARA */}
      <Tile style={{marginBottom: '1.5rem', padding: '1.5rem'}}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{margin: '0', fontSize: '1rem', fontWeight: '600', color: '#161616'}}>Escáner QR</h4>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {!scannerIniciado ? (
              <Button 
                kind="primary" 
                size="sm"
                onClick={iniciarScanner}
              >
                📹 Iniciar Cámara
              </Button>
            ) : (
              <Button 
                kind="danger--tertiary" 
                size="sm"
                onClick={detenerScanner}
              >
                ⏹️ Detener
              </Button>
            )}
          </div>
        </div>
        <div id="reader" style={{borderRadius: '4px', overflow: 'hidden', border: '1px solid #e0e0e0', minHeight: scannerIniciado ? '0' : '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: scannerIniciado ? 'transparent' : '#f4f4f4'}}>
          {!scannerIniciado && (
            <p style={{ color: '#525252', fontSize: '0.875rem' }}>Presiona "Iniciar Cámara" para comenzar</p>
          )}
        </div>
      </Tile>

      {/* MODAL DE CONFIRMACIÓN CON CARBON */}
      <Modal
        open={mostrarModal && productoEscaneado}
        onRequestClose={cancelarMovimiento}
        modalHeading={`${modo === "PRODUCCION" ? "Entrada de Producción" : "Salida de Venta"}`}
        primaryButtonText={procesando ? "Procesando..." : "Confirmar"}
        secondaryButtonText="Cancelar"
        onRequestSubmit={confirmarMovimiento}
        onSecondarySubmit={cancelarMovimiento}
        primaryButtonDisabled={procesando || cantidadInput <= 0}
        size="sm"
      >
        {productoEscaneado && (
          <div>
            {/* Nombre del Producto */}
            <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
                {modo === "PRODUCCION" ? "🏭" : "💰"}
              </div>
              <h3 style={{ margin: '0', fontSize: '1.5rem', fontWeight: '400', color: '#161616' }}>
                {productoEscaneado.nombre}
              </h3>
            </div>

            {/* Información del Producto */}
            <Tile style={{ marginBottom: '1.5rem', background: '#f4f4f4' }}>
              <div style={{fontSize: '0.875rem', color: '#525252', marginBottom: '0.5rem'}}>
                <strong>Stock actual:</strong> {productoEscaneado.stock_actual} unidades
              </div>
              <div style={{fontSize: '0.875rem', color: '#525252'}}>
                {modo === "PRODUCCION" 
                  ? `Unidades por bandeja: ${productoEscaneado.unidades_por_bandeja || 30}`
                  : `Unidades por bolsa: ${productoEscaneado.unidades_por_bolsa || 10}`
                }
              </div>
            </Tile>

            {/* Input de Cantidad */}
            <div style={{marginBottom: '1rem'}}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600', color: '#161616' }}>
                Cantidad de {modo === "PRODUCCION" ? "Bandejas" : "Bolsas"}
              </label>
              <input
                type="number"
                min="1"
                value={cantidadInput === 0 ? '' : cantidadInput}
                onChange={(e) => {
                  const valor = e.target.value;
                  if (valor === '' || valor === '0') {
                    setCantidadInput(0);
                  } else {
                    const numero = parseInt(valor);
                    if (!isNaN(numero) && numero > 0) {
                      setCantidadInput(numero);
                    }
                  }
                }}
                disabled={procesando}
                className="cds--text-input"
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  fontSize: '1.25rem',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  border: cantidadInput === 0 ? '2px solid #da1e28' : '1px solid #8d8d8d',
                  borderRadius: '0',
                  boxSizing: 'border-box',
                  outline: 'none',
                  background: 'white'
                }}
                onFocus={(e) => {
                  e.target.select();
                  if (cantidadInput !== 0) {
                    e.target.style.borderColor = '#0f62fe';
                    e.target.style.borderWidth = '2px';
                  }
                }}
                onBlur={(e) => {
                  if (cantidadInput === 0 || e.target.value === '') {
                    setCantidadInput(1);
                  }
                  e.target.style.borderColor = '#8d8d8d';
                  e.target.style.borderWidth = '1px';
                }}
                autoFocus
              />
            </div>

            {/* Vista previa del cálculo */}
            {cantidadInput === 0 ? (
              <InlineNotification
                kind="error"
                title="Error"
                subtitle="La cantidad debe ser mayor a 0"
                lowContrast
                hideCloseButton
              />
            ) : (
              <Tile style={{ 
                background: modo === "PRODUCCION" ? '#defbe6' : '#fff1f1',
                border: `1px solid ${modo === "PRODUCCION" ? '#24a148' : '#da1e28'}`,
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.875rem', color: '#161616', fontWeight: '600' }}>
                  {modo === "PRODUCCION" 
                    ? `= ${cantidadInput * (productoEscaneado.unidades_por_bandeja || 30)} unidades a agregar`
                    : `= ${cantidadInput * (productoEscaneado.unidades_por_bolsa || 10)} unidades a restar`
                  }
                </div>
              </Tile>
            )}
          </div>
        )}
      </Modal>

      {/* LISTA DE STOCK */}
      <Tile style={{ padding: '1.5rem' }}>
        <h4 style={{margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '600', color: '#161616'}}>Inventario Actual</h4>
        
        {loading ? (
          <p style={{ textAlign: 'center', color: '#525252' }}>Cargando inventario...</p>
        ) : (
          <Grid narrow>
            {productos.map((prod) => {
              const esBajoStock = prod.stock_actual < prod.stock_minimo;
              return (
                <Column key={prod.id} lg={16} md={8} sm={4} style={{ marginBottom: '1rem' }}>
                  <Tile 
                    style={{
                      borderLeft: `4px solid ${esBajoStock ? '#da1e28' : '#24a148'}`,
                      background: esBajoStock ? '#fff1f1' : 'white',
                      padding: '1rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <h5 style={{margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: '600', color: '#161616'}}>
                          {esBajoStock && <WarningAltFilled size={16} style={{ color: '#da1e28', marginRight: '0.5rem', verticalAlign: 'middle' }} />}
                          {prod.nombre}
                        </h5>
                        <div style={{ fontSize: '0.75rem', color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Stock Total
                        </div>
                        <div style={{ fontSize: '2rem', fontWeight: '300', color: esBajoStock ? '#da1e28' : '#161616', lineHeight: '1' }}>
                          {prod.stock_actual}
                        </div>
                      </div>
                      
                      <div style={{ 
                        textAlign: 'right', 
                        fontSize: '0.875rem', 
                        color: '#525252', 
                        background: '#f4f4f4', 
                        padding: '0.75rem', 
                        borderRadius: '4px',
                        minWidth: '140px'
                      }}>
                        <div style={{ marginBottom: '0.25rem' }}>
                          🏭 <strong>{Math.floor(prod.stock_actual / (prod.unidades_por_bandeja || 30))}</strong> Bandejas
                        </div>
                        <div>
                          💰 <strong>{Math.floor(prod.stock_actual / (prod.unidades_por_bolsa || 10))}</strong> Bolsas
                        </div>
                      </div>
                    </div>
                  </Tile>
                </Column>
              );
            })}
          </Grid>
        )}
      </Tile>
    </div>
  )
}
export default Scanner