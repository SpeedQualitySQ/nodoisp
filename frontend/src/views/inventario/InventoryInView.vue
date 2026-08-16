<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import type { InventoryMovement, ProductStock } from '@/types/database'

const auth = useAuthStore()

const products = ref<ProductStock[]>([])
const movements = ref<(InventoryMovement & { products: { code: string; name: string } | null })[]>([])
const loading = ref(true)
const errorMsg = ref('')
const okMsg = ref('')
const saving = ref(false)

const form = reactive({ product_id: '', quantity: 1, notes: '' })

const selectedProduct = computed(() => products.value.find((p) => p.id === form.product_id) ?? null)

async function loadProducts() {
  const { data } = await supabase.from('product_stock').select('*').order('name')
  products.value = (data ?? []) as ProductStock[]
}

async function loadMovements() {
  loading.value = true
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('*, products(code, name)')
    .eq('type', 'in')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) errorMsg.value = error.message
  movements.value = (data ?? []) as unknown as (InventoryMovement & { products: { code: string; name: string } | null })[]
  loading.value = false
}

onMounted(async () => {
  await Promise.all([loadProducts(), loadMovements()])
})

async function onSubmit() {
  saving.value = true
  errorMsg.value = ''
  okMsg.value = ''
  try {
    const { error } = await supabase.from('inventory_movements').insert({
      product_id: form.product_id,
      type: 'in',
      quantity: form.quantity,
      notes: form.notes || null,
      created_by: auth.user?.id ?? null,
    })
    if (error) throw error
    okMsg.value = `Ingreso registrado: ${form.quantity} unidad(es) de ${selectedProduct.value?.name}.`
    form.product_id = ''
    form.quantity = 1
    form.notes = ''
    await Promise.all([loadProducts(), loadMovements()])
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo registrar el ingreso'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-6 py-8">
    <div class="mb-6">
      <h1 class="text-xl font-semibold text-slate-900">Ingreso de inventario</h1>
      <p class="text-sm text-slate-500">Registrar entrada de equipos al stock (compras)</p>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>
    <p v-if="okMsg" class="mb-4 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-700">{{ okMsg }}</p>

    <form class="mb-8 grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-white p-6" @submit.prevent="onSubmit">
      <div class="col-span-2 space-y-1">
        <label class="text-sm font-medium text-slate-700">Producto</label>
        <select v-model="form.product_id" required class="input">
          <option value="" disabled>Seleccionar producto…</option>
          <option v-for="p in products" :key="p.id" :value="p.id">{{ p.code }} — {{ p.name }} (stock: {{ p.stock }})</option>
        </select>
      </div>
      <div class="space-y-1">
        <label class="text-sm font-medium text-slate-700">Cantidad</label>
        <input v-model.number="form.quantity" type="number" min="1" required class="input" />
      </div>
      <div class="space-y-1">
        <label class="text-sm font-medium text-slate-700">Notas</label>
        <input v-model="form.notes" placeholder="Ej. factura de compra #123" class="input" />
      </div>
      <div class="col-span-2 flex justify-end">
        <button
          type="submit"
          :disabled="saving || !form.product_id"
          class="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {{ saving ? 'Guardando…' : 'Registrar ingreso' }}
        </button>
      </div>
    </form>

    <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Últimos ingresos</h2>
    <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-4 py-3">Fecha</th>
            <th class="px-4 py-3">Producto</th>
            <th class="px-4 py-3">Cantidad</th>
            <th class="px-4 py-3">Notas</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading">
            <td colspan="4" class="px-4 py-6 text-center text-slate-400">Cargando…</td>
          </tr>
          <tr v-else-if="!movements.length">
            <td colspan="4" class="px-4 py-6 text-center text-slate-400">Sin ingresos todavía</td>
          </tr>
          <tr v-for="m in movements" :key="m.id" class="hover:bg-slate-50">
            <td class="px-4 py-3 text-slate-600">{{ new Date(m.created_at).toLocaleString('es-EC') }}</td>
            <td class="px-4 py-3 text-slate-900">{{ m.products?.name ?? '—' }}</td>
            <td class="px-4 py-3 tabular-nums font-medium text-teal-700">+{{ m.quantity }}</td>
            <td class="px-4 py-3 text-slate-500">{{ m.notes || '—' }}</td>
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
