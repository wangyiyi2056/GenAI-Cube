<script setup lang="ts">
  import { ref, computed, onBeforeUnmount, onMounted } from "vue";
  import { ElMessage } from "element-plus";
  import { useCubeStore } from "../stores/cubeStore";
  import { CubeSolver } from "../utils/cubeSolver";
  import { ImageProcessor, type ColorSquare } from "../utils/imageProcessor";
  import {
    Upload,
    VideoPlay,
    VideoPause,
    ArrowLeft,
    ArrowRight,
    RefreshLeft,
    Camera,
    Delete,
  } from "@element-plus/icons-vue";
  import RubiksCube from "./RubiksCube.vue";

  const cubeStore = useCubeStore();
  const solving = ref(false);

  // 移动端适配
  const isMobile = ref(false);
  const mobileTab = ref<"upload" | "cube">("upload");

  const checkMobile = () => {
    isMobile.value = window.innerWidth < 768;
  };

  onMounted(() => {
    checkMobile();
    window.addEventListener("resize", checkMobile);
  });
  const imageUrls = ref<(string | null)[]>([
    null,
    null,
    null,
    null,
    null,
    null,
  ]);
  const processingImages = ref(false);
  const rubiksCubeRef = ref<InstanceType<typeof RubiksCube> | null>(null);

  // 颜色编辑相关
  const editingFace = ref<number | null>(null);
  const editingSquare = ref<number | null>(null);

  // 摄像头相关
  const showCamera = ref(false);
  const cameraFaceIndex = ref<number | null>(null);
  const videoRef = ref<HTMLVideoElement | null>(null);
  const canvasRef = ref<HTMLCanvasElement | null>(null);
  let mediaStream: MediaStream | null = null;

  // 计算已完成的面数量
  const completedFaces = computed(() => {
    return cubeStore.faceColors.filter((face) => face && face.length > 0)
      .length;
  });

  // 检查某个面是否已成功解析（必须有9个颜色格子）
  const isFaceUploaded = (index: number): boolean => {
    return !!(
      imageUrls.value[index] && cubeStore.faceColors[index]?.length === 9
    );
  };

  // 数据存储顺序: U R F D L B (索引 0-5)
  const faceNames = [
    "上 (U)",
    "右 (R)",
    "前 (F)",
    "下 (D)",
    "左 (L)",
    "后 (B)",
  ];

  // 显示顺序: 上下、左右、前后 -> 对应数据索引 [0, 3, 4, 1, 2, 5]
  const displayOrder = [0, 3, 4, 1, 2, 5];

  const CUBE_COLORS = ["WHITE", "YELLOW", "RED", "ORANGE", "GREEN", "BLUE"];

  const COLOR_HEX: Record<string, string> = {
    WHITE: "#ffffff",
    YELLOW: "#ffff00",
    RED: "#b90000",
    ORANGE: "#ff6600",
    GREEN: "#00b900",
    BLUE: "#0000b9",
  };

  // 获取某个面的颜色网格（按位置排序）
  const getSortedFaceColors = (faceIndex: number): ColorSquare[] => {
    if (
      !cubeStore.faceColors[faceIndex] ||
      cubeStore.faceColors[faceIndex].length === 0
    )
      return [];
    const face = cubeStore.faceColors[faceIndex];
    return [...face].sort((a, b) => {
      const rowDiff = a.position.y - b.position.y;
      if (Math.abs(rowDiff) > 10) return rowDiff;
      return a.position.x - b.position.x;
    });
  };

  // 修改颜色
  const changeColor = (
    faceIndex: number,
    squareIndex: number,
    newColor: string
  ) => {
    cubeStore.updateSquareColor(faceIndex, squareIndex, newColor);
    editingSquare.value = null;
    editingFace.value = null;
  };

  // 切换编辑模式
  const toggleEdit = (faceIndex: number, squareIndex: number) => {
    if (
      editingFace.value === faceIndex &&
      editingSquare.value === squareIndex
    ) {
      editingSquare.value = null;
      editingFace.value = null;
    } else {
      editingFace.value = faceIndex;
      editingSquare.value = squareIndex;
    }
  };

  // 拖拽状态
  const dragOverIndex = ref<number | null>(null);

  // 处理图片（上传或拍照后）
  const processImage = async (imageUrl: string, faceIndex: number) => {
    processingImages.value = true;
    try {
      const squares = await ImageProcessor.processImage(imageUrl);

      // 验证是否成功识别出9个颜色格子
      if (!squares || squares.length !== 9) {
        ElMessage.error("无法识别魔方面，请确保图片清晰且包含完整的魔方面");
        URL.revokeObjectURL(imageUrl);
        return;
      }

      // 验证识别出的颜色是否都是有效的魔方颜色
      const validColors = new Set([
        "WHITE",
        "YELLOW",
        "RED",
        "ORANGE",
        "GREEN",
        "BLUE",
      ]);
      const invalidSquares = squares.filter((s) => !validColors.has(s.color));
      if (invalidSquares.length > 0) {
        ElMessage.warning("部分颜色识别可能不准确，请检查并手动修正");
      }

      // 释放旧的 URL
      if (imageUrls.value[faceIndex]) {
        URL.revokeObjectURL(imageUrls.value[faceIndex]!);
      }

      imageUrls.value[faceIndex] = imageUrl;
      cubeStore.setFaceData(faceIndex, imageUrl, squares);

      ElMessage.success(`${faceNames[faceIndex]} 处理成功`);
    } catch (error) {
      ElMessage.error("图片处理失败，请重试");
      URL.revokeObjectURL(imageUrl);
      console.error("Image processing error:", error);
    } finally {
      processingImages.value = false;
    }
  };

  // 上传图片
  const handleFileUpload = async (event: Event, faceIndex: number) => {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    if (!file.type.startsWith("image/")) {
      ElMessage.error("请上传图片文件");
      return;
    }

    const imageUrl = URL.createObjectURL(file);
    await processImage(imageUrl, faceIndex);

    // 清空 input 以便重复上传同一文件
    input.value = "";
  };

  // 拖拽处理
  const handleDragOver = (event: DragEvent, faceIndex: number) => {
    event.preventDefault();
    dragOverIndex.value = faceIndex;
  };

  const handleDragLeave = () => {
    dragOverIndex.value = null;
  };

  const handleDrop = async (event: DragEvent, faceIndex: number) => {
    event.preventDefault();
    dragOverIndex.value = null;

    const files = event.dataTransfer?.files;
    if (!files?.length) return;

    const file = files[0];
    if (!file.type.startsWith("image/")) {
      ElMessage.error("请拖入图片文件");
      return;
    }

    const imageUrl = URL.createObjectURL(file);
    await processImage(imageUrl, faceIndex);
  };

  // 删除某个面的图片
  const deleteFace = (faceIndex: number) => {
    if (imageUrls.value[faceIndex]) {
      URL.revokeObjectURL(imageUrls.value[faceIndex]!);
    }
    imageUrls.value[faceIndex] = null;
    cubeStore.clearFaceData(faceIndex);
    ElMessage.success(`${faceNames[faceIndex]} 已删除`);
  };

  // 打开摄像头
  const openCamera = async (faceIndex: number) => {
    cameraFaceIndex.value = faceIndex;
    showCamera.value = true;

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 640, height: 480 },
      });

      // 等待 DOM 更新
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (videoRef.value) {
        videoRef.value.srcObject = mediaStream;
        await videoRef.value.play();
      }
    } catch (error) {
      ElMessage.error("无法访问摄像头，请检查权限设置");
      console.error("Camera error:", error);
      closeCamera();
    }
  };

  // 拍照
  const takePhoto = async () => {
    if (!videoRef.value || !canvasRef.value || cameraFaceIndex.value === null)
      return;

    const video = videoRef.value;
    const canvas = canvasRef.value;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    // 设置 canvas 尺寸与视频一致
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // 绘制当前帧
    ctx.drawImage(video, 0, 0);

    // 转换为图片 URL
    const imageUrl = canvas.toDataURL("image/jpeg", 0.9);

    // 关闭摄像头
    const faceIndex = cameraFaceIndex.value;
    closeCamera();

    // 处理图片
    await processImage(imageUrl, faceIndex);
  };

  // 关闭摄像头
  const closeCamera = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
    }
    showCamera.value = false;
    cameraFaceIndex.value = null;
  };

  // 组件卸载时关闭摄像头
  onBeforeUnmount(() => {
    closeCamera();
    window.removeEventListener("resize", checkMobile);
    // 释放所有图片 URL
    imageUrls.value.forEach((url) => {
      if (url) URL.revokeObjectURL(url);
    });
  });

  const generateSolution = async () => {
    if (completedFaces.value < 6) {
      ElMessage.error("Please upload all 6 faces first");
      return;
    }

    solving.value = true;
    try {
      // 初始化3D魔方显示扫描的状态
      rubiksCubeRef.value?.initCubeFromColors(cubeStore.faceColors);

      // 转换为求解器格式并求解
      const cubeState = CubeSolver.convertToSolverFormat(cubeStore.faceColors);
      const solution = await CubeSolver.solve(cubeState);
      cubeStore.setSolution(solution);
      cubeStore.setCurrentStepIndex(-1);

      ElMessage.success(`Solution generated: ${solution.length} moves`);

      // 移动端自动切换到3D页签
      if (isMobile.value) {
        mobileTab.value = "cube";
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to generate solution";
      ElMessage.error(errorMessage);
      console.error("Solver error:", error);
    } finally {
      solving.value = false;
    }
  };

  const resetScanner = () => {
    imageUrls.value.forEach((url) => {
      if (url) URL.revokeObjectURL(url);
    });

    cubeStore.clearFaceImages();
    cubeStore.resetSolution();
    imageUrls.value = [null, null, null, null, null, null];
    rubiksCubeRef.value?.resetCube();
    ElMessage.success("已重置");
  };

  // 播放控制
  const handlePlay = () => {
    rubiksCubeRef.value?.playSolution();
  };

  const handlePause = () => {
    rubiksCubeRef.value?.pauseSolution();
  };

  const handlePrev = () => {
    rubiksCubeRef.value?.prevStep();
  };

  const handleNext = () => {
    rubiksCubeRef.value?.nextStep();
  };

  const handleResetToStart = () => {
    rubiksCubeRef.value?.resetToStart();
  };

  // 速度变化时更新store
  const handleSpeedChange = (value: number) => {
    cubeStore.setAnimationSpeed(value);
  };

  // Tab 切换
  const activeTab = ref("solution");

  // 手动输入解法
  const manualSolution = ref("");

  const applyManualSolution = () => {
    if (!manualSolution.value.trim()) {
      ElMessage.warning("请输入解法步骤");
      return;
    }

    // 解析输入的解法
    // 支持格式: "R U R' U'" 或 "R U R' U'" 或 "R,U,R',U'"
    const input = manualSolution.value.trim().toUpperCase();
    const moves = input
      .split(/[\s,]+/)
      .filter((m) => m.length > 0)
      .map((m) => {
        // 标准化格式
        return m.replace(/['′`]/g, "'").replace(/2/g, "2");
      });

    // 验证步骤格式
    const validMoves = /^[FBLRUD][2']?$/;
    const invalidMoves = moves.filter((m) => !validMoves.test(m));
    if (invalidMoves.length > 0) {
      ElMessage.error(`无效的步骤: ${invalidMoves.join(", ")}`);
      return;
    }

    // 如果已上传图片，先初始化3D魔方
    if (completedFaces.value === 6) {
      rubiksCubeRef.value?.initCubeFromColors(cubeStore.faceColors);
    }

    cubeStore.setSolution(moves);
    cubeStore.setCurrentStepIndex(-1);
    ElMessage.success(`已应用 ${moves.length} 步解法`);

    // 切换到解法结果面板
    activeTab.value = "solution";
  };
</script>

<template>
  <div class="solver-container" :class="{ mobile: isMobile }">
    <!-- 移动端页签切换 -->
    <div v-if="isMobile" class="mobile-tabs">
      <button
        class="mobile-tab"
        :class="{ active: mobileTab === 'upload' }"
        @click="mobileTab = 'upload'"
      >
        📷 上传图片
      </button>
      <button
        class="mobile-tab"
        :class="{ active: mobileTab === 'cube' }"
        @click="mobileTab = 'cube'"
      >
        🎲 3D魔方
      </button>
    </div>

    <div class="main-content">
      <!-- 左侧：上传区域 -->
      <div class="upload-panel" v-show="!isMobile || mobileTab === 'upload'">
        <div class="gradient-text">3D魔方解析</div>
        <div class="face-upload-grid">
          <div
            v-for="displayIdx in displayOrder"
            :key="displayIdx"
            class="face-upload-item"
          >
            <div
              class="face-label"
              :class="{ completed: isFaceUploaded(displayIdx) }"
            >
              {{ faceNames[displayIdx] }}
              <span v-if="isFaceUploaded(displayIdx)" class="check-mark">
                ✓
              </span>
            </div>
            <div class="face-content">
              <!-- 左侧：图片上传区域 + 操作按钮 -->
              <div class="upload-column">
                <!-- 图片预览/上传区域（支持点击和拖拽） -->
                <label
                  class="upload-area"
                  :class="{
                    'has-image': imageUrls[displayIdx],
                    'drag-over': dragOverIndex === displayIdx,
                  }"
                  @dragover="(e) => handleDragOver(e, displayIdx)"
                  @dragleave="handleDragLeave"
                  @drop="(e) => handleDrop(e, displayIdx)"
                >
                  <template v-if="imageUrls[displayIdx]">
                    <img
                      :src="imageUrls[displayIdx]!"
                      :alt="faceNames[displayIdx]"
                      class="preview-image"
                    />
                  </template>
                  <div class="upload-placeholder" v-else>
                    <el-icon size="24"><Upload /></el-icon>
                    <span>点击或拖拽</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    @change="(e) => handleFileUpload(e, displayIdx)"
                    :disabled="processingImages"
                    hidden
                  />
                </label>

                <!-- 操作按钮（在图片下方，水平排列） -->
                <div class="face-actions">
                  <button
                    class="action-btn camera-btn"
                    @click="openCamera(displayIdx)"
                    :disabled="processingImages"
                    title="拍照"
                  >
                    <el-icon><Camera /></el-icon>
                  </button>
                  <button
                    class="action-btn delete-btn"
                    @click="deleteFace(displayIdx)"
                    :disabled="processingImages || !isFaceUploaded(displayIdx)"
                    title="删除"
                  >
                    <el-icon><Delete /></el-icon>
                  </button>
                </div>
              </div>

              <!-- 右侧：颜色预览网格 -->
              <div v-if="isFaceUploaded(displayIdx)" class="color-grid">
                <div
                  v-for="(square, sIndex) in getSortedFaceColors(displayIdx)"
                  :key="sIndex"
                  class="color-cell"
                  :style="{ backgroundColor: COLOR_HEX[square.color] }"
                  @click="toggleEdit(displayIdx, sIndex)"
                  :class="{
                    editing:
                      editingFace === displayIdx && editingSquare === sIndex,
                  }"
                >
                  <div
                    v-if="
                      editingFace === displayIdx && editingSquare === sIndex
                    "
                    class="color-picker"
                    @click.stop
                  >
                    <div
                      v-for="color in CUBE_COLORS"
                      :key="color"
                      class="color-option"
                      :style="{ backgroundColor: COLOR_HEX[color] }"
                      @click="changeColor(displayIdx, sIndex, color)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <p class="edit-hint">💡 点击颜色格子可手动修正识别错误</p>

        <div class="scan-progress">
          <el-progress
            :percentage="(completedFaces / 6) * 100"
            :format="() => `${completedFaces}/6`"
          />
        </div>

        <div class="solver-controls">
          <el-button
            type="primary"
            @click="generateSolution"
            :loading="solving"
            :disabled="completedFaces < 6 || processingImages"
            size="large"
          >
            {{ solving ? "生成中..." : "生成解法" }}
          </el-button>

          <el-button
            type="warning"
            @click="resetScanner"
            :disabled="processingImages"
            size="large"
          >
            重置
          </el-button>
        </div>
      </div>

      <!-- 摄像头弹窗 -->
      <div v-if="showCamera" class="camera-modal" @click.self="closeCamera">
        <div class="camera-container">
          <div class="camera-header">
            <span>
              拍摄
              {{ cameraFaceIndex !== null ? faceNames[cameraFaceIndex] : "" }}
            </span>
            <button class="close-btn" @click="closeCamera">✕</button>
          </div>
          <div class="camera-body">
            <video ref="videoRef" autoplay playsinline></video>
            <canvas ref="canvasRef" style="display: none"></canvas>
            <div class="camera-guide">
              <div class="guide-grid">
                <div v-for="i in 9" :key="i" class="guide-cell"></div>
              </div>
            </div>
          </div>
          <div class="camera-footer">
            <button class="capture-btn" @click="takePhoto">
              <span class="capture-icon"></span>
            </button>
          </div>
        </div>
      </div>

      <!-- 右侧：3D魔方和解法 -->
      <div class="cube-panel" v-show="!isMobile || mobileTab === 'cube'">
        <RubiksCube ref="rubiksCubeRef" />

        <!-- Tab 切换面板 -->
        <div class="solution-panel">
          <div class="tab-header">
            <button
              class="tab-btn"
              :class="{ active: activeTab === 'solution' }"
              @click="activeTab = 'solution'"
            >
              解法结果
              <span v-if="cubeStore.solution.length > 0" class="badge">
                {{ cubeStore.solution.length }}
              </span>
            </button>
            <button
              class="tab-btn"
              :class="{ active: activeTab === 'manual' }"
              @click="activeTab = 'manual'"
            >
              手动输入
            </button>
          </div>

          <!-- 解法结果面板 -->
          <div v-show="activeTab === 'solution'" class="tab-content">
            <div v-if="cubeStore.solution.length > 0">
              <div class="solution-header">
                <span class="solution-title">
                  共 {{ cubeStore.solution.length }} 步
                </span>
                <div class="speed-control">
                  <span>速度:</span>
                  <el-slider
                    :model-value="cubeStore.animationSpeed"
                    @update:model-value="handleSpeedChange"
                    :min="100"
                    :max="1000"
                    :step="100"
                    :format-tooltip="(val: number) => `${val}ms`"
                    style="width: 100px"
                  />
                </div>
              </div>

              <div class="solution-steps">
                <span
                  v-for="(step, index) in cubeStore.solution"
                  :key="index"
                  :class="[
                    'solution-step',
                    {
                      current: index === cubeStore.currentStepIndex,
                      completed: index < cubeStore.currentStepIndex,
                    },
                  ]"
                >
                  {{ step }}
                </span>
              </div>

              <div class="playback-controls">
                <el-button-group>
                  <el-button
                    @click="handleResetToStart"
                    :disabled="
                      cubeStore.isRotating || cubeStore.currentStepIndex < 0
                    "
                    :icon="RefreshLeft"
                  >
                    重置
                  </el-button>
                  <el-button
                    @click="handlePrev"
                    :disabled="
                      cubeStore.isRotating ||
                      cubeStore.isPlaying ||
                      cubeStore.currentStepIndex < 0
                    "
                    :icon="ArrowLeft"
                  >
                    上一步
                  </el-button>
                  <el-button
                    v-if="!cubeStore.isPlaying"
                    type="primary"
                    @click="handlePlay"
                    :disabled="
                      cubeStore.isRotating ||
                      cubeStore.currentStepIndex >=
                        cubeStore.solution.length - 1
                    "
                    :icon="VideoPlay"
                  >
                    播放
                  </el-button>
                  <el-button
                    v-else
                    type="danger"
                    @click="handlePause"
                    :icon="VideoPause"
                  >
                    暂停
                  </el-button>
                  <el-button
                    @click="handleNext"
                    :disabled="
                      cubeStore.isRotating ||
                      cubeStore.isPlaying ||
                      cubeStore.currentStepIndex >=
                        cubeStore.solution.length - 1
                    "
                    :icon="ArrowRight"
                  >
                    下一步
                  </el-button>
                </el-button-group>
              </div>

              <div class="progress-info">
                进度: {{ cubeStore.currentStepIndex + 1 }} /
                {{ cubeStore.solution.length }}
              </div>
            </div>
            <div v-else class="empty-solution">
              <p>暂无解法</p>
              <p class="hint">请上传魔方六面图片后点击"生成解法"</p>
            </div>
          </div>

          <!-- 手动输入面板 -->
          <div v-show="activeTab === 'manual'" class="tab-content">
            <div class="manual-input-row">
              <el-input
                v-model="manualSolution"
                placeholder="输入解法，如: R U R' U' 或 R,U,R',U'"
                clearable
                @keyup.enter="applyManualSolution"
              />
              <el-button type="success" @click="applyManualSolution">
                应用
              </el-button>
            </div>
            <p class="input-hint">
              支持格式: F, B, L, R, U, D (顺时针), F', B', L', R', U', D'
              (逆时针), F2, R2... (180度)
            </p>
          </div>
        </div>

        <div class="controls-hint">
          <p>键盘: F, B, R, L, U, D 旋转对应面 (Shift + 键 为逆时针)</p>
          <p>鼠标: 拖拽旋转视角，滚轮缩放</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .solver-container {
    padding: 20px;
  }

  /* 移动端页签 */
  .mobile-tabs {
    display: flex;
    margin-bottom: 15px;
    background: #e4e7ed;
    border-radius: 8px;
    overflow: hidden;
  }

  .mobile-tab {
    flex: 1;
    padding: 12px 16px;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 14px;
    color: #606266;
    transition: all 0.2s;
  }

  .mobile-tab.active {
    background: #409eff;
    color: white;
    font-weight: 500;
  }

  .main-content {
    display: flex;
    gap: 20px;
    min-height: 600px;
  }

  .upload-panel {
    flex: 0 0 400px;
    display: flex;
    flex-direction: column;
  }

  .cube-panel {
    flex: 0 0 600px;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .face-upload-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
    margin-top: 15px;
  }

  .face-upload-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .face-label {
    font-size: 12px;
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
    border-color: #67c23a;
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
    font-size: 12px;
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

  .scan-progress {
    margin: 20px 0;
  }

  .solver-controls {
    display: flex;
    gap: 10px;
  }

  /* Tab 面板样式 */
  .solution-panel {
    background: #f5f7fa;
    border-radius: 8px;
    margin-top: 15px;
    overflow: hidden;
  }

  .tab-header {
    display: flex;
    background: #e4e7ed;
  }

  .tab-btn {
    flex: 1;
    padding: 12px 16px;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 14px;
    color: #606266;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .tab-btn:hover {
    background: rgba(64, 158, 255, 0.1);
  }

  .tab-btn.active {
    background: #f5f7fa;
    color: #409eff;
    font-weight: 500;
  }

  .badge {
    background: #409eff;
    color: white;
    font-size: 12px;
    padding: 2px 6px;
    border-radius: 10px;
    min-width: 20px;
    text-align: center;
  }

  .tab-content {
    padding: 15px;
  }

  .solution-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .solution-title {
    font-weight: 500;
    color: #303133;
  }

  .speed-control {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #606266;
  }

  .solution-steps {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 15px;
    max-height: 100px;
    overflow-y: auto;
  }

  .solution-step {
    background: #e4e7ed;
    padding: 4px 10px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 14px;
    transition: all 0.3s;
  }

  .solution-step.completed {
    background: #67c23a;
    color: white;
  }

  .solution-step.current {
    background: #409eff;
    color: white;
    transform: scale(1.1);
  }

  .playback-controls {
    display: flex;
    justify-content: center;
    margin-bottom: 10px;
  }

  .progress-info {
    text-align: center;
    color: #666;
    font-size: 14px;
  }

  .empty-solution {
    text-align: center;
    padding: 20px;
    color: #909399;
  }

  .empty-solution p {
    margin: 4px 0;
  }

  .empty-solution .hint {
    font-size: 12px;
  }

  .controls-hint {
    margin-top: 15px;
    padding: 10px;
    background: #fafafa;
    border-radius: 6px;
    font-size: 12px;
    color: #909399;
  }

  .controls-hint p {
    margin: 4px 0;
  }

  .face-content {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }

  .upload-column {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;
  }

  .upload-area {
    width: 80px;
    height: 80px;
    display: block;
    cursor: pointer;
  }

  .upload-area.drag-over {
    border-color: #409eff;
    background: rgba(64, 158, 255, 0.1);
  }

  .upload-placeholder {
    gap: 4px;
  }

  .upload-placeholder span {
    font-size: 10px;
  }

  .color-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2px;
    width: 66px;
    height: 66px;
    margin-top: 4px;
  }

  .color-cell {
    width: 20px;
    height: 20px;
    border: 1px solid #333;
    border-radius: 2px;
    cursor: pointer;
    position: relative;
    transition: transform 0.2s;
  }

  .color-cell:hover {
    transform: scale(1.1);
    z-index: 1;
  }

  .color-cell.editing {
    transform: scale(1.2);
    z-index: 10;
    box-shadow: 0 0 8px rgba(0, 0, 0, 0.5);
  }

  .color-picker {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 3px;
    padding: 4px;
    background: white;
    border-radius: 4px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
    z-index: 100;
  }

  .color-option {
    width: 18px;
    height: 18px;
    border: 1px solid #333;
    border-radius: 2px;
    cursor: pointer;
    transition: transform 0.15s;
  }

  .color-option:hover {
    transform: scale(1.2);
  }

  .edit-hint {
    font-size: 12px;
    color: #909399;
    margin: 10px 0;
  }

  .manual-input-row {
    display: flex;
    gap: 10px;
  }

  .manual-input-row .el-input {
    flex: 1;
  }

  .input-hint {
    font-size: 11px;
    color: #909399;
    margin: 10px 0 0 0;
    line-height: 1.5;
  }

  /* 面标签样式 */
  .face-label.completed {
    color: #67c23a;
    font-weight: 500;
  }

  .check-mark {
    color: #67c23a;
    margin-left: 4px;
  }

  /* 操作按钮 */
  .face-actions {
    display: flex;
    flex-direction: row;
    gap: 6px;
    justify-content: center;
  }

  .action-btn {
    width: 36px;
    height: 28px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    font-size: 14px;
  }

  .action-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .camera-btn {
    background: #67c23a;
    color: white;
  }

  .camera-btn:hover:not(:disabled) {
    background: #85ce61;
  }

  .delete-btn {
    background: #f56c6c;
    color: white;
  }

  .delete-btn:hover:not(:disabled) {
    background: #f78989;
  }

  /* 摄像头弹窗 */
  .camera-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .camera-container {
    background: #1a1a1a;
    border-radius: 12px;
    overflow: hidden;
    max-width: 500px;
    width: 90%;
  }

  .camera-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #2a2a2a;
    color: white;
  }

  .close-btn {
    background: none;
    border: none;
    color: white;
    font-size: 20px;
    cursor: pointer;
    padding: 4px 8px;
  }

  .close-btn:hover {
    color: #f56c6c;
  }

  .camera-body {
    position: relative;
    background: black;
  }

  .camera-body video {
    width: 100%;
    display: block;
  }

  .camera-guide {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 70%;
    aspect-ratio: 1;
    pointer-events: none;
  }

  .guide-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, 1fr);
    width: 100%;
    height: 100%;
    border: 2px solid rgba(255, 255, 255, 0.6);
    border-radius: 8px;
  }

  .guide-cell {
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .camera-footer {
    padding: 20px;
    display: flex;
    justify-content: center;
    background: #2a2a2a;
  }

  .capture-btn {
    width: 70px;
    height: 70px;
    border-radius: 50%;
    background: white;
    border: 4px solid #666;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.1s;
  }

  .capture-btn:hover {
    transform: scale(1.05);
  }

  .capture-btn:active {
    transform: scale(0.95);
  }

  .capture-icon {
    width: 54px;
    height: 54px;
    border-radius: 50%;
    background: #f56c6c;
  }

  /* 移动端适配 */
  .solver-container.mobile {
    padding: 10px;
  }

  .solver-container.mobile .main-content {
    flex-direction: column;
    min-height: auto;
    gap: 15px;
  }

  .solver-container.mobile .upload-panel,
  .solver-container.mobile .cube-panel {
    flex: 0 0 1;
    width: 100%;
  }

  .solver-container.mobile .face-upload-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .solver-container.mobile .upload-area {
    width: 65px;
    height: 65px;
  }

  .solver-container.mobile .color-grid {
    width: 51px;
    height: 51px;
  }

  .solver-container.mobile .color-cell {
    width: 15px;
    height: 15px;
  }

  .solver-container.mobile .solver-controls .el-button {
    width: 100%;
  }

  .solver-container.mobile .playback-controls {
    overflow-x: auto;
  }

  .solver-container.mobile .playback-controls .el-button-group {
    display: flex;
    flex-wrap: nowrap;
  }

  .solver-container.mobile .playback-controls .el-button {
    padding: 8px 10px;
    font-size: 12px;
  }

  .solver-container.mobile .playback-controls .el-button span {
    display: none;
  }

  .solver-container.mobile .solution-header {
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }

  .solver-container.mobile .speed-control {
    width: 100%;
  }

  .solver-container.mobile .speed-control .el-slider {
    width: 100% !important;
    flex: 1;
  }

  .solver-container.mobile .controls-hint {
    font-size: 11px;
  }

  .solver-container.mobile h3 {
    font-size: 16px;
    margin: 0 0 10px 0;
  }

  .solver-container.mobile .manual-input-row {
    flex-direction: column;
  }

  .solver-container.mobile .face-actions {
    gap: 4px;
  }

  .solver-container.mobile .action-btn {
    width: 30px;
    height: 24px;
    font-size: 12px;
  }

  .solver-container.mobile .edit-hint {
    font-size: 11px;
  }

  .solver-container.mobile .solution-steps {
    max-height: 80px;
  }

  .solver-container.mobile .solution-step {
    padding: 3px 8px;
    font-size: 12px;
  }
  .gradient-text {
    font-size: 25px;
    font-weight: 500;
    background: linear-gradient(135deg, #0f7dea 0%, #6c4dea 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    font-weight: bold;
  }
</style>
