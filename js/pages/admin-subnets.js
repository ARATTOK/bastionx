document.addEventListener('alpine:init', () => {
  Alpine.data('adminSubnetsApp', () => ({
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

    subnetsList: [],
    newSubnetCidr: '',
    newSubnetName: '',
    newSubnetVlan: '',

    simulateRole(role) {
      this.simulatedRole = role
      BastionUtils.setSimulatedRole(role)
      if (role) {
        BastionUtils.showToast('info', `Vista simulada como: ${role}`)
      } else {
        BastionUtils.showToast('success', 'Vista restaurada a Superadmin')
      }
    },

    resetSimulation() {
      this.simulatedRole = ''
      BastionUtils.setSimulatedRole('')
      BastionUtils.showToast('success', 'Vista restaurada a Superadmin')
    },

    async init() {
      try {
        const { data: { session } } = await sb.auth.getSession()
        if (!session) { window.location.href = 'login.html'; return }
        this.user = session.user

        try {
          const { data } = await sb.from('user_profiles').select('role').eq('id', this.user.id).single()
          if (data?.role) this.realUserRole = data.role
        } catch(e) {}

        if (this.realUserRole !== 'superadmin') {
          BastionUtils.showToast('error', 'Acceso denegado: Requiere permisos de Superadmin')
          setTimeout(() => { window.location.href = 'dashboard.html' }, 500)
          return
        }

        this.loadSubnets()
      } catch (err) {
        console.error('Admin subnets init error:', err)
      } finally {
        this.loading = false
      }
    },

    loadSubnets() {
      const stored = localStorage.getItem('bastion_managed_subnets')
      if (stored) {
        try { this.subnetsList = JSON.parse(stored) } catch(e) {}
      } else {
        this.subnetsList = [
          { cidr: '192.168.1.0/24', name: 'Red Producción VLAN 10', vlan: '10' },
          { cidr: '10.0.0.0/24', name: 'Red Servicios VLAN 20', vlan: '20' },
          { cidr: '172.16.0.0/24', name: 'DMZ / IPMI VLAN 30', vlan: '30' }
        ]
        localStorage.setItem('bastion_managed_subnets', JSON.stringify(this.subnetsList))
      }
    },

    addSubnet() {
      const cidr = this.newSubnetCidr.trim()
      const name = this.newSubnetName.trim() || `Subred ${cidr}`
      const vlan = this.newSubnetVlan.trim() || '1'
      if (!cidr) {
        BastionUtils.showToast('error', 'Ingresa un rango CIDR válido (ej: 192.168.1.0/24)')
        return
      }
      this.subnetsList.push({ cidr, name, vlan })
      localStorage.setItem('bastion_managed_subnets', JSON.stringify(this.subnetsList))
      BastionUtils.showToast('success', `Subred ${cidr} registrada`)
      this.newSubnetCidr = ''
      this.newSubnetName = ''
      this.newSubnetVlan = ''
    },

    deleteSubnet(cidr) {
      this.subnetsList = this.subnetsList.filter(s => s.cidr !== cidr)
      localStorage.setItem('bastion_managed_subnets', JSON.stringify(this.subnetsList))
      BastionUtils.showToast('info', `Subred ${cidr} eliminada`)
    }
  }))
})
