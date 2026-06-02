import { onUnmounted, ref, watch } from "vue";
import { geocodeLocation } from "../lib/reverseGeocode";
import { useArchiveStore } from "../stores/archive";

interface MediaRecordSource {
   mainFilePath: string;
   overlayFilePath: string | null;
   location: string | null;
}

export function useMediaRecord(getRecord: () => MediaRecordSource) {
   const archiveStore = useArchiveStore();

   const mainBlobUrl = ref<string | null>(null);
   const overlayBlobUrl = ref<string | null>(null);
   const cityName = ref<string | null>(null);

   let activeRun = 0;
   let disposed = false;

   function revokeUrl(url: string | null) {
      if (url) URL.revokeObjectURL(url);
   }

   function clearBlobUrls() {
      revokeUrl(mainBlobUrl.value);
      revokeUrl(overlayBlobUrl.value);
      mainBlobUrl.value = null;
      overlayBlobUrl.value = null;
   }

   watch(
      () => {
         const record = getRecord();
         return {
            mainFilePath: record.mainFilePath,
            overlayFilePath: record.overlayFilePath,
            location: record.location,
         };
      },
      async (record, _previousRecord, onCleanup) => {
         const run = ++activeRun;
         let cancelled = false;

         onCleanup(() => {
            cancelled = true;
         });

         clearBlobUrls();
         cityName.value = null;

         const [mainUrl, overlayUrl, resolvedCityName] = await Promise.all([
            archiveStore.resolveMediaUrl(record.mainFilePath),
            record.overlayFilePath
               ? archiveStore.resolveMediaUrl(record.overlayFilePath)
               : Promise.resolve(null),
            geocodeLocation(record.location),
         ]);

         if (disposed || cancelled || run !== activeRun) {
            revokeUrl(mainUrl);
            revokeUrl(overlayUrl);
            return;
         }

         mainBlobUrl.value = mainUrl;
         overlayBlobUrl.value = overlayUrl;
         cityName.value = resolvedCityName;
      },
      { immediate: true },
   );

   onUnmounted(() => {
      disposed = true;
      activeRun += 1;
      clearBlobUrls();
   });

   return {
      mainBlobUrl,
      overlayBlobUrl,
      cityName,
   };
}
