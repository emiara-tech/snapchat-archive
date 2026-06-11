<template>
	<MediaCardShell
		:date="record.date"
		:formatted-date="formattedDate"
		:city-name="cityName"
		:label="cardLabel"
		@click="emit('click')"
	>
		<VideoMediaCard
			v-if="isVideo"
			:src="mainBlobUrl"
			:overlay-src="overlayBlobUrl"
			:label="mediaLabel"
		/>
		<ImageMediaCard
			v-else
			:src="mainBlobUrl"
			:overlay-src="overlayBlobUrl"
			:alt="mediaLabel"
		/>
	</MediaCardShell>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useMediaRecord } from "../../composables/useMediaRecord";
import type { MediaRecord } from "../../types";
import ImageMediaCard from "./ImageMediaCard.vue";
import MediaCardShell from "./MediaCardShell.vue";
import VideoMediaCard from "./VideoMediaCard.vue";

const props = defineProps<{
	record: MediaRecord;
}>();

const emit = defineEmits<{
	(event: "click"): void;
}>();

const { mainBlobUrl, overlayBlobUrl, cityName } = useMediaRecord(
	() => props.record,
);

const formattedDate = computed(() => {
	const date = new Date(props.record.date);
	if (Number.isNaN(date.getTime())) return props.record.date;
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
});

const isVideo = computed(
	() =>
		props.record.mediaType.toLowerCase() === "video" ||
		props.record.mainFilePath.toLowerCase().endsWith(".mp4"),
);

const mediaLabel = computed(() => {
	return `${props.record.mediaType} media from ${props.record.date}`;
});

const cardLabel = computed(() => {
	return `Media metadata from ${props.record.date}`;
});
</script>