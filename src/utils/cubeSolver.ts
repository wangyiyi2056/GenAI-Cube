import Cube from "cubejs";
import type { ColorSquare } from "./imageProcessor";

// 初始化 cubejs 的查找表（首次使用时会自动初始化）
let cubeInitialized = false;

export class CubeSolver {
  /**
   * 将扫描的面颜色转换为 cubejs 格式
   *
   * 输入的 faces 顺序是固定的物理位置: [U, R, F, D, L, B] (上、右、前、下、左、后)
   * 每个面的中心块颜色决定了该面还原后应该是什么颜色
   *
   * cubejs 格式: 54个字符，大写
   * 顺序: U面9格 + R面9格 + F面9格 + D面9格 + L面9格 + B面9格
   * 这与我们的输入顺序完全一致！
   */
  static convertToSolverFormat(faces: ColorSquare[][]): string {
    if (faces.length !== 6) {
      throw new Error("Incomplete cube state: need all 6 faces");
    }

    // 输入和输出顺序都是: U, R, F, D, L, B
    const faceNames = ["U", "R", "F", "D", "L", "B"];

    // 获取每个面的中心块颜色，建立颜色到面的映射
    const colorToFace: Record<string, string> = {};

    faces.forEach((face, index) => {
      const sortedSquares = this.sortSquaresByPosition([...face]);
      const centerColor = sortedSquares[4].color;
      colorToFace[centerColor] = faceNames[index];
    });

    console.log("Color to face mapping:", colorToFace);

    // 验证6个面有6种不同的中心颜色
    if (Object.keys(colorToFace).length !== 6) {
      console.error(
        "Center colors:",
        faces.map((face, i) => {
          const sorted = this.sortSquaresByPosition([...face]);
          return `${faceNames[i]}: ${sorted[4].color}`;
        })
      );
      throw new Error(
        "Invalid cube state: center colors must be unique for each face"
      );
    }

    // 按顺序转换每个面的颜色
    let notation = "";

    faces.forEach((face, faceIndex) => {
      const sortedSquares = this.sortSquaresByPosition([...face]);
      console.log(
        `Face ${faceNames[faceIndex]}:`,
        sortedSquares.map((s) => s.color).join(", ")
      );
      sortedSquares.forEach((square) => {
        const faceName = colorToFace[square.color];
        if (!faceName) {
          throw new Error(
            `Unknown color: ${square.color}. Known colors: ${Object.keys(
              colorToFace
            ).join(", ")}`
          );
        }
        notation += faceName;
      });
    });

    console.log("Generated cube state:", notation);
    console.log("State length:", notation.length);

    // 验证每个面字母出现9次
    const counts: Record<string, number> = {};
    for (const char of notation) {
      counts[char] = (counts[char] || 0) + 1;
    }
    console.log("Face counts:", counts);

    return notation;
  }

  /**
   * 将扫描的面颜色转换为 Kociemba 格式（用于显示）
   */
  static convertToKociembaNotation(faces: ColorSquare[][]): string {
    if (faces.length !== 6) {
      throw new Error("Incomplete cube state: need all 6 faces");
    }

    const faceNames = ["U", "R", "F", "D", "L", "B"];
    const colorToFace: Record<string, string> = {};

    faces.forEach((face, index) => {
      const sortedSquares = this.sortSquaresByPosition([...face]);
      const centerColor = sortedSquares[4].color;
      colorToFace[centerColor] = faceNames[index];
    });

    if (Object.keys(colorToFace).length !== 6) {
      throw new Error(
        "Invalid cube state: center colors must be unique for each face"
      );
    }

    let notation = "";

    faces.forEach((face) => {
      const sortedSquares = this.sortSquaresByPosition([...face]);
      sortedSquares.forEach((square) => {
        const faceName = colorToFace[square.color];
        if (!faceName) {
          throw new Error(`Unknown color: ${square.color}`);
        }
        notation += faceName;
      });
    });

    return notation;
  }

  /**
   * 获取每个面的目标颜色（中心块颜色）
   */
  static getFaceTargetColors(faces: ColorSquare[][]): Record<string, string> {
    const faceNames = ["U", "R", "F", "D", "L", "B"];
    const result: Record<string, string> = {};

    faces.forEach((face, index) => {
      const sortedSquares = this.sortSquaresByPosition([...face]);
      result[faceNames[index]] = sortedSquares[4].color;
    });

    return result;
  }

