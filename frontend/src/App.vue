<script setup lang="ts">
import { useRoute } from 'vue-router'
import AppShell from '@/components/layout/AppShell.vue'
import PortalShell from '@/components/layout/PortalShell.vue'

const route = useRoute()
</script>

<template>
  <RouterView v-if="route.meta.public" />
  <PortalShell v-else-if="route.meta.portal" />
  <AppShell v-else />
</template>
