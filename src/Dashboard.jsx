import { useState, useEffect } from 'react'
import axios from 'axios'
import { supabase } from './supabaseClient'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from 'recharts'

function Dashboard() {
  const [productos, setProductos] = useState([])
  const [reporte, setReporte] = useState([])
  const [nuevoProducto, setNuevoProducto] = useState({ nombre: '', stock_minimo: 10 })
  const navigate = useNavigate()

  // ⚠️ TU URL DE RENDER
  const API_URL = "https://api-saltenas.onrender.com"

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) navigate('/')
    }
    checkUser()
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    try {
      // 1. Cargar Inventario
      const prodRes = await axios.get(`${API_URL}/inventario`)
      setProductos(prodRes.data)

      // 2. Cargar Reporte
      const repRes = await axios.get(`${API_URL}/admin/reportes/mensual`)
      const datosGrafica = Object.keys(repRes.data).map(fecha => ({
        name: fecha,
        Ventas: repRes.data[fecha].salidas,      // Son Bolsas
        Produccion: repRes.data[fecha].entradas  // Son Bolsas
      }))
      setReporte(datosGrafica)
    } catch (error) {
      console.error("Error cargando datos:", error)
    }
  }

  const crearProducto = async () => {
    if (!nuevoProducto.nombre) return alert("Escribe un nombre")
    try {
      await axios.post(`${API_URL}/admin/productos`, nuevoProducto)
      alert("✅ Producto creado exitosamente")
      setNuevoProducto({ nombre: '', stock_minimo: 10 }) // Limpiar
      cargarDatos()
    } catch (e) { alert("❌ Error: Posiblemente ya existe ese nombre") }
  }

  const borrarProducto = async (id) => {
    if(confirm("⚠ PELIGRO: ¿Estás seguro de borrar este producto y todo su historial?")) {
      await axios.delete(`${API_URL}/admin/productos/${id}`)
      cargarDatos()
    }
  }

  const ajustarMinimo = async (id, nuevoMinimo) => {
    await axios.put(`${API_URL}/admin/productos/${id}`, { stock_minimo: parseInt(nuevoMinimo) })
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1100px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1 style={{margin: 0}}>📊 Panel de Control</h1>
          <p style={{margin: 0, color: '#666'}}>Vista de Supervisor (1 Bolsa = 10 Unidades)</p>
        </div>
        <button onClick={async () => { await supabase.auth.signOut(); navigate('/') }} style={{background: '#333', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer'}}>
          Cerrar Sesión
        </button>
      </div>

      {/* GRÁFICA */}
      <div style={{ background: '#fff', padding: '20px', borderRadius: '15px', marginBottom: '30px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', height: '350px' }}>
        <h3 style={{marginTop: 0}}>📈 Movimiento de Bolsas (Mensual)</h3>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={reporte}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="Produccion" fill="#82ca9d" name="Bolsas Producidas" />
            <Bar dataKey="Ventas" fill="#8884d8" name="Bolsas Vendidas" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px' }}>
        
        {/* TABLA DE INVENTARIO */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
          <h3 style={{marginTop: 0}}>📦 Stock Actual</h3>
          <div style={{overflowX: 'auto'}}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '500px' }}>
              <thead>
                <tr style={{background: '#f8f9fa', color: '#666', fontSize: '14px', textAlign: 'left'}}>
                  <th style={{padding: '12px'}}>Sabor</th>
                  <th>Bolsas (Stock)</th>
                  <th>Unidades (x10)</th>
                  <th>Mínimo (Alerta)</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {productos.map(p => (
                  <tr key={p.id} style={{borderBottom: '1px solid #eee'}}>
                    <td style={{padding: '12px', fontWeight: 'bold'}}>{p.nombre}</td>
                    
                    {/* Columna BOLSAS */}
                    <td style={{fontSize: '16px'}}>
                      {p.stock_actual}
                    </td>

                    {/* Columna UNIDADES (Cálculo Visual) */}
                    <td style={{color: '#007bff', fontWeight: 'bold'}}>
                      {p.stock_actual * 10}
                    </td>

                    {/* Columna ALERTA */}
                    <td>
                      <input 
                        type="number" 
                        defaultValue={p.stock_minimo} 
                        onBlur={(e) => ajustarMinimo(p.id, e.target.value)}
                        style={{ 
                          width: '50px', 
                          padding: '5px', 
                          borderRadius: '5px',
                          border: `2px solid ${p.stock_actual < p.stock_minimo ? 'red' : '#ddd'}`,
                          color: p.stock_actual < p.stock_minimo ? 'red' : 'black',
                          fontWeight: 'bold'
                        }}
                      />
                    </td>
                    <td>
                      <button onClick={() => borrarProducto(p.id)} style={{ background: '#ffebee', color: 'red', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer' }}>
                        Borrar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FORMULARIO NUEVO PRODUCTO */}
        <div style={{ background: '#e3f2fd', padding: '25px', borderRadius: '15px', height: 'fit-content' }}>
          <h3 style={{marginTop: 0, color: '#0d47a1'}}>➕ Nuevo Sabor</h3>
          <p style={{fontSize: '13px', color: '#555', marginBottom: '15px'}}>
            Agrega una nueva referencia. Recuerda definir el stock mínimo en <strong>Bolsas</strong>.
          </p>
          
          <label style={{display: 'block', fontSize: '12px', marginBottom: '5px', fontWeight: 'bold'}}>Nombre del Producto</label>
          <input 
            type="text" 
            placeholder="Ej: Salteña de Fricasé" 
            value={nuevoProducto.nombre}
            onChange={e => setNuevoProducto({...nuevoProducto, nombre: e.target.value})}
            style={{ width: '100%', marginBottom: '15px', padding: '10px', borderRadius: '8px', border: '1px solid #bbdefb', boxSizing: 'border-box' }}
          />
          
          <label style={{display: 'block', fontSize: '12px', marginBottom: '5px', fontWeight: 'bold'}}>Alerta (Mínimo de Bolsas)</label>
          <input 
            type="number" 
            placeholder="Ej: 10" 
            value={nuevoProducto.stock_minimo}
            onChange={e => setNuevoProducto({...nuevoProducto, stock_minimo: parseInt(e.target.value)})}
            style={{ width: '100%', marginBottom: '20px', padding: '10px', borderRadius: '8px', border: '1px solid #bbdefb', boxSizing: 'border-box' }}
          />
          
          <button 
            onClick={crearProducto} 
            style={{
              width: '100%', 
              padding: '12px', 
              background: '#1976d2', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              fontWeight: 'bold', 
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(25, 118, 210, 0.2)'
            }}
          >
            Crear Producto
          </button>
        </div>

      </div>
    </div>
  )
}

export default Dashboard