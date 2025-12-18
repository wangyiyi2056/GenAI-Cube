export interface ColorSquare {
  color: string;
  position: { x: number; y: number };
}

export class ImageProcessor {
  static async processImage(imageData: string): Promise<ColorSquare[]> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const squares = this.detectSquares(ctx, canvas.width, canvas.height);
        resolve(squares);
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = imageData;
    });
  }

  private static detectSquares(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): ColorSquare[] {
    const squares: ColorSquare[] = [];
    const gridSize = 3;
    const cellWidth = width / gridSize;
    const cellHeight = height / gridSize;

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const x = col * cellWidth + cellWidth / 2;
        const y = row * cellHeight + cellHeight / 2;

        // 采样中心区域的多个像素取平均值，提高准确性
        const sampleSize = Math.min(cellWidth, cellHeight) * 0.3;
        const avgColor = this.sampleAreaColor(ctx, x, y, sampleSize);
        const color = this.classifyColor(avgColor);

        console.log(
          `Grid [${row},${col}]: RGB(${avgColor.join(",")}) -> ${color}`
        );

        squares.push({
          color,
          position: { x, y },
        });
      }
    }

    return squares;
  }

  private static sampleAreaColor(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    size: number
  ): number[] {
    const halfSize = Math.floor(size / 2);
    const startX = Math.max(0, Math.floor(centerX - halfSize));
    const startY = Math.max(0, Math.floor(centerY - halfSize));
    const sampleWidth = Math.floor(size);
    const sampleHeight = Math.floor(size);

    const imageData = ctx.getImageData(
      startX,
      startY,
      sampleWidth,
      sampleHeight
    );
    const data = imageData.data;

    let totalR = 0,
      totalG = 0,
      totalB = 0;
    const pixelCount = sampleWidth * sampleHeight;

    for (let i = 0; i < data.length; i += 4) {
      totalR += data[i];
      totalG += data[i + 1];
      totalB += data[i + 2];
    }

    return [
      Math.round(totalR / pixelCount),
      Math.round(totalG / pixelCount),
      Math.round(totalB / pixelCount),
    ];
  }

  /**
   * 使用 HSL 颜色空间进行颜色分类
   * 这比 RGB 欧几里得距离更准确，特别是对于区分红色和橙色
   */
  private static classifyColor(rgb: number[]): string {
    const [r, g, b] = rgb;
    const { h, s, l } = this.rgbToHsl(r, g, b);

    console.log(`HSL: h=${h.toFixed(1)}, s=${s.toFixed(2)}, l=${l.toFixed(2)}`);

    // 白色：低饱和度，高亮度
    if (s < 0.2 && l > 0.7) {
      return "WHITE";
    }

    // 黑色/灰色：低饱和度，低亮度（不应该出现在魔方上）
    if (s < 0.2 && l < 0.3) {
      return "WHITE"; // 默认为白色
    }

    // 黄色：色相在 40-70 之间
    if (h >= 40 && h <= 70) {
      return "YELLOW";
    }

    // 橙色：色相在 15-40 之间
    if (h >= 15 && h < 40) {
      return "ORANGE";
    }

    // 红色：色相在 0-15 或 340-360 之间
    if (h < 15 || h >= 340) {
      return "RED";
    }

    // 绿色：色相在 80-160 之间
    if (h >= 80 && h <= 160) {
      return "GREEN";
    }

    // 蓝色：色相在 180-260 之间
    if (h >= 180 && h <= 260) {
      return "BLUE";
    }

    // 青色可能被识别为蓝色或绿色
    if (h > 160 && h < 180) {
      return "GREEN";
    }

    // 紫色可能被识别为蓝色
    if (h > 260 && h < 340) {
      return "BLUE";
    }

    // 默认返回最接近的颜色（使用 RGB 距离作为后备）
    return this.getClosestColorByRgb(rgb);
  }

  private static rgbToHsl(
    r: number,
    g: number,
    b: number
  ): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;

    let h = 0;
    let s = 0;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
          break;
        case g:
          h = ((b - r) / d + 2) * 60;
          break;
        case b:
          h = ((r - g) / d + 4) * 60;
          break;
      }
    }

    return { h, s, l };
  }

  private static getClosestColorByRgb(pixel: number[]): string {
    const COLORS: Record<string, number[]> = {
      WHITE: [255, 255, 255],
      YELLOW: [255, 255, 0],
      RED: [255, 0, 0],
      ORANGE: [255, 165, 0],
      GREEN: [0, 255, 0],
      BLUE: [0, 0, 255],
    };

    let minDistance = Infinity;
    let closestColor = "WHITE";

    Object.entries(COLORS).forEach(([color, rgb]) => {
      const distance = Math.sqrt(
        Math.pow(pixel[0] - rgb[0], 2) +
          Math.pow(pixel[1] - rgb[1], 2) +
          Math.pow(pixel[2] - rgb[2], 2)
      );

      if (distance < minDistance) {
        minDistance = distance;
        closestColor = color;
      }
    });

    return closestColor;
  }
}
