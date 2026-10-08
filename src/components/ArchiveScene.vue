<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { WebGPURenderer } from "three/webgpu";

export interface SceneNode {
	id: string;
	label: string;
	value: number;
	latitude?: number;
	longitude?: number;
	imageUrl?: string;
	calendarMonth?: number;
}
export type SceneMode =
	"timeline" | "relationships" | "memories" | "language" | "map" | "persona";
const props = withDefaults(
	defineProps<{
		mode: SceneMode;
		nodes: SceneNode[];
		selected?: string;
		motion?: boolean;
	}>(),
	{ motion: true },
);
const emit = defineEmits<{
	select: [id: string];
	backend: [backend: string];
}>();
const host = ref<HTMLDivElement | null>(null);
const unavailable = ref(false);
const labels = ref<{ id: string; text: string; x: number; y: number }[]>([]);
const systemReducedMotion = ref(false);
const movement = computed(() => props.motion && !systemReducedMotion.value);
let renderer: THREE.WebGLRenderer | WebGPURenderer | null = null;
let unmounted = false;
let rendererLabel = "Three.js · WebGL 2";
let recoveryUsed = false;
let recovering = false;
const previousTarget = new THREE.Vector3();
let camera: THREE.PerspectiveCamera | null = null;
let scene: THREE.Scene | null = null;
let controls: OrbitControls | null = null;
let resizeObserver: ResizeObserver | null = null;
let frame = 0;
let figure: THREE.Group | null = null;
let mediaQuery: MediaQueryList | null = null;
let pickable: THREE.Mesh[] = [];
let anchors = new Map<string, THREE.Object3D>();
let pointerStart = { x: 0, y: 0 };
let generation = 0;
let builtMode: SceneMode | null = null;
const raycaster = new THREE.Raycaster();

function disposeObjects() {
	generation++;
	if (!scene) return;
	const geometries = new Set<THREE.BufferGeometry>();
	const materials = new Set<THREE.Material>();
	const textures = new Set<THREE.Texture>();
	scene.traverse((object) => {
		if (!(object instanceof THREE.Mesh || object instanceof THREE.Line)) return;
		geometries.add(object.geometry);
		for (const material of Array.isArray(object.material)
			? object.material
			: [object.material]) {
			materials.add(material);
			if (material instanceof THREE.MeshStandardMaterial && material.map)
				textures.add(material.map);
		}
	});
	// An incompletely allocated GPU resource may reject its disposal callback.
	// Continue releasing the other resources owned by this scene.
	for (const geometry of geometries) safelyRelease(() => geometry.dispose());
	for (const material of materials) safelyRelease(() => material.dispose());
	for (const texture of textures) safelyRelease(() => texture.dispose());
	scene.clear();
	anchors.clear();
	pickable = [];
	figure = null;
}

function material(color: THREE.ColorRepresentation, emissive = false) {
	return new THREE.MeshStandardMaterial({
		color,
		roughness: 0.6,
		metalness: 0.3,
		emissive: emissive ? color : 0x000000,
		emissiveIntensity: emissive ? 0.35 : 0,
	});
}

function mesh(
	geometry: THREE.BufferGeometry,
	color: THREE.ColorRepresentation,
	x: number,
	y: number,
	z: number,
	node?: SceneNode,
) {
	const object = new THREE.Mesh(
		geometry,
		material(color, node?.id === props.selected),
	);
	object.position.set(x, y, z);
	if (node) {
		object.userData.id = node.id;
		pickable.push(object);
		anchors.set(node.id, object);
	}
	scene?.add(object);
	return object;
}

function line(points: THREE.Vector3[], color = 0x4b746a) {
	const object = new THREE.Line(
		new THREE.BufferGeometry().setFromPoints(points),
		new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.45 }),
	);
	scene?.add(object);
}

