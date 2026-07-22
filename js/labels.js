document.addEventListener('alpine:init', () => {
  Alpine.data('labelsApp', () => ({
    loading: true,
    canEdit: false,
    servers: [],
    credsMap: {},

    async init() {
      try {
        const { data: { session } } = await sb.auth.getSession()
        if (!session) { window.location.href = 'login.html'; return }
        const { data: profile } = await sb.from('user_profiles').select('role').eq('id', session.user.id).single()
        this.canEdit = profile?.role === 'superadmin' || profile?.role === 'admin'
        const { data: servers } = await sb.from('servers').select('*').order('hostname')
        if (servers) this.servers = servers
        const { data: creds } = await sb.from('server_credentials').select('server_id,ipmi')
        this.credsMap = {}
        if (creds) {
          creds.forEach(c => { if (!this.credsMap[c.server_id]) this.credsMap[c.server_id] = c })
        }
      } catch (e) {
        window.location.href = 'login.html'
        return
      }
      this.loading = false
    },

    credField(s, field) {
      return this.credsMap[s.id]?.[field] || ''
    },

    serverQrUrl(s) {
      const origin = window.location.origin + window.location.pathname.replace('labels.html', 'server-detail.html')
      const detailUrl = `${origin}?id=${s.id}`
      return `https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(detailUrl)}&color=ffffff&bgcolor=1e1e1e`
    },

    serverQrPrintUrl(s) {
      const origin = window.location.origin + window.location.pathname.replace('labels.html', 'server-detail.html')
      const detailUrl = `${origin}?id=${s.id}`
      return `https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(detailUrl)}&color=000000&bgcolor=ffffff`
    },

    print() {
      window.print()
    }
  }))
})
