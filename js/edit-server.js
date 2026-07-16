document.addEventListener('alpine:init', () => {
  Alpine.data('editApp', () => ({
    loading: true,
    saving: false,
    user: null,
    isSuperAdmin: false,
    canEdit: false,
    server: null,
    serverCreds: null,
    allTags: [],
    selectedTagIds: [],

    form: {
      hostname: '', modelo: '', sn: '', ubicacion: '',
      procesador: '', ram_gb: 0, ram_modulos: '', ram_velocidad: '',
      estado: 'Activo', raids: [], servicios: []
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
      let role = 'readonly'
      try {
        const { data } = await sb.from('user_profiles').select('role').eq('id', this.user.id).single()
        if (data?.role) role = data.role
      } catch(e) {}
      this.isSuperAdmin = role === 'superadmin'
      this.canEdit = this.isSuperAdmin || role === 'admin'

      const params = new URLSearchParams(window.location.search)
      const id = params.get('id')
      if (!id) { window.location.href = 'dashboard.html'; return }

      const { data: server } = await sb.from('servers').select('*').eq('id', id).single()
      if (!server) { window.location.href = 'dashboard.html'; return }
      this.server = server

      const migrateRaids = (d) => {
        try {
          const raw = Array.isArray(d) ? d : (typeof d === 'string' ? JSON.parse(d) : [])
          if (!Array.isArray(raw)) return [{ nombre: '', discos: [] }]
          if (raw.length === 0) return [{ nombre: '', discos: [] }]
          if (raw[0].nombre !== undefined) return raw
          const disks = raw.filter(x => x && x.bay)
          if (disks.length === 0) return [{ nombre: '', discos: [] }]
          const groups = {}
          disks.forEach(x => {
            const key = x.raid || ''
            if (!groups[key]) groups[key] = { nombre: key, discos: [] }
            groups[key].discos.push({ bay: x.bay, tipo: x.tipo || '', tamano: x.tamano || '', velocidad: x.velocidad || '' })
          })
          return Object.values(groups)
        } catch { return [{ nombre: '', discos: [] }] }
      }
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
        raids: migrateRaids(server.discos),
        servicios: Array.isArray(server.servicios) ? server.servicios.map(s => ({ ...s, ips: s.ips || [''] })) : [{ nombre: '', ips: [''], puerto: '', descripcion: '' }]
      }

        if (this.canEdit) {
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

    addRaid() {
      this.form.raids.push({ nombre: '', discos: [{ bay: '', tipo: '', tamano: '', velocidad: '' }] })
    },

    removeRaid(idx) {
      this.form.raids.splice(idx, 1)
    },

    addDiskToRaid(raidIdx) {
      this.form.raids[raidIdx].discos.push({ bay: '', tipo: '', tamano: '', velocidad: '' })
    },

    removeDiskFromRaid(raidIdx, diskIdx) {
      this.form.raids[raidIdx].discos.splice(diskIdx, 1)
    },

    async save() {
      this.saving = true
      try {
        const discos = this.form.raids
          .filter(r => r.nombre.trim())
          .map(r => ({
            nombre: r.nombre.trim(),
            discos: r.discos.filter(d => d.bay.trim())
          }))
          .filter(r => r.discos.length > 0)

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

      if (this.canEdit) {
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
