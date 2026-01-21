import { useState, useEffect } from 'react'
import axios from 'axios'
import { supabase } from './supabaseClient'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from 'recharts'

// Colores para diferenciar Entrada (Verdes/Azules) y Salida (Rojos/Naranjas)
const COLORES_ENTRADA = ['#10b981', '#059669', '#0088fe', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#06b6d4'];
const COLORES_SALIDA = ['#ef4444', '#f97316', '#f59e0b', '#fb923c', '#dc2626', '#ea580c', '#d97706', '#c2410c'];

function Dashboard() {
  const [productos, setProductos] = useState([])
  const [datosMensuales, setDatosMensuales] = useState([]) 
  const [datosDiarios, setDatosDiarios] = useState([])     
  const [mostrarGraficaCompleta, setMostrarGraficaCompleta] = useState(false)
  
  // Llaves para saber qué barras pintar (dinámicas según los productos)
  const [keysEntrada, setKeysEntrada] = useState([]) 
  const [keysSalida, setKeysSalida] = useState([])   
  
  // Estado para formulario de nuevo producto
  const [nuevoProducto, setNuevoProducto] = useState({ 
    nombre: '', stock_minimo: 100, unidades_por_bandeja: 30, unidades_por_bolsa: 10 
  })
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  // ⚠️ TU URL DE RENDER
  const API_URL = "https://api-saltenas.onrender.com"

  useEffect(() => {
    const iniciar = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { navigate('/'); return; }
      await cargarDatos()
    }
    iniciar()
  }, [])

  const cargarDatos = async () => {
    try {
      setLoading(true)
      
      // 1. Cargar Inventario
      const prodRes = await axios.get(`${API_URL}/inventario`)
      setProductos(prodRes.data)
      
      // 2. Cargar Reporte Mensual
      const mesRes = await axios.get(`${API_URL}/admin/reportes/mensual`)
      const dataMes = procesarDatosGrafica(mesRes.data)
      setDatosMensuales(dataMes.datos)

      // 3. Cargar Reporte Diario (El endpoint que seleccionaste)
      const diaRes = await axios.get(`${API_URL}/admin/reportes/diario`)
      const dataDia = procesarDatosGrafica(diaRes.data)
      // Mostramos solo los últimos 14 días para que la gráfica se entienda
      setDatosDiarios(dataDia.datos.slice(-14)) 

      // Unimos las llaves encontradas en ambos reportes para asignar colores consistentes
      const todasEntradas = new Set([...dataMes.keysEntrada, ...dataDia.keysEntrada])
      const todasSalidas = new Set([...dataMes.keysSalida, ...dataDia.keysSalida])
      
      setKeysEntrada(Array.from(todasEntradas))
      setKeysSalida(Array.from(todasSalidas))

    } catch (error) { console.error(error) } finally { setLoading(false) }
  }

  // --- HELPER: Convierte el JSON del backend a formato para Recharts ---
  const procesarDatosGrafica = (rawData) => {
    const raw = rawData || {}
    const entradasSet = new Set()
    const salidasSet = new Set()

    const datos = Object.keys(raw).map(fecha => {
      const fila = { name: fecha }
      Object.keys(raw[fecha]).forEach(key => {
        fila[key] = raw[fecha][key]
        // Clasificamos si es entrada o salida
        if (key.startsWith("Entrada:")) entradasSet.add(key)
        if (key.startsWith("Salida:")) salidasSet.add(key)
      })
      return fila
    })
    
    // Ordenar por fecha
    datos.sort((a, b) => a.name.localeCompare(b.name))

    return { datos, keysEntrada: Array.from(entradasSet), keysSalida: Array.from(salidasSet) }
  }

  // --- ACCIONES DE GESTIÓN (Crear, Borrar, Editar) ---

  const crearProducto = async () => {
    if (!nuevoProducto.nombre) return alert("Escribe un nombre")
    try {
      await axios.post(`${API_URL}/admin/productos`, nuevoProducto)
      alert("✅ Producto creado")
      setNuevoProducto({ nombre: '', stock_minimo: 100, unidades_por_bandeja: 30, unidades_por_bolsa: 10 }) 
      cargarDatos()
    } catch (e) { alert("❌ Error: Verifica si el producto ya existe") }
  }

  const borrarProducto = async (id) => {
    if(confirm("⚠ PELIGRO: Se borrará el producto y TODO su historial de movimientos.")) {
      await axios.delete(`${API_URL}/admin/productos/${id}`)
      cargarDatos()
    }
  }

  const actualizarConfig = async (p, campo, valor) => {
    const valorInt = parseInt(valor) || 0
    const edicion = {
      stock_minimo: p.stock_minimo,
      unidades_por_bandeja: p.unidades_por_bandeja,
      unidades_por_bolsa: p.unidades_por_bolsa,
      [campo]: valorInt // Actualizamos solo el campo modificado
    }
    await axios.put(`${API_URL}/admin/productos/${p.id}`, edicion)
  }

  // Componente personalizado para tooltip mejorado
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'white', padding: '15px', border: '1px solid #ccc', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
          <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', color: '#333' }}>{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ margin: '5px 0', color: entry.color, fontSize: '13px' }}>
              <strong>{entry.name}:</strong> {entry.value} unidades
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Componente personalizado para Legend más compacto
  const renderLegend = (props) => {
    const { payload } = props;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', padding: '10px 0', maxHeight: '80px', overflowY: 'auto' }}>
        {payload.map((entry, index) => (
          <div key={`item-${index}`} style={{ display: 'flex', alignItems: 'center', fontSize: '11px', background: '#f8f9fa', padding: '4px 8px', borderRadius: '4px' }}>
            <div style={{ width: '12px', height: '12px', background: entry.color, marginRight: '5px', borderRadius: '2px' }}></div>
            <span style={{ color: '#333' }}>{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  // Calcular estadísticas resumidas
  const calcularEstadisticas = () => {
    const totalStock = productos.reduce((sum, p) => sum + p.stock_actual, 0);
    const productosAlerta = productos.filter(p => p.stock_actual <= p.stock_minimo).length;
    const stockPromedio = productos.length > 0 ? Math.round(totalStock / productos.length) : 0;
    return { totalStock, productosAlerta, stockPromedio };
  };

  const stats = calcularEstadisticas();

  if (loading) return <div style={{padding:'50px',textAlign:'center',fontSize:'18px',color:'#666'}}>⏳ Cargando Sistema...</div>

  // Calcular altura dinámica basada en el número de productos
  const alturaGrafica = Math.max(400, keysEntrada.length * 40 + keysSalida.length * 40);
  const alturaMensual = Math.max(350, keysEntrada.length * 35 + keysSalida.length * 35);

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Arial, sans-serif', background: '#f5f7fa', minHeight: '100vh' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>
        <div>
          <h1 style={{margin: 0, color: '#1e293b', fontSize: '28px'}}>📊 Dashboard Maestro</h1>
          <p style={{margin: '5px 0 0 0', color: '#64748b', fontSize: '14px'}}>Control de Inventario en Tiempo Real</p>
        </div>
        <button onClick={async () => { await supabase.auth.signOut(); navigate('/') }} style={{background: '#1e293b', color:'white', padding:'12px 24px', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontWeight:'600', transition: 'all 0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.1)'}}>
          🚪 Cerrar Sesión
        </button>
      </div>

      {/* TARJETAS DE ESTADÍSTICAS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', marginBottom: '25px' }}>
        <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px', borderRadius: '12px', color: 'white', boxShadow: '0 4px 15px rgba(102,126,234,0.4)' }}>
          <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>📦 Stock Total</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{stats.totalStock}</div>
          <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '5px' }}>unidades totales</div>
        </div>
        
        <div style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', padding: '20px', borderRadius: '12px', color: 'white', boxShadow: '0 4px 15px rgba(245,87,108,0.4)' }}>
          <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>⚠️ Alertas Bajas</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{stats.productosAlerta}</div>
          <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '5px' }}>productos bajo mínimo</div>
        </div>
        
        <div style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', padding: '20px', borderRadius: '12px', color: 'white', boxShadow: '0 4px 15px rgba(79,172,254,0.4)' }}>
          <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>📊 Promedio Stock</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{stats.stockPromedio}</div>
          <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '5px' }}>unidades por producto</div>
        </div>
        
        <div style={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', padding: '20px', borderRadius: '12px', color: 'white', boxShadow: '0 4px 15px rgba(250,112,154,0.4)' }}>
          <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>🍱 Total Sabores</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{productos.length}</div>
          <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '5px' }}>productos registrados</div>
        </div>
      </div>

      {/* --- GRÁFICA 1: REPORTE DIARIO --- */}
      <div style={{ background: '#fff', padding: '25px', borderRadius: '12px', marginBottom: '25px', boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{margin: 0, color: '#1e293b', fontSize: '20px'}}>📅 Movimiento Diario (Últimos 14 días)</h3>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            <span style={{ color: '#10b981', fontWeight: 'bold' }}>●</span> Entradas  
            <span style={{ marginLeft: '15px', color: '#ef4444', fontWeight: 'bold' }}>●</span> Salidas
          </div>
        </div>
        <div style={{ height: `${alturaGrafica}px`, overflowY: keysEntrada.length + keysSalida.length > 8 ? 'auto' : 'visible' }}>
          <ResponsiveContainer width="100%" height={alturaGrafica}>
            <BarChart data={datosDiarios} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#64748b" />
              <YAxis label={{ value: 'Unidades', angle: -90, position: 'insideLeft', style: { fill: '#64748b' } }} tick={{ fontSize: 12 }} stroke="#64748b" />
              <Tooltip content={<CustomTooltip />} />
              <Legend content={renderLegend} wrapperStyle={{ paddingTop: '20px' }} />
              {/* Barras Apiladas: Entradas (A) y Salidas (B) */}
              {keysEntrada.map((key, i) => <Bar key={key} dataKey={key} stackId="a" fill={COLORES_ENTRADA[i%COLORES_ENTRADA.length]} name={key.replace("Entrada: ", "📦 ")} radius={[4, 4, 0, 0]} />)}
              {keysSalida.map((key, i) => <Bar key={key} dataKey={key} stackId="b" fill={COLORES_SALIDA[i%COLORES_SALIDA.length]} name={key.replace("Salida: ", "🛍️ ")} radius={[4, 4, 0, 0]} />)}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* --- GRÁFICA 2: REPORTE MENSUAL --- */}
      <div style={{ background: '#fff', padding: '25px', borderRadius: '12px', marginBottom: '25px', boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{margin: 0, color: '#1e293b', fontSize: '20px'}}>� Histórico Mensual</h3>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Vista consolidada por mes
          </div>
        </div>
        <div style={{ height: `${alturaMensual}px`, overflowY: keysEntrada.length + keysSalida.length > 8 ? 'auto' : 'visible' }}>
          <ResponsiveContainer width="100%" height={alturaMensual}>
            <BarChart data={datosMensuales} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#64748b" />
              <YAxis label={{ value: 'Unidades', angle: -90, position: 'insideLeft', style: { fill: '#64748b' } }} tick={{ fontSize: 12 }} stroke="#64748b" />
              <Tooltip content={<CustomTooltip />} />
              <Legend content={renderLegend} wrapperStyle={{ paddingTop: '20px' }} />
              {keysEntrada.map((key, i) => <Bar key={key} dataKey={key} stackId="a" fill={COLORES_ENTRADA[i%COLORES_ENTRADA.length]} name={key.replace("Entrada: ", "📦 ")} radius={[4, 4, 0, 0]} />)}
              {keysSalida.map((key, i) => <Bar key={key} dataKey={key} stackId="b" fill={COLORES_SALIDA[i%COLORES_SALIDA.length]} name={key.replace("Salida: ", "🛍️ ")} radius={[4, 4, 0, 0]} />)}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        
        {/* TABLA DE CONFIGURACIÓN */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', overflowX: 'auto', boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#1e293b', fontSize: '20px' }}>📦 Configuración de Productos</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{background: '#f1f5f9', textAlign: 'left', color: '#475569'}}>
                  <th style={{padding: '12px 8px', fontWeight: '600'}}>Producto</th>
                  <th style={{padding: '12px 8px', fontWeight: '600'}}>Stock</th>
                  <th style={{padding: '12px 8px', fontWeight: '600'}} title="Unidades que entran por Bandeja">u/Bandeja</th>
                  <th style={{padding: '12px 8px', fontWeight: '600'}} title="Unidades que salen por Bolsa">u/Bolsa</th>
                  <th style={{padding: '12px 8px', fontWeight: '600'}}>Min Alerta</th>
                  <th style={{padding: '12px 8px', fontWeight: '600'}}></th>
                </tr>
              </thead>
              <tbody>
                {productos.map(p => {
                  const esBajoStock = p.stock_actual <= p.stock_minimo;
                  return (
                    <tr key={p.id} style={{borderBottom: '1px solid #e2e8f0', background: esBajoStock ? '#fef2f2' : 'transparent'}}>
                      <td style={{padding: '12px 8px', fontWeight: '600', color: '#1e293b'}}>
                        {esBajoStock && <span style={{color: '#ef4444', marginRight: '5px'}}>⚠️</span>}
                        {p.nombre}
                      </td>
                      <td style={{padding: '12px 8px', fontSize: '16px', color: esBajoStock ? '#ef4444' : '#0ea5e9', fontWeight:'700'}}>
                        {p.stock_actual}
                      </td>
                      
                      {/* Inputs Editables */}
                      <td style={{padding: '12px 8px'}}>
                        <input 
                          type="number" 
                          defaultValue={p.unidades_por_bandeja} 
                          onBlur={e=>actualizarConfig(p, 'unidades_por_bandeja', e.target.value)} 
                          style={{width:'60px', background:'#ecfdf5', border:'1px solid #6ee7b7', padding:'6px', textAlign:'center', borderRadius:'6px', fontSize:'13px', fontWeight:'600'}} 
                        />
                      </td>
                      <td style={{padding: '12px 8px'}}>
                        <input 
                          type="number" 
                          defaultValue={p.unidades_por_bolsa} 
                          onBlur={e=>actualizarConfig(p, 'unidades_por_bolsa', e.target.value)} 
                          style={{width:'60px', background:'#fef2f2', border:'1px solid #fca5a5', padding:'6px', textAlign:'center', borderRadius:'6px', fontSize:'13px', fontWeight:'600'}} 
                        />
                      </td>
                      <td style={{padding: '12px 8px'}}>
                        <input 
                          type="number" 
                          defaultValue={p.stock_minimo} 
                          onBlur={e=>actualizarConfig(p, 'stock_minimo', e.target.value)} 
                          style={{width:'60px', padding:'6px', textAlign:'center', border:'1px solid #cbd5e1', borderRadius:'6px', fontSize:'13px', fontWeight:'600', background:'#f8fafc'}} 
                        />
                      </td>
                      
                      <td style={{padding: '12px 8px', textAlign:'center'}}>
                        <button 
                          onClick={() => borrarProducto(p.id)} 
                          style={{border:'none', background:'#fee2e2', color:'#dc2626', cursor:'pointer', padding:'6px 10px', borderRadius:'6px', fontSize:'16px', transition:'all 0.2s'}}
                          onMouseOver={(e) => e.target.style.background = '#fecaca'}
                          onMouseOut={(e) => e.target.style.background = '#fee2e2'}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* FORMULARIO NUEVO PRODUCTO */}
        <div style={{ background: 'linear-gradient(135deg, #e0f2fe 0%, #dbeafe 100%)', padding: '25px', borderRadius: '12px', height: 'fit-content', boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>
          <h3 style={{marginTop: 0, color: '#0c4a6e', fontSize: '20px'}}>➕ Agregar Nuevo Sabor</h3>
          
          <label style={{fontSize:'12px', fontWeight:'bold', color:'#334155', display:'block', marginBottom:'5px'}}>Nombre del Producto</label>
          <input 
            placeholder="Ej: Cuñapé, Pollo, Carne..." 
            value={nuevoProducto.nombre}
            onChange={e => setNuevoProducto({...nuevoProducto, nombre: e.target.value})}
            style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius:'8px', border:'2px solid #38bdf8', boxSizing: 'border-box', fontSize:'14px' }} 
          />
          
          <div style={{display:'flex', gap:'12px', marginBottom:'15px'}}>
             <div style={{flex:1}}>
               <label style={{fontSize:'11px', fontWeight:'bold', color:'#334155', display:'block', marginBottom:'5px'}}>📦 Unid/Bandeja</label>
               <input 
                 type="number" 
                 value={nuevoProducto.unidades_por_bandeja} 
                 onChange={e => setNuevoProducto({...nuevoProducto, unidades_por_bandeja: e.target.value})} 
                 style={{width: '100%', padding:'10px', borderRadius:'8px', border:'2px solid #6ee7b7', boxSizing: 'border-box', fontSize:'14px', fontWeight:'600'}} 
               />
             </div>
             <div style={{flex:1}}>
               <label style={{fontSize:'11px', fontWeight:'bold', color:'#334155', display:'block', marginBottom:'5px'}}>🛍️ Unid/Bolsa</label>
               <input 
                 type="number" 
                 value={nuevoProducto.unidades_por_bolsa} 
                 onChange={e => setNuevoProducto({...nuevoProducto, unidades_por_bolsa: e.target.value})} 
                 style={{width: '100%', padding:'10px', borderRadius:'8px', border:'2px solid #fca5a5', boxSizing: 'border-box', fontSize:'14px', fontWeight:'600'}} 
               />
             </div>
          </div>

          <label style={{fontSize:'11px', fontWeight:'bold', color:'#334155', display:'block', marginBottom:'5px'}}>⚠️ Stock Mínimo (Alerta)</label>
          <input 
            type="number" 
            value={nuevoProducto.stock_minimo} 
            onChange={e => setNuevoProducto({...nuevoProducto, stock_minimo: e.target.value})} 
            style={{width: '100%', padding: '12px', marginBottom: '20px', borderRadius:'8px', border:'2px solid #38bdf8', boxSizing: 'border-box', fontSize:'14px', fontWeight:'600'}} 
          />
          
          <button 
            onClick={crearProducto} 
            style={{width: '100%', padding: '14px', background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)', color: 'white', border: 'none', borderRadius: '8px', fontWeight:'700', cursor:'pointer', boxShadow: '0 4px 10px rgba(14,165,233,0.4)', fontSize:'15px', transition:'all 0.2s'}}
            onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
          >
            ✨ Crear Producto
          </button>
        </div>
      </div>
    </div>
  )
}
export default Dashboard