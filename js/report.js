document.addEventListener('alpine:init', () => {
  Alpine.data('reportApp', () => ({
    loading: true,
    canEdit: false,
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
        const { data: profile } = await sb.from('user_profiles').select('role').eq('id', session.user.id).single()
        this.canEdit = profile?.role === 'superadmin' || profile?.role === 'admin'
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

    get statusData() {
      const counts = { Activo: 0, Inactivo: 0, Pendiente: 0, Libre: 0 }
      for (const s of this.servers) {
        const st = s.estado || 'Libre'
        if (counts[st] !== undefined) counts[st]++
      }
      return Object.entries(counts).filter(([, c]) => c > 0).map(([label, count]) => ({ label, count }))
    },

    get diskTypeData() {
      const types = { SSD: 0, HDD: 0, NVMe: 0, Otro: 0 }
      for (const s of this.servers) {
        try {
          const d = typeof s.discos === 'string' ? JSON.parse(s.discos) : (s.discos || [])
          if (!Array.isArray(d)) continue
          const disks = (d[0] && d[0].nombre !== undefined) ? d.flatMap(r => Array.isArray(r.discos) ? r.discos : []) : d
          for (const dk of disks) {
            const tipo = (dk.tipo || '').toUpperCase()
            if (tipo.includes('SSD') || tipo.includes('SOLID') || tipo === 'SATA SSD') types.SSD++
            else if (tipo.includes('NVME') || tipo.includes('NVMe')) types.NVMe++
            else if (tipo.includes('HDD') || tipo.includes('SAS') || tipo === 'SATA') types.HDD++
            else types.Otro++
          }
        } catch {}
      }
      return Object.entries(types).filter(([, c]) => c > 0).map(([label, count]) => ({ label, count }))
    },

    get serviceOverview() {
      const svcMap = {}
      for (const s of this.servers) {
        const svcs = Array.isArray(s.servicios) ? s.servicios : []
        for (const svc of svcs) {
          const name = svc.nombre || 'Sin nombre'
          if (!svcMap[name]) svcMap[name] = { nombre: name, count: 0, servers: [] }
          svcMap[name].count++
          svcMap[name].servers.push(s.hostname)
        }
      }
      return Object.values(svcMap).sort((a, b) => b.count - a.count)
    },

    get locationData() {
      const locs = {}
      for (const s of this.servers) {
        const l = s.ubicacion || 'Sin ubicación'
        locs[l] = (locs[l] || 0) + 1
      }
      return Object.entries(locs).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([label, count]) => ({ label, count }))
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

    exportCSV() {
      const headers = ['ID', 'Hostname', 'Ubicación', 'Estado', 'Marca/Modelo', 'Número de Serie', 'Procesador', 'RAM (GB)', 'Tags', 'IPMI', 'IP Servicio']
      const rows = this.servers.map(s => [
        s.id,
        s.hostname || '',
        s.ubicacion || '',
        s.estado || '',
        `${s.marca || ''} ${s.modelo || ''}`.trim(),
        s.sn || '',
        s.procesador || '',
        s.ram_gb || 0,
        this.serverTags(s),
        this.credField(s, 'ipmi'),
        this.credField(s, 'ip_servicio')
      ])
      const csvContent = [headers, ...rows]
        .map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
        .join('\n')
      
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `reporte_bastionx_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      Alpine.store('toast').success('Reporte CSV descargado con éxito')
    },

    print() {
      window.print()
    }
  }))
})
