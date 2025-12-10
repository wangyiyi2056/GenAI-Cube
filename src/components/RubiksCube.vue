<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { useCubeStore } from '../stores/cubeStore';

const container = ref<HTMLDivElement | null>(null);
const cubeStore = useCubeStore();

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let rubiksCube: THREE.Group;
let cubelets: THREE.Mesh[] = [];

const CUBE_SIZE = 1;
const GAP = 0.1;
const ROTATION_DURATION = 500; // ms

const createCubelet = (position: [number, number, number], colors: string[]) => {
  const geometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
  const materials = colors.map(color => new THREE.MeshPhongMaterial({ 
    color,
    shininess: 30,
    specular: new THREE.Color(0x444444)
  }));
  const cubelet = new THREE.Mesh(geometry, materials);
  cubelet.position.set(...position);
  cubelet.userData.initialPosition = [...position];
  return cubelet;
};

const getFaceCubelets = (face: string): THREE.Mesh[] => {
  const threshold = CUBE_SIZE / 2 + GAP / 2;
  return cubelets.filter(cubelet => {
    const pos = cubelet.position;
    switch (face) {
      case 'F': return Math.abs(pos.z - threshold) < 0.1;
      case 'B': return Math.abs(pos.z + threshold) < 0.1;
      case 'R': return Math.abs(pos.x - threshold) < 0.1;
      case 'L': return Math.abs(pos.x + threshold) < 0.1;
      case 'U': return Math.abs(pos.y - threshold) < 0.1;
      case 'D': return Math.abs(pos.y + threshold) < 0.1;
      default: return false;
    }
  });
};

const rotateFace = (face: string, angle: number) => {
  if (cubeStore.isRotating) return;
  
  cubeStore.setRotating(true);
  const faceCubelets = getFaceCubelets(face);
  const rotationMatrix = new THREE.Matrix4();
  
  let axis: THREE.Vector3;
  switch (face) {
    case 'F':
    case 'B':
      axis = new THREE.Vector3(0, 0, 1);
      break;
    case 'R':
    case 'L':
      axis = new THREE.Vector3(1, 0, 0);
      break;
    case 'U':
    case 'D':
      axis = new THREE.Vector3(0, 1, 0);
      break;
    default:
      return;
  }
  
  if (['B', 'L', 'D'].includes(face)) angle = -angle;
  
  const startTime = Date.now();
  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / ROTATION_DURATION, 1);
    
    if (progress < 1) {
      const stepAngle = (angle * progress) - (angle * (progress - 0.05));
      rotationMatrix.makeRotationAxis(axis, stepAngle);
      
      faceCubelets.forEach(cubelet => {
        cubelet.position.applyMatrix4(rotationMatrix);
        cubelet.rotateOnWorldAxis(axis, stepAngle);
      });
      
      requestAnimationFrame(animate);
    } else {
      // Snap to final position
      const finalRotation = new THREE.Matrix4().makeRotationAxis(axis, angle - (angle * (progress - 0.05)));
      faceCubelets.forEach(cubelet => {
        cubelet.position.applyMatrix4(finalRotation);
        cubelet.rotateOnWorldAxis(axis, angle - (angle * (progress - 0.05)));
      });
      
      cubeStore.setRotating(false);
    }
  };
  
  animate();
};

// Watch for solution moves
watch(() => cubeStore.currentMove, (move) => {
  if (!move) return;
  
  const angle = Math.PI / 2;
  const isCounterClockwise = move.includes("'");
  const isTwice = move.includes("2");
  const face = move.charAt(0);
  
  if (isTwice) {
    rotateFace(face, angle * 2);
  } else {
    rotateFace(face, isCounterClockwise ? -angle : angle);
  }
});

const handleKeyPress = (event: KeyboardEvent) => {
  if (cubeStore.isRotating) return;
  
  const angle = event.shiftKey ? -Math.PI / 2 : Math.PI / 2;
  switch (event.key.toUpperCase()) {
    case 'F': rotateFace('F', angle); break;
    case 'B': rotateFace('B', angle); break;
    case 'R': rotateFace('R', angle); break;
    case 'L': rotateFace('L', angle); break;
    case 'U': rotateFace('U', angle); break;
    case 'D': rotateFace('D', angle); break;
  }
};

const initScene = () => {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);
  
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.value?.appendChild(renderer.domElement);
  
  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(10, 10, 10);
  scene.add(directionalLight);
  
  // Camera position
  camera.position.set(5, 5, 7);
  camera.lookAt(0, 0, 0);
  
  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  
  // Create Rubik's Cube
  rubiksCube = new THREE.Group();
  
  // Create all 27 cubelets
  const positions: [number, number, number][] = [];
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        positions.push([
          x * (CUBE_SIZE + GAP),
          y * (CUBE_SIZE + GAP),
          z * (CUBE_SIZE + GAP)
        ]);
      }
    }
  }
  
  // Standard Rubik's Cube colors
  const colors = [
    '#B90000', // Right - Red
    '#FF6600', // Left - Orange
    '#FFFFFF', // Top - White
    '#FFFF00', // Bottom - Yellow
    '#00B900', // Front - Green
    '#0000B9', // Back - Blue
  ];
  
  positions.forEach(position => {
    const cubelet = createCubelet(position, colors);
    cubelets.push(cubelet);
    rubiksCube.add(cubelet);
  });
  
  scene.add(rubiksCube);
};

const animate = () => {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
};

const handleResize = () => {
  if (container.value) {
    const width = container.value.clientWidth;
    const height = container.value.clientHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
};

onMounted(() => {
  initScene();
  animate();
  window.addEventListener('resize', handleResize);
  window.addEventListener('keydown', handleKeyPress);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('keydown', handleKeyPress);
});
</script>

<template>
  <div ref="container" class="cube-container">
    <div class="controls-info">
      <h3>Controls:</h3>
      <p>Use keys F, B, R, L, U, D to rotate faces</p>
      <p>Hold Shift + key for counter-clockwise rotation</p>
      <p>Mouse drag to orbit camera</p>
      <p>Mouse wheel to zoom</p>
    </div>
  </div>
</template>

<style scoped>
.cube-container {
  width: 100%;
  height: 100vh;
  position: relative;
}

.controls-info {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(255, 255, 255, 0.9);
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.controls-info h3 {
  margin: 0 0 10px 0;
  color: #333;
}

.controls-info p {
  margin: 5px 0;
  color: #666;
}
</style>