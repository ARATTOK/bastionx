document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    user: null,
    userRole: 'readonly',
    isSuperAdmin: false,
    canEdit: false,
    loading: true,

    servers: [],
    activeFilter: 'todos',
    activeView: 'servers',
    searchQuery: '',
    expandedCard: null,
    showPalette: false,
    paletteQuery: '',
    paletteIndex: 0,

    serverTagsMap: {},
    allTagsMap: {},
    pendingTasksMap: {},
    tasksProgressMap: {},
    credsMap: {},
    openKebabId: null,
    expandedServerId: null,
    managedUsers: [],
    auditLogs: [],
    auditDetailItem: null,
    quickServerItem: null,
    netSubnetFilter: '',
    adminUserSearch: '',
    auditActionFilter: 'all',

    async init() {
      try {
        const { data: { session } } = await sb.auth.getSession()
        if (!session) {
          window.location.href = 'login.html'
          return
        }
        const { error: userErr } = await sb.auth.getUser()
        if (userErr) {
          await sb.auth.signOut()
          window.location.href = 'login.html'
          return
        }
        this.user = session.user
        await this.fetchUserRole()
        await this.refreshServers()
        await this.loadTags()
        await this.loadTasks()
        await this.loadCreds()
        await this.loadAuditLogs()
        this.loading = false
      } catch (e) {
        window.location.href = 'login.html'
        return
      }

      document.addEventListener('keydown', (e) => this.openPalette(e))

      sb.auth.onAuthStateChange(async (event, session) => {
        if (session && event === 'SIGNED_IN') {
          this.user = session.user
          await this.fetchUserRole()
          await this.refreshServers()
        }
        if (event === 'SIGNED_OUT') {
          window.location.href = 'login.html'
        }
      })
    },

    async logout() {
      await sb.auth.signOut()
    },

    async fetchUserRole() {
      try {
        const { data } = await sb
          .from('user_profiles')
          .select('role')
          .eq('id', this.user.id)
          .single()
        if (data) this.userRole = data.role || 'readonly'
      } catch (e) {
        this.userRole = 'readonly'
      }
      this.isSuperAdmin = this.userRole === 'superadmin'
      this.canEdit = this.isSuperAdmin || this.userRole === 'admin'
    },

    async refreshServers() {
      this.loading = true
      const { data } = await sb
        .from('servers')
        .select('*')
        .order('ubicacion')
      if (data) this.servers = data
      this.loading = false
    },

    gotoServer(id) {
      window.location.href = 'server-detail.html?id=' + id
    },

    svcFirstIp(svc) {
      return (svc.ips && svc.ips[0]) ? svc.ips[0] : null
    },

    toggleExpand(id) {
      this.expandedCard = this.expandedCard === id ? null : id
    },

    openPalette(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        this.showPalette = !this.showPalette
        if (this.showPalette) {
          this.paletteQuery = ''
          this.paletteIndex = 0
          this.$nextTick(() => { this.$refs.paletteInput?.focus() })
        }
      }
      if (e.key === 'Escape' && this.showPalette) {
        this.showPalette = false
      }
    },

    executePalette() {
      const items = this.filteredPalette
      if (items.length > 0 && items[this.paletteIndex]) {
        items[this.paletteIndex].action()
      }
    },

    buildPalette() {
      const actions = [
        { icon: 'lucide:plus', label: 'Agregar servidor', action: () => window.location.href='add-server.html' },
        { icon: 'lucide:file-down', label: 'Exportar CSV', action: () => this.exportCSV() },
        { icon: 'lucide:clipboard-list', label: 'Abrir reporte', action: () => window.location.href='report.html' },
        { icon: 'lucide:refresh-cw', label: 'Recargar inventario', action: () => this.refreshServers() },
        { icon: 'lucide:printer', label: 'Imprimir etiquetas', action: () => window.location.href='labels.html' },
        { icon: 'lucide:tag', label: 'Administrar tags', action: () => window.location.href='tags.html' },
      ]
      if (this.isSuperAdmin) {
      }
      actions.push({ type: 'divider' })
      this.servers.forEach(s => {
        actions.push({
          icon: 'lucide:server',
          label: 'Ir a ' + s.hostname + (s.modelo ? ' (' + s.modelo + ')' : ''),
          action: () => this.gotoServer(s.id),
          shortcut: ''
        })
      })
      return actions
    },

    get filteredPalette() {
      const items = this.buildPalette()
      if (!this.paletteQuery.trim()) return items
      const q = this.paletteQuery.toLowerCase()
      return items.filter(a => a.label.toLowerCase().includes(q))
    },

    downloadCSV(headers, rows, filename) {
      const csv = [headers, ...rows].map(r => r.map(v => `"${(v ?? '').toString().replace(/"/g, '""')}"`).join(',')).join('\n')
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `bastionx-${filename}-${new Date().toISOString().slice(0,10)}.csv`
      a.click()
      URL.revokeObjectURL(a.href)
      const t = Alpine.store('toast')
      if (t) t.success('CSV exportado correctamente')
    },

    exportCSV() {
      const isRestricted = !this.canEdit
      const headers = ['Hostname','SN','Modelo','Ubicaci\u00f3n','Estado','CPU','RAM (GB)','Discos','Servicios','Tags']
      if (!isRestricted) headers.push('IPMI', 'IP Servicio')
      const rows = this.servers.map(s => {
        const tags = this.serverTagsMap[s.id]?.map(t => t.name).join('; ') || ''
        const creds = this.credsMap[s.id] || {}
        const row = [s.hostname, s.sn, s.modelo, s.ubicacion, s.estado, s.procesador, s.ram_gb, this.diskCount(s), s.servicios?.length || 0, tags]
        if (!isRestricted) row.push(creds.ipmi || '', creds.ip_servicio || '')
        return row
      })
      this.downloadCSV(headers, rows, 'inventario')
    },

    exportServicesCSV() {
      const headers = ['Servidor','Hostname','Servicio','IP','Puerto']
      const rows = []
      for (const s of this.servers) {
        const svcs = Array.isArray(s.servicios) ? s.servicios : []
        for (const svc of svcs) {
          const ips = Array.isArray(svc.ips) && svc.ips.length > 0 ? svc.ips : ['']
          for (const ip of ips) {
            rows.push([s.id, s.hostname, svc.nombre || '', ip, svc.puerto || ''])
          }
        }
      }
      this.downloadCSV(headers, rows, 'servicios')
    },

    exportNetworkCSV() {
      const headers = ['Subred','IP','Hostname','Servidor']
      const rows = this.allIPs.map(entry => [
        entry.subnet || '',
        entry.ip,
        entry.hostname,
        entry.serverId
      ])
      this.downloadCSV(headers, rows, 'redes')
    },

    exportInfraCSV() {
      const headers = ['Hostname','Modelo','CPU','RAM (GB)','Discos','Servicios','Tags','Estado']
      const rows = this.servers.map(s => [
        s.hostname, s.modelo || '', s.procesador || '', s.ram_gb || 0,
        this.diskCount(s), s.servicios?.length || 0,
        this.serverTagsMap[s.id]?.map(t => t.name).join('; ') || '',
        s.estado || ''
      ])
      this.downloadCSV(headers, rows, 'infraestructura')
    },

    async loadTags() {
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
    },

    async loadTasks() {
      const { data: tasks } = await sb
        .from('server_tasks')
        .select('*')
      this.pendingTasksMap = {}
      this.tasksProgressMap = {}
      if (tasks) {
        const byServer = {}
        tasks.forEach(t => {
          if (!byServer[t.server_id]) byServer[t.server_id] = { all: [], pending: [] }
          byServer[t.server_id].all.push(t)
          if (!t.completada) byServer[t.server_id].pending.push(t)
        })
        Object.entries(byServer).forEach(([sid, group]) => {
          this.tasksProgressMap[sid] = {
            completed: group.all.length - group.pending.length,
            total: group.all.length
          }
          this.pendingTasksMap[sid] = group.pending
        })
      }
    },

    get upcomingMaintenanceTasks() {
      const list = []
      Object.values(this.pendingTasksMap).forEach(tasks => {
        tasks.forEach(t => {
          if (t.fecha_limite && !t.completada) {
            const server = this.servers.find(s => String(s.id) === String(t.server_id))
            if (server) {
              list.push({ ...t, hostname: server.hostname })
            }
          }
        })
      })
      return list.sort((a, b) => new Date(a.fecha_limite) - new Date(b.fecha_limite))
    },

    getCountdownText(fechaLimite) {
      if (!fechaLimite) return ''
      const due = new Date(fechaLimite)
      const today = new Date()
      today.setHours(0,0,0,0)
      due.setHours(0,0,0,0)
      const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24))
      if (diffDays < 0) return `Vencido (${Math.abs(diffDays)}d)`
      if (diffDays === 0) return 'Mantenimiento HOY'
      if (diffDays === 1) return 'Mañana'
      return `En ${diffDays} días`
    },

    getCountdownClass(fechaLimite) {
      if (!fechaLimite) return ''
      const due = new Date(fechaLimite)
      const today = new Date()
      today.setHours(0,0,0,0)
      due.setHours(0,0,0,0)
      const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24))
      if (diffDays < 0) return 'cd-overdue'
      if (diffDays <= 3) return 'cd-urgent'
      return 'cd-upcoming'
    },

    async loadCreds() {
      const { data } = await sb.from('server_credentials').select('server_id,ipmi,ip_servicio')
      this.credsMap = {}
      if (data) {
        data.forEach(c => { if (!this.credsMap[c.server_id]) this.credsMap[c.server_id] = c })
      }
    },

    serverCardSeverity(serverId) {
      const pts = this.pendingTasksMap[serverId]
      if (!pts || pts.length === 0) return null
      const hasCritica = pts.some(t => t.criticidad === 'critica')
      if (hasCritica) return 'critical'
      const hasConfig = pts.some(t => t.criticidad === 'configuracion')
      if (hasConfig) return 'config'
      return 'other'
    },

    async updateServerStatus(id, newStatus) {
      await sb.from('servers').update({ estado: newStatus }).eq('id', id)
      await this.refreshServers()
      await this.loadTags()
    },

    // =============================================================
    // USERS
    // =============================================================

    async fetchUsers() {
      const { data } = await sb
        .from('user_profiles')
        .select('*')
        .order('created_at')
      if (data) this.managedUsers = data
    },

    async updateUserRole(userId, newRole) {
      const { error } = await sb
        .from('user_profiles')
        .update({ role: newRole })
        .eq('id', userId)
      if (error) {
        const t = Alpine.store('toast')
        if (t) t.error('Error al actualizar rol: ' + error.message)
      } else {
        await this.fetchUsers()
        if (userId === this.user.id) {
          this.userRole = newRole
        }
        const t = Alpine.store('toast')
        if (t) t.success('Rol actualizado correctamente')
      }
    },

    async loadAuditLogs() {
      try {
        const { data } = await sb
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50)
        if (data) {
          const userIds = [...new Set(data.map(a => a.user_id))]
          const { data: profiles } = await sb
            .from('user_profiles')
            .select('id, email')
            .in('id', userIds)
          const emailMap = {}
          if (profiles) profiles.forEach(p => { emailMap[p.id] = p.email })
          this.auditLogs = data.map(a => ({ ...a, user_email: emailMap[a.user_id] || a.user_id.slice(0, 8) }))
        }
      } catch (e) {
      }
    },

    viewAuditDetail(a) {
      if (!a) return
      let item = { ...a }
      if (typeof item.cambios === 'string') {
        try {
          item.cambios = JSON.parse(item.cambios)
        } catch (e) {
          item.cambios = null
        }
      }
      this.auditDetailItem = item
    },

    formatDiffVal(v) {
      if (v === null || v === undefined) return '—'
      if (typeof v === 'object') {
        if (Array.isArray(v)) {
          if (v.length === 0) return '(vacío)'
          return JSON.stringify(v.length > 3 ? v.slice(0, 3).map(x => x.nombre || x.bay || JSON.stringify(x)).join(', ') + '...' : v.map(x => x.nombre || x.bay || JSON.stringify(x)).join(', '))
        }
        if (v.nombre !== undefined) return v.nombre
        return JSON.stringify(v).slice(0, 80)
      }
      if (typeof v === 'string' && v.length > 60) return v.slice(0, 60) + '...'
      return String(v)
    },

    logAccionClassAudit(accion) {
      if (accion === 'server.creada') return 'log-creada'
      if (accion === 'server.eliminada') return 'log-eliminada'
      return 'log-completada'
    },

    formatDate(ts) {
      if (!ts) return ''
      const d = new Date(ts)
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    },

    serversByStatus(status) {
      return this.servers.filter(s => s.estado === status)
    },

    countByStatus(status) {
      return this.servers.filter(s => s.estado === status).length
    },

    get filteredServers() {
      const sorted = [...this.servers].sort((a, b) =>
        (a.ubicacion || '').localeCompare(b.ubicacion || '')
      )
      let list = this.activeFilter === 'todos' ? sorted : sorted.filter(s => s.estado === this.activeFilter)
      if (this.searchQuery.trim()) {
        const q = this.searchQuery.toLowerCase()
        list = list.filter(s =>
          s.hostname?.toLowerCase().includes(q) ||
          s.sn?.toLowerCase().includes(q) ||
          s.modelo?.toLowerCase().includes(q) ||
          s.ubicacion?.toLowerCase().includes(q) ||
          (s.servicios || []).some(svc => svc.nombre?.toLowerCase().includes(q)) ||
          (this.serverTagsMap[s.id] || []).some(t => t.name.toLowerCase().includes(q)) ||
          (this.credsMap[s.id]?.ipmi || '').includes(q)
        )
      }
      return list
    },

    get totalRam() {
      return this.servers.reduce((acc, s) => acc + Number(s.ram_gb || 0), 0)
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

    shortCpu(cpu) {
      if (!cpu || cpu === '') return '\u2014'
      if (cpu.includes('Silver')) return cpu.split('@')[0].replace('Intel ', '').trim()
      if (cpu.includes('E5')) return cpu.split('@')[0].replace('Intel ', '').trim()
      if (cpu.includes('E-')) return cpu.split('@')[0].replace('Intel ', '').trim()
      if (cpu === 'Pendiente') return 'Pendiente'
      return cpu
    },

    cpuTagClass(s) {
      if (!s.procesador || s.procesador === '' || s.procesador === 'Pendiente') return 'pending-tag'
      if (s.procesador.includes('Silver')) return 'silver'
      if (s.procesador.includes('E5')) return 'e5'
      if (s.procesador.includes('E-')) return 'xeon'
      return 'pending-tag'
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

    diskDetail(s) {
      try {
        const d = typeof s.discos === 'string' ? JSON.parse(s.discos) : (s.discos || [])
        if (!Array.isArray(d) || d.length === 0) return ''
        if (d[0] && d[0].nombre !== undefined) {
          return d.flatMap(r => Array.isArray(r.discos) ? r.discos : [])
            .map(dd => dd.bay + ': ' + (dd.tipo || '\u2014')).join('<br>')
        }
        return d.map(dd => dd.bay + ': ' + (dd.tipo || '\u2014')).join('<br>')
      } catch { return '' }
    },

    taskPercent(s) {
      const p = this.tasksProgressMap[s.id]
      if (!p || p.total === 0) return 0
      return (p.completed / p.total) * 100
    },

    taskColor(s) {
      const pct = this.taskPercent(s)
      if (pct >= 100) return '#2ecc71'
      if (pct >= 50) return '#5dade2'
      if (pct >= 25) return '#f39c12'
      return '#e74c3c'
    },
    toggleExpand(id) {
      this.expandedCard = this.expandedCard === id ? null : id
      this.expandedServerId = this.expandedCard
    },

    openQuickServer(s) {
      this.quickServerItem = s
    },

    closeQuickServer() {
      this.quickServerItem = null
    },

    diskList(s) {
      try {
        const d = typeof s.discos === 'string' ? JSON.parse(s.discos) : (s.discos || [])
        if (!Array.isArray(d) || d.length === 0) return []
        if (d[0] && d[0].nombre !== undefined) {
          return d.flatMap(r => Array.isArray(r.discos) ? r.discos.map(dd => ({ bay: dd.bay || '—', tipo: dd.tipo || '', tamano: dd.tamano || '', raid: r.nombre })) : [])
        }
        return d.map(dd => ({ bay: dd.bay || '—', tipo: dd.tipo || '', tamano: dd.tamano || '' }))
      } catch { return [] }
    },

    // ===== VIEW GETTERS =====

    get allServices() {
      const svcMap = {}
      for (const s of this.servers) {
        for (const svc of (s.servicios || [])) {
          const key = svc.nombre || 'sin-nombre'
          if (!svcMap[key]) svcMap[key] = { nombre: key, servers: [], puerto: '' }
          const ip = (svc.ips || [])[0] || (this.credsMap[s.id]?.ip_servicio || '') || (this.credsMap[s.id]?.ipmi || '') || ''
          const puerto = svc.puerto || ''
          let directUrl = ''
          if (ip) {
            const hostWithPort = puerto ? `${ip}:${puerto}` : ip
            directUrl = ip.startsWith('http') ? hostWithPort : `https://${hostWithPort}`
          }
          if (!svcMap[key].servers.some(ex => ex.id === s.id && ex._svcIp === ip)) {
            svcMap[key].servers.push({
              ...s,
              _svcIp: ip,
              _svcPuerto: puerto,
              _directUrl: directUrl,
              _svcUsuario: svc.usuario || '',
              _svcPassword: svc.password || ''
            })
          }
          if (puerto && !svcMap[key].puerto) svcMap[key].puerto = puerto
        }
      }
      return Object.values(svcMap)
    },

    netIpFilter: '',
    netTypeFilter: '',
    netHostFilter: '',
    netStatusFilter: '',

    copyToClipboard(text) {
      if (!text) return
      navigator.clipboard.writeText(text).then(() => {
        const t = Alpine.store('toast')
        if (t) t.success('Contraseña copiada al portapapeles')
      }).catch(() => {})
    },

    get allIPs() {
      const ips = []
      const seen = new Set()
      for (const s of this.servers) {
        const creds = this.credsMap[s.id]
        if (creds?.ipmi && !seen.has(creds.ipmi)) {
          seen.add(creds.ipmi)
          ips.push({ ip: creds.ipmi, type: 'IPMI', server: s })
        }
        if (creds?.ip_servicio && !seen.has(creds.ip_servicio)) {
          seen.add(creds.ip_servicio)
          ips.push({ ip: creds.ip_servicio, type: 'Servicio', server: s })
        }
        for (const svc of (s.servicios || [])) {
          for (const ip of (svc.ips || [])) {
            if (ip && !seen.has(ip)) {
              seen.add(ip)
              ips.push({ ip, type: svc.nombre, server: s })
            }
          }
        }
      }
      return ips
    },

    get uniqueTypes() {
      const types = new Set(this.allIPs.map(e => e.type).filter(Boolean))
      return [...types].sort()
    },

    get filteredIPs() {
      let list = this.allIPs
      if (this.netIpFilter.trim()) {
        const q = this.netIpFilter.trim().toLowerCase()
        list = list.filter(e => e.ip.toLowerCase().includes(q))
      }
      if (this.netTypeFilter) {
        list = list.filter(e => e.type === this.netTypeFilter)
      }
      if (this.netHostFilter.trim()) {
        const q = this.netHostFilter.trim().toLowerCase()
        list = list.filter(e => e.server?.hostname?.toLowerCase().includes(q))
      }
      if (this.netStatusFilter) {
        list = list.filter(e => e.server?.estado === this.netStatusFilter)
      }
      return list
    },

    get uniqueSubnets() {
      const subnets = new Set()
      for (const entry of this.filteredIPs) {
        const parts = entry.ip.split('.')
        if (parts.length === 4) {
          subnets.add(parts.slice(0, 3).join('.'))
        }
      }
      return [...subnets].sort()
    },

    get groupedIPs() {
      const groups = {}
      for (const entry of this.filteredIPs) {
        const parts = entry.ip.split('.')
        const subnet = parts.length === 4 ? parts.slice(0, 3).join('.') + '.0/24' : 'Otros'
        if (!groups[subnet]) groups[subnet] = { subnet, ips: [] }
        groups[subnet].ips.push(entry)
      }
      return Object.values(groups).sort((a, b) => a.subnet.localeCompare(b.subnet))
    },

    get filteredManagedUsers() {
      let list = this.managedUsers
      if (this.adminUserSearch.trim()) {
        const q = this.adminUserSearch.toLowerCase()
        list = list.filter(u =>
          (u.email || '').toLowerCase().includes(q) || (u.role || '').includes(q)
        )
      }
      return list.sort((a, b) => (a.email || '').localeCompare(b.email || ''))
    },

    get filteredAuditLogs() {
      if (this.auditActionFilter === 'all') return this.auditLogs
      return this.auditLogs.filter(a => a.accion === this.auditActionFilter)
    },

    get pendingTasksSummary() {
      const summary = { critica: 0, configuracion: 0, normal: 0, total: 0 }
      for (const sid in this.pendingTasksMap) {
        for (const t of this.pendingTasksMap[sid]) {
          const c = t.criticidad || 'normal'
          if (summary[c] !== undefined) summary[c]++
          summary.total++
        }
      }
      return summary
    }
  }))
})
