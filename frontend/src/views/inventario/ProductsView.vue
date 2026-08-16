<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { PlusIcon } from '@heroicons/vue/24/outline'
import { supabase } from '@/lib/supabase'
import type { ProductStock } from '@/types/database'

const products = ref<ProductStock[]>([])
const loading = ref(true)
const errorMsg = ref('')
const saving = ref(false)
const editingId = ref<string | null>(null)
const showForm = ref(false)

const form = reactive({
  code: '',
  name: '',
  category: '',
  unit: 'Unidad',
  min_stock: 0,
  cost_price: 0,
})

function resetForm() {
  editingId.value = null
  form.code = ''
  form.name = ''
  form.category = ''
  form.unit = 'Unidad'
  form.min_stock = 0
  form.cost_price = 0
}

function openNew() {
  resetForm()
  showForm.value = true
}

function openEdit(p: ProductStock) {
  editingId.value = p.id
  form.code = p.code
  form.name = p.name
  form.category = p.category ?? ''
  form.unit = p.unit
  form.min_stock = p.min_stock
  form.cost_price = p.cost_price
  showForm.value = true
}

async function loadProducts() {
  loading.value = true
  errorMsg.value = ''
  const { data, error } = await supabase.from('product_stock').select('*').order('name')
  if (error) errorMsg.value = error.message
  products.value = (data ?? []) as ProductStock[]
  loading.value = false
}

onMounted(loadProducts)

async function onSave() {
  saving.value = true
  errorMsg.value = ''
  try {
    const payload = {
      code: form.code,
      name: form.name,
      category: form.category || null,
      unit: form.unit,
      min_stock: form.min_stock,
      cost_price: form.cost_price,
    }
    if (editingId.value) {
      const { error } = await supabase.from('products').update(payload).eq('id', editingId.value)
      if (error) throw error
    } else {
      const { error } = await supabase.from('products').insert(payload)
      if (error) throw error
    }
    showForm.value = false
    await loadProducts()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo guardar el producto'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-6 py-8">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">Productos</h1>
        <p class="text-sm text-slate-500">Catálogo de equipos del inventario</p>
      </div>
      <button
        class="flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
        @click="openNew"
      >
        <PlusIcon class="h-4 w-4" />
        Nuevo producto
      </button>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>

    <div v-if="showForm" class="mb-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {{ editingId ? 'Editar producto' : 'Nuevo producto' }}
      </h2>
      <form class="grid grid-cols-2 gap-4" @submit.prevent="onSave">
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Código</label>
          <input v-model="form.code" required class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Nombre</label>
          <input v-model="form.name" required class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Categoría</label>
          <input v-model="form.category" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Unidad</label>
          <input v-model="form.unit" required class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Stock mínimo</label>
          <input v-model.number="form.min_stock" type="number" min="0" required class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Precio costo (USD)</label>
          <input v-model.number="form.cost_price" type="number" min="0" step="0.01" required class="input" />
        </div>
        <div class="col-span-2 flex justify-end gap-3">
          <button type="button" class="px-3 py-2 text-sm text-slate-600" @click="showForm = false">Cancelar</button>
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
            <th class="px-4 py-3">Código</th>
            <th class="px-4 py-3">Nombre</th>
            <th class="px-4 py-3">Categoría</th>
            <th class="px-4 py-3">Stock</th>
            <th class="px-4 py-3">Costo</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading">
            <td colspan="6" class="px-4 py-6 text-center text-slate-400">Cargando…</td>
          </tr>
          <tr v-else-if="!products.length">
            <td colspan="6" class="px-4 py-6 text-center text-slate-400">Sin productos todavía</td>
          </tr>
          <tr v-for="p in products" :key="p.id" class="hover:bg-slate-50">
            <td class="px-4 py-3 font-mono text-xs text-slate-600">{{ p.code }}</td>
            <td class="px-4 py-3 font-medium text-slate-900">{{ p.name }}</td>
            <td class="px-4 py-3 text-slate-600">{{ p.category || '—' }}</td>
            <td class="px-4 py-3 tabular-nums">
              <span :class="p.stock <= p.min_stock ? 'font-semibold text-red-600' : 'text-slate-700'">
                {{ p.stock }}
              </span>
              <span class="text-xs text-slate-400"> / mín. {{ p.min_stock }}</span>
            </td>
            <td class="px-4 py-3 tabular-nums text-slate-600">${{ p.cost_price.toFixed(2) }}</td>
            <td class="px-4 py-3 text-right">
              <button class="text-sm font-medium text-teal-700 hover:text-teal-900" @click="openEdit(p)">Editar</button>
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
