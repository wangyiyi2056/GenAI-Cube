declare module "cubejs" {
  class Cube {
    static initSolver(): void;
    static fromString(state: string): Cube;
    solve(): string;
    asString(): string;
  }
  export default Cube;
}
