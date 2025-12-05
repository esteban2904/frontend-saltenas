import { useState, useEffect } from 'react'
import axios from 'axios'
import { supabase } from './supabaseClient'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from 'recharts'

// Colores para diferenciar los sabores en la gráfica
const COLORES = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe', '#00C49F', '#FFBB28'];

function Dashboard() {
  const [productos, setProductos] = useState([])
  const [datosGrafica, setDatosGrafica] = useState([]) 
  const [nombresProductos, setNombresProductos] = useState([])
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
      
      // Guardar lista de nombres únicos para las barras de colores
      const nombres = prodRes.data.map(p => p.nombre)
      setNombresProductos(nombres)

      // 2. Cargar Reporte Mensual
      const repRes = await axios.get(`${API_URL}/admin/reportes/mensual`)
      const rawData = repRes.data
      
      // Transformar datos para Recharts (Formato Apilado)
      const datosTransformados = Object.keys(rawData).map(fecha => {
        const fila = { name: fecha }
        Object.keys(rawData[fecha]).forEach(prod => {
          fila[prod] = rawData[fecha][prod]
        })
        return fila
      })

      // Ordenar cronológicamente
      datosTransformados.sort((a, b) => a.name.localeCompare(b.name))
      setDatosGrafica(datosTransformados)

    } catch (error) {
      console.error("Error cargando datos:", error)
    }
  }

  // --- ACCIONES DE GESTIÓN ---

  const crearProducto = async () => {
    if (!nuevoProducto.nombre) return alert("Escribe un nombre")
    try {
      await axios.post(`${API_URL}/admin/productos`, nuevoProducto)
      alert("✅ Producto creado exitosamente")
      setNuevoProducto({ nombre: '', stock_minimo: 10 }) 
      cargarDatos()
    } catch (e) { alert("❌ Error: Posiblemente ya existe ese nombre") }
  }

  const borrarProducto = async (id) => {
    if(confirm("⚠ PELIGRO: ¿Estás seguro de borrar este producto y todo su historial de ventas?")) {
      await axios.delete(`${API_URL}/admin/productos/${id}`)
      cargarDatos()
    }
  }

  const ajustarMinimo = async (id, nuevoMinimo) => {
    await axios.put(`${API_URL}/admin/productos/${id}`, { stock_minimo: parseInt(nuevoMinimo) })
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1 style={{margin: 0, color: '#333'}}>📊 Dashboard Gerencial</h1>
          <p style={{margin: 0, color: '#666'}}>1 Bolsa = 10 Unidades</p>
        </div>
        <button 
          onClick={async () => { await supabase.auth.signOut(); navigate('/') }} 
          style={{background: '#343a40', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer'}}
        >
          Cerrar Sesión
        </button>
      </div>

      {/* GRÁFICA APILADA DE VENTAS */}
      <div style={{ background: '#fff', padding: '25px', borderRadius: '12px', marginBottom: '30px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', height: '400px' }}>
        <h3 style={{marginTop: 0, color: '#444'}}>📈 Ventas por Sabor (Bolsas Mensuales)</h3>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={datosGrafica}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" />
            <YAxis label={{ value: 'Bolsas Vendidas', angle: -90, position: 'insideLeft' }} />
            <Tooltip cursor={{fill: '#f5f5f5'}} />
            <Legend />
            
            {/* Generamos una barra apilada por cada producto */}
            {nombresProductos.map((nombre, index) => (
              <Bar 
                key={nombre} 
                dataKey={nombre} 
                stackId="a" 
                fill={COLORES[index % COLORES.length]} 
                name={nombre}
                radius={[4, 4, 0, 0]} // Redondeamos solo la punta superior si es el último, pero aquí redondeamos todos para efecto visual suave
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px' }}>
        
        {/* TABLA DE INVENTARIO */}
        <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          <h3 style={{marginTop: 0, color: '#444'}}>📦 Stock Actual</h3>
          <div style={{overflowX: 'auto'}}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
              <thead>
                <tr style={{background: '#f8f9fa', color: '#666', fontSize: '14px', textAlign: 'left', borderBottom: '2px solid #eee'}}>
                  <th style={{padding: '12px'}}>Sabor</th>
                  <th>Bolsas</th>
                  <th>Unidades (x10)</th>
                  <th>Alerta (Bolsas)</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {productos.map(p => (
                  <tr key={p.id} style={{borderBottom: '1px solid #f1f1f1'}}>
                    <td style={{padding: '12px', fontWeight: 'bold', color: '#333'}}>{p.nombre}</td>
                    
                    {/* Columna BOLSAS */}
                    <td style={{fontSize: '16px', fontWeight: 'bold'}}>
                      {p.stock_actual}
                    </td>

                    {/* Columna UNIDADES */}
                    <td style={{color: '#007bff', fontWeight: '600'}}>
                      {p.stock_actual * 10}
                    </td>

                    {/* Columna ALERTA */}
                    <td>
                      <input 
                        type="number" 
                        defaultValue={p.stock_minimo} 
                        onBlur={(e) => ajustarMinimo(p.id, e.target.value)}
                        style={{ 
                          width: '60px', 
                          padding: '6px', 
                          borderRadius: '6px',
                          border: `2px solid ${p.stock_actual < p.stock_minimo ? '#ff6b6b' : '#dee2e6'}`,
                          color: p.stock_actual < p.stock_minimo ? '#e03131' : '#495057',
                          fontWeight: 'bold',
                          textAlign: 'center'
                        }}
                      />
                    </td>
                    <td>
                      <button 
                        onClick={() => borrarProducto(p.id)} 
                        style={{ background: '#ffe3e3', color: '#c92a2a', border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FORMULARIO NUEVO PRODUCTO */}
        <div style={{ background: '#e7f5ff', padding: '25px', borderRadius: '12px', height: 'fit-content' }}>
          <h3 style={{marginTop: 0, color: '#1864ab'}}>➕ Nuevo Sabor</h3>
          <p style={{fontSize: '13px', color: '#1c7ed6', marginBottom: '20px', lineHeight: '1.4'}}>
            Agrega una nueva referencia al catálogo. El stock inicial será 0.
          </p>
          
          <div style={{marginBottom: '15px'}}>
            <label style={{display: 'block', fontSize: '12px', marginBottom: '6px', fontWeight: 'bold', color: '#339af0'}}>Nombre del Producto</label>
            <input 
              type="text" 
              placeholder="Ej: Salteña de Fricasé" 
              value={nuevoProducto.nombre}
              onChange={e => setNuevoProducto({...nuevoProducto, nombre: e.target.value})}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #a5d8ff', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
          
          <div style={{marginBottom: '20px'}}>
            <label style={{display: 'block', fontSize: '12px', marginBottom: '6px', fontWeight: 'bold', color: '#339af0'}}>Mínimo de Bolsas (Alerta)</label>
            <input 
              type="number" 
              placeholder="Ej: 10" 
              value={nuevoProducto.stock_minimo}
              onChange={e => setNuevoProducto({...nuevoProducto, stock_minimo: parseInt(e.target.value)})}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #a5d8ff', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
          
          <button 
            onClick={crearProducto} 
            style={{
              width: '100%', 
              padding: '14px', 
              background: '#1971c2', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              fontWeight: 'bold', 
              cursor: 'pointer',
              fontSize: '15px',
              boxShadow: '0 4px 6px rgba(25, 113, 194, 0.2)',
              transition: 'background 0.2s'
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