<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type { SriEmitterConfig } from '@/types/database'

const loading = ref(true)
const saving = ref(false)
const errorMsg = ref('')
const savedMsg = ref('')
const configId = ref<string | null>(null)
const certificateFile = ref<File | null>(null)

const form = reactive({
  ruc: '',
  razon_social: '',
  nombre_comercial: '',
  direccion: '',
  establecimiento: '001',
  punto_emision: '001',
  ambiente: 1 as 1 | 2,
  certificado_path: '' as string | null,
  certificado_password: '',
})

async function loadConfig() {
  loading.value = true
  const { data, error } = await supabase.from('sri_emitter_config').select('*').maybeSingle()
  if (error) {
    errorMsg.value = error.message
  } else if (data) {
    const cfg = data as SriEmitterConfig
    configId.value = cfg.id
    Object.assign(form, {
      ruc: cfg.ruc,
      razon_social: cfg.razon_social,
      nombre_comercial: cfg.nombre_comercial ?? '',
      direccion: cfg.direccion,
      establecimiento: cfg.establecimiento,
      punto_emision: cfg.punto_emision,
      ambiente: cfg.ambiente,
      certificado_path: cfg.certificado_path,
      certificado_password: cfg.certificado_password ?? '',
    })
  }
  loading.value = false
}

onMounted(loadConfig)

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  certificateFile.value = input.files?.[0] ?? null
}

async function onSave() {
  errorMsg.value = ''
  savedMsg.value = ''
  saving.value = true
  try {
    let certPath = form.certificado_path

    if (certificateFile.value) {
      const path = `${form.ruc || 'emisor'}/${Date.now()}-${certificateFile.value.name}`
      const { error: uploadError } = await supabase.storage
        .from('sri-certificates')
        .upload(path, certificateFile.value, { upsert: true })
      if (uploadError) throw uploadError
      certPath = path
    }

    const payload = {
      ruc: form.ruc,
      razon_social: form.razon_social,
      nombre_comercial: form.nombre_comercial || null,
      direccion: form.direccion,
      establecimiento: form.establecimiento,
      punto_emision: form.punto_emision,
      ambiente: form.ambiente,
      certificado_path: certPath,
      certificado_password: form.certificado_password || null,
    }

    if (configId.value) {
      const { error } = await supabase
        .from('sri_emitter_config')
        .update(payload)
        .eq('id', configId.value)
      if (error) throw error
    } else {
      const { data, error } = await supabase
        .from('sri_emitter_config')
        .insert(payload)
        .select('id')
        .single()
      if (error) throw error
      configId.value = data.id
    }

    form.certificado_path = certPath
    certificateFile.value = null
    savedMsg.value = 'Configuración guardada.'
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo guardar la configuración'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-6 py-8">
    <div class="mb-6">
      <h1 class="text-xl font-semibold text-slate-900">Emisor SRI</h1>
      <p class="text-sm text-slate-500">Datos del emisor usados para numerar y firmar los comprobantes electrónicos.</p>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>
    <p v-if="savedMsg" class="mb-4 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-700">{{ savedMsg }}</p>

    <div v-if="loading" class="text-sm text-slate-400">Cargando…</div>

    <form v-else class="space-y-8" @submit.prevent="onSave">
      <section class="rounded-xl border border-slate-200 bg-white p-6">
        <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Datos del emisor</h2>
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">RUC</label>
            <input v-model="form.ruc" required maxlength="13" class="input" />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Razón social</label>
            <input v-model="form.razon_social" required class="input" />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Nombre comercial</label>
            <input v-model="form.nombre_comercial" class="input" />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Dirección</label>
            <input v-model="form.direccion" required class="input" />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Establecimiento</label>
            <input v-model="form.establecimiento" required maxlength="3" class="input" />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Punto de emisión</label>
            <input v-model="form.punto_emision" required maxlength="3" class="input" />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Ambiente</label>
            <select v-model.number="form.ambiente" class="input">
              <option :value="1">1 — Pruebas</option>
              <option :value="2">2 — Producción</option>
            </select>
          </div>
        </div>
      </section>

      <section class="rounded-xl border border-slate-200 bg-white p-6">
        <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Certificado digital</h2>
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Archivo .p12</label>
            <input type="file" accept=".p12" class="input" @change="onFileChange" />
            <p v-if="form.certificado_path" class="text-xs text-slate-500">
              Actual: {{ form.certificado_path.split('/').pop() }}
            </p>
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Contraseña del certificado</label>
            <input v-model="form.certificado_password" type="password" class="input" />
          </div>
        </div>
        <p class="mt-3 text-xs text-slate-500">
          La firma XAdES-BES y el envío al webservice del SRI se simulan en este entorno de taller.
        </p>
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
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.input {
  @apply w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600;
}
</style>