function build() {
	if (!scene || !camera) return;
	disposeObjects();
	const currentGeneration = generation;
	scene.background = new THREE.Color(0x112723);
	scene.fog = new THREE.Fog(0x112723, 22, 55);
	scene.add(new THREE.HemisphereLight(0xfff0ca, 0x19342b, 2.8));
	const key = new THREE.DirectionalLight(0xffd891, 4);
	key.position.set(3, 8, 6);
	scene.add(key);
	const fill = new THREE.PointLight(0x6dceba, 35, 28);
	fill.position.set(-7, 5, -2);
	scene.add(fill);
	mesh(new THREE.CylinderGeometry(11, 11.3, 0.2, 72), 0x173c33, 0, -0.15, 0);
	const ring = mesh(
		new THREE.TorusGeometry(8.8, 0.03, 8, 96),
		0xb9a571,
		0,
		0,
		0,
	);
	ring.rotation.x = Math.PI / 2;
	const nodes = props.nodes.slice(0, props.mode === "memories" ? 18 : 64);
	const maximum = Math.max(1, ...nodes.map((node) => node.value));
	const points: THREE.Vector3[] = [];
	const months = nodes.flatMap((node) =>
		node.calendarMonth === undefined ? [] : [node.calendarMonth],
	);
	const firstMonth = Math.min(...months);
	const lastMonth = Math.max(...months);
	for (const [index, node] of nodes.entries()) {
		const ratio = node.value / maximum;
		const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2;
		const color =
			node.id === props.selected
				? 0xffd26d
				: new THREE.Color().setHSL(0.1 + (index % 5) * 0.028, 0.5, 0.58);
		if (props.mode === "timeline") {
			const x =
				node.calendarMonth === undefined || !Number.isFinite(firstMonth)
					? (index / Math.max(nodes.length - 1, 1) - 0.5) * 14
					: (node.calendarMonth - (firstMonth + lastMonth) / 2) * 0.25;
			const height = 0.3 + ratio * 5;
			const z = Math.sin(index * 0.65) * 1.6;
			mesh(
				new THREE.BoxGeometry(
					Math.min(1.2, 12 / Math.max(nodes.length, 1)),
					height,
					0.9,
				),
				color,
				x,
				height / 2,
				z,
				node,
			);
			points.push(new THREE.Vector3(x, 0.06, z));
		} else if (props.mode === "relationships") {
			const x = Math.cos(angle) * (3.7 + (index % 3) * 1.2);
			const z = Math.sin(angle) * (3.7 + (index % 3) * 1.2);
			const y = 1.4 + ratio * 4;
			mesh(
				new THREE.IcosahedronGeometry(0.3 + ratio * 0.65, 1),
				color,
				x,
				y,
				z,
				node,
			);
			line([new THREE.Vector3(0, 2, 0), new THREE.Vector3(x, y, z)]);
		} else if (props.mode === "memories") {
			const columns = Math.min(6, nodes.length);
			const x = ((index % columns) - (columns - 1) / 2) * 2.85;
			const y = 1.9 + Math.floor(index / columns) * 3.55;
			const z = -2 + Math.abs(x) * 0.12;
			const frameMesh = mesh(
				new THREE.BoxGeometry(2.4, 3.1, 0.18),
				color,
				x,
				y,
				z,
				node,
			);
			if (node.imageUrl?.startsWith("blob:")) {
				new THREE.TextureLoader().load(node.imageUrl, (texture) => {
					if (generation !== currentGeneration) {
						texture.dispose();
						return;
					}
					texture.colorSpace = THREE.SRGBColorSpace;
					texture.minFilter = THREE.LinearFilter;
					texture.generateMipmaps = false;
					const oldMaterial = frameMesh.material;
					frameMesh.material = new THREE.MeshStandardMaterial({
						map: texture,
						roughness: 1,
					});
					if (!Array.isArray(oldMaterial)) oldMaterial.dispose();
					draw();
				});
			}
		} else if (props.mode === "language") {
			const x = ((index % 8) - 3.5) * 1.8;
			const z = (Math.floor(index / 8) - 2) * 1.8;
			const height = 0.5 + ratio * 5;
			mesh(
				new THREE.ConeGeometry(0.72, height, 6),
				color,
				x,
				height / 2,
				z,
				node,
			);
		} else if (
			props.mode === "map" &&
			node.latitude !== undefined &&
			node.longitude !== undefined
		) {
			const x = (node.longitude / 180) * 8;
			const z = (-node.latitude / 90) * 4;
			mesh(
				new THREE.ConeGeometry(0.18 + ratio * 0.14, 0.8, 12),
				color,
				x,
				0.4,
				z,
				node,
			);
		}
	}
	if (points.length > 1) line(points, 0xf3cb45);
	if (props.mode === "relationships")
		mesh(new THREE.SphereGeometry(0.6, 20, 16), 0x78b6a1, 0, 2, 0);
	if (props.mode === "map") {
		const grid = new THREE.GridHelper(16, 16, 0x85a895, 0x35624f);
		scene.add(grid);
	}
	if (props.mode === "persona") {
		figure = new THREE.Group();
		const body = new THREE.Mesh(
			new THREE.ConeGeometry(1.25, 2.8, 8),
			material(0xddd3ab),
		);
		body.position.y = 2.2;
		const head = new THREE.Mesh(
			new THREE.IcosahedronGeometry(0.82, 1),
			material(0xecca68),
		);
		head.position.y = 4.1;
		figure.add(body, head);
		for (const x of [-0.25, 0.25]) {
			const eye = new THREE.Mesh(
				new THREE.SphereGeometry(0.08, 12, 8),
				material(0x183e34),
			);
			eye.position.set(x, 4.13, 0.73);
			figure.add(eye);
		}
		scene.add(figure);
		const halo = mesh(
			new THREE.TorusGeometry(1.4, 0.035, 8, 64),
			0xb2d8be,
			0,
			4.1,
			-0.2,
		);
		halo.rotation.y = 0.25;
	}
	if (builtMode !== props.mode) {
		if (props.mode === "memories")
			camera.position.set(0, 4.5, nodes.length > 6 ? 24 : 12);
		else camera.position.set(12, 10, 15);
		if (props.mode === "persona") camera.position.set(6, 5, 12);
		controls?.target.set(
			0,
			props.mode === "map"
				? 0
				: props.mode === "memories" && nodes.length > 6
					? 5
					: 2,
			0,
		);
		builtMode = props.mode;
	}
	controls?.update();
	draw();
}

