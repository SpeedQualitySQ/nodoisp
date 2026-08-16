import { defineStore } from 'pinia'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { ModuleKey, Profile } from '@/types/database'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    session: null as Session | null,
    user: null as User | null,
    profile: null as Profile | null,
    ready: false,
  }),
  getters: {
    isAuthenticated: (state) => !!state.session,
    isPortalUser: (state) => state.profile?.role === 'cliente_portal',
    isAdmin: (state) => state.profile?.role === 'admin',
    isVisor: (state) => state.profile?.role === 'visor',
    // admin ve todo siempre; operador/visor dependen de permissions (por
    // defecto false — hay que otorgar el módulo explícitamente). El
    // dashboard es la excepción: siempre visible para cualquier staff, para
    // que nadie quede bloqueado hasta de la pantalla de inicio si todavía
    // no le asignaron ningún módulo.
    can:
      (state) =>
      (moduleKey: ModuleKey): boolean => {
        if (!state.profile) return false
        if (state.profile.role === 'cliente_portal') return false
        if (state.profile.role === 'admin' || moduleKey === 'dashboard') return true
        return state.profile.permissions?.[moduleKey] === true
      },
  },
  actions: {
    async init() {
      const { data } = await supabase.auth.getSession()
      this.session = data.session
      this.user = data.session?.user ?? null
      if (this.user) await this.loadProfile()

      supabase.auth.onAuthStateChange(async (_event, session) => {
        this.session = session
        this.user = session?.user ?? null
        if (this.user) {
          await this.loadProfile()
        } else {
          this.profile = null
        }
      })

      this.ready = true
    },

    async loadProfile() {
      if (!this.user) return
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, client_id, permissions, created_at')
        .eq('id', this.user.id)
        .maybeSingle()
      this.profile = data
    },

    async signIn(email: string, password: string) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    },

    async signOut() {
      await supabase.auth.signOut()
      this.session = null
      this.user = null
      this.profile = null
    },
  },
})
