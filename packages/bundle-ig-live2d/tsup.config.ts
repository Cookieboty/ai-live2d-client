import { createTsup } from '../../tsup.base';

export default createTsup({
  preset: 'react-lib',
  entry: ['src/index.ts', 'src/seams/index.ts'],
  external: ['@deepseek-ai/dsh', '@ig-live/bundle-ig-base', '@ig-live/bundle-ig-electron-caps'],
});
