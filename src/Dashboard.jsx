import { useState, useEffect } from 'react'
import axios from 'axios'
import { supabase } from './supabaseClient'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from 'recharts'

// Paletas de colores distintas para Entrada y Salida
const COLORES_ENTRADA = ['#82ca9d', '#00C49F', '#0088fe', '#009688', '#4caf50', '#8bc34a'];
const COLORES_SALIDA = ['#ff7300', '#ffc658', '#ff6b6b', '#d32f2f', '#f44336', '#ff9800'];

function Dashboard() {
  const [productos, setProductos] = useState([])
  const [datosGrafica, setDatosGrafica] = useState([]) 
  const [keysEntrada, setKeysEntrada] = useState([]) // Nombres de productos que entraron
  const [keysSalida, setKeysSalida] = useState([])   // Nombres de productos que salieron
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
      
      // 2. Cargar Reporte Mensual Desglosado
      const repRes = await axios.get(`${API_URL}/admin/reportes/mensual`)
      const rawData = repRes.data
      
      // Conjuntos para detectar qué productos tienen movimiento
      const entradasSet = new Set()
      const salidasSet = new Set()

      // Transformar datos para Recharts
      const datosTransformados = Object.keys(rawData).map(fecha => {
        const fila = { name: fecha }
        Object.keys(rawData[fecha]).forEach(key => {
          fila[key] = rawData[fecha][key]
          
          // Clasificamos las llaves para saber qué barras pintar
          // El backend envía claves como "Entrada: Pollo" o "Salida: Carne"
          if (key.startsWith("Entrada:")) entradasSet.add(key)
          if (key.startsWith("Salida:")) salidasSet.add(key)
        })
        return fila
      })

      // Ordenar cronológicamente
      datosTransformados.sort((a, b) => a.name.localeCompare(b.name))
      
      setDatosGrafica(datosTransformados)
      setKeysEntrada(Array.from(entradasSet))
      setKeysSalida(Array.from(salidasSet))

    } catch (error) {
      console.error("Error cargando datos:", error)
    }
  }

  const crearProducto = async () => {
    if (!nuevoProducto.nombre) return alert("Escribe un nombre")
    try {
      await axios.post(`${API_URL}/admin/productos`, nuevoProducto)
      alert("✅ Producto creado")
      setNuevoProducto({ nombre: '', stock_minimo: 10 }) 
      cargarDatos()
    } catch (e) { alert("❌ Error") }
  }

  const borrarProducto = async (id) => {
    if(confirm("⚠ PELIGRO: ¿Estás seguro de borrar este producto y todo su historial?")) {
      await axios.delete(`${API_URL}/admin/productos/${id}`)
      cargarDatos()
    }
  }

  const ajustarMinimo = async (id, val) => {
    await axios.put(`${API_URL}/admin/productos/${id}`, { stock_minimo: parseInt(val) })
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
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

      {/* GRÁFICA DE DOBLE PILA */}
      <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', marginBottom: '30px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', height: '450px' }}>
        <h3 style={{marginTop: 0, color: '#444'}}>📈 Flujo de Bolsas (Producción vs Ventas)</h3>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={datosGrafica}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" />
            <YAxis label={{ value: 'Bolsas', angle: -90, position: 'insideLeft' }} />
            <Tooltip 
              contentStyle={{borderRadius: '10px', border: 'none', boxShadow: '0 2px 10px rgba(0,0,0,0.1)'}} 
              cursor={{fill: '#f5f5f5'}}
            />
            <Legend />
            
            {/* Pila A: Entradas (Verdes) */}
            {keysEntrada.map((key, index) => (
              <Bar 
                key={key} 
                dataKey={key} 
                stackId="a" // Agrupa todo lo que sea "a" en una columna
                fill={COLORES_ENTRADA[index % COLORES_ENTRADA.length]} 
                name={key.replace("Entrada: ", "Prod: ")}
              />
            ))}

            {/* Pila B: Salidas (Rojas/Naranjas) */}
            {keysSalida.map((key, index) => (
              <Bar 
                key={key} 
                dataKey={key} 
                stackId="b" // Agrupa todo lo que sea "b" en otra columna al lado
                fill={COLORES_SALIDA[index % COLORES_SALIDA.length]} 
                name={key.replace("Salida: ", "Venta: ")}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px' }}>
        
        {/* TABLA DE INVENTARIO */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          <h3 style={{marginTop: 0, color: '#444'}}>📦 Stock Actual</h3>
          <div style={{overflowX: 'auto'}}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
              <thead>
                <tr style={{background: '#f8f9fa', color: '#666', fontSize: '14px', textAlign: 'left'}}>
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
                    <td style={{padding: '12px', fontWeight: 'bold'}}>{p.nombre}</td>
                    <td style={{fontSize: '16px', fontWeight: 'bold'}}>{p.stock_actual}</td>
                    <td style={{color: '#007bff'}}>{p.stock_actual * 10}</td>
                    <td>
                      <input 
                        type="number" 
                        defaultValue={p.stock_minimo} 
                        onBlur={(e) => ajustarMinimo(p.id, e.target.value)}
                        style={{ width: '50px', padding: '5px', borderRadius: '5px', border: '1px solid #ddd' }}
                      />
                    </td>
                    <td><button onClick={() => borrarProducto(p.id)} style={{border:'none', background:'transparent', cursor:'pointer'}}>❌</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FORMULARIO */}
        <div style={{ background: '#e7f5ff', padding: '20px', borderRadius: '12px', height: 'fit-content' }}>
          <h3 style={{marginTop: 0, color: '#1864ab'}}>➕ Nuevo Sabor</h3>
          <input 
            placeholder="Nombre (Ej: Fricasé)" 
            value={nuevoProducto.nombre}
            onChange={e => setNuevoProducto({...nuevoProducto, nombre: e.target.value})}
            style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #a5d8ff', boxSizing: 'border-box' }}
          />
          <input 
            type="number" placeholder="Alerta Mínimo" 
            value={nuevoProducto.stock_minimo}
            onChange={e => setNuevoProducto({...nuevoProducto, stock_minimo: parseInt(e.target.value)})}
            style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '8px', border: '1px solid #a5d8ff', boxSizing: 'border-box' }}
          />
          <button onClick={crearProducto} style={{width: '100%', padding: '12px', background: '#1971c2', color: 'white', border: 'none', borderRadius: '8px', cursor:'pointer', fontWeight: 'bold'}}>
            Crear Producto
          </button>
        </div>

      </div>
    </div>
  )
}

export default Dashboard