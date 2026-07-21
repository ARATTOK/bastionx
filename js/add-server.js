document.addEventListener('alpine:init', () => {
  Alpine.data('addServerApp', () => ({
    loading: true,
    saving: false,
    user: null,
    allTags: [],
    selectedTagIds: [],
    tagSearch: '',
    showTagDropdown: false,
    showAdvanced: false,
    errors: {},
    diskErrors: {},

    form: {
      hostname: '', sn: '', modelo: '', ubicacion: '',
      procesador: '', ram_gb: 0, ram_modulos: '', ram_velocidad: '',
      raids: [], servicios: []
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
      const isSuperAdmin = role === 'superadmin'
      const canEdit = isSuperAdmin || role === 'admin'
      if (!canEdit) { window.location.href = 'dashboard.html'; return }

      const { data: allTags } = await sb.from('tags').select('*').order('name')
      if (allTags) this.allTags = allTags

      this.loading = false
    },

    validateField(name) {
      this.errors[name] = null
      if (name === 'hostname') {
        if (!this.form.hostname.trim()) this.errors.hostname = 'El hostname es obligatorio'
        else if (this.form.hostname.trim().length < 3) this.errors.hostname = 'M\u00ednimo 3 caracteres'
      }
      if (name === 'sn') {
        if (!this.form.sn.trim()) this.errors.sn = 'El n\u00famero de serie es obligatorio'
      }
      if (name === 'modelo') {
        if (!this.form.modelo.trim()) this.errors.modelo = 'El modelo es obligatorio'
      }
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
      this.validateField('modelo')
      this.form.raids.forEach((raid, ri) => {
        raid.discos.forEach((_, di) => this.validateDisk(ri, di))
      })
      const hasDiskErr = Object.values(this.diskErrors).some(Boolean)
      return !Object.values(this.errors).some(Boolean) && !hasDiskErr
    },

    get filteredTags() {
      if (!this.tagSearch.trim()) return []
      const q = this.tagSearch.toLowerCase().trim()
      return this.allTags.filter(t =>
        t.name.toLowerCase().includes(q) && !this.selectedTagIds.includes(t.id)
      )
    },

    selectTag(tag) {
      if (!this.selectedTagIds.includes(tag.id)) {
        this.selectedTagIds.push(tag.id)
      }
      this.tagSearch = ''
      this.showTagDropdown = false
    },

    removeTag(tagId) {
      const idx = this.selectedTagIds.indexOf(tagId)
      if (idx >= 0) this.selectedTagIds.splice(idx, 1)
    },

    onTagInput() {
      this.showTagDropdown = this.tagSearch.trim().length > 0
    },

    onTagKeydown(e) {
      if (e.key === 'Backspace' && !this.tagSearch && this.selectedTagIds.length > 0) {
        this.selectedTagIds.pop()
      }
      if (e.key === 'Enter' && this.filteredTags.length > 0) {
        e.preventDefault()
        this.selectTag(this.filteredTags[0])
      }
      if (e.key === 'Escape') {
        this.showTagDropdown = false
      }
    },

    goBack() { window.location.href = 'dashboard.html' },

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

        const { data, error } = await sb
          .from('servers')
          .insert({
            hostname: this.form.hostname.trim(),
            sn: this.form.sn.trim(),
            modelo: this.form.modelo.trim(),
            ubicacion: this.form.ubicacion.trim(),
            procesador: this.form.procesador.trim(),
            ram_gb: Number(this.form.ram_gb) || 0,
            ram_modulos: this.form.ram_modulos.trim(),
            ram_velocidad: this.form.ram_velocidad.trim(),
            estado: 'Libre',
            discos: discos,
            servicios: servicios
          })
          .select()
        if (error) {
          const t = Alpine.store('toast')
          if (t) t.error('Error al guardar: ' + error.message)
          this.saving = false
          return
        }

        const serverId = data[0].id

        await auditLog(serverId, this.user.id, 'server.creada', null, 'Servidor creado: ' + this.form.hostname.trim())

        if (this.selectedTagIds.length > 0) {
          const inserts = this.selectedTagIds.map(tagId => ({ server_id: serverId, tag_id: tagId }))
          await sb.from('server_tags').insert(inserts)
        }

        const t = Alpine.store('toast')
        if (t) t.success('Servidor creado correctamente')
        setTimeout(() => { window.location.href = 'server-detail.html?id=' + serverId }, 500)
      } catch (e) {
        const t = Alpine.store('toast')
        if (t) t.error('Error al guardar: ' + (e.message || e))
        this.saving = false
      }
    }
  }))
})
