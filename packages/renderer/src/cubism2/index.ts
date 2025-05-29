/* global document, window, Live2D */
import { L2DMatrix44, L2DTargetPoint, L2DViewMatrix, L2DModelMatrix } from './Live2DFramework';
import LAppDefine from './LAppDefine';
import MatrixStack from './utils/MatrixStack';
import LAppLive2DManager from './LAppLive2DManager';
import logger from '@/utils/logger';

class Cubism2Model {
  private live2DMgr: LAppLive2DManager;
  private isDrawStart: boolean = false;
  private gl: WebGLRenderingContext | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private dragMgr: L2DTargetPoint | null = null;
  private viewMatrix: L2DViewMatrix | null = null;
  private projMatrix: L2DMatrix44 | null = null;
  private deviceToScreen: L2DMatrix44 | null = null;
  private drag: boolean = false;
  private oldLen: number = 0;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private _boundMouseEvent: (e: MouseEvent) => void;
  private _boundTouchEvent: (e: TouchEvent) => void;
  private _drawFrameId: number | null = null;

  constructor() {
    this.live2DMgr = new LAppLive2DManager();
    this._boundMouseEvent = this.mouseEvent.bind(this);
    this._boundTouchEvent = this.touchEvent.bind(this);
  }

  initL2dCanvas(canvasId: string): void {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;

    if (this.canvas.addEventListener) {
      this.canvas.addEventListener('mousewheel', this._boundMouseEvent as any, false);
      this.canvas.addEventListener('click', this._boundMouseEvent, false);

      this.canvas.addEventListener('mousedown', this._boundMouseEvent, false);
      this.canvas.addEventListener('mousemove', this._boundMouseEvent, false);

      this.canvas.addEventListener('mouseup', this._boundMouseEvent, false);
      this.canvas.addEventListener('mouseout', this._boundMouseEvent, false);
      this.canvas.addEventListener('contextmenu', this._boundMouseEvent, false);

      this.canvas.addEventListener('touchstart', this._boundTouchEvent, false);
      this.canvas.addEventListener('touchend', this._boundTouchEvent, false);
      this.canvas.addEventListener('touchmove', this._boundTouchEvent, false);
    }
  }

  async init(canvasId: string, modelSettingPath: string, modelSetting: any): Promise<void> {
    this.initL2dCanvas(canvasId);
    if (!this.canvas) return;

    const width = this.canvas.width;
    const height = this.canvas.height;

    this.dragMgr = new L2DTargetPoint();

    // 根据Live2D官方文档的最佳实践设置视图矩阵
    // 使用标准的正交投影设置
    const ratio = height / width;
    const left = LAppDefine.VIEW_LOGICAL_LEFT;
    const right = LAppDefine.VIEW_LOGICAL_RIGHT;
    const bottom = -ratio;
    const top = ratio;

    this.viewMatrix = new L2DViewMatrix();
    this.viewMatrix.setScreenRect(left, right, bottom, top);
    this.viewMatrix.setMaxScreenRect(
      LAppDefine.VIEW_LOGICAL_MAX_LEFT,
      LAppDefine.VIEW_LOGICAL_MAX_RIGHT,
      LAppDefine.VIEW_LOGICAL_MAX_BOTTOM,
      LAppDefine.VIEW_LOGICAL_MAX_TOP,
    );
    this.viewMatrix.setMaxScale(LAppDefine.VIEW_MAX_SCALE);
    this.viewMatrix.setMinScale(LAppDefine.VIEW_MIN_SCALE);

    // 设置投影矩阵 - 使用官方推荐的方式
    this.projMatrix = new L2DMatrix44();
    this.projMatrix.multScale(1, width / height);

    // 设备到屏幕的变换矩阵
    this.deviceToScreen = new L2DMatrix44();
    this.deviceToScreen.multTranslate(-width / 2.0, -height / 2.0);
    this.deviceToScreen.multScale(2 / width, -2 / width);

    // 初始化WebGL上下文 - 按照Live2D官方要求配置
    this.gl = this.canvas.getContext('webgl2', {
      alpha: true,                    // 启用alpha通道
      premultipliedAlpha: true,       // Live2D要求启用预乘alpha
      preserveDrawingBuffer: false,   // 禁用缓冲区保留，避免残留
      antialias: true,               // 启用抗锯齿
      depth: true,                   // 启用深度缓冲
      stencil: false                 // 禁用模板缓冲
    }) as WebGLRenderingContext;

    if (!this.gl) {
      // 尝试fallback到webgl1
      this.gl = this.canvas.getContext('webgl', {
        alpha: true,
        premultipliedAlpha: true,      // Live2D要求启用预乘alpha
        preserveDrawingBuffer: false,
        antialias: true,
        depth: true,
        stencil: false
      }) as WebGLRenderingContext;
    }

    if (!this.gl) {
      logger.error('Failed to create WebGL context.');
      return;
    }

    (Live2D as any).setGL(this.gl);

    // 设置透明背景并启用适合预乘alpha的混合模式
    this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
    this.gl.enable(this.gl.BLEND);
    // 使用适合预乘alpha的混合函数
    this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

    // 加载模型
    await this.changeModelWithJSON(modelSettingPath, modelSetting);

    // 模型加载完成后，设置Canvas尺寸（包含模型矩阵设置）
    this.setupCanvasSize(width, height);

    this.startDraw();
  }

