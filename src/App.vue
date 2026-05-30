<script setup lang="ts">
import Layout from "./components/Layout.vue";
</script>

<template>
   <Layout>
      <router-view v-slot="{ Component }">
         <Transition name="fade" mode="out-in">
            <component :is="Component" />
         </Transition>
      </router-view>
   </Layout>
</template>
