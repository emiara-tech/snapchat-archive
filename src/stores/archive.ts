import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
	ArchiveCapabilities,
	ArchiveDiagnostics,
	ChatHistory,
	ComputedArchiveStats,
	ExportConfig,
	Friend,
	MemoryRecord,
	SnapHistory,
	Story,
} from '../types'
import type { ArchiveProgressCallback, ArchiveSession } from '../lib/snapArchive'
import { createArchiveSession, SNAP_JSON_PATHS } from '../lib/snapArchive'
import { computeStats } from '../lib/computeStats'
import {
	AnalysisManager,
	BestFriendsAnalyzer,
	SentimentAnalyzer,
	StreakAnalyzer,
	TimelineAnalyzer,
	WordCloudAnalyzer,
} from '../lib/analyzers'
import {
	parseChatHistoryJson,
	parseMemoriesHistoryJson,
	parseSnapHistoryJson,
	parseStoryHistoryJson,
} from '../lib/snapchatParsers'

const EMPTY_CAPABILITIES: ArchiveCapabilities = {
	hasAccountJson: false,
	hasFriendsJson: false,
	hasChatHistoryJson: false,
	hasSnapHistoryJson: false,
	hasStoryHistoryJson: false,
	hasMemoriesHistoryJson: false,
	hasMemoriesDirectory: false,
	hasChatMediaDirectory: false,
}

const EMPTY_DIAGNOSTICS: ArchiveDiagnostics = {
	missingExpectedPaths: [],
	unknownJsonFiles: [],
	mediaCountsByDirectory: {},
	mediaCountsByExtension: {},
	duplicateEntryPaths: [],
}

