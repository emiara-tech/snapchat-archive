<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
const host = ref<HTMLDivElement>();
const unavailable = ref(false);
let cleanup = () => {};
onMounted(() => {
	const element = host.value;
	if (!element) return;
	let renderer: THREE.WebGLRenderer;
	try {
		renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
	} catch {
		unavailable.value = true;
		return;
	}
	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
	camera.position.set(0, 2.1, 10);
	renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
	renderer.setClearColor(0xe6e8dd, 1);
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	element.appendChild(renderer.domElement);
	renderer.domElement.setAttribute("aria-hidden", "true");
	const controls = new OrbitControls(camera, renderer.domElement);
	controls.enableZoom = false;
	controls.enablePan = false;
	controls.minPolarAngle = 0.9;
	controls.maxPolarAngle = 2;
	controls.target.set(0, 0.3, 0);
	scene.add(new THREE.HemisphereLight(0xffffff, 0x718778, 2.5));
	const sun = new THREE.DirectionalLight(0xfff1d4, 3);
	sun.position.set(-4, 5, 5);
	scene.add(sun);
	const group = new THREE.Group();
	group.rotation.z = -0.1;
	scene.add(group);
	const sphere = new THREE.Mesh(
		new THREE.IcosahedronGeometry(1.22, 2),
		new THREE.MeshStandardMaterial({
			color: 0xd1af63,
			roughness: 0.7,
			metalness: 0.12,
			flatShading: true,
		}),
	);
	group.add(sphere);
	const wire = new THREE.Mesh(
		new THREE.IcosahedronGeometry(1.25, 2),
		new THREE.MeshBasicMaterial({
			color: 0x916e30,
			wireframe: true,
			transparent: true,
			opacity: 0.13,
		}),
	);
	group.add(wire);
	const orbit = new THREE.Mesh(
		new THREE.TorusGeometry(2.06, 0.012, 8, 100),
		new THREE.MeshStandardMaterial({ color: 0x819c86, roughness: 0.8 }),
	);
	orbit.rotation.x = 1.15;
	orbit.rotation.y = 0.35;
	group.add(orbit);
	const orbit2 = orbit.clone();
	orbit2.rotation.x = -0.8;
	orbit2.rotation.y = -0.5;
	group.add(orbit2);
	const textures: THREE.Texture[] = [];
	for (let i = 0; i < 7; i++) {
		const a = (i * Math.PI * 2) / 7;
		const frame = new THREE.Group();
		frame.position.set(
			Math.cos(a) * 2.5,
			Math.sin(a) * 1.9,
			Math.sin(a * 2) * 0.5 + 0.8,
		);
		frame.rotation.set(-0.1, Math.cos(a) * -0.25, Math.sin(a) * 0.24);
		frame.add(
			new THREE.Mesh(
				new THREE.BoxGeometry(1.13, 1.35, 0.045),
				new THREE.MeshStandardMaterial({ color: 0xfbf7ed, roughness: 0.95 }),
			),
		);
		const canvas = document.createElement("canvas");
		canvas.width = 256;
		canvas.height = 256;
		const ctx = canvas.getContext("2d");
		if (ctx) {
			const palette = [
				"#879e84",
				"#d9ae68",
				"#a7c3c2",
				"#ae8994",
				"#637e70",
				"#b59a71",
				"#d0ae89",
			];
			ctx.fillStyle = palette[i]!;
			ctx.fillRect(0, 0, 256, 256);
			ctx.fillStyle = "#f6deb0";
			ctx.beginPath();
			ctx.arc(170 - i * 7, 65 + i * 3, 25, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = "#355749";
			ctx.beginPath();
			ctx.moveTo(0, 205);
			ctx.lineTo(70 + i * 4, 95);
			ctx.lineTo(155, 205);
			ctx.lineTo(215, 145);
			ctx.lineTo(256, 200);
			ctx.lineTo(256, 256);
			ctx.lineTo(0, 256);
			ctx.fill();
			ctx.fillStyle = "#dde2cd";
			ctx.beginPath();
			ctx.moveTo(100, 256);
			ctx.lineTo(143, 187);
			ctx.lineTo(155, 187);
			ctx.lineTo(181, 256);
			ctx.fill();
			const texture = new THREE.CanvasTexture(canvas);
			texture.colorSpace = THREE.SRGBColorSpace;
			textures.push(texture);
			const artwork = new THREE.Mesh(
				new THREE.PlaneGeometry(0.99, 0.97),
				new THREE.MeshBasicMaterial({ map: texture }),
			);
			artwork.position.set(0, 0.1, 0.027);
			frame.add(artwork);
		}
		group.add(frame);
	}
	const shadow = new THREE.Mesh(
		new THREE.CircleGeometry(2.25, 64),
		new THREE.MeshBasicMaterial({
			color: 0x9eac98,
			transparent: true,
			opacity: 0.16,
		}),
	);
	shadow.rotation.x = -Math.PI / 2;
	shadow.position.y = -2.5;
	scene.add(shadow);
	const resize = () => {
		const { width, height } = element.getBoundingClientRect();
		if (!width || !height) return;
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
		renderer.setSize(width, height);
	};
	const observer = new ResizeObserver(resize);
	observer.observe(element);
	resize();
	const media = matchMedia("(prefers-reduced-motion: reduce)");
	let active = true;
	let frameId = 0;
	const clock = new THREE.Clock();
	const draw = () => {
		if (!active) return;
		frameId = requestAnimationFrame(draw);
		if (document.hidden) return;
		const t = clock.getElapsedTime();
		if (!media.matches) {
			sphere.rotation.y = t * 0.07;
			wire.rotation.y = t * 0.07;
			group.position.y = Math.sin(t * 0.5) * 0.07;
		}
		controls.update();
		renderer.render(scene, camera);
	};
	const lost = (event: Event) => {
		event.preventDefault();
		active = false;
		cancelAnimationFrame(frameId);
		unavailable.value = true;
	};
	renderer.domElement.addEventListener("webglcontextlost", lost);
	draw();
	cleanup = () => {
		active = false;
		cancelAnimationFrame(frameId);
		observer.disconnect();
		controls.dispose();
		renderer.domElement.removeEventListener("webglcontextlost", lost);
		const geometries = new Set<THREE.BufferGeometry>();
		const materials = new Set<THREE.Material>();
		scene.traverse((object) => {
			if (object instanceof THREE.Mesh) {
				geometries.add(object.geometry);
				for (const material of Array.isArray(object.material)
					? object.material
					: [object.material])
					materials.add(material);
			}
		});
		geometries.forEach((g) => g.dispose());
		materials.forEach((m) => m.dispose());
		textures.forEach((t) => t.dispose());
		renderer.dispose();
		renderer.domElement.remove();
	};
});
onBeforeUnmount(() => cleanup());
</script>
<template>
	<div
		ref="host"
		class="arrival-canvas"
		role="img"
		aria-label="Illustrated paper photographs orbit a golden archive. Decorative preview; no personal records are shown."
	>
		<div v-if="unavailable" class="scene-fallback">
			<span>2012</span><span>2018</span><span>2024</span>
			<p>A collection of moments,<br />waiting to be opened.</p>
		</div>
	</div>
</template>
<style scoped>
.arrival-canvas {
	width: 100%;
	height: 100%;
	cursor: grab;
}
.arrival-canvas:active {
	cursor: grabbing;
}
.arrival-canvas :deep(canvas) {
	display: block;
	width: 100%;
	height: 100%;
}
.scene-fallback {
	height: 100%;
	display: flex;
	gap: 15px;
	flex-wrap: wrap;
	align-content: center;
	justify-content: center;
	padding: 45px;
}
.scene-fallback span {
	background: #f7f1e6;
	border: 1px solid #d4d7c9;
	box-shadow: 0 15px 25px #61746322;
	padding: 40px 15px;
	transform: rotate(-8deg);
	font-family: var(--font-serif);
	font-size: 1.5rem;
}
.scene-fallback span:nth-child(2) {
	transform: rotate(8deg);
	background: #d1af63;
}
.scene-fallback p {
	width: 100%;
	text-align: center;
	color: #40594f;
	font-family: var(--font-serif);
	font-size: 1.6rem;
	padding-top: 25px;
}
</style>
