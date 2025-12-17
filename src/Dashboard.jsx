import { useState, useEffect } from 'react'
import axios from 'axios'
import { supabase } from './supabaseClient'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from 'recharts'

const COLORES_ENTRADA = ['#82ca9d', '#00C49F', '#0088fe', '#009688'];
const COLORES_SALIDA = ['#ff7300', '#ffc658', '#ff6b6b', '#d32f2f'];

function Dashboard() {
  const [productos, setProductos] = useState([])
  const [datosGrafica, setDatosGrafica] = useState([]) 
  const [keysEntrada, setKeysEntrada] = useState([]) 
  const [keysSalida, setKeysSalida] = useState([])   
  // Configuramos valores por defecto: 30 por bandeja, 10 por bolsa
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
      const repRes = await axios.get(`${API_URL}/admin/reportes/mensual`)
      const rawData = repRes.data || {} 
      
      const entradasSet = new Set()
      const salidasSet = new Set()

      // Transformar datos para la gráfica
      const datosTransformados = Object.keys(rawData).map(fecha => {
        const fila = { name: fecha }
        Object.keys(rawData[fecha]).forEach(key => {
          fila[key] = rawData[fecha][key]
          if (key.startsWith("Entrada:")) entradasSet.add(key)
          if (key.startsWith("Salida:")) salidasSet.add(key)
        })
        return fila
      })

      datosTransformados.sort((a, b) => a.name.localeCompare(b.name))
      setDatosGrafica(datosTransformados)
      setKeysEntrada(Array.from(entradasSet))
      setKeysSalida(Array.from(salidasSet))
    } catch (error) { console.error(error) } finally { setLoading(false) }
  }

  // --- ACCIONES DE GESTIÓN ---

  const crearProducto = async () => {
    if (!nuevoProducto.nombre) return alert("Escribe un nombre")
    try {
      await axios.post(`${API_URL}/admin/productos`, nuevoProducto)
      alert("✅ Producto creado")
      setNuevoProducto({ nombre: '', stock_minimo: 100, unidades_por_bandeja: 30, unidades_por_bolsa: 10 }) 
      cargarDatos()
    } catch (e) { alert("❌ Error: Posiblemente ya existe") }
  }

  const borrarProducto = async (id) => {
    if(confirm("⚠ PELIGRO: Se borrará el historial completo de este producto.")) {
      await axios.delete(`${API_URL}/admin/productos/${id}`)
      cargarDatos()
    }
  }

  const actualizarConfig = async (p, campo, valor) => {
    const valorInt = parseInt(valor) || 0
    // Enviamos todos los datos necesarios para la actualización
    const edicion = {
      stock_minimo: p.stock_minimo,
      unidades_por_bandeja: p.unidades_por_bandeja,
      unidades_por_bolsa: p.unidades_por_bolsa,
      [campo]: valorInt // Sobreescribimos solo el que cambió
    }
    await axios.put(`${API_URL}/admin/productos/${p.id}`, edicion)
  }

  if (loading) return <div style={{padding:'50px',textAlign:'center'}}>Cargando Sistema...</div>

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Arial' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{margin: 0}}>📊 Dashboard Maestro</h1>
          <p style={{margin: 0, color: '#666'}}>Control de Unidades Reales</p>
        </div>
        <button onClick={async () => { await supabase.auth.signOut(); navigate('/') }} style={{background: '#333', color:'white', padding:'10px', border:'none', cursor:'pointer'}}>Salir</button>
      </div>

      {/* GRÁFICA DE FLUJO DE UNIDADES */}
      <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', marginBottom: '30px', height: '400px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <h3 style={{marginTop: 0}}>📈 Flujo de Unidades (Sueltas)</h3>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={datosGrafica}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" />
            <YAxis label={{ value: 'Unidades', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend />
            {keysEntrada.map((key, i) => <Bar key={key} dataKey={key} stackId="a" fill={COLORES_ENTRADA[i%4]} name={key.replace("Entrada: ", "Prod: ")} />)}
            {keysSalida.map((key, i) => <Bar key={key} dataKey={key} stackId="b" fill={COLORES_SALIDA[i%4]} name={key.replace("Salida: ", "Venta: ")} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        
        {/* TABLA CONFIGURABLE */}
        <div style={{ background: 'white', padding: '15px', borderRadius: '12px', overflowX: 'auto', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <h3>📦 Configuración de Productos</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{background: '#f8f9fa', textAlign: 'left'}}>
                <th style={{padding: '8px'}}>Producto</th>
                <th>Stock (Unid)</th>
                <th title="Unidades que entran al escanear en Producción">u/Bandeja</th>
                <th title="Unidades que salen al escanear en Venta">u/Bolsa</th>
                <th>Min Alerta</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {productos.map(p => (
                <tr key={p.id} style={{borderBottom: '1px solid #eee'}}>
                  <td style={{padding: '8px', fontWeight: 'bold'}}>{p.nombre}</td>
                  <td style={{fontSize: '15px', color: '#007bff', fontWeight:'bold'}}>{p.stock_actual}</td>
                  
                  {/* EDITAR BANDEJA (Producción) */}
                  <td>
                    <input 
                      type="number" 
                      defaultValue={p.unidades_por_bandeja} 
                      onBlur={e=>actualizarConfig(p, 'unidades_por_bandeja', e.target.value)} 
                      style={{width:'50px', background:'#e8f5e9', border:'1px solid #c8e6c9', padding:'4px', textAlign:'center'}} 
                    />
                  </td>
                  
                  {/* EDITAR BOLSA (Venta) */}
                  <td>
                    <input 
                      type="number" 
                      defaultValue={p.unidades_por_bolsa} 
                      onBlur={e=>actualizarConfig(p, 'unidades_por_bolsa', e.target.value)} 
                      style={{width:'50px', background:'#ffebee', border:'1px solid #ffcdd2', padding:'4px', textAlign:'center'}} 
                    />
                  </td>
                  
                  {/* EDITAR ALERTA */}
                  <td>
                    <input 
                      type="number" 
                      defaultValue={p.stock_minimo} 
                      onBlur={e=>actualizarConfig(p, 'stock_minimo', e.target.value)} 
                      style={{width:'50px', padding:'4px', textAlign:'center'}} 
                    />
                  </td>
                  
                  <td><button onClick={() => borrarProducto(p.id)} style={{border:'none', background:'transparent', cursor:'pointer'}}>❌</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* FORMULARIO */}
        <div style={{ background: '#e7f5ff', padding: '20px', borderRadius: '12px', height: 'fit-content', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <h3 style={{marginTop: 0, color: '#1864ab'}}>➕ Nuevo Sabor</h3>
          
          <input 
            placeholder="Nombre (Ej: Cuñapé)" 
            value={nuevoProducto.nombre}
            onChange={e => setNuevoProducto({...nuevoProducto, nombre: e.target.value})}
            style={{ width: '100%', padding: '8px', marginBottom: '10px', borderRadius:'5px', border:'1px solid #90caf9' }} 
          />
          
          <div style={{display:'flex', gap:'10px', marginBottom:'10px'}}>
             <div style={{flex:1}}>
               <label style={{fontSize:'11px', fontWeight:'bold', color:'#555'}}>Unid/Bandeja</label>
               <input 
                 type="number" 
                 value={nuevoProducto.unidades_por_bandeja} 
                 onChange={e => setNuevoProducto({...nuevoProducto, unidades_por_bandeja: e.target.value})} 
                 style={{width: '100%', padding:'5px', borderRadius:'5px', border:'1px solid #ddd'}} 
               />
             </div>
             <div style={{flex:1}}>
               <label style={{fontSize:'11px', fontWeight:'bold', color:'#555'}}>Unid/Bolsa</label>
               <input 
                 type="number" 
                 value={nuevoProducto.unidades_por_bolsa} 
                 onChange={e => setNuevoProducto({...nuevoProducto, unidades_por_bolsa: e.target.value})} 
                 style={{width: '100%', padding:'5px', borderRadius:'5px', border:'1px solid #ddd'}} 
               />
             </div>
          </div>

          <label style={{fontSize:'11px', fontWeight:'bold', color:'#555'}}>Mínimo Alerta (Unidades Totales)</label>
          <input 
            type="number" 
            value={nuevoProducto.stock_minimo} 
            onChange={e => setNuevoProducto({...nuevoProducto, stock_minimo: e.target.value})} 
            style={{width: '100%', padding: '8px', marginBottom: '15px', borderRadius:'5px', border:'1px solid #ddd'}} 
          />
          
          <button onClick={crearProducto} style={{width: '100%', padding: '10px', background: '#1971c2', color: 'white', border: 'none', borderRadius: '5px', fontWeight:'bold', cursor:'pointer'}}>
            Crear Producto
          </button>
        </div>
      </div>
    </div>
  )
}
export default Dashboard