<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import type { InventoryMovement, ProductStock } from '@/types/database'
import StatusBadge from '@/components/StatusBadge.vue'

const products = ref<ProductStock[]>([])
const movements = ref<InventoryMovement[]>([])
const selectedProductId = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function loadProducts() {
  const { data, error } = await supabase.from('product_stock').select('*').order('name')
  if (error) errorMsg.value = error.message
  products.value = (data ?? []) as ProductStock[]
}

async function loadMovements() {
  if (!selectedProductId.value) {
    movements.value = []
    return
  }
  loading.value = true
  errorMsg.value = ''
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('*')
    .eq('product_id', selectedProductId.value)
    .order('created_at', { ascending: true })
  if (error) errorMsg.value = error.message
  movements.value = (data ?? []) as InventoryMovement[]
  loading.value = false
}

watch(selectedProductId, loadMovements)

onMounted(async () => {
  await loadProducts()
})

const selectedProduct = computed(() => products.value.find((p) => p.id === selectedProductId.value) ?? null)

// Saldo acumulado por movimiento, en orden cronológico (para mostrar el
// kárdex de arriba hacia abajo se invierte solo en el template).
const withBalance = computed(() => {
  let balance = 0
  return movements.value.map((m) => {
    balance += m.type === 'in' ? m.quantity : -m.quantity
    return { ...m, balance }
  })
})

const lowStock = computed(() => products.value.filter((p) => p.stock <= p.min_stock))
</script>

<template>
  <div class="mx-auto max-w-4xl px-6 py-8">
    <div class="mb-6">
      <h1 class="text-xl font-semibold text-slate-900">Kárdex de inventario</h1>
      <p class="text-sm text-slate-500">Historial de movimientos por producto</p>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>

    <div v-if="lowStock.length" class="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p class="mb-2 text-sm font-semibold text-amber-800">{{ lowStock.length }} producto(s) bajo el stock mínimo</p>
      <ul class="space-y-1 text-sm text-amber-700">
        <li v-for="p in lowStock" :key="p.id">{{ p.name }} — stock {{ p.stock }} (mín. {{ p.min_stock }})</li>
      </ul>
    </div>

    <div class="mb-6 max-w-sm space-y-1">
      <label class="text-sm font-medium text-slate-700">Producto</label>
      <select v-model="selectedProductId" class="input">
        <option value="">Seleccionar producto…</option>
        <option v-for="p in products" :key="p.id" :value="p.id">{{ p.code }} — {{ p.name }}</option>
      </select>
    </div>

    <div v-if="selectedProduct" class="mb-4 flex gap-6 rounded-xl border border-slate-200 bg-white p-4 text-sm">
      <div><span class="text-slate-500">Stock actual: </span><span class="font-semibold text-slate-900">{{ selectedProduct.stock }}</span></div>
      <div><span class="text-slate-500">Stock mínimo: </span><span class="font-semibold text-slate-900">{{ selectedProduct.min_stock }}</span></div>
      <div><span class="text-slate-500">Costo unitario: </span><span class="font-semibold text-slate-900">${{ selectedProduct.cost_price.toFixed(2) }}</span></div>
    </div>

    <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-4 py-3">Fecha</th>
            <th class="px-4 py-3">Tipo</th>
            <th class="px-4 py-3">Cantidad</th>
            <th class="px-4 py-3">Saldo</th>
            <th class="px-4 py-3">Notas</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="!selectedProductId">
            <td colspan="5" class="px-4 py-6 text-center text-slate-400">Elegí un producto para ver su historial</td>
          </tr>
          <tr v-else-if="loading">
            <td colspan="5" class="px-4 py-6 text-center text-slate-400">Cargando…</td>
          </tr>
          <tr v-else-if="!withBalance.length">
            <td colspan="5" class="px-4 py-6 text-center text-slate-400">Sin movimientos todavía</td>
          </tr>
          <tr v-for="m in [...withBalance].reverse()" :key="m.id" class="hover:bg-slate-50">
            <td class="px-4 py-3 text-slate-600">{{ new Date(m.created_at).toLocaleString('es-EC') }}</td>
            <td class="px-4 py-3"><StatusBadge :status="m.type" /></td>
            <td class="px-4 py-3 tabular-nums" :class="m.type === 'in' ? 'text-teal-700' : 'text-orange-600'">
              {{ m.type === 'in' ? '+' : '-' }}{{ m.quantity }}
            </td>
            <td class="px-4 py-3 tabular-nums font-medium text-slate-900">{{ m.balance }}</td>
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
