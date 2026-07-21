document.addEventListener('alpine:init', () => {
  Alpine.data('reportApp', () => ({
    loading: true,
    servers: [],
    serverTagsMap: {},
    allTagsMap: {},
    credsMap: {},
    reportDate: '',

    async init() {
      try {
        const { data: { session } } = await sb.auth.getSession()
        if (!session) { window.location.href = 'login.html'; return }
        this.reportDate = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        await this.loadData()
      } catch (e) {
        window.location.href = 'login.html'
        return
      }
      this.loading = false
    },

    async loadData() {
      const { data: servers } = await sb.from('servers').select('*').order('ubicacion')
      if (servers) this.servers = servers

      const { data: sts } = await sb.from('server_tags').select('*')
      const { data: tags } = await sb.from('tags').select('*')
      if (tags) {
        this.allTagsMap = {}
        tags.forEach(t => { this.allTagsMap[t.id] = t })
      }
      this.serverTagsMap = {}
      if (sts && tags) {
        sts.forEach(st => {
          if (!this.serverTagsMap[st.server_id]) this.serverTagsMap[st.server_id] = []
          if (this.allTagsMap[st.tag_id]) this.serverTagsMap[st.server_id].push(this.allTagsMap[st.tag_id])
        })
      }

      const { data: creds } = await sb.from('server_credentials').select('server_id,ipmi,ip_servicio')
      this.credsMap = {}
      if (creds) {
        creds.forEach(c => { if (!this.credsMap[c.server_id]) this.credsMap[c.server_id] = c })
      }
    },

    get totalRAM() {
      return this.servers.reduce((sum, s) => sum + (parseInt(s.ram_gb) || 0), 0)
    },

    get totalStorageTB() {
      let totalGB = 0
      for (const s of this.servers) {
        try {
          const d = typeof s.discos === 'string' ? JSON.parse(s.discos) : (s.discos || [])
          if (!Array.isArray(d)) continue
          const disks = (d[0] && d[0].nombre !== undefined)
            ? d.flatMap(r => Array.isArray(r.discos) ? r.discos : [])
            : d
          for (const dk of disks) {
            if (!dk.tamano) continue
            const m = dk.tamano.match(/(\d+(?:\.\d+)?)\s*(GB|TB|MB)/i)
            if (!m) continue
            const val = parseFloat(m[1])
            const unit = m[2].toUpperCase()
            if (unit === 'TB') totalGB += val * 1024
            else if (unit === 'MB') totalGB += val / 1024
            else totalGB += val
          }
        } catch {}
      }
      return (totalGB / 1024).toFixed(1)
    },

    get totalCpuGHz() {
      let total = 0
      for (const s of this.servers) {
        if (!s.procesador || s.procesador === 'Pendiente') continue
        const m = s.procesador.match(/@?\s*(\d+(?:\.\d+)?)\s*GHz/i)
        if (m) total += parseFloat(m[1])
      }
      return total.toFixed(1)
    },

    diskCount(s) {
      try {
        const d = typeof s.discos === 'string' ? JSON.parse(s.discos) : (s.discos || [])
        if (!Array.isArray(d)) return 0
        if (d.length === 0) return 0
        if (d[0] && d[0].nombre !== undefined)
          return d.reduce((sum, r) => sum + (Array.isArray(r.discos) ? r.discos.length : 0), 0)
        return d.length
      } catch { return 0 }
    },

    serverTags(s) {
      const t = this.serverTagsMap[s.id]
      return t ? t.map(tag => tag.name).join(', ') : '—'
    },

    credField(s, field) {
      return this.credsMap[s.id]?.[field] || '—'
    },

    print() {
      window.print()
    }
  }))
})
