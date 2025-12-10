export interface ColorSquare {
  color: string;
  position: { x: number; y: number };
}

export class ImageProcessor {
  private static readonly COLORS = {
    WHITE: [255, 255, 255],
    YELLOW: [255, 255, 0],
    RED: [255, 0, 0],
    ORANGE: [255, 165, 0],
    GREEN: [0, 255, 0],
    BLUE: [0, 0, 255]
  };

  static async processImage(imageData: string): Promise<ColorSquare[]> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const squares = this.detectSquares(ctx, canvas.width, canvas.height);
        resolve(squares);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageData;
    });
  }

  private static detectSquares(ctx: CanvasRenderingContext2D, width: number, height: number): ColorSquare[] {
    const squares: ColorSquare[] = [];
    const gridSize = 3;
    const cellWidth = width / gridSize;
    const cellHeight = height / gridSize;

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const x = col * cellWidth + cellWidth / 2;
        const y = row * cellHeight + cellHeight / 2;
        
        // Sample color from the center of each grid cell
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        const color = this.getClosestColor([pixel[0], pixel[1], pixel[2]]);
        
        squares.push({
          color,
          position: { x, y }
        });
      }
    }

    return squares;
  }

  private static getClosestColor(pixel: number[]): string {
    let minDistance = Infinity;
    let closestColor = '';

    Object.entries(this.COLORS).forEach(([color, rgb]) => {
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