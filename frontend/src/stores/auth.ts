import { defineStore } from 'pinia'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database'

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
        .select('id, full_name, email, role, client_id, created_at')
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
