async function auditLog(serverId, userId, accion, cambios, descripcion) {
  try {
    await sb.from('audit_logs').insert({
      server_id: serverId || null,
      user_id: userId,
      accion: accion,
      cambios: cambios ? JSON.stringify(cambios) : null,
      descripcion: descripcion
    })
  } catch (e) {
    console.warn('Audit log write skipped:', e)
  }
}
