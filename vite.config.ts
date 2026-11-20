import { defineConfig } from 'vite';
import changelog from './src/data/changelog.json';

export default defineConfig({
  base: './',
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  plugins: [{
    // 打包時輸出 version.json，讓正在玩的人可以偵測到新版本
    name: 'version-file',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: changelog[0].version }) });
    },
  }],
});
