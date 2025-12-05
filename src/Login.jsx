import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { useNavigate } from 'react-router-dom'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // 1. Verificar si ya hay una sesión activa al cargar la página
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        // Si ya está logueado, lo redirigimos automáticamente
        redirigirUsuario(session.user.id)
      }
    }
    checkSession()
  }, [])

  // 2. Función Inteligente: Decide a dónde va el usuario según su ROL
  const redirigirUsuario = async (userId) => {
    try {
      // Consultamos la tabla 'perfiles' en Supabase
      const { data, error } = await supabase
        .from('perfiles')
        .select('rol')
        .eq('id', userId)
        .single()

      if (error || !data) {
        // Si no tiene rol asignado, por seguridad va al escáner (empleado)
        console.log("No se encontró rol, asumiendo Empleado.")
        navigate('/scanner')
      } else if (data.rol === 'SUPERVISOR') {
        // Si es jefe, va al panel de control
        navigate('/dashboard')
      } else {
        // Si es empleado, va al escáner
        navigate('/scanner')
      }
    } catch (e) {
      // Si falla algo crítico, mandamos al escáner por defecto
      navigate('/scanner')
    }
  }

  // 3. Manejo del Formulario (Cuando le das click a "Entrar")
  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)

    // Intentamos iniciar sesión con Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      alert("❌ Error de acceso: " + error.message)
      setLoading(false)
    } else {
      // Si la contraseña es correcta, verificamos el rol
      await redirigirUsuario(data.user.id)
    }
  }

  return (
    <div className="container" style={{
      maxWidth: '400px', 
      margin: '80px auto', 
      padding: '30px', 
      borderRadius: '15px', 
      boxShadow: '0 10px 25px rgba(0,0,0,0.1)', 
      background: 'white',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{textAlign: 'center', color: '#333', marginBottom: '10px'}}>🥟 Salteñas Login</h1>
      <p style={{textAlign: 'center', color: '#666', marginBottom: '30px'}}>
        Ingreso al Sistema
      </p>
      
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div>
          <label style={{display: 'block', marginBottom: '5px', color: '#555', fontSize: '14px'}}>Correo Electrónico</label>
          <input
            type="email" 
            placeholder="usuario@saltenas.com"
            value={email} 
            onChange={(e) => setEmail(e.target.value)}
            required 
            style={{ 
              width: '100%', 
              padding: '12px', 
              borderRadius: '8px', 
              border: '1px solid #ddd',
              fontSize: '16px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div>
          <label style={{display: 'block', marginBottom: '5px', color: '#555', fontSize: '14px'}}>Contraseña</label>
          <input
            type="password" 
            placeholder="••••••••"
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            required 
            style={{ 
              width: '100%', 
              padding: '12px', 
              borderRadius: '8px', 
              border: '1px solid #ddd',
              fontSize: '16px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <button 
          type="submit" 
          disabled={loading} 
          style={{ 
            marginTop: '10px',
            padding: '15px', 
            background: loading ? '#ccc' : '#007bff', 
            color: 'white', 
            border: 'none', 
            borderRadius: '8px', 
            fontSize: '16px', 
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.3s'
          }}
        >
          {loading ? 'Verificando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}

export default Login