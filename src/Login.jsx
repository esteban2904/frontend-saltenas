import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { useNavigate } from 'react-router-dom'
import { Button, TextInput, Form, Tile, InlineLoading } from '@carbon/react'
import { Login as LoginIcon } from '@carbon/icons-react'

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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f4f4f4',
      padding: '2rem'
    }}>
      <Tile style={{
        maxWidth: '400px',
        width: '100%',
        padding: '2.5rem'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', fontWeight: '400', color: '#161616' }}>
            Sistema de Inventario
          </h1>
          <p style={{ margin: 0, color: '#525252', fontSize: '0.875rem' }}>
            Ingreso al Sistema
          </p>
        </div>
        
        <Form onSubmit={handleLogin}>
          <div style={{ marginBottom: '1rem' }}>
            <TextInput
              id="email-input"
              labelText="Correo Electrónico"
              placeholder="usuario@saltenas.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <TextInput
              id="password-input"
              labelText="Contraseña"
              placeholder="Ingresa tu contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <Button 
            type="submit"
            kind="primary"
            renderIcon={LoginIcon}
            disabled={loading}
            style={{ width: '100%', maxWidth: '100%', justifyContent: 'center' }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <InlineLoading description="Verificando..." />
              </span>
            ) : 'Ingresar'}
          </Button>
        </Form>
      </Tile>
    </div>
  )
}

export default Login