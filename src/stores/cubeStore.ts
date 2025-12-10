import { defineStore } from 'pinia';
import * as THREE from 'three';
import type { ColorSquare } from '../utils/imageProcessor';

interface CubeState {
  isRotating: boolean;
  currentRotation: THREE.Euler;
  faceImages: string[];
  faceColors: ColorSquare[][];
  cubeState: string;
  solution: string[];
}

export const useCubeStore = defineStore('cube', {
  state: (): CubeState => ({
    isRotating: false,
    currentRotation: new THREE.Euler(0, 0, 0),
    faceImages: [],
    faceColors: [],
    cubeState: '',
    solution: [],
  }),
  
  actions: {
    setRotating(rotating: boolean) {
      this.isRotating = rotating;
    },
    updateRotation(rotation: THREE.Euler) {
      this.currentRotation = rotation;
    },
    addFaceImage(imageData: string) {
      if (this.faceImages.length < 6) {
        this.faceImages.push(imageData);
      }
    },
    addFaceColors(colors: ColorSquare[]) {
      if (this.faceColors.length < 6) {
        this.faceColors.push(colors);
      }
    },
    clearFaceImages() {
      this.faceImages = [];
      this.faceColors = [];
    },
    setSolution(solution: string[]) {
      this.solution = solution;
    },
    setCubeState(state: string) {
      this.cubeState = state;
    },
  },
});