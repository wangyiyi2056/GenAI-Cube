<script setup lang="ts">
  import RubiksCube from "./components/RubiksCube.vue";
  import CubeScanner from "./components/CubeScanner.vue";
  import CubeSolver from "./components/CubeSolver.vue";
</script>

<template>
  <div class="app-container">
    <el-tabs type="border-card">
      <el-tab-pane label="3D Cube">
        <RubiksCube />
      </el-tab-pane>
      <el-tab-pane label="Cube Scanner">
        <CubeScanner />
      </el-tab-pane>
      <el-tab-pane label="Solver">
        <CubeSolver />
      </el-tab-pane>
      <el-tab-pane label="examples">
        <div>
          <a href="https://www.cubing.net/">https://www.cubing.net/</a>
        </div>
        <div>
          <a href="https://rubiks-cube-solver.com/zh/">
            https://rubiks-cube-solver.com/zh/
          </a>
        </div>
        <div>
          <a href="https://rubikscu.be/">https://rubikscu.be/</a>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style>
  .app-container {
    width: 100%;
    min-height: 100vh;
    padding: 20px;
    box-sizing: border-box;
  }

  .el-tabs {
    background: white;
  }
</style>