function draw() {
	if (!renderer || !scene || !camera || recovering || unavailable.value || unmounted || document.hidden)
		return;
	const current = renderer;
	try { current.render(scene, camera); }
	catch { recoverRenderer(current); return; }
	const width = host.value?.clientWidth ?? 1;
	const height = host.value?.clientHeight ?? 1;
	labels.value = props.nodes.slice(0, 12).flatMap((node) => {
		const anchor = anchors.get(node.id);
		if (!anchor || !camera) return [];
		const projected = anchor.position
			.clone()
			.add(new THREE.Vector3(0, 0.65, 0))
			.project(camera);
		if (
			projected.z > 1 ||
			Math.abs(projected.x) > 1 ||
			Math.abs(projected.y) > 1
		)
			return [];
		return [
			{
				id: node.id,
				text: node.label,
				x: ((projected.x + 1) * width) / 2,
				y: ((1 - projected.y) * height) / 2,
			},
		];
	});
}

function animate(time = 0) {
	cancelAnimationFrame(frame);
	if (figure && movement.value && !unmounted && !recovering && !unavailable.value && !document.hidden) {
		figure.position.y = Math.sin(time / 1100) * 0.08;
		figure.rotation.y = Math.sin(time / 2400) * 0.08;
		draw();
		frame = requestAnimationFrame(animate);
	}
}

function pick(event: PointerEvent) {
	if (
		!renderer ||
		!camera ||
		Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) >
			5
	)
		return;
	const rect = renderer.domElement.getBoundingClientRect();
	raycaster.setFromCamera(
		new THREE.Vector2(
			((event.clientX - rect.left) / rect.width) * 2 - 1,
			(-(event.clientY - rect.top) / rect.height) * 2 + 1,
		),
		camera,
	);
	const id = raycaster.intersectObjects(pickable)[0]?.object.userData.id;
	if (typeof id === "string") emit("select", id);
}

