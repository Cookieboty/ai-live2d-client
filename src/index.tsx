import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const container = document.getElementById('root');
if (!container) throw new Error('找不到root元素');
const root = createRoot(container);
root.render(<App />); 