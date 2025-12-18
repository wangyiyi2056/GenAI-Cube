import { defineStore } from "pinia";
import * as THREE from "three";
import type { ColorSquare } from "../utils/imageProcessor";

interface CubeState {
  isRotating: boolean;
  currentRotation: THREE.Euler;
  faceImages: string[];
  faceColors: ColorSquare[][];
  cubeState: string;
  solution: string[];
  currentMove: string | null;
  currentStepIndex: number;
  isPlaying: boolean;
  animationSpeed: number;
  cubeInitialized: boolean;
}

export const useCubeStore = defineStore("cube", {
  state: (): CubeState => ({
    isRotating: false,
    currentRotation: new THREE.Euler(0, 0, 0),
    faceImages: [],
    faceColors: [],
    cubeState: "",
    solution: [],
    currentMove: null,
    currentStepIndex: -1,
    isPlaying: false,
    animationSpeed: 500,
    cubeInitialized: false,
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
      this.cubeInitialized = false;
    },
    setSolution(solution: string[]) {
      this.solution = solution;
      this.currentStepIndex = -1;
    },
    setCubeState(state: string) {
      this.cubeState = state;
    },
    setCurrentMove(move: string | null) {
      this.currentMove = move;
    },
    setCurrentStepIndex(index: number) {
      this.currentStepIndex = index;
    },
    setIsPlaying(playing: boolean) {
      this.isPlaying = playing;
    },
    setAnimationSpeed(speed: number) {
      this.animationSpeed = speed;
    },
    setCubeInitialized(initialized: boolean) {
      this.cubeInitialized = initialized;
    },
    resetSolution() {
      this.solution = [];
      this.currentStepIndex = -1;
      this.currentMove = null;
      this.isPlaying = false;
    },
    updateSquareColor(
      faceIndex: number,
      squareIndex: number,
      newColor: string
    ) {
      if (faceIndex < this.faceColors.length && this.faceColors[faceIndex]) {
        // 按位置排序找到对应的方块
        const sorted = [...this.faceColors[faceIndex]].sort((a, b) => {
          const rowDiff = a.position.y - b.position.y;
          if (Math.abs(rowDiff) > 10) return rowDiff;
          return a.position.x - b.position.x;
        });
        // 找到原始数组中对应的索引
        const targetSquare = sorted[squareIndex];
        const originalIndex = this.faceColors[faceIndex].findIndex(
          (s) =>
            s.position.x === targetSquare.position.x &&
            s.position.y === targetSquare.position.y
        );
        if (originalIndex !== -1) {
          this.faceColors[faceIndex][originalIndex].color = newColor;
        }
      }
    },
    // 按索引设置面的图片和颜色（支持任意顺序上传）
    setFaceData(faceIndex: number, imageUrl: string, colors: ColorSquare[]) {
      // 确保数组足够长
      while (this.faceImages.length <= faceIndex) {
        this.faceImages.push("");
      }
      while (this.faceColors.length <= faceIndex) {
        this.faceColors.push([]);
      }
      this.faceImages[faceIndex] = imageUrl;
      this.faceColors[faceIndex] = colors;
    },
    // 删除某个面的数据
    clearFaceData(faceIndex: number) {
      if (faceIndex < this.faceImages.length) {
        this.faceImages[faceIndex] = "";
      }
      if (faceIndex < this.faceColors.length) {
        this.faceColors[faceIndex] = [];
      }
    },
    // 获取已完成的面数量
    getCompletedFacesCount(): number {
      return this.faceColors.filter((face) => face && face.length > 0).length;
    },
  },
});