  /**
   * @deprecated 已废弃，使用setupCanvasSize代替
   */
  setupModelMatrix(): void {
    // 此方法已废弃，功能已移至setupCanvasSize方法
  }

  destroy(): void {
    // 1. Unbind canvas events
    if (this.canvas) {
      this.canvas.removeEventListener('mousewheel', this._boundMouseEvent as any, false);
      this.canvas.removeEventListener('click', this._boundMouseEvent, false);
      this.canvas.removeEventListener('mousedown', this._boundMouseEvent, false);
      this.canvas.removeEventListener('mousemove', this._boundMouseEvent, false);
      this.canvas.removeEventListener('mouseup', this._boundMouseEvent, false);
      this.canvas.removeEventListener('mouseout', this._boundMouseEvent, false);
      this.canvas.removeEventListener('contextmenu', this._boundMouseEvent, false);

      this.canvas.removeEventListener('touchstart', this._boundTouchEvent, false);
      this.canvas.removeEventListener('touchend', this._boundTouchEvent, false);
      this.canvas.removeEventListener('touchmove', this._boundTouchEvent, false);
    }

    // 2. Stop animation
    if (this._drawFrameId) {
      window.cancelAnimationFrame(this._drawFrameId);
      this._drawFrameId = null;
    }
    this.isDrawStart = false;

    // 3. Release Live2D related resources
    if (this.live2DMgr && typeof this.live2DMgr.release === 'function') {
      if (this.gl) {
        this.live2DMgr.release(this.gl);
      } else {
        this.live2DMgr.release();
      }
    }

    // 4. Clear references to assist GC
    this.canvas = null;
    this.gl = null;
    this.dragMgr = null;
    this.viewMatrix = null;
    this.projMatrix = null;
    this.deviceToScreen = null;
  }

  startDraw(): void {
    if (!this.isDrawStart) {
      this.isDrawStart = true;
      const tick = (): void => {
        this.draw();
        this._drawFrameId = window.requestAnimationFrame(tick);
      };
      tick();
    }
  }

  draw(): void {
    if (!this.gl) return;
    MatrixStack.reset();
    MatrixStack.loadIdentity();

    if (this.dragMgr) {
      this.dragMgr.update();
      this.live2DMgr.setDrag(this.dragMgr.getX(), this.dragMgr.getY());
    }

    // 强制设置Canvas元素背景为透明
    if (this.canvas) {
      this.canvas.style.background = 'transparent';
      this.canvas.style.backgroundColor = 'transparent';
    }

    // 确保每次绘制都有透明背景
    this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT | this.gl.STENCIL_BUFFER_BIT);

