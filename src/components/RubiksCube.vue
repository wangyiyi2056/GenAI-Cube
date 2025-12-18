<script setup lang="ts">
  import { ref, onMounted, onBeforeUnmount } from "vue";
  import * as THREE from "three";
  import { OrbitControls } from "three/addons/controls/OrbitControls.js";
  import { useCubeStore } from "../stores/cubeStore";

  const container = ref<HTMLDivElement | null>(null);
  const miniContainer = ref<HTMLDivElement | null>(null);
  const cubeStore = useCubeStore();

  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let renderer: THREE.WebGLRenderer;
  let controls: OrbitControls;
  let rubiksCube: THREE.Group;
  let cubelets: THREE.Mesh[] = [];
  let animationFrameId: number;
  let resizeObserver: ResizeObserver | null = null;

  // 迷你魔方相关
  let miniScene: THREE.Scene;
  let miniCamera: THREE.PerspectiveCamera;
  let miniRenderer: THREE.WebGLRenderer;
  let miniCube: THREE.Group;

  // 保存每个面的目标颜色（中心块颜色），用于确定还原后的状态
  let faceTargetColors: Record<string, string> = {
    U: "WHITE",
    R: "RED",
    F: "GREEN",
    D: "YELLOW",
    L: "ORANGE",
    B: "BLUE",
  };

  const CUBE_SIZE = 1;
  const GAP = 0.05;

  // 颜色映射 - 与 web 端保持一致
  const COLOR_MAP: Record<string, number> = {
    WHITE: 0xffffff,
    YELLOW: 0xffff00,
    RED: 0xb90000,
    ORANGE: 0xff6600,
    GREEN: 0x00b900,
    BLUE: 0x0000b9,
    BLACK: 0x111111,
  };

  // 面的索引映射 (上传顺序: U R F D L B)
  const FACE_INDEX = { U: 0, R: 1, F: 2, D: 3, L: 4, B: 5 };

  // 获取cubelet在某个面上的颜色索引
  // 图片扫描顺序: 从左上到右下，按行排列 (0-8)
  //
  // 标准魔方展开图布局:
  //        [U]
  //    [L][F][R][B]
  //        [D]
  //
  // 3D坐标系: X(左-右), Y(下-上), Z(后-前)
  const getCubeletFaceIndex = (
    x: number,
    y: number,
    z: number,
    face: string
  ): number => {
    // 返回该cubelet在对应面上的位置索引 (0-8)
    // row = 0,1,2 从上到下; col = 0,1,2 从左到右
    // index = row * 3 + col
    switch (face) {
      case "U":
        // U面下边连接F上边
        // 图片下方是前(+Z)，图片左方是左(-X)
        // 图片上方是后(-Z)
        // row: z从-1到1 -> row从0到2
        // col: x从-1到1 -> col从0到2
        return (z + 1) * 3 + (x + 1);
      case "D":
        // D面上边连接F下边
        // 图片上方是前(+Z)，图片左方是左(-X)
        // row: z从1到-1 -> row从0到2
        // col: x从-1到1 -> col从0到2
        return (1 - z) * 3 + (x + 1);
      case "F":
        // F面正对观察者
        // 图片上方是上(+Y)，图片左方是左(-X)
        // row: y从1到-1 -> row从0到2
        // col: x从-1到1 -> col从0到2
        return (1 - y) * 3 + (x + 1);
      case "B":
        // B面在展开图最右边，左边连接R的右边
        // 图片上方是上(+Y)，图片左方是右(+X)
        // row: y从1到-1 -> row从0到2
        // col: x从1到-1 -> col从0到2
        return (1 - y) * 3 + (1 - x);
      case "R":
        // R面左边连接F的右边
        // 图片上方是上(+Y)，图片左方是前(+Z)
        // row: y从1到-1 -> row从0到2
        // col: z从1到-1 -> col从0到2
        return (1 - y) * 3 + (1 - z);
      case "L":
        // L面右边连接F的左边
        // 图片上方是上(+Y)，图片左方是后(-Z)
        // row: y从1到-1 -> row从0到2
        // col: z从-1到1 -> col从0到2
        return (1 - y) * 3 + (z + 1);
      default:
        return -1;
    }
  };

  const createCubelet = (
    position: [number, number, number],
    faceColorsData?: string[][]
  ) => {
    const geometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
    const [x, y, z] = position.map((p) => Math.round(p / (CUBE_SIZE + GAP)));

    // 材质顺序: +X(R), -X(L), +Y(U), -Y(D), +Z(F), -Z(B)
    let colors: number[];

    if (faceColorsData && faceColorsData.length === 6) {
      // 使用扫描的颜色数据（打乱状态）
      colors = [
        x === 1
          ? COLOR_MAP[
              faceColorsData[FACE_INDEX.R][getCubeletFaceIndex(x, y, z, "R")]
            ]
          : COLOR_MAP["BLACK"],
        x === -1
          ? COLOR_MAP[
              faceColorsData[FACE_INDEX.L][getCubeletFaceIndex(x, y, z, "L")]
            ]
          : COLOR_MAP["BLACK"],
        y === 1
          ? COLOR_MAP[
              faceColorsData[FACE_INDEX.U][getCubeletFaceIndex(x, y, z, "U")]
            ]
          : COLOR_MAP["BLACK"],
        y === -1
          ? COLOR_MAP[
              faceColorsData[FACE_INDEX.D][getCubeletFaceIndex(x, y, z, "D")]
            ]
          : COLOR_MAP["BLACK"],
        z === 1
          ? COLOR_MAP[
              faceColorsData[FACE_INDEX.F][getCubeletFaceIndex(x, y, z, "F")]
            ]
          : COLOR_MAP["BLACK"],
        z === -1
          ? COLOR_MAP[
              faceColorsData[FACE_INDEX.B][getCubeletFaceIndex(x, y, z, "B")]
            ]
          : COLOR_MAP["BLACK"],
      ];
    } else {
      // 默认已还原状态 - 使用目标颜色（中心块颜色）
      colors = [
        x === 1 ? COLOR_MAP[faceTargetColors.R] : COLOR_MAP["BLACK"], // R
        x === -1 ? COLOR_MAP[faceTargetColors.L] : COLOR_MAP["BLACK"], // L
        y === 1 ? COLOR_MAP[faceTargetColors.U] : COLOR_MAP["BLACK"], // U
        y === -1 ? COLOR_MAP[faceTargetColors.D] : COLOR_MAP["BLACK"], // D
        z === 1 ? COLOR_MAP[faceTargetColors.F] : COLOR_MAP["BLACK"], // F
        z === -1 ? COLOR_MAP[faceTargetColors.B] : COLOR_MAP["BLACK"], // B
      ];
    }

    // 使用 MeshBasicMaterial 确保颜色准确显示，不受光照影响
    const materials = colors.map(
      (color) =>
        new THREE.MeshBasicMaterial({
          color,
        })
    );

    const cubelet = new THREE.Mesh(geometry, materials);
    cubelet.position.set(...position);
    cubelet.userData.gridPosition = [x, y, z];
    return cubelet;
  };

  const getFaceCubelets = (face: string): THREE.Mesh[] => {
    return cubelets.filter((cubelet) => {
      const [x, y, z] = cubelet.userData.gridPosition;
      switch (face) {
        case "F":
          return z === 1;
        case "B":
          return z === -1;
        case "R":
          return x === 1;
        case "L":
          return x === -1;
        case "U":
          return y === 1;
        case "D":
          return y === -1;
        default:
          return false;
      }
    });
  };

  const rotateFace = (face: string, angle: number): Promise<void> => {
    return new Promise((resolve) => {
      if (cubeStore.isRotating) {
        resolve();
        return;
      }

      cubeStore.setRotating(true);
      const faceCubelets = getFaceCubelets(face);

      let axis: THREE.Vector3;
      switch (face) {
        case "F":
          axis = new THREE.Vector3(0, 0, 1);
          break;
        case "B":
          axis = new THREE.Vector3(0, 0, -1);
          break;
        case "R":
          axis = new THREE.Vector3(1, 0, 0);
          break;
        case "L":
          axis = new THREE.Vector3(-1, 0, 0);
          break;
        case "U":
          axis = new THREE.Vector3(0, 1, 0);
          break;
        case "D":
          axis = new THREE.Vector3(0, -1, 0);
          break;
        default:
          resolve();
          return;
      }

      const startTime = Date.now();
      const duration = cubeStore.animationSpeed;
      let lastAngle = 0;

      const animateRotation = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3); // ease out cubic
        const currentAngle = angle * easeProgress;
        const deltaAngle = currentAngle - lastAngle;
        lastAngle = currentAngle;

        faceCubelets.forEach((cubelet) => {
          cubelet.position.applyAxisAngle(axis, deltaAngle);
          cubelet.rotateOnWorldAxis(axis, deltaAngle);

          // 更新grid position
          const pos = cubelet.position;
          cubelet.userData.gridPosition = [
            Math.round(pos.x / (CUBE_SIZE + GAP)),
            Math.round(pos.y / (CUBE_SIZE + GAP)),
            Math.round(pos.z / (CUBE_SIZE + GAP)),
          ];
        });

        if (progress < 1) {
          requestAnimationFrame(animateRotation);
        } else {
          cubeStore.setRotating(false);
          resolve();
        }
      };

      animateRotation();
    });
  };

  // 执行单个移动
  const executeMove = async (move: string) => {
    const firstChar = move.charAt(0);
    const isWideMove =
      firstChar === firstChar.toLowerCase() && /[lrudfb]/.test(firstChar);
    const face = firstChar.toUpperCase();
    const isCounterClockwise = move.includes("'");
    const isDouble = move.includes("2");

    // 标准魔方记号：顺时针是从该面正对着看的顺时针
    // Three.js 使用右手定则，绕正轴旋转正角度是逆时针（从正方向看）
    // 所以需要反转：顺时针 = 负角度
    let angle = -Math.PI / 2; // 顺时针为负
    if (isCounterClockwise) angle = -angle; // 逆时针为正
    if (isDouble) angle *= 2;

    if (isWideMove) {
      // 宽转：同时转动外层和中间层
      // 例如 l = L层 + M层（中间层，与L同向）
      await rotateWide(face, angle);
    } else {
      await rotateFace(face, angle);
    }
  };

  // 获取中间层的cubelets
  const getMiddleLayerCubelets = (face: string): THREE.Mesh[] => {
    return cubelets.filter((cubelet) => {
      const [x, y, z] = cubelet.userData.gridPosition;
      switch (face) {
        case "R":
        case "L":
          return x === 0; // M层（与L同向）
        case "U":
        case "D":
          return y === 0; // E层（与D同向）
        case "F":
        case "B":
          return z === 0; // S层（与F同向）
        default:
          return false;
      }
    });
  };

  // 宽转：同时转动外层和中间层
  const rotateWide = (face: string, angle: number): Promise<void> => {
    return new Promise(async (resolve) => {
      if (cubeStore.isRotating) {
        resolve();
        return;
      }

      cubeStore.setRotating(true);

      const faceCubelets = getFaceCubelets(face);
      const middleCubelets = getMiddleLayerCubelets(face);
      const allCubelets = [...faceCubelets, ...middleCubelets];

      let axis: THREE.Vector3;
      switch (face) {
        case "F":
          axis = new THREE.Vector3(0, 0, 1);
          break;
        case "B":
          axis = new THREE.Vector3(0, 0, -1);
          break;
        case "R":
          axis = new THREE.Vector3(1, 0, 0);
          break;
        case "L":
          axis = new THREE.Vector3(-1, 0, 0);
          break;
        case "U":
          axis = new THREE.Vector3(0, 1, 0);
          break;
        case "D":
          axis = new THREE.Vector3(0, -1, 0);
          break;
        default:
          cubeStore.setRotating(false);
          resolve();
          return;
      }

      const startTime = Date.now();
      const duration = cubeStore.animationSpeed;
      let lastAngle = 0;

      const animateRotation = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const currentAngle = angle * easeProgress;
        const deltaAngle = currentAngle - lastAngle;
        lastAngle = currentAngle;

        allCubelets.forEach((cubelet) => {
          cubelet.position.applyAxisAngle(axis, deltaAngle);
          cubelet.rotateOnWorldAxis(axis, deltaAngle);

          const pos = cubelet.position;
          cubelet.userData.gridPosition = [
            Math.round(pos.x / (CUBE_SIZE + GAP)),
            Math.round(pos.y / (CUBE_SIZE + GAP)),
            Math.round(pos.z / (CUBE_SIZE + GAP)),
          ];
        });

        if (progress < 1) {
          requestAnimationFrame(animateRotation);
        } else {
          cubeStore.setRotating(false);
          resolve();
        }
      };

      animateRotation();
    });
  };

  // 播放解法动画
  const playSolution = async () => {
    if (cubeStore.solution.length === 0 || cubeStore.isPlaying) return;

    cubeStore.setIsPlaying(true);

    for (
      let i = cubeStore.currentStepIndex + 1;
      i < cubeStore.solution.length;
      i++
    ) {
      if (!cubeStore.isPlaying) break;

      cubeStore.setCurrentStepIndex(i);
      cubeStore.setCurrentMove(cubeStore.solution[i]);
      await executeMove(cubeStore.solution[i]);

      // 等待一小段时间再执行下一步
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    cubeStore.setIsPlaying(false);
    cubeStore.setCurrentMove(null);
  };

  // 暂停播放
  const pauseSolution = () => {
    cubeStore.setIsPlaying(false);
  };

  // 执行下一步
  const nextStep = async () => {
    if (cubeStore.isRotating || cubeStore.isPlaying) return;
    if (cubeStore.currentStepIndex >= cubeStore.solution.length - 1) return;

    const nextIndex = cubeStore.currentStepIndex + 1;
    cubeStore.setCurrentStepIndex(nextIndex);
    cubeStore.setCurrentMove(cubeStore.solution[nextIndex]);
    await executeMove(cubeStore.solution[nextIndex]);
    cubeStore.setCurrentMove(null);
  };

  // 执行上一步（反向）
  const prevStep = async () => {
    if (cubeStore.isRotating || cubeStore.isPlaying) return;
    if (cubeStore.currentStepIndex < 0) return;

    const move = cubeStore.solution[cubeStore.currentStepIndex];
    // 反转移动
    let reverseMove = move;
    if (move.includes("'")) {
      reverseMove = move.replace("'", "");
    } else if (!move.includes("2")) {
      reverseMove = move + "'";
    }

    cubeStore.setCurrentMove(reverseMove);
    await executeMove(reverseMove);
    cubeStore.setCurrentStepIndex(cubeStore.currentStepIndex - 1);
    cubeStore.setCurrentMove(null);
  };

  // 重置到初始状态
  const resetToStart = async () => {
    if (cubeStore.isRotating || cubeStore.isPlaying) return;

    // 反向执行所有已执行的步骤
    while (cubeStore.currentStepIndex >= 0) {
      await prevStep();
    }
  };

  // 根据扫描的颜色初始化魔方
  const initCubeFromColors = (
    faceColors: { color: string; position: { x: number; y: number } }[][]
  ) => {
    // 清除现有cubelets
    cubelets.forEach((cubelet) => rubiksCube.remove(cubelet));
    cubelets = [];

    // 按位置排序每个面的颜色
    const sortSquares = (
      squares: { color: string; position: { x: number; y: number } }[]
    ) => {
      return [...squares].sort((a, b) => {
        const rowDiff = a.position.y - b.position.y;
        if (Math.abs(rowDiff) > 10) return rowDiff;
        return a.position.x - b.position.x;
      });
    };

    // 保存每个面的目标颜色（中心块颜色，index 4）
    const faceNames = ["U", "R", "F", "D", "L", "B"];
    faceColors.forEach((face, index) => {
      const sorted = sortSquares(face);
      faceTargetColors[faceNames[index]] = sorted[4].color;
    });

    // 转换颜色数据格式
    const faceColorsData: string[][] = faceColors.map((face) => {
      const sorted = sortSquares(face);
      return sorted.map((square) => square.color);
    });

    // 创建新的cubelets
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const position: [number, number, number] = [
            x * (CUBE_SIZE + GAP),
            y * (CUBE_SIZE + GAP),
            z * (CUBE_SIZE + GAP),
          ];
          const cubelet = createCubelet(position, faceColorsData);
          cubelets.push(cubelet);
          rubiksCube.add(cubelet);
        }
      }
    }

    cubeStore.setCubeInitialized(true);
  };

  // 重置魔方到已还原状态（使用目标颜色）
  const resetCube = () => {
    cubelets.forEach((cubelet) => rubiksCube.remove(cubelet));
    cubelets = [];

    // 重置目标颜色为默认标准配色
    faceTargetColors = {
      U: "WHITE",
      R: "RED",
      F: "GREEN",
      D: "YELLOW",
      L: "ORANGE",
      B: "BLUE",
    };

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const position: [number, number, number] = [
            x * (CUBE_SIZE + GAP),
            y * (CUBE_SIZE + GAP),
            z * (CUBE_SIZE + GAP),
          ];
          const cubelet = createCubelet(position);
          cubelets.push(cubelet);
          rubiksCube.add(cubelet);
        }
      }
    }

    cubeStore.setCubeInitialized(false);
    cubeStore.resetSolution();
  };

  const handleKeyPress = (event: KeyboardEvent) => {
    if (cubeStore.isRotating || cubeStore.isPlaying) return;

    // 顺时针为负角度，Shift 为逆时针（正角度）
    const angle = event.shiftKey ? Math.PI / 2 : -Math.PI / 2;
    switch (event.key.toUpperCase()) {
      case "F":
        rotateFace("F", angle);
        break;
      case "B":
        rotateFace("B", angle);
        break;
      case "R":
        rotateFace("R", angle);
        break;
      case "L":
        rotateFace("L", angle);
        break;
      case "U":
        rotateFace("U", angle);
        break;
      case "D":
        rotateFace("D", angle);
        break;
    }
  };

  const initScene = () => {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    const width = container.value?.clientWidth || 600;
    const height = container.value?.clientHeight || 500;

    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.value?.appendChild(renderer.domElement);

    // Lighting - 增强亮度，确保白色不偏灰
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 10, 10);
    scene.add(directionalLight);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight2.position.set(-10, 5, -10);
    scene.add(directionalLight2);

    const directionalLight3 = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight3.position.set(0, 10, 0);
    scene.add(directionalLight3);

    // Camera position
    camera.position.set(4, 4, 5);
    camera.lookAt(0, 0, 0);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Create Rubik's Cube
    rubiksCube = new THREE.Group();

    // 创建默认已还原的魔方
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const position: [number, number, number] = [
            x * (CUBE_SIZE + GAP),
            y * (CUBE_SIZE + GAP),
            z * (CUBE_SIZE + GAP),
          ];
          const cubelet = createCubelet(position);
          cubelets.push(cubelet);
          rubiksCube.add(cubelet);
        }
      }
    }

    scene.add(rubiksCube);
  };

  // 创建带文字的面纹理
  const createTextTexture = (text: string, bgColor: string): THREE.Texture => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;

    // 背景色
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 128, 128);

    // 边框
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 124, 124);

    // 文字
    ctx.fillStyle =
      bgColor === "#ffffff" || bgColor === "#ffff00" ? "#333" : "#fff";
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  };

  // 初始化迷你方块场景
  const initMiniScene = () => {
    miniScene = new THREE.Scene();
    miniScene.background = new THREE.Color(0xfafafa);

    // 使用正交相机，固定视角
    miniCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);

    miniRenderer = new THREE.WebGLRenderer({ antialias: true });
    miniRenderer.setSize(80, 80);
    miniRenderer.setPixelRatio(window.devicePixelRatio);
    miniContainer.value?.appendChild(miniRenderer.domElement);

    // 创建单个方块，每个面带标签
    miniCube = new THREE.Group();
    const geometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);

    // 材质顺序: +X(R), -X(L), +Y(U), -Y(D), +Z(F), -Z(B)
    const materials = [
      new THREE.MeshBasicMaterial({ map: createTextTexture("右", "#b90000") }), // R
      new THREE.MeshBasicMaterial({ map: createTextTexture("左", "#ff6600") }), // L
      new THREE.MeshBasicMaterial({ map: createTextTexture("上", "#ffffff") }), // U
      new THREE.MeshBasicMaterial({ map: createTextTexture("下", "#ffff00") }), // D
      new THREE.MeshBasicMaterial({ map: createTextTexture("前", "#00b900") }), // F
      new THREE.MeshBasicMaterial({ map: createTextTexture("后", "#0000b9") }), // B
    ];

    const cube = new THREE.Mesh(geometry, materials);
    miniCube.add(cube);

    miniScene.add(miniCube);
  };

  const animate = () => {
    animationFrameId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);

    // 同步迷你方块 - 让迷你相机与主相机保持相同的相对位置
    if (miniCube && miniCamera && camera) {
      // 获取主相机相对于原点的位置方向
      const cameraPos = camera.position.clone().normalize().multiplyScalar(3);
      miniCamera.position.copy(cameraPos);
      miniCamera.lookAt(0, 0, 0);

      miniRenderer.render(miniScene, miniCamera);
    }
  };

  const handleResize = () => {
    if (container.value && renderer && camera) {
      const width = container.value.clientWidth;
      const height = container.value.clientHeight;

      if (width > 0 && height > 0) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      }
    }
  };

  // 使用 ResizeObserver 监听容器尺寸变化
  const setupResizeObserver = () => {
    if (container.value) {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(container.value);
    }
  };

  // 暴露方法给父组件
  defineExpose({
    initCubeFromColors,
    resetCube,
    playSolution,
    pauseSolution,
    nextStep,
    prevStep,
    resetToStart,
  });

  onMounted(() => {
    initScene();
    initMiniScene();
    animate();
    setupResizeObserver();
    window.addEventListener("keydown", handleKeyPress);
  });

  onBeforeUnmount(() => {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    window.removeEventListener("keydown", handleKeyPress);
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    if (renderer) {
      renderer.dispose();
    }
    if (miniRenderer) {
      miniRenderer.dispose();
    }
  });
</script>

<template>
  <div class="cube-wrapper">
    <div ref="container" class="cube-container"></div>
    <!-- 右上角同步旋转的方向参考方块 -->
    <div class="mini-cube-panel">
      <div ref="miniContainer" class="mini-cube-container"></div>
    </div>
  </div>
</template>

<style scoped>
  .cube-wrapper {
    position: relative;
    width: 100%;
  }

  .cube-container {
    width: 100%;
    height: 500px;
    position: relative;
  }

  .mini-cube-panel {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 10;
  }

  .mini-cube-container {
    width: 80px;
    height: 80px;
    border-radius: 4px;
    overflow: hidden;
  }
</style>
