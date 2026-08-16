<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { PlusIcon } from '@heroicons/vue/24/outline'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import type { ModuleKey, Profile, ProfileRole } from '@/types/database'
import StatusBadge from '@/components/StatusBadge.vue'

const auth = useAuthStore()

const ROLES: ProfileRole[] = ['admin', 'operador', 'visor']

// dashboard queda fuera: siempre visible para cualquier staff (ver
// auth.can() en stores/auth.ts), así que no tiene sentido pedirlo acá.
const MODULE_LABELS: Partial<Record<ModuleKey, string>> = {
  clientes: 'Clientes',
  planes: 'Planes',
  olt: 'OLT',
  mikrotik: 'MikroTik',
  tr069: 'TR-069 / CPEs',
  facturacion: 'Facturación',
  cobros: 'Cobros',
  soporte: 'Soporte',
  reportes: 'Reportes',
  inventario: 'Inventario',
  configuracion: 'Configuración',
}
const MODULE_KEYS = Object.keys(MODULE_LABELS) as ModuleKey[]

const users = ref<Profile[]>([])
const loading = ref(true)
const errorMsg = ref('')
const okMsg = ref('')
const saving = ref(false)
const editingId = ref<string | null>(null)
const showForm = ref(false)
const resettingId = ref<string | null>(null)

const form = reactive({
  full_name: '',
  email: '',
  role: 'operador' as ProfileRole,
  permissions: {} as Partial<Record<ModuleKey, boolean>>,
})

function resetForm() {
  editingId.value = null
  form.full_name = ''
  form.email = ''
  form.role = 'operador'
  form.permissions = {}
}

function openNew() {
  resetForm()
  showForm.value = true
}

function openEdit(u: Profile) {
  editingId.value = u.id
  form.full_name = u.full_name ?? ''
  form.email = u.email ?? ''
  form.role = u.role as ProfileRole
  form.permissions = { ...u.permissions }
  showForm.value = true
}

async function loadUsers() {
  loading.value = true
  errorMsg.value = ''
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .neq('role', 'cliente_portal')
    .order('full_name')
  if (error) errorMsg.value = error.message
  users.value = (data ?? []) as Profile[]
  loading.value = false
}

onMounted(loadUsers)

function moduleCount(u: Profile) {
  if (u.role === 'admin') return 'Todos'
  const n = MODULE_KEYS.filter((k) => u.permissions?.[k]).length
  return n === 0 ? 'Ninguno' : `${n} módulo${n === 1 ? '' : 's'}`
}

async function onSave() {
  saving.value = true
  errorMsg.value = ''
  okMsg.value = ''
  try {
    const permissions = form.role === 'admin' ? {} : form.permissions
    if (editingId.value) {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: form.full_name, role: form.role, permissions })
        .eq('id', editingId.value)
      if (error) throw error
      okMsg.value = 'Usuario actualizado.'
    } else {
      const res = await fetch('/api/staff/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, full_name: form.full_name, role: form.role, permissions }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `Error ${res.status}`)
      okMsg.value = 'Usuario creado. Se le envió un correo de invitación.'
    }
    showForm.value = false
    await loadUsers()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo guardar el usuario'
  } finally {
    saving.value = false
  }
}

async function onResetPassword(u: Profile) {
  if (!u.email) return
  resettingId.value = u.id
  errorMsg.value = ''
  okMsg.value = ''
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(u.email, {
      redirectTo: `${window.location.origin}/login`,
    })
    if (error) throw error
    okMsg.value = `Se envió un correo para resetear la contraseña de ${u.email}.`
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo enviar el correo de reseteo'
  } finally {
    resettingId.value = null
  }
}

const isSelf = computed(() => (id: string) => id === auth.user?.id)
</script>

<template>
  <div class="mx-auto max-w-4xl px-6 py-8">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">Usuarios del sistema</h1>
        <p class="text-sm text-slate-500">{{ users.length }} usuarios de staff</p>
      </div>
      <button
        class="flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
        @click="openNew"
      >
        <PlusIcon class="h-4 w-4" />
        Nuevo usuario
      </button>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>
    <p v-if="okMsg" class="mb-4 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-700">{{ okMsg }}</p>

    <div v-if="showForm" class="mb-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {{ editingId ? 'Editar usuario' : 'Nuevo usuario' }}
      </h2>
      <form class="space-y-4" @submit.prevent="onSave">
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Nombre completo</label>
            <input v-model="form.full_name" required class="input" />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Correo</label>
            <input v-model="form.email" type="email" required :disabled="!!editingId" class="input disabled:bg-slate-50 disabled:text-slate-400" />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Rol</label>
            <select v-model="form.role" class="input">
              <option v-for="r in ROLES" :key="r" :value="r">
                {{ r === 'admin' ? 'Administrador' : r === 'operador' ? 'Operador' : 'Visor' }}
              </option>
            </select>
          </div>
        </div>

        <div v-if="form.role === 'admin'" class="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
          Los administradores tienen acceso a todos los módulos del sistema.
        </div>
        <div v-else class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Módulos visibles</label>
          <div class="grid grid-cols-3 gap-2 rounded-lg border border-slate-200 p-3">
            <label v-for="k in MODULE_KEYS" :key="k" class="flex items-center gap-2 text-sm text-slate-700">
              <input v-model="form.permissions[k]" type="checkbox" class="h-4 w-4 rounded border-slate-300" />
              {{ MODULE_LABELS[k] }}
            </label>
          </div>
        </div>

        <div class="flex justify-end gap-3">
          <button type="button" class="px-3 py-2 text-sm text-slate-600" @click="showForm = false">Cancelar</button>
          <button
            type="submit"
            :disabled="saving"
            class="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {{ saving ? 'Guardando…' : editingId ? 'Guardar' : 'Crear e invitar' }}
          </button>
        </div>
      </form>
    </div>

    <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-4 py-3">Nombre</th>
            <th class="px-4 py-3">Correo</th>
            <th class="px-4 py-3">Rol</th>
            <th class="px-4 py-3">Módulos</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading">
            <td colspan="5" class="px-4 py-6 text-center text-slate-400">Cargando…</td>
          </tr>
          <tr v-else-if="!users.length">
            <td colspan="5" class="px-4 py-6 text-center text-slate-400">Sin usuarios todavía</td>
          </tr>
          <tr v-for="u in users" :key="u.id" class="hover:bg-slate-50">
            <td class="px-4 py-3 font-medium text-slate-900">
              {{ u.full_name || '—' }}
              <span v-if="isSelf(u.id)" class="ml-1 text-xs font-normal text-slate-400">(tú)</span>
            </td>
            <td class="px-4 py-3 text-slate-600">{{ u.email }}</td>
            <td class="px-4 py-3"><StatusBadge :status="u.role" /></td>
            <td class="px-4 py-3 text-slate-600">{{ moduleCount(u) }}</td>
            <td class="px-4 py-3 text-right">
              <button class="text-sm font-medium text-teal-700 hover:text-teal-900" @click="openEdit(u)">Editar</button>
              <button
                class="ml-3 text-sm font-medium text-slate-500 hover:text-slate-700 disabled:opacity-60"
                :disabled="resettingId === u.id"
                @click="onResetPassword(u)"
              >
                {{ resettingId === u.id ? 'Enviando…' : 'Resetear contraseña' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.input {
  @apply w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600;
}
</style>
