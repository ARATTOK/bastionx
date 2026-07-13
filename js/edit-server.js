document.addEventListener('alpine:init', () => {
  Alpine.data('editApp', () => ({
    loading: true,
    saving: false,
    user: null,
    isSuperAdmin: false,
    server: null,
    serverCreds: null,
    allTags: [],
    selectedTagIds: [],

    form: {
      hostname: '', modelo: '', sn: '', ubicacion: '',
      procesador: '', ram_gb: 0, ram_modulos: '', ram_velocidad: '',
      estado: 'Activo', discos_str: '[]', servicios: []
    },

    credForm: {
      ipmi: '', ip_servicio: '', usuario: '', password: ''
    },

    async init() {
      const { data: { session } } = await sb.auth.getSession()
      if (!session) { window.location.href = 'login.html'; return }
      const { error: userErr } = await sb.auth.getUser()
      if (userErr) { await sb.auth.signOut(); window.location.href = 'login.html'; return }
      this.user = session.user
      this.isSuperAdmin = this.user.email === 'admin@bastionx.com'

      const params = new URLSearchParams(window.location.search)
      const id = params.get('id')
      if (!id) { window.location.href = 'dashboard.html'; return }

      const { data: server } = await sb.from('servers').select('*').eq('id', id).single()
      if (!server) { window.location.href = 'dashboard.html'; return }
      this.server = server

      this.form = {
        hostname: server.hostname || '',
        modelo: server.modelo || '',
        sn: server.sn || '',
        ubicacion: server.ubicacion || '',
        procesador: server.procesador || '',
        ram_gb: server.ram_gb || 0,
        ram_modulos: server.ram_modulos || '',
        ram_velocidad: server.ram_velocidad || '',
        estado: server.estado || 'Activo',
        discos_str: typeof server.discos === 'string' ? server.discos : JSON.stringify(server.discos || [], null, 2),
        servicios: Array.isArray(server.servicios) ? server.servicios.map(s => ({ ...s, ips: s.ips || [''] })) : [{ nombre: '', ips: [''], puerto: '', descripcion: '' }]
      }

      if (this.isSuperAdmin) {
        const { data: creds } = await sb.from('server_credentials').select('*').eq('server_id', id).maybeSingle()
        if (creds) {
          this.credForm = { ipmi: creds.ipmi || '', ip_servicio: creds.ip_servicio || '', usuario: creds.usuario || '', password: creds.password || '' }
          this.serverCreds = creds
        }
      }

      const { data: allTags } = await sb.from('tags').select('*').order('name')
      if (allTags) this.allTags = allTags

      const { data: sts } = await sb.from('server_tags').select('tag_id').eq('server_id', id)
      if (sts) this.selectedTagIds = sts.map(s => s.tag_id)

      this.loading = false
    },

    toggleTag(tagId) {
      const idx = this.selectedTagIds.indexOf(tagId)
      if (idx >= 0) this.selectedTagIds.splice(idx, 1)
      else this.selectedTagIds.push(tagId)
    },

    addService() {
      this.form.servicios.push({ nombre: '', ips: [''], puerto: '', descripcion: '' })
    },

    removeService(idx) {
      this.form.servicios.splice(idx, 1)
    },

    addServiceIp(svcIdx) {
      this.form.servicios[svcIdx].ips.push('')
    },

    removeServiceIp(svcIdx, ipIdx) {
      const ips = this.form.servicios[svcIdx].ips
      if (ips.length > 1) ips.splice(ipIdx, 1)
    },

    goBack() { window.location.href = 'server-detail.html?id=' + this.server.id },

    async save() {
      this.saving = true
      try {
        const discos = (() => {
          try { return JSON.parse(this.form.discos_str || '[]') } catch { return [] }
        })()

        const servicios = this.form.servicios
          .filter(s => s.nombre.trim())
          .map(s => ({
            nombre: s.nombre.trim(),
            ips: s.ips.map(ip => ip.trim()).filter(ip => ip),
            puerto: s.puerto?.trim() || '',
            descripcion: s.descripcion?.trim() || ''
          }))

        const { error: svErr } = await sb.from('servers').update({
          hostname: this.form.hostname,
          modelo: this.form.modelo,
          sn: this.form.sn,
          ubicacion: this.form.ubicacion,
          procesador: this.form.procesador,
          ram_gb: Number(this.form.ram_gb) || 0,
          ram_modulos: this.form.ram_modulos,
          ram_velocidad: this.form.ram_velocidad,
          estado: this.form.estado,
          discos: discos,
          servicios: servicios
        }).eq('id', this.server.id)
        if (svErr) { alert('Error al guardar: ' + svErr.message); this.saving = false; return }

        await sb.from('server_tags').delete().eq('server_id', this.server.id)
        if (this.selectedTagIds.length > 0) {
          const inserts = this.selectedTagIds.map(tagId => ({ server_id: this.server.id, tag_id: tagId }))
          await sb.from('server_tags').insert(inserts)
        }

        if (this.isSuperAdmin) {
          const credPayload = {
            ipmi: this.credForm.ipmi,
            ip_servicio: this.credForm.ip_servicio,
            usuario: this.credForm.usuario,
            password: this.credForm.password
          }
          if (this.serverCreds) {
            await sb.from('server_credentials').update(credPayload).eq('server_id', this.server.id)
          } else {
            await sb.from('server_credentials').insert({ server_id: this.server.id, ...credPayload })
          }
        }

        window.location.href = 'server-detail.html?id=' + this.server.id
      } catch (e) {
        alert('Error al guardar: ' + (e.message || e))
        this.saving = false
      }
    },
  }))
})