function fail(event?: Event) {
	event?.preventDefault();
	unavailable.value = true;
	cancelAnimationFrame(frame);
	labels.value = [];
	releaseRenderer();
	emit("backend", "Reading mode");
}
function safelyRelease(release: () => void | Promise<void>) {
	try { const result = release(); if (result) void result.catch(() => {}); }
	catch { /* Release the remaining scene-owned resources after partial GPU allocation. */ }
}
function releaseRenderer() {
	cancelAnimationFrame(frame);
	resizeObserver?.disconnect(); resizeObserver = null;
	if (controls) previousTarget.copy(controls.target);
	safelyRelease(() => controls?.dispose()); controls = null;
	const previous = renderer; renderer = null;
	if (previous) {
		previous.domElement.removeEventListener("pointerdown", pointerDown);
		previous.domElement.removeEventListener("pointerup", pick);
		previous.domElement.removeEventListener("webglcontextlost", contextLost);
		if ("onDeviceLost" in previous) previous.onDeviceLost = () => {};
		if ("onError" in previous) previous.onError = () => {};
	}
	disposeObjects();
	safelyRelease(() => previous?.dispose());
	if (previous && "backend" in previous) {
		const device = (previous.backend as { device?: GPUDevice }).device;
		safelyRelease(() => device?.destroy());
	}
	previous?.domElement.remove();
}
function contextLost(event: Event) { event.preventDefault(); if (renderer) recoverRenderer(renderer); }
function recoverRenderer(failed: THREE.WebGLRenderer | WebGPURenderer) {
	if (unmounted || renderer !== failed || recovering) return;
	recovering = true;
	cancelAnimationFrame(frame); labels.value = [];
	emit("backend", "Recovering local renderer");
	queueMicrotask(() => {
		if (unmounted) return;
		releaseRenderer(); recovering = false;
		if (recoveryUsed) { fail(); return; }
		recoveryUsed = true;
		try { mountWebGL(); } catch { fail(); }
	});
}
function mountWebGL() {
	if (unmounted || !host.value) return;
	const canvas = document.createElement("canvas");
	const context = canvas.getContext("webgl2", { antialias: true, alpha: false });
	if (!context) { fail(); return; }
	mountRenderer(new THREE.WebGLRenderer({ canvas, context, antialias: true }), "Three.js · WebGL 2");
}
function mountRenderer(candidate: THREE.WebGLRenderer | WebGPURenderer, label: string) {
	if (unmounted || !host.value) { safelyRelease(() => candidate.dispose()); return; }
	renderer = candidate; rendererLabel = label; unavailable.value = false;
	candidate.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
	candidate.toneMapping = THREE.ACESFilmicToneMapping;
	camera ??= new THREE.PerspectiveCamera(40, 1, 0.1, 100);
	scene ??= new THREE.Scene();
	const canvas = candidate.domElement;
	canvas.setAttribute("aria-hidden", "true"); host.value.append(canvas);
	canvas.addEventListener("pointerdown", pointerDown); canvas.addEventListener("pointerup", pick);
	canvas.addEventListener("webglcontextlost", contextLost);
	controls = new OrbitControls(camera, canvas); controls.target.copy(previousTarget);
	controls.enableDamping = false; controls.minDistance = 7; controls.maxDistance = 35;
	controls.maxPolarAngle = Math.PI / 2 - 0.03; controls.addEventListener("change", draw);
	resizeObserver = new ResizeObserver(() => {
		if (unmounted || renderer !== candidate || !host.value || !camera) return;
		try {
			const width = host.value.clientWidth, height = host.value.clientHeight;
			candidate.setSize(width, height); camera.aspect = width / Math.max(height, 1);
			camera.updateProjectionMatrix(); draw();
		} catch { recoverRenderer(candidate); }
	});
	resizeObserver.observe(host.value);
	build(); animate(); if (!recovering) emit("backend", rendererLabel);
}

function visibility() {
	if (!document.hidden) {
		draw();
		animate();
	} else cancelAnimationFrame(frame);
}
function motionChanged(event: MediaQueryListEvent) {
	systemReducedMotion.value = event.matches;
}
function pointerDown(event: PointerEvent) {
	pointerStart = { x: event.clientX, y: event.clientY };
}

