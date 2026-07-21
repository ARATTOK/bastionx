document.addEventListener('alpine:init', () => {
  Alpine.data('labelsApp', () => ({
    loading: true,
    servers: [],
    credsMap: {},

    async init() {
      try {
        const { data: { session } } = await sb.auth.getSession()
        if (!session) { window.location.href = 'login.html'; return }
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

    print() {
      window.print()
    }
  }))
})
