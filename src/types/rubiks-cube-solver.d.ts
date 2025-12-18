declare module "rubiks-cube-solver" {
  function solve(
    cubeState: string,
    options?: { partitioned?: boolean }
  ): string;
  export default solve;
}
