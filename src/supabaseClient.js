import { createClient } from '@supabase/supabase-js'

// ⚠️ REEMPLAZA ESTOS DATOS CON LOS DE TU PROYECTO SUPABASE
// (Los mismos que pusiste en el .env del backend, pero aquí van directos)
const supabaseUrl = 'https://kplnksqjolmbkuxdvtxh.supabase.co'
const supabaseKey = 'sb_publishable_z-wtp7E-Qc1opFMzSn6ETg_wC4tCES0' 

export const supabase = createClient(supabaseUrl, supabaseKey)