    // 强制设置适合预乘alpha的混合模式
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);

    // 转换Float32Array为number[]类型
    if (this.projMatrix && this.viewMatrix) {
      const projArray = this.projMatrix.getArray();
      const viewArray = this.viewMatrix.getArray();

      MatrixStack.multMatrix(projArray);
      MatrixStack.multMatrix(viewArray);
    }

    MatrixStack.push();

    const model = this.live2DMgr.getModel();

    if (model == null) {
      // 即使没有模型也要清除背景
      this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT | this.gl.STENCIL_BUFFER_BIT);
      MatrixStack.pop();
      return;
    }

    if (model.initialized && !model.updating) {
      model.update();
      model.draw(this.gl);
    }

    MatrixStack.pop();

    // 关键修复：在绘制完成后强制清除背景色，防止残留
    // 这是根据Live2D社区论坛的解决方案
    this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
  }

  async changeModel(modelSettingPath: string): Promise<void> {
    if (this.gl) {
      await this.live2DMgr.changeModel(this.gl, modelSettingPath);
    }
  }

  async changeModelWithJSON(modelSettingPath: string, modelSetting: any): Promise<void> {
    if (this.gl) {
      // 重置WebGL背景色，确保新模型有透明背景
      this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);

      await this.live2DMgr.changeModelWithJSON(this.gl, modelSettingPath, modelSetting);

      // 模型加载完成后，重新设置Canvas尺寸以适应新模型
      // 这里需要延迟执行，确保模型完全初始化
      setTimeout(() => {
        if (this.canvas) {
          this.setupCanvasSize(this.canvas.width, this.canvas.height);
        }
      }, 100);
    }
  }

  modelScaling(scale: number): void {
    if (!this.viewMatrix) return;

    const isMaxScale = this.viewMatrix.isMaxScale();
    const isMinScale = this.viewMatrix.isMinScale();

    this.viewMatrix.adjustScale(0, 0, scale);

    if (!isMaxScale) {
      if (this.viewMatrix.isMaxScale()) {
        this.live2DMgr.maxScaleEvent();
      }
    }

    if (!isMinScale) {
      if (this.viewMatrix.isMinScale()) {
        this.live2DMgr.minScaleEvent();
      }
    }
  }

  modelTurnHead(event: MouseEvent | Touch): void {
    if (!this.canvas || !this.dragMgr) return;

    this.drag = true;

    const rect = (event.target as HTMLElement).getBoundingClientRect();

    const sx = this.transformScreenX(event.clientX - rect.left);
    const sy = this.transformScreenY(event.clientY - rect.top);
    const vx = this.transformViewX(event.clientX - rect.left);
    const vy = this.transformViewY(event.clientY - rect.top);

    logger.trace(
      'onMouseDown device( x:' +
      event.clientX +
      ' y:' +
      event.clientY +
      ' ) view( x:' +
      vx +
      ' y:' +
      vy +
      ')',
    );

    this.lastMouseX = sx;
    this.lastMouseY = sy;

    this.dragMgr.setPoint(vx, vy);

    this.live2DMgr.tapEvent(vx, vy);
  }

  followPointer(event: MouseEvent | Touch): void {
    if (!this.canvas || !this.dragMgr) return;

    const rect = (event.target as HTMLElement).getBoundingClientRect();

    const sx = this.transformScreenX(event.clientX - rect.left);
    const sy = this.transformScreenY(event.clientY - rect.top);
    const vx = this.transformViewX(event.clientX - rect.left);
    const vy = this.transformViewY(event.clientY - rect.top);

    logger.trace(
      'onMouseMove device( x:' +
      event.clientX +
      ' y:' +
      event.clientY +
      ' ) view( x:' +
      vx +
      ' y:' +
      vy +
      ')',
    );

    if (this.drag) {
      this.lastMouseX = sx;
      this.lastMouseY = sy;

      this.dragMgr.setPoint(vx, vy);
    }
  }

  lookFront(): void {
    if (this.drag) {
      this.drag = false;
    }

    if (this.dragMgr) {
      this.dragMgr.setPoint(0, 0);
    }
  }

  mouseEvent(e: MouseEvent): void {
    e.preventDefault();

    if (e.type == 'mousewheel') {
      if (
        !this.canvas ||
        e.clientX < 0 ||
        this.canvas.clientWidth < e.clientX ||
        e.clientY < 0 ||
        this.canvas.clientHeight < e.clientY
      ) {
        return;
      }

      if ((e as any).wheelDelta > 0) this.modelScaling(1.1);
      else this.modelScaling(0.9);
    } else if (e.type == 'mousedown') {
      if ('button' in e && e.button != 0) return;

      this.modelTurnHead(e);
    } else if (e.type == 'mousemove') {
      this.followPointer(e);
    } else if (e.type == 'mouseup') {
      if ('button' in e && e.button != 0) return;

      this.lookFront();
    } else if (e.type == 'mouseout') {
      this.lookFront();
    }
  }

  touchEvent(e: TouchEvent): void {
    e.preventDefault();

    const touch = e.touches[0];

    if (e.type == 'touchstart') {
      if (e.touches.length == 1) this.modelTurnHead(touch);
      // onClick(touch);
    } else if (e.type == 'touchmove') {
      this.followPointer(touch);

      if (e.touches.length == 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];

        const len =
          Math.pow(touch1.pageX - touch2.pageX, 2) +
          Math.pow(touch1.pageY - touch2.pageY, 2);
        if (this.oldLen - len < 0) this.modelScaling(1.025);
        else this.modelScaling(0.975);

        this.oldLen = len;
      }
    } else if (e.type == 'touchend') {
      this.lookFront();
    }
  }

  transformViewX(deviceX: number): number {
    if (!this.deviceToScreen || !this.viewMatrix) return 0;
    const screenX = this.deviceToScreen.transformX(deviceX);
    return this.viewMatrix.invertTransformX(screenX);
  }

  transformViewY(deviceY: number): number {
    if (!this.deviceToScreen || !this.viewMatrix) return 0;
    const screenY = this.deviceToScreen.transformY(deviceY);
    return this.viewMatrix.invertTransformY(screenY);
  }

  transformScreenX(deviceX: number): number {
    if (!this.deviceToScreen) return 0;
    return this.deviceToScreen.transformX(deviceX);
  }

  transformScreenY(deviceY: number): number {
    if (!this.deviceToScreen) return 0;
    return this.deviceToScreen.transformY(deviceY);
  }

  /**
   * 设置Canvas尺寸 - 使用Live2D官方默认逻辑
   */
  setupCanvasSize(canvasWidth: number, canvasHeight: number): void {
    if (!this.canvas || !this.gl) return;

    // 设置Canvas的实际尺寸
    this.canvas.width = canvasWidth;
    this.canvas.height = canvasHeight;

    // 设置WebGL视口
    this.gl.viewport(0, 0, canvasWidth, canvasHeight);

    // 重新计算投影矩阵
    if (this.projMatrix) {
      this.projMatrix.identity();
      this.projMatrix.multScale(1, canvasWidth / canvasHeight);
    }

    // 重新计算设备到屏幕的变换矩阵
    if (this.deviceToScreen) {
      this.deviceToScreen.identity();
      this.deviceToScreen.multTranslate(-canvasWidth / 2.0, -canvasHeight / 2.0);
      this.deviceToScreen.multScale(2 / canvasWidth, -2 / canvasWidth);
    }

    // 重新计算视图矩阵的屏幕范围
    if (this.viewMatrix) {
      const ratio = canvasHeight / canvasWidth;
      const left = LAppDefine.VIEW_LOGICAL_LEFT;
      const right = LAppDefine.VIEW_LOGICAL_RIGHT;
      const bottom = -ratio;
      const top = ratio;

      this.viewMatrix.setScreenRect(left, right, bottom, top);
    }
  }
}

export default Cubism2Model; 