onMounted(async () => {
	mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
	systemReducedMotion.value = mediaQuery.matches;
	mediaQuery.addEventListener("change", motionChanged);
	document.addEventListener("visibilitychange", visibility);
	try {
		if (!host.value) return;
		const canvas = document.createElement("canvas");
		const gpu = navigator.gpu;
		let adapter: GPUAdapter | null = null;
		try {
			adapter = gpu ? await gpu.requestAdapter() : null;
		} catch {
			/* Try the WebGL path. */
		}
		if (unmounted) return;
		if (adapter) {
			let device: GPUDevice | null = null;
			try {
				const { WebGPURenderer } = await import("three/webgpu");
				if (unmounted) return;
				device = await adapter.requestDevice();
				if (unmounted) { device.destroy(); return; }
				const candidate = new WebGPURenderer({
					canvas,
					device,
					antialias: true,
					alpha: false,
				});
				try {
					await candidate.init();
				} catch (error) {
					safelyRelease(() => candidate.dispose());
					throw error;
				}
				if (unmounted) {
					safelyRelease(() => candidate.dispose());
					safelyRelease(() => device?.destroy());
					return;
				}
				candidate.onDeviceLost = () => recoverRenderer(candidate);
				candidate.onError = () => recoverRenderer(candidate);
				if (device) {
					const popErrorScope = device.popErrorScope.bind(device);
					// Three attaches an unchecked Promise to this browser method. Handle
					// rejection at this owned device only and abandon the failed renderer.
					device.popErrorScope = () => popErrorScope().catch(() => {
						recoverRenderer(candidate);
						return null;
					});
				}
				const label =
					(candidate.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend === true
						? "Three.js · WebGPU"
						: "Three.js · WebGL 2";
				mountRenderer(candidate, label);
			} catch {
				safelyRelease(() => device?.destroy());
				if (unmounted) return;
			}
		}
		if (!renderer && !unmounted) mountWebGL();
	} catch {
		if (!unmounted) fail();
	}
});
watch(
	() => [props.mode, props.nodes],
	() => {
		build();
		animate();
	},
	{ deep: true },
);
watch(
	() => props.selected,
	() => {
		for (const object of pickable) {
			if (object.material instanceof THREE.MeshStandardMaterial) {
				object.material.emissive.set(
					object.userData.id === props.selected ? 0xffbd45 : 0x000000,
				);
				object.material.emissiveIntensity = 0.45;
			}
		}
		draw();
	},
);
watch(movement, () => {
	if (figure) {
		figure.position.y = 0;
		figure.rotation.y = 0;
	}
	draw();
	animate();
});
onBeforeUnmount(() => {
	unmounted = true;
	cancelAnimationFrame(frame);
	mediaQuery?.removeEventListener("change", motionChanged);
	document.removeEventListener("visibilitychange", visibility);
	releaseRenderer();
});
</script>

<template>
	<div ref="host" class="archive-scene" :class="{ unavailable }">
		<div v-if="unavailable" class="scene-unavailable" role="status">
			<strong>Your history still works without 3D.</strong>
			<p>Use the evidence list to explore the same selection.</p>
		</div>
		<div v-else class="scene-labels" aria-hidden="true">
			<span
				v-for="label in labels"
				:key="label.id"
				:style="{ left: `${label.x}px`, top: `${label.y}px` }"
				:class="{ selected: label.id === selected }"
				>{{ label.text }}</span
			>
		</div>
		<div v-if="!unavailable" class="scene-hint">
			Drag to orbit · Scroll to zoom · Select an object or use the evidence list
		</div>
	</div>
</template>

<style scoped>
.archive-scene {
	height: 540px;
	min-height: 360px;
	position: relative;
	overflow: hidden;
	background: #112723;
	border-radius: 22px;
}
.archive-scene :deep(canvas) {
	display: block;
	width: 100%;
	height: 100%;
	touch-action: none;
}
.scene-labels {
	position: absolute;
	inset: 0;
	pointer-events: none;
}
.scene-labels span {
	position: absolute;
	transform: translate(-50%, -100%);
	background: #102c25dd;
	border: 1px solid #8caa864d;
	color: #e8e6c9;
	padding: 3px 9px;
	border-radius: 7px;
	white-space: nowrap;
	max-width: 150px;
	overflow: hidden;
	text-overflow: ellipsis;
	font-size: 0.71rem;
}
.scene-labels span.selected {
	border-color: #f3cb45;
	color: #ffe29a;
}
.scene-hint {
	position: absolute;
	bottom: 16px;
	left: 20px;
	right: 20px;
	color: #d8e5d3aa;
	font-size: 0.72rem;
	pointer-events: none;
}
.scene-unavailable {
	display: grid;
	place-content: center;
	text-align: center;
	height: 100%;
	padding: 24px;
	color: #ede6c6;
	gap: 12px;
}
@media (prefers-reduced-motion: reduce) {
	.archive-scene {
		scroll-behavior: auto;
	}
}
</style>
