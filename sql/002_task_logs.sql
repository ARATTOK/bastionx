-- BASTIONX LAB — Bitácora de tareas
-- Run this in Supabase SQL Editor

-- 1. Add completed_at to server_tasks
ALTER TABLE server_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 2. Create server_task_logs table (bitácora)
CREATE TABLE IF NOT EXISTS server_task_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES server_tasks(id) ON DELETE CASCADE,
  server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  accion TEXT NOT NULL CHECK (accion IN ('creada', 'completada', 'desmarcada', 'eliminada')),
  descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. RLS policies
ALTER TABLE server_task_logs ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "Authenticated read task_logs" ON server_task_logs
  FOR SELECT TO authenticated USING (true);

-- Authenticated users can insert
CREATE POLICY "Authenticated insert task_logs" ON server_task_logs
  FOR INSERT TO authenticated WITH CHECK (true);
