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
    errors: {},
    diskErrors: {},

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
          if (raw[0].nombre !== undefined) return raw.map(r => ({
            nombre: r.nombre || '',
            discos: (r.discos || []).map(dk => ({
              bay: dk.bay || '',
              tipo: dk.tipo || '',
              tamano: (dk.tamano || '').replace(/(GB|TB|MB)$/i, ''),
              tamano_unit: ((dk.tamano || '').match(/(GB|TB|MB)$/i) || ['GB'])[0],
              velocidad: dk.velocidad || ''
            }))
          }))
          const disks = raw.filter(x => x && x.bay)
          if (disks.length === 0) return [{ nombre: '', discos: [] }]
          const groups = {}
          disks.forEach(x => {
            const key = x.raid || ''
            if (!groups[key]) groups[key] = { nombre: key, discos: [] }
            groups[key].discos.push({
              bay: x.bay, tipo: x.tipo || '',
              tamano: (x.tamano || '').replace(/(GB|TB|MB)$/i, ''),
              tamano_unit: ((x.tamano || '').match(/(GB|TB|MB)$/i) || ['GB'])[0],
              velocidad: x.velocidad || ''
            })
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
      this._origTagIds = [...this.selectedTagIds]

      this.loading = false
    },

    validateField(name) {
      this.errors[name] = null
      if (name === 'hostname' && !this.form.hostname.trim()) this.errors.hostname = 'El hostname es obligatorio'
      if (name === 'sn' && !this.form.sn.trim()) this.errors.sn = 'El n\u00famero de serie es obligatorio'
    },

    validateDisk(raidIdx, diskIdx) {
      const disk = this.form.raids[raidIdx]?.discos[diskIdx]
      if (!disk) return
      const key = raidIdx + '-' + diskIdx
      const errs = {}
      if (!disk.bay?.trim()) errs.bay = 'Requerido'
      else {
        const dup = this.form.raids[raidIdx].discos.some((d, i) => i !== diskIdx && d.bay?.trim() === disk.bay.trim())
        if (dup) errs.bay = 'Bay duplicada en este RAID'
      }
      if (!disk.tipo) errs.tipo = 'Selecciona tipo'
      if (!disk.tamano?.trim()) errs.tamano = 'Requerido'
      else if (isNaN(parseFloat(disk.tamano))) errs.tamano = 'Debe ser un n\u00famero'
      this.diskErrors[key] = Object.keys(errs).length > 0 ? errs : null
    },

    validateAll() {
      this.validateField('hostname')
      this.validateField('sn')
      this.form.raids.forEach((raid, ri) => {
        raid.discos.forEach((_, di) => this.validateDisk(ri, di))
      })
      const hasDiskErr = Object.values(this.diskErrors).some(Boolean)
      return !Object.values(this.errors).some(Boolean) && !hasDiskErr
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
      this.form.raids.push({ nombre: '', discos: [{ bay: '', tipo: '', tamano: '', tamano_unit: 'GB', velocidad: '' }] })
      this.diskErrors = {}
    },

    removeRaid(idx) {
      this.form.raids.splice(idx, 1)
      this.diskErrors = {}
    },

    addDiskToRaid(raidIdx) {
      this.form.raids[raidIdx].discos.push({ bay: '', tipo: '', tamano: '', tamano_unit: 'GB', velocidad: '' })
    },

    removeDiskFromRaid(raidIdx, diskIdx) {
      this.form.raids[raidIdx].discos.splice(diskIdx, 1)
      this.diskErrors = {}
    },

    async save() {
      if (!this.validateAll()) {
        const t = Alpine.store('toast')
        if (t) t.error('Corrige los errores en el formulario antes de guardar')
        return
      }

      this.saving = true
      try {
        const discos = this.form.raids
          .filter(r => r.nombre.trim())
          .map(r => ({
            nombre: r.nombre.trim(),
            discos: r.discos
              .filter(d => d.bay.trim())
              .map(d => ({
                bay: d.bay.trim(),
                tipo: d.tipo?.trim() || '',
                tamano: d.tamano.trim() ? d.tamano.trim() + (d.tamano_unit || '') : '',
                velocidad: d.velocidad?.trim() || ''
              }))
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

        const updates = {
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
        }

        const { error: svErr } = await sb.from('servers').update(updates).eq('id', this.server.id)
        if (svErr) {
          const t = Alpine.store('toast')
          if (t) t.error('Error al guardar: ' + svErr.message)
          this.saving = false
          return
        }

        await sb.from('server_tags').delete().eq('server_id', this.server.id)
        if (this.selectedTagIds.length > 0) {
          const inserts = this.selectedTagIds.map(tagId => ({ server_id: this.server.id, tag_id: tagId }))
          await sb.from('server_tags').insert(inserts)
        }

        let credChanged = false
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
          const oldCreds = this.serverCreds || {}
          credChanged = ['ipmi', 'ip_servicio', 'usuario', 'password'].some(k => oldCreds[k] !== credPayload[k])
        }

        const cambios = {}
        const old = this.server
        const stringFields = ['hostname', 'modelo', 'sn', 'ubicacion', 'procesador', 'estado']
        stringFields.forEach(f => {
          if (String(old[f] || '') !== String(updates[f] || '')) {
            cambios[f] = { old: old[f] || '', new: updates[f] || '' }
          }
        })
        if (Number(old.ram_gb || 0) !== Number(updates.ram_gb || 0)) {
          cambios.ram_gb = { old: old.ram_gb || 0, new: updates.ram_gb || 0 }
        }
        if (String(old.ram_modulos || '') !== String(updates.ram_modulos || '')) {
          cambios.ram_modulos = { old: old.ram_modulos || '', new: updates.ram_modulos || '' }
        }
        if (String(old.ram_velocidad || '') !== String(updates.ram_velocidad || '')) {
          cambios.ram_velocidad = { old: old.ram_velocidad || '', new: updates.ram_velocidad || '' }
        }
        if (JSON.stringify(old.discos || []) !== JSON.stringify(updates.discos || [])) {
          cambios.discos = { old: old.discos || [], new: updates.discos || [] }
        }
        if (JSON.stringify(old.servicios || []) !== JSON.stringify(updates.servicios || [])) {
          cambios.servicios = { old: old.servicios || [], new: updates.servicios || [] }
        }
        if (credChanged) cambios.credenciales = { old: 'actualizadas', new: 'actualizadas' }
        if (this.selectedTagIds !== this._origTagIds) cambios.tags = { old: 'modificados', new: 'modificados' }

        await auditLog(this.server.id, this.user.id, 'server.actualizada', cambios, 'Campos actualizados: ' + Object.keys(cambios).join(', '))

        const t = Alpine.store('toast')
        if (t) t.success('Cambios guardados correctamente')
        setTimeout(() => { window.location.href = 'server-detail.html?id=' + this.server.id }, 500)
      } catch (e) {
        const t = Alpine.store('toast')
        if (t) t.error('Error al guardar: ' + (e.message || e))
        this.saving = false
      }
    },
  }))
})
