async function auditLog(serverId, userId, accion, cambios, descripcion) {
  try {
    const payload = {
      server_id: serverId,
      user_id: userId,
      accion: accion,
      cambios: cambios || null,
      descripcion: descripcion || null
    }
    const { error } = await sb.from('audit_logs').insert(payload)
    if (error) console.warn('audit_log insert failed:', error)
  } catch (e) {
    console.warn('audit_log error:', e)
  }
}