export const useArchiveStore = defineStore('archive', () => {
	const isImported = ref(false)
	const isProcessing = ref(false)
	const processingProgress = ref(0)
	const processingStatus = ref('')
	const importError = ref<string | null>(null)
	const statsError = ref<string | null>(null)

	const friendsList = ref<Friend[]>([])
	const chatHistory = ref<ChatHistory | null>(null)
	const snapHistory = ref<SnapHistory | null>(null)
	const memoriesList = ref<MemoryRecord[]>([])
	const storiesList = ref<Story[]>([])
	const archiveStats = ref<ComputedArchiveStats | null>(null)
	const archiveCapabilities = ref<ArchiveCapabilities>({ ...EMPTY_CAPABILITIES })
	const archiveDiagnostics = ref<ArchiveDiagnostics>({ ...EMPTY_DIAGNOSTICS })
	const isLoadingStats = ref(false)
	const analysisManager = ref<AnalysisManager | null>(null)
	const analysisResults = ref<Map<string, unknown>>(new Map())
	const archiveSession = ref<ArchiveSession | null>(null)
	const selectedFiles = ref<File[]>([])

	const exportConfig = ref<ExportConfig>({
		includeSnaps: true,
		includeChats: true,
		includeStories: true,
		includeMetadata: true,
		format: 'json',
	})

	const importedDate = ref<string | null>(null)

	const totalMemories = computed(() => memoriesList.value.length)
	const totalPhotos = totalMemories
	const photosList = memoriesList
	const totalFriends = computed(() => friendsList.value.length)
	const totalChats = computed(() => {
		if (!chatHistory.value) return 0
		return Object.values(chatHistory.value).reduce((sum, thread) => sum + thread.length, 0)
	})

	function startProcessing() {
		importError.value = null
		statsError.value = null
		isProcessing.value = true
		processingProgress.value = 0
	}

	function updateProgress(progress: number, status: string) {
		processingProgress.value = progress
		processingStatus.value = status
	}

	function completeProcessing() {
		isProcessing.value = false
		isImported.value = true
		processingProgress.value = 100
		importedDate.value = new Date().toISOString()
	}

	async function prepareArchive(files: File[], onProgress?: ArchiveProgressCallback): Promise<void> {
		try {
			const session = await createArchiveSession(files, (progress, status) => {
				updateProgress(progress, status)
				onProgress?.(progress, status)
			})

			archiveSession.value = session
			friendsList.value = session.metadata.friends
			archiveCapabilities.value = session.metadata.capabilities
			archiveDiagnostics.value = session.metadata.diagnostics
			archiveStats.value = null
			initializeAnalyzers(session)
		} catch (error) {
			importError.value = error instanceof Error ? error.message : 'Failed to import archive'
			throw error
		}
	}

	async function loadStats(): Promise<void> {
		if (archiveStats.value !== null) return
		if (!archiveSession.value) return
		if (isLoadingStats.value) return

		isLoadingStats.value = true
		statsError.value = null
		const { reader, metadata, index } = archiveSession.value

		try {
			updateProgress(10, 'Loading snap history')
			const snap = parseSnapHistoryJson(await reader.readJsonFile<unknown>(SNAP_JSON_PATHS.snapHistory))
			snapHistory.value = snap

			updateProgress(35, 'Loading chat history')
			const chat = parseChatHistoryJson(await reader.readJsonFile<unknown>(SNAP_JSON_PATHS.chatHistory))
			chatHistory.value = chat

			updateProgress(60, 'Loading story history')
			const storyJson = parseStoryHistoryJson(await reader.readJsonFile<unknown>(SNAP_JSON_PATHS.storyHistory))
			storiesList.value = storyJson?.['Your Story Views'] ?? []

			updateProgress(75, 'Loading memories metadata')
			const memories = parseMemoriesHistoryJson(await reader.readJsonFile<unknown>(SNAP_JSON_PATHS.memoriesHistory))
			memoriesList.value = memories

			updateProgress(90, 'Computing stats')
			archiveStats.value = computeStats({
				friends: metadata.friends,
				snapHistory: snap,
				chatHistory: chat,
				storyHistory: storyJson,
				memories,
				indexedMediaBytes: computeIndexedMediaBytes(index),
			})

			updateProgress(100, 'Done')
		} catch (error) {
			statsError.value = error instanceof Error ? error.message : 'Failed to load archive stats'
			throw error
		} finally {
			isLoadingStats.value = false
		}
	}

	function initializeAnalyzers(session: ArchiveSession) {
		const manager = new AnalysisManager({ reader: session.reader, metadata: session.metadata })
		manager.registerAll([
			new StreakAnalyzer(),
			new BestFriendsAnalyzer(),
			new SentimentAnalyzer(),
			new WordCloudAnalyzer(),
			new TimelineAnalyzer(),
		])
		analysisManager.value = manager
		analysisResults.value = manager.getCachedResults()
	}

	async function runAnalyzer(id: string) {
		if (!analysisManager.value) return undefined
		const result = await analysisManager.value.runOne(id)
		analysisResults.value = new Map(analysisManager.value.getCachedResults())
		return result
	}

	async function resolveMediaUrl(path: string): Promise<string | null> {
		return archiveSession.value?.reader.readMediaBlob(path) ?? null
	}

	function setSelectedFiles(files: File[]) {
		selectedFiles.value = files
	}

	function updateExportConfig(config: Partial<ExportConfig>) {
		exportConfig.value = { ...exportConfig.value, ...config, format: 'json' }
	}

	function resetArchive() {
		isImported.value = false
		isProcessing.value = false
		processingProgress.value = 0
		processingStatus.value = ''
		importError.value = null
		statsError.value = null
		friendsList.value = []
		chatHistory.value = null
		snapHistory.value = null
		memoriesList.value = []
		storiesList.value = []
		archiveStats.value = null
		archiveCapabilities.value = { ...EMPTY_CAPABILITIES }
		archiveDiagnostics.value = { ...EMPTY_DIAGNOSTICS }
		isLoadingStats.value = false
		analysisManager.value = null
		analysisResults.value = new Map()
		archiveSession.value = null
		selectedFiles.value = []
		importedDate.value = null
	}

	return {
		isImported,
		isProcessing,
		processingProgress,
		processingStatus,
		importError,
		statsError, friendsList,
		chatHistory,
		snapHistory,
		memoriesList,
		photosList,
		storiesList,
		archiveStats,
		archiveCapabilities,
		archiveDiagnostics,
		isLoadingStats,
		exportConfig,
		analysisResults,
		archiveSession,
		selectedFiles,
		importedDate,
		totalMemories,
		totalPhotos,
		totalFriends,
		totalChats,
		startProcessing,
		updateProgress,
		completeProcessing,
		prepareArchive,
		loadStats,
		runAnalyzer,
		resolveMediaUrl,
		setSelectedFiles,
		updateExportConfig,
		resetArchive,
	}
})

function computeIndexedMediaBytes(sessionIndex: ArchiveSession['index']): number {
	return sessionIndex.entries
		.filter((entry) => !entry.isDirectory)
		.filter((entry) => entry.id.path.startsWith('memories/') || entry.id.path.startsWith('chat_media/'))
		.reduce((sum, entry) => sum + entry.uncompressedSize, 0)
}
