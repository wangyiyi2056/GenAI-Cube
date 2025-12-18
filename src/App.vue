<script setup lang="ts">
  import CubeSolver from "./components/CubeSolver.vue";
</script>

<template>
  <div class="app-container">
    <CubeSolver />
  </div>
</template>

<style>
  .app-container {
    width: 100%;
    background: #fff;
    height: 100vh;
    box-sizing: border-box;
  }

  .el-tabs {
    background: white;
  }

  .practice-hint {
    position: absolute;
    top: 20px;
    left: 20px;
    background: rgba(255, 255, 255, 0.9);
    padding: 15px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .practice-hint h3 {
    margin: 0 0 10px 0;
    color: #333;
  }

  .practice-hint p {
    margin: 5px 0;
    color: #666;
  }

  .examples-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 20px;
  }

  .examples-list a {
    color: #409eff;
    text-decoration: none;
  }

  .examples-list a:hover {
    text-decoration: underline;
  }
</style>
