document.addEventListener('alpine:init', () => {
  Alpine.data('networksApp', () => ({
    loading: true,
    user: null,
    realUserRole: 'readonly',
    simulatedRole: BastionUtils.getSimulatedRole(),

    get userRole() {
      return (this.realUserRole === 'superadmin' && this.simulatedRole) ? this.simulatedRole : this.realUserRole
    },

    get isSuperAdmin() {
      return this.userRole === 'superadmin'
    },

    get canEdit() {
      return this.isSuperAdmin || this.userRole === 'admin'
    },

    simulateRole(role) {
      this.simulatedRole = role
      BastionUtils.setSimulatedRole(role)
    },

    resetSimulation() {
      this.simulatedRole = ''
      BastionUtils.setSimulatedRole('')
    },

    subnets: [],
    searchQuery: '',
    selectedIpType: 'todas',

    async init() {
      try {
        const { data: { session } } = await sb.auth.getSession()
        if (!session) { window.location.href = 'login.html'; return }
        this.user = session.user
        try {
          const { data } = await sb.from('user_profiles').select('role').eq('id', this.user.id).single()
          if (data?.role) this.realUserRole = data.role
        } catch(e) {}
        await this.loadNetworks()
      } catch (err) {
        window.location.href = 'login.html'
      }
    },

    async loadNetworks() {
      this.loading = true
      const { data: servers } = await sb.from('servers').select('*')
      const { data: creds } = await sb.from('server_credentials').select('*')

      const ipMap = {}

      if (servers) {
        servers.forEach(s => {
          if (s.ip) {
            ipMap[s.ip] = { ip: s.ip, hostname: s.hostname, tipo: 'IP Principal', category: 'host' }
          }
          if (s.servicios && Array.isArray(s.servicios)) {
            s.servicios.forEach(svc => {
              if (svc.ips) {
                svc.ips.forEach(ip => {
                  ipMap[ip] = { ip, hostname: s.hostname, tipo: 'Servicio (' + svc.nombre + ')', category: 'servicio' }
                })
              }
            })
          }
        })
      }

      if (creds) {
        creds.forEach(c => {
          if (c.ipmi) {
            ipMap[c.ipmi] = { ip: c.ipmi, hostname: 'Server ID: ' + c.server_id.slice(0,8), tipo: 'IPMI Gestor', category: 'ipmi' }
          }
        })
      }

      const groups = {}
      Object.values(ipMap).forEach(item => {
        const parts = item.ip.split('.')
        const subnetName = parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.0/24` : 'General'
        if (!groups[subnetName]) groups[subnetName] = []
        groups[subnetName].push(item)
      })

      this.subnets = Object.keys(groups).map(name => ({
        name,
        ips: groups[name]
      }))
      this.loading = false
    },

    get filteredSubnets() {
      return this.subnets.map(sub => {
        const q = this.searchQuery.toLowerCase().trim()
        const filteredIps = sub.ips.filter(i => {
          const matchesQ = !q || i.ip.includes(q) || i.hostname.toLowerCase().includes(q) || sub.name.toLowerCase().includes(q)
          const matchesType = this.selectedIpType === 'todas' || i.category === this.selectedIpType
          return matchesQ && matchesType
        })
        return {
          name: sub.name,
          ips: filteredIps
        }
      }).filter(sub => sub.ips.length > 0)
    },

    openIpmi(ip) {
      const url = ip.startsWith('http') ? ip : 'https://' + ip
      window.open(url, '_blank', 'noopener,noreferrer')
    },

    copyIp(ip) {
      BastionUtils.copyToClipboard(ip, 'Dirección IP copiada al portapapeles')
    },

    exportCsv() {
      const rows = [['Subred', 'Direccion IP', 'Tipo', 'Host']]
      this.subnets.forEach(sub => {
        sub.ips.forEach(i => {
          rows.push([sub.name, i.ip, i.tipo, i.hostname])
        })
      })
      const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n')
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement('a')
      link.setAttribute('href', encodedUri)
      link.setAttribute('download', `bastionlab_redes_export_${new Date().toISOString().slice(0,10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      Alpine.store('toast').show('Catálogo de redes exportado a CSV exitosamente', 'success')
    }
  }))
})
