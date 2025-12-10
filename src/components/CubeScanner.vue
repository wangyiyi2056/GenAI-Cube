<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { useCubeStore } from '../stores/cubeStore';
import { ImageProcessor } from '../utils/imageProcessor';

const videoRef = ref<HTMLVideoElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const streaming = ref(false);
const processing = ref(false);
const cubeStore = useCubeStore();

const startCamera = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'environment'
      }
    });
    
    if (videoRef.value) {
      videoRef.value.srcObject = stream;
      streaming.value = true;
    }
  } catch (err) {
    ElMessage.error('Failed to access camera');
    console.error('Error accessing camera:', err);
  }
};

const captureImage = async () => {
  if (!streaming.value || !videoRef.value || !canvasRef.value) return;
  
  processing.value = true;
  try {
    const video = videoRef.value;
    const canvas = canvasRef.value;
    const context = canvas.getContext('2d');
    
    if (!context) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Process the image and detect colors
    const imageData = canvas.toDataURL('image/jpeg');
    const colorSquares = await ImageProcessor.processImage(imageData);
    
    // Store the processed face data
    cubeStore.addFaceImage(imageData);
    cubeStore.addFaceColors(colorSquares);
    
    ElMessage.success('Face captured and processed successfully');
  } catch (error) {
    ElMessage.error('Failed to process image');
    console.error('Image processing error:', error);
  } finally {
    processing.value = false;
  }
};

const stopCamera = () => {
  if (videoRef.value && videoRef.value.srcObject) {
    const stream = videoRef.value.srcObject as MediaStream;
    stream.getTracks().forEach(track => track.stop());
    videoRef.value.srcObject = null;
    streaming.value = false;
  }
};

onMounted(() => {
  startCamera();
});
</script>

<template>
  <div class="scanner-container">
    <video
      ref="videoRef"
      autoplay
      playsinline
      @canplay="streaming = true"
      class="camera-preview"
    ></video>
    
    <canvas ref="canvasRef" style="display: none;"></canvas>
    
    <div class="scanner-overlay">
      <div class="scan-area"></div>
    </div>
    
    <div class="scanner-controls">
      <el-button 
        type="primary" 
        @click="captureImage" 
        :loading="processing"
        :disabled="!streaming || processing"
      >
        {{ processing ? 'Processing...' : 'Capture Face' }}
      </el-button>
      <el-button type="warning" @click="stopCamera">
        Stop Camera
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.scanner-container {
  position: relative;
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
}

.camera-preview {
  width: 100%;
  height: auto;
  display: block;
}

.scanner-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
}

.scan-area {
  width: 200px;
  height: 200px;
  border: 2px solid #fff;
  position: relative;
}

.scan-area::before,
.scan-area::after {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  border-color: #00ff00;
  border-style: solid;
}

.scan-area::before {
  top: -2px;
  left: -2px;
  border-width: 2px 0 0 2px;
}

.scan-area::after {
  bottom: -2px;
  right: -2px;
  border-width: 0 2px 2px 0;
}

.scanner-controls {
  position: absolute;
  bottom: 20px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  gap: 10px;
  padding: 10px;
}
</style>