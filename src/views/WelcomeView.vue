<script setup lang="ts">
import { ref } from 'vue';
import SlideCard from '../components/SlideCard.vue';

const title = ref("Most snapped person");
</script>

<template>
	<SlideCard :title="title" />
</template>


<style scoped>

</style>
