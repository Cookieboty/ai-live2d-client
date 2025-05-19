import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // 可在此添加与主进程通信的方法
});  