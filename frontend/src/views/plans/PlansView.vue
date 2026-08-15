<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { PlusIcon } from '@heroicons/vue/24/outline'
import { supabase } from '@/lib/supabase'
import type { Plan, PlanTechnology } from '@/types/database'

const plans = ref<Plan[]>([])
const loading = ref(true)
const errorMsg = ref('')
const saving = ref(false)
const editingId = ref<string | null>(null)
const showForm = ref(false)

const TECHNOLOGIES: PlanTechnology[] = ['fiber', 'radio', 'cable']

const form = reactive({
  name: '',
  download_speed: 0,
  upload_speed: 0,
  price: 0,
  technology: 'fiber' as PlanTechnology,
  is_active: true,
})

function resetForm() {
  editingId.value = null
  form.name = ''
  form.download_speed = 0
  form.upload_speed = 0
  form.price = 0
  form.technology = 'fiber'
  form.is_active = true
}

function openNew() {
  resetForm()
  showForm.value = true
}

function openEdit(plan: Plan) {
  editingId.value = plan.id
  form.name = plan.name
  form.download_speed = plan.download_speed
  form.upload_speed = plan.upload_speed
  form.price = plan.price
  form.technology = plan.technology
  form.is_active = plan.is_active
  showForm.value = true
}

async function loadPlans() {
  loading.value = true
  const { data, error } = await supabase.from('plans').select('*').order('price')
  if (error) errorMsg.value = error.message
  plans.value = (data ?? []) as Plan[]
  loading.value = false
}

async function onSave() {
  saving.value = true
  errorMsg.value = ''
  try {
    if (editingId.value) {
      const { error } = await supabase.from('plans').update(form).eq('id', editingId.value)
      if (error) throw error
    } else {
      const { error } = await supabase.from('plans').insert(form)
      if (error) throw error
    }
    showForm.value = false
    await loadPlans()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo guardar el plan'
  } finally {
    saving.value = false
  }
}

async function toggleActive(plan: Plan) {
  const { error } = await supabase
    .from('plans')
    .update({ is_active: !plan.is_active })
    .eq('id', plan.id)
  if (error) {
    errorMsg.value = error.message
    return
  }
  plan.is_active = !plan.is_active
}

onMounted(loadPlans)
</script>

<template>
  <div class="mx-auto max-w-4xl px-6 py-8">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-xl font-semibold text-slate-900">Planes de servicio</h1>
      <button
        class="flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
        @click="openNew"
      >
        <PlusIcon class="h-4 w-4" />
        Nuevo plan
      </button>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {{ errorMsg }}
    </p>

    <div v-if="showForm" class="mb-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {{ editingId ? 'Editar plan' : 'Nuevo plan' }}
      </h2>
      <form class="grid grid-cols-2 gap-4" @submit.prevent="onSave">
        <div class="col-span-2 space-y-1">
          <label class="text-sm font-medium text-slate-700">Nombre</label>
          <input v-model="form.name" required class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Bajada (Mbps)</label>
          <input v-model.number="form.download_speed" type="number" min="0" required class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Subida (Mbps)</label>
          <input v-model.number="form.upload_speed" type="number" min="0" required class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Precio (USD)</label>
          <input v-model.number="form.price" type="number" min="0" step="0.01" required class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Tecnología</label>
          <select v-model="form.technology" class="input">
            <option v-for="t in TECHNOLOGIES" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <label class="col-span-2 flex items-center gap-2 text-sm text-slate-700">
          <input v-model="form.is_active" type="checkbox" class="h-4 w-4 rounded border-slate-300" />
          Disponible para nuevos contratos
        </label>
        <div class="col-span-2 flex justify-end gap-3">
          <button type="button" class="px-3 py-2 text-sm text-slate-600" @click="showForm = false">
            Cancelar
          </button>
          <button
            type="submit"
            :disabled="saving"
            class="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            Guardar
          </button>
        </div>
      </form>
    </div>

    <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-4 py-3">Plan</th>
            <th class="px-4 py-3">Velocidad</th>
            <th class="px-4 py-3">Precio</th>
            <th class="px-4 py-3">Tecnología</th>
            <th class="px-4 py-3">Estado</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading">
            <td colspan="6" class="px-4 py-6 text-center text-slate-400">Cargando…</td>
          </tr>
          <tr v-for="p in plans" :key="p.id" class="hover:bg-slate-50">
            <td class="px-4 py-3 font-medium text-slate-900">{{ p.name }}</td>
            <td class="px-4 py-3 tabular-nums text-slate-600">{{ p.download_speed }}↓ / {{ p.upload_speed }}↑ Mbps</td>
            <td class="px-4 py-3 tabular-nums text-slate-600">${{ p.price.toFixed(2) }}</td>
            <td class="px-4 py-3 capitalize text-slate-600">{{ p.technology }}</td>
            <td class="px-4 py-3">
              <button
                class="rounded-full px-2.5 py-0.5 text-xs font-medium"
                :class="p.is_active ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'"
                @click="toggleActive(p)"
              >
                {{ p.is_active ? 'Activo' : 'Inactivo' }}
              </button>
            </td>
            <td class="px-4 py-3 text-right">
              <button class="text-sm font-medium text-teal-700 hover:text-teal-900" @click="openEdit(p)">
                Editar
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
