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
      if (!this.form.hostname.trim()) { alert('El hostname es obligatorio'); return }
      if (!this.form.sn.trim()) { alert('El serial number (SN) es obligatorio'); return }

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
        if (error) { alert('Error al guardar: ' + error.message); this.saving = false; return }

        const serverId = data[0].id

        if (this.selectedTagIds.length > 0) {
          const inserts = this.selectedTagIds.map(tagId => ({ server_id: serverId, tag_id: tagId }))
          await sb.from('server_tags').insert(inserts)
        }

        window.location.href = 'server-detail.html?id=' + serverId
      } catch (e) {
        alert('Error al guardar: ' + (e.message || e))
        this.saving = false
      }
    }
  }))
})
