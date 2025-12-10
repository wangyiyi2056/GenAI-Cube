<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { useCubeStore } from '../stores/cubeStore';
import { CubeSolver } from '../utils/cubeSolver';
import { ImageProcessor } from '../utils/imageProcessor';
import { Upload } from '@element-plus/icons-vue';

const cubeStore = useCubeStore();
const solving = ref(false);
const currentStep = ref(-1);
const animationSpeed = ref(500); // ms per move
const uploadedFiles = ref<File[]>([]);
const imageUrls = ref<string[]>([]);
const processingImages = ref(false);

const completedFaces = computed(() => cubeStore.faceColors.length);

const faceNames = ['Top (White Center)', 'Right (Red Center)', 'Front (Green Center)', 
                  'Bottom (Yellow Center)', 'Left (Orange Center)', 'Back (Blue Center)'];

const handleFileUpload = async (event: Event, faceIndex: number) => {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;

  const file = input.files[0];
  if (!file.type.startsWith('image/')) {
    ElMessage.error('Please upload an image file');
    return;
  }

  processingImages.value = true;
  try {
    // Update the uploaded files array
    uploadedFiles.value[faceIndex] = file;
    
    // Create and store the URL for preview
    if (imageUrls.value[faceIndex]) {
      URL.revokeObjectURL(imageUrls.value[faceIndex]);
    }
    imageUrls.value[faceIndex] = URL.createObjectURL(file);

    const squares = await ImageProcessor.processImage(imageUrls.value[faceIndex]);
    
    // Store the processed face data
    cubeStore.addFaceImage(imageUrls.value[faceIndex]);
    cubeStore.addFaceColors(squares);
    
    ElMessage.success(`Face ${faceIndex + 1} processed successfully`);
  } catch (error) {
    ElMessage.error('Failed to process image');
    console.error('Image processing error:', error);
  } finally {
    processingImages.value = false;
  }
};

const generateSolution = async () => {
  if (completedFaces.value < 6) {
    ElMessage.error('Please upload all 6 faces first');
    return;
  }

  solving.value = true;
  try {
    // Convert scanned colors to Kociemba notation
    const cubeState = CubeSolver.convertToKociembaNotation(cubeStore.faceColors);
    // Get solution
    const solution = await CubeSolver.solve(cubeState);
    cubeStore.setSolution(solution);
    currentStep.value = 0;
    ElMessage.success('Solution generated successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate solution';
    ElMessage.error(errorMessage);
    console.error('Solver error:', error);
  } finally {
    solving.value = false;
  }
};

const resetScanner = () => {
  // Cleanup existing object URLs
  imageUrls.value.forEach(url => {
    if (url) URL.revokeObjectURL(url);
  });
  
  cubeStore.clearFaceImages();
  cubeStore.setSolution([]);
  currentStep.value = -1;
  uploadedFiles.value = [];
  imageUrls.value = [];
  ElMessage.success('Scanner reset');
};

const startAnimation = () => {
  if (currentStep.value >= 0 && currentStep.value < cubeStore.solution.length) {
    const move = cubeStore.solution[currentStep.value];
    cubeStore.setCurrentMove(move);
    
    setTimeout(() => {
      currentStep.value++;
      if (currentStep.value < cubeStore.solution.length) {
        startAnimation();
      } else {
        cubeStore.setCurrentMove(null);
      }
    }, animationSpeed.value);
  }
};

watch(() => cubeStore.solution, (newSolution) => {
  if (newSolution.length > 0) {
    currentStep.value = 0;
    startAnimation();
  }
}, { deep: true });
</script>

<template>
  <div class="solver-container">
    <div class="upload-section">
      <h3>Upload Cube Faces</h3>
      <div class="face-upload-grid">
        <div v-for="(faceName, index) in faceNames" 
             :key="index" 
             class="face-upload-item">
          <div class="face-label">{{ faceName }}</div>
          <div class="upload-area" 
               :class="{ 'has-image': imageUrls[index] }">
            <template v-if="imageUrls[index]">
              <img :src="imageUrls[index]" 
                   :alt="`Face ${index + 1}`" 
                   class="preview-image" />
            </template>
            <div class="upload-placeholder" v-else>
              <el-icon><Upload /></el-icon>
              <span>Click to upload</span>
            </div>
            <input type="file" 
                   accept="image/*" 
                   @change="(e) => handleFileUpload(e, index)" 
                   class="file-input"
                   :disabled="processingImages" />
          </div>
        </div>
      </div>
    </div>

    <div class="scan-progress">
      <h3>Upload Progress</h3>
      <el-progress 
        :percentage="(completedFaces / 6) * 100" 
        :format="() => `${completedFaces}/6 faces`"
      />
    </div>
    
    <div class="solver-controls">
      <el-button 
        type="primary" 
        @click="generateSolution" 
        :loading="solving"
        :disabled="completedFaces < 6 || processingImages"
      >
        {{ solving ? 'Generating Solution...' : 'Generate Solution' }}
      </el-button>
      
      <el-button 
        type="warning" 
        @click="resetScanner"
        :disabled="processingImages"
      >
        Reset Scanner
      </el-button>
    </div>
    
    <div v-if="cubeStore.solution.length > 0" class="solution-display">
      <h3>Solution</h3>
      <div class="solution-steps">
        <span 
          v-for="(step, index) in cubeStore.solution" 
          :key="index"
          :class="['solution-step', { 'current': index === currentStep }]"
        >
          {{ step }}
        </span>
      </div>
      
      <div class="animation-controls">
        <el-slider
          v-model="animationSpeed"
          :min="100"
          :max="1000"
          :step="100"
          label="Animation Speed"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.solver-container {
  padding: 20px;
  max-width: 1000px;
  margin: 0 auto;
}

.upload-section {
  margin-bottom: 30px;
}

.face-upload-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.face-upload-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.face-label {
  font-size: 14px;
  color: #666;
  text-align: center;
}

.upload-area {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  overflow: hidden;
}

.upload-area:hover {
  border-color: #409eff;
}

.upload-area.has-image {
  border-style: solid;
}

.upload-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;
}

.preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.file-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.file-input:disabled {
  cursor: not-allowed;
}

.scan-progress {
  margin: 30px 0;
}

.solver-controls {
  display: flex;
  gap: 10px;
  margin: 20px 0;
}

.solution-display {
  margin-top: 30px;
}

.solution-steps {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.solution-step {
  background: #f0f0f0;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: monospace;
}

.solution-step.current {
  background: #409EFF;
  color: white;
}

.animation-controls {
  margin-top: 20px;
  padding: 0 20px;
}
</style>