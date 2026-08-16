<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { normalizePhone, sendWhatsApp } from '@/lib/whatsapp'
import type { WhatsappConfig } from '@/types/database'

const loading = ref(true)
const saving = ref(false)
const testing = ref(false)
const errorMsg = ref('')
const savedMsg = ref('')
const configId = ref<string | null>(null)
const testPhone = ref('')
const testMsg = ref('')

const form = reactive({
  enabled: false,
  phone_number_id: '',
  access_token: '',
  technician_phones: '',
  check_interval: 5,
  notify_venc_enabled: false,
  venc_dias_1: 3,
  venc_dias_2: 7,
  venc_dias_3: 15,
})

async function loadConfig() {
  loading.value = true
  const { data, error } = await supabase.from('whatsapp_config').select('*').single()
  if (error) {
    errorMsg.value = error.message
  } else if (data) {
    const cfg = data as WhatsappConfig
    configId.value = cfg.id
    Object.assign(form, {
      enabled: cfg.enabled,
      phone_number_id: cfg.phone_number_id ?? '',
      access_token: cfg.access_token ?? '',
      technician_phones: cfg.technician_phones ?? '',
      check_interval: cfg.check_interval,
      notify_venc_enabled: cfg.notify_venc_enabled,
      venc_dias_1: cfg.venc_dias_1,
      venc_dias_2: cfg.venc_dias_2,
      venc_dias_3: cfg.venc_dias_3,
    })
  }
  loading.value = false
}

onMounted(loadConfig)

async function onSave() {
  if (!configId.value) return
  errorMsg.value = ''
  savedMsg.value = ''
  saving.value = true
  try {
    const { error } = await supabase
      .from('whatsapp_config')
      .update({
        enabled: form.enabled,
        phone_number_id: form.phone_number_id || null,
        access_token: form.access_token || null,
        technician_phones: form.technician_phones || null,
        check_interval: form.check_interval,
        notify_venc_enabled: form.notify_venc_enabled,
        venc_dias_1: form.venc_dias_1,
        venc_dias_2: form.venc_dias_2,
        venc_dias_3: form.venc_dias_3,
      })
      .eq('id', configId.value)
    if (error) throw error
    savedMsg.value = 'Configuración guardada.'
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo guardar la configuración'
  } finally {
    saving.value = false
  }
}

async function onEnviarPrueba() {
  errorMsg.value = ''
  savedMsg.value = ''
  const phone = normalizePhone(testPhone.value)
  if (!phone) {
    errorMsg.value = 'Número inválido — usá el formato 09XXXXXXXX.'
    return
  }
  testing.value = true
  try {
    await sendWhatsApp(phone, testMsg.value || 'Mensaje de prueba desde NodoISP.')
    savedMsg.value = 'Mensaje enviado.'
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo enviar el mensaje de prueba'
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-6 py-8">
    <div class="mb-6">
      <h1 class="text-xl font-semibold text-slate-900">WhatsApp Business</h1>
      <p class="text-sm text-slate-500">Notificaciones automáticas de tickets y vencimientos por WhatsApp.</p>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>
    <p v-if="savedMsg" class="mb-4 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-700">{{ savedMsg }}</p>

    <div v-if="loading" class="text-sm text-slate-400">Cargando…</div>

    <form v-else class="space-y-8" @submit.prevent="onSave">
      <section class="rounded-xl border border-slate-200 bg-white p-6">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Cuenta de Meta Business</h2>
          <label class="flex items-center gap-2 text-sm text-slate-700">
            <input v-model="form.enabled" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-teal-700" />
            Habilitado
          </label>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Phone Number ID</label>
            <input v-model="form.phone_number_id" placeholder="123456789012345" class="input font-mono" />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Access Token</label>
            <input v-model="form.access_token" type="password" class="input font-mono" />
          </div>
          <div class="col-span-2 space-y-1">
            <label class="text-sm font-medium text-slate-700">Teléfonos técnicos (separados por coma)</label>
            <input v-model="form.technician_phones" placeholder="593987654321,593912345678" class="input font-mono" />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Intervalo de chequeo (minutos)</label>
            <input v-model.number="form.check_interval" type="number" min="1" class="input" />
          </div>
        </div>
        <p class="mt-3 text-xs text-slate-500">
          El Access Token debe ser el permanente (Usuario del Sistema en Meta Business), no el de prueba de 24h.
        </p>
      </section>

      <section class="rounded-xl border border-slate-200 bg-white p-6">
        <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Notificaciones de vencimiento</h2>
        <label class="mb-4 flex items-center gap-2 text-sm text-slate-700">
          <input v-model="form.notify_venc_enabled" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-teal-700" />
          Activar avisos automáticos de mora
        </label>
        <div class="grid grid-cols-3 gap-4">
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">1.er aviso (días)</label>
            <input v-model.number="form.venc_dias_1" type="number" min="1" class="input" />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">2.do aviso (días)</label>
            <input v-model.number="form.venc_dias_2" type="number" min="1" class="input" />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">3.er aviso (días)</label>
            <input v-model.number="form.venc_dias_3" type="number" min="1" class="input" />
          </div>
        </div>
      </section>

      <div class="flex justify-end">
        <button
          type="submit"
          :disabled="saving"
          class="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {{ saving ? 'Guardando…' : 'Guardar configuración' }}
        </button>
      </div>
    </form>

    <section v-if="!loading" class="mt-8 rounded-xl border border-slate-200 bg-white p-6">
      <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Enviar mensaje de prueba</h2>
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Número (09XXXXXXXX)</label>
          <input v-model="testPhone" placeholder="0987654321" class="input font-mono" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Mensaje</label>
          <input v-model="testMsg" placeholder="Mensaje de prueba" class="input" />
        </div>
      </div>
      <div class="mt-4 flex justify-end">
        <button
          type="button"
          :disabled="testing || !testPhone"
          class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
          @click="onEnviarPrueba"
        >
          {{ testing ? 'Enviando…' : 'Enviar mensaje de prueba' }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.input {
  @apply w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600;
}
</style>
