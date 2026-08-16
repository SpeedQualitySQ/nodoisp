<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type { SriEmitterConfig } from '@/types/database'

// Mismo registro que /configuracion/emisor-sri (sri_emitter_config) — no se
// crea una tabla nueva con los mismos datos. Esta pantalla solo toca los
// campos de identidad/contacto (nombre, RUC, dirección, teléfono, email,
// logo); ambiente/certificado/secuenciales siguen siendo exclusivos de la
// pantalla de Emisor SRI. Cada guardado manda solo sus propios campos, así
// que las dos pantallas no se pisan entre sí.

const loading = ref(true)
const saving = ref(false)
const errorMsg = ref('')
const savedMsg = ref('')
const configId = ref<string | null>(null)
const logoFile = ref<File | null>(null)
const logoUrl = ref<string | null>(null)

const form = reactive({
  ruc: '',
  razon_social: '',
  nombre_comercial: '',
  direccion: '',
  telefono: '',
  email: '',
  logo_path: '' as string | null,
})

async function resolveLogoUrl() {
  if (!form.logo_path) {
    logoUrl.value = null
    return
  }
  const { data } = await supabase.storage.from('company-assets').createSignedUrl(form.logo_path, 3600)
  logoUrl.value = data?.signedUrl ?? null
}

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
      telefono: cfg.telefono ?? '',
      email: cfg.email ?? '',
      logo_path: cfg.logo_path,
    })
    await resolveLogoUrl()
  }
  loading.value = false
}

onMounted(loadConfig)

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  logoFile.value = input.files?.[0] ?? null
}

async function onSave() {
  errorMsg.value = ''
  savedMsg.value = ''
  saving.value = true
  try {
    let logoPath = form.logo_path

    if (logoFile.value) {
      const path = `logo-${Date.now()}-${logoFile.value.name}`
      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(path, logoFile.value, { upsert: true })
      if (uploadError) throw uploadError
      logoPath = path
    }

    const payload = {
      ruc: form.ruc,
      razon_social: form.razon_social,
      nombre_comercial: form.nombre_comercial || null,
      direccion: form.direccion,
      telefono: form.telefono || null,
      email: form.email || null,
      logo_path: logoPath,
    }

    if (configId.value) {
      const { error } = await supabase.from('sri_emitter_config').update(payload).eq('id', configId.value)
      if (error) throw error
    } else {
      const { data, error } = await supabase.from('sri_emitter_config').insert(payload).select('id').single()
      if (error) throw error
      configId.value = data.id
    }

    form.logo_path = logoPath
    logoFile.value = null
    await resolveLogoUrl()
    savedMsg.value = 'Datos de la empresa guardados.'
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo guardar'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-6 py-8">
    <div class="mb-6">
      <h1 class="text-xl font-semibold text-slate-900">Datos de la empresa</h1>
      <p class="text-sm text-slate-500">Aparecen en facturas y documentos del sistema.</p>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>
    <p v-if="savedMsg" class="mb-4 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-700">{{ savedMsg }}</p>

    <div v-if="loading" class="text-sm text-slate-400">Cargando…</div>

    <form v-else class="space-y-6 rounded-xl border border-slate-200 bg-white p-6" @submit.prevent="onSave">
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Nombre comercial</label>
          <input v-model="form.nombre_comercial" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Razón social</label>
          <input v-model="form.razon_social" required class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">RUC</label>
          <input v-model="form.ruc" required maxlength="13" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Teléfono</label>
          <input v-model="form.telefono" class="input" />
        </div>
        <div class="col-span-2 space-y-1">
          <label class="text-sm font-medium text-slate-700">Dirección</label>
          <input v-model="form.direccion" required class="input" />
        </div>
        <div class="col-span-2 space-y-1">
          <label class="text-sm font-medium text-slate-700">Email</label>
          <input v-model="form.email" type="email" class="input" />
        </div>
      </div>

      <div class="space-y-1">
        <label class="text-sm font-medium text-slate-700">Logo</label>
        <img v-if="logoUrl" :src="logoUrl" alt="Logo actual" class="mb-2 h-16 rounded border border-slate-200 object-contain p-1" />
        <input type="file" accept="image/png,image/jpeg" class="input" @change="onFileChange" />
      </div>

      <div class="flex justify-end">
        <button
          type="submit"
          :disabled="saving"
          class="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {{ saving ? 'Guardando…' : 'Guardar' }}
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
