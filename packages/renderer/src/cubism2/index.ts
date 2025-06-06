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

    // 根据原始项目的视口设置 - 完全按照live2d-widget项目的逻辑
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

    // 投影矩阵设置 - 按照原始项目的方式
    this.projMatrix = new L2DMatrix44();
    this.projMatrix.multScale(1, width / height);

    // 设备到屏幕的变换矩阵 - 按照原始项目的方式
    this.deviceToScreen = new L2DMatrix44();
    this.deviceToScreen.multTranslate(-width / 2.0, -height / 2.0);
    this.deviceToScreen.multScale(2 / width, -2 / width);

    // WebGL上下文初始化 - 按照原始项目的配置
    this.gl = this.canvas.getContext('webgl2', {
      premultipliedAlpha: true,
      preserveDrawingBuffer: true
    }) as WebGLRenderingContext;

    if (!this.gl) {
      // 尝试fallback到webgl1
      this.gl = this.canvas.getContext('webgl', {
        premultipliedAlpha: true,
        preserveDrawingBuffer: true
      }) as WebGLRenderingContext;
    }

    if (!this.gl) {
      logger.error('Failed to create WebGL context.');
      return;
    }

    (Live2D as any).setGL(this.gl);

    // 设置透明背景 - 按照原始项目的方式
    this.gl.clearColor(0.0, 0.0, 0.0, 0.0);

    // 加载模型
    await this.changeModelWithJSON(modelSettingPath, modelSetting);

    this.startDraw();
  }

  /**
   * @deprecated 已废弃，原始项目不需要此方法
   */
  setupModelMatrix(): void {
    // 此方法已废弃，原始项目不需要此功能
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

    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    if (this.projMatrix && this.viewMatrix) {
      MatrixStack.multMatrix(this.projMatrix.getArray());
      MatrixStack.multMatrix(this.viewMatrix.getArray());
    }

    MatrixStack.push();

    const model = this.live2DMgr.getModel();

    if (model == null) {
      MatrixStack.pop();
      return;
    }

    if (model.initialized && !model.updating) {
      model.update();
      model.draw(this.gl);
    }

    MatrixStack.pop();
  }

  async changeModel(modelSettingPath: string): Promise<void> {
    if (this.gl) {
      await this.live2DMgr.changeModel(this.gl, modelSettingPath);
    }
  }

  async changeModelWithJSON(modelSettingPath: string, modelSetting: any): Promise<void> {
    if (this.gl) {
      await this.live2DMgr.changeModelWithJSON(this.gl, modelSettingPath, modelSetting);
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
}

export default Cubism2Model; 