  private static sortSquaresByPosition(squares: ColorSquare[]): ColorSquare[] {
    return squares.sort((a, b) => {
      const rowDiff = a.position.y - b.position.y;
      if (Math.abs(rowDiff) > 10) {
        return rowDiff;
      }
      return a.position.x - b.position.x;
    });
  }

  /**
   * 使用 Kociemba 两阶段算法求解魔方（更优解，通常 20 步以内）
   * @param cubeState 54字符的魔方状态字符串
   * @returns 解法步骤数组
   */
  static async solve(cubeState: string): Promise<string[]> {
    console.log("Solving cube state:", cubeState);

    // 验证状态字符串
    if (cubeState.length !== 54) {
      throw new Error(
        `Invalid cube state length: ${cubeState.length}, expected 54`
      );
    }

    // 验证每个面有9个贴纸
    const counts: Record<string, number> = {};
    for (const char of cubeState) {
      const upperChar = char.toUpperCase();
      counts[upperChar] = (counts[upperChar] || 0) + 1;
    }
    for (const face of ["U", "R", "F", "D", "L", "B"]) {
      if (counts[face] !== 9) {
        throw new Error(
          `Invalid cube state: face ${face} has ${
            counts[face] || 0
          } stickers, expected 9`
        );
      }
    }

    // 检查是否是已还原状态
    const solved = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";
    if (cubeState.toUpperCase() === solved) {
      return [];
    }

    // 验证状态字符串只包含有效字符
    const validChars = new Set(["U", "R", "F", "D", "L", "B"]);
    for (let i = 0; i < cubeState.length; i++) {
      const char = cubeState[i].toUpperCase();
      if (!validChars.has(char)) {
        throw new Error(
          `Invalid character '${cubeState[i]}' at position ${i} in cube state`
        );
      }
    }

    // 验证中心块是否正确
    // cubejs 格式: U(0-8), R(9-17), F(18-26), D(27-35), L(36-44), B(45-53)
    const centers = [
      { pos: 4, expected: "U" },
      { pos: 13, expected: "R" },
      { pos: 22, expected: "F" },
      { pos: 31, expected: "D" },
      { pos: 40, expected: "L" },
      { pos: 49, expected: "B" },
    ];

    for (const { pos, expected } of centers) {
      if (cubeState[pos].toUpperCase() !== expected) {
        console.error(
          `Center mismatch: position ${pos} should be ${expected}, got ${cubeState[pos]}`
        );
        throw new Error(
          `魔方中心块错误：${expected}面的中心应该是${expected}，但得到了${cubeState[
            pos
          ].toUpperCase()}。\n请检查图片上传顺序是否正确（上-右-前-下-左-后）。`
        );
      }
    }

    try {
      // 初始化 cubejs（只需要一次）
      if (!cubeInitialized) {
        console.log("Initializing cubejs...");
        Cube.initSolver();
        cubeInitialized = true;
        console.log("cubejs initialized");
      }

      console.log("Calling cubejs with:", cubeState.toUpperCase());

      // 创建魔方实例并求解
      const cube = Cube.fromString(cubeState.toUpperCase());
      const solution = cube.solve();

      console.log("Raw solution from cubejs:", solution);

      // 解析解法字符串
      const moves = this.parseSolution(solution);

      console.log("Parsed moves:", moves);
      console.log("Total moves:", moves.length);
      return moves;
    } catch (error) {
      console.error("Solving error:", error);
      console.error("Cube state that failed:", cubeState.toUpperCase());

      throw new Error(
        "无法生成解法。魔方状态可能无效或不可解。\n" +
          "请检查图片是否清晰，颜色是否正确识别。"
      );
    }
  }

  /**
   * 解析解法字符串，转换为标准格式
   *
   * cubejs 返回的格式: "R U R' U'" (标准记号)
   * 支持的记号：
   * - 大写字母 (F, B, L, R, U, D): 单层旋转
   * - ' 后缀: 逆时针
   * - 2 后缀: 180度
   */
  private static parseSolution(solution: string): string[] {
    if (!solution || solution.trim() === "") {
      return [];
    }

    console.log("Parsing solution string:", solution);

    // cubejs 返回标准格式，直接按空格分割
    const moves = solution.split(/\s+/).filter((m) => m.length > 0);

    return moves.map((move) => {
      // 确保格式正确
      const normalized = move.toUpperCase().replace(/[^FBLRUD'2]/g, "");
      console.log(`  "${move}" -> "${normalized}"`);
      return normalized;
    });
  }
}
