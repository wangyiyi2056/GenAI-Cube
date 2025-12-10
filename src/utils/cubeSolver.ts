import { randomScrambleForEvent } from 'cubing/scramble';
import type { ColorSquare } from './imageProcessor';

export class CubeSolver {
  private static readonly COLOR_MAPPING = {
    'WHITE': 'U',
    'YELLOW': 'D',
    'RED': 'R',
    'ORANGE': 'L',
    'GREEN': 'F',
    'BLUE': 'B'
  };

  static convertToKociembaNotation(faces: ColorSquare[][]): string {
    if (faces.length !== 6) {
      throw new Error('Incomplete cube state: need all 6 faces');
    }

    // Kociemba expects the following order: U R F D L B
    const orderedFaces = new Array(6).fill('');
    const faceOrder = ['U', 'R', 'F', 'D', 'L', 'B'];

    faces.forEach((face, index) => {
      const sortedSquares = this.sortSquaresByPosition(face);
      const notation = sortedSquares.map(square => 
        this.COLOR_MAPPING[square.color as keyof typeof this.COLOR_MAPPING]
      ).join('');
      
      const centerColor = sortedSquares[4].color;
      const facePosition = faceOrder.indexOf(this.COLOR_MAPPING[centerColor as keyof typeof this.COLOR_MAPPING]);
      orderedFaces[facePosition] = notation;
    });

    return orderedFaces.join('');
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

  static async solve(cubeState: string): Promise<string[]> {
    try {
      // Generate a random scramble and reverse it for now
      // In a real implementation, this would use a proper solving algorithm
      const scramble = await randomScrambleForEvent("333");
      const moves = scramble.toString().split(" ");
      
      // Reverse the moves and invert each move
      return moves.reverse().map(move => {
        if (move.includes("'")) {
          return move.replace("'", "");
        } else if (move.includes("2")) {
          return move;
        } else {
          return move + "'";
        }
      });
    } catch (error) {
      console.error('Solving error:', error);
      throw new Error('Failed to generate solution. Please try again.');
    }
  }
}