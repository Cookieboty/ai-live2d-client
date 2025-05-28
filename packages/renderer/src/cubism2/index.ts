/* global document, window, Live2D */
import { L2DMatrix44, L2DTargetPoint, L2DViewMatrix, L2DModelMatrix } from './Live2DFramework';
import LAppDefine from './LAppDefine';
import MatrixStack from './utils/MatrixStack';
import LAppLive2DManager from './LAppLive2DManager';
import logger from '@/utils/logger';
import { AdaptiveConfig, AdaptiveParams, ViewBounds } from '@/types/adaptive';

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
  // 新增自适应相关属性
  private adaptiveConfig: AdaptiveConfig | null = null;
  private lastCanvasSize: { width: number; height: number } | null = null;
  private isAdaptiveMode: boolean = false;

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

    // 模型加载完成后，应用正确的模型矩阵设置
    this.setupModelMatrix();

    this.startDraw();
  }

  /**
   * 设置正确的模型矩阵 - 参考Live2D官方最佳实践
   */
  setupModelMatrix(): void {
    const model = this.live2DMgr.getModel();
    if (!model || !model.live2DModel) {
      return;
    }

    // 获取模型的Canvas尺寸
    const modelCanvasWidth = model.live2DModel.getCanvasWidth();
    const modelCanvasHeight = model.live2DModel.getCanvasHeight();

    if (!this.canvas) return;

    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    logger.info('设置模型矩阵:', {
      modelCanvas: { width: modelCanvasWidth, height: modelCanvasHeight },
      displayCanvas: { width: canvasWidth, height: canvasHeight }
    });

    // 重新创建模型矩阵，使用模型的实际Canvas尺寸
    model.modelMatrix = new L2DModelMatrix(modelCanvasWidth, modelCanvasHeight);

    // 计算合适的缩放比例 - 针对高宽比差异很大的模型优化
    const canvasAspect = canvasWidth / canvasHeight;
    const modelAspect = modelCanvasWidth / modelCanvasHeight;

    logger.info('宽高比计算:', {
      canvasAspect: canvasAspect.toFixed(2),
      modelAspect: modelAspect.toFixed(2)
    });

    let scale: number;

    // 优化缩放逻辑，防止头部截断
    if (modelAspect < canvasAspect) {
      // 模型更高瘦，需要更小的缩放防止截断
      if (modelAspect < 0.5) {
        scale = 1.0; // 极高瘦模型使用更小缩放
      } else if (modelAspect < 0.7) {
        scale = 1.3; // 中等高瘦模型
      } else {
        scale = 1.6; // 轻微高瘦模型
      }
    } else {
      // 模型更宽，以宽度为准
      scale = 2.0;
    }

    // 应用缩放和居中
    if (model.modelMatrix) {
      model.modelMatrix.setWidth(scale);
      model.modelMatrix.setCenterPosition(0.0, 0.0);
    }

    // 对于高瘦模型，调整视图矩阵以扩大垂直视野
    if (modelAspect < 1.0 && this.viewMatrix) {
      const ratio = canvasHeight / canvasWidth;
      const left = LAppDefine.VIEW_LOGICAL_LEFT;
      const right = LAppDefine.VIEW_LOGICAL_RIGHT;

      // 根据模型宽高比动态调整视野扩展
      let verticalExpansion = 1.0;
      if (modelAspect < 0.3) {
        verticalExpansion = 3.0; // 极端高瘦
      } else if (modelAspect < 0.5) {
        verticalExpansion = 2.5; // 很高瘦
      } else if (modelAspect < 0.7) {
        verticalExpansion = 2.0; // 中等高瘦
      } else if (modelAspect < 1.0) {
        verticalExpansion = 1.5; // 轻微高瘦
      }

      const bottom = -ratio * verticalExpansion;
      const top = ratio * verticalExpansion;

      this.viewMatrix.setScreenRect(left, right, bottom, top);
      logger.info('为高瘦模型调整视图矩阵，扩大垂直视野:', {
        modelAspect: modelAspect.toFixed(2),
        verticalExpansion,
        viewBounds: { left, right, bottom, top }
      });
    }

    logger.info('模型矩阵设置完成:', {
      scale: scale.toFixed(2),
      modelAspect: modelAspect.toFixed(2),
      canvasAspect: canvasAspect.toFixed(2)
    });
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

      // 模型加载完成后，强制应用正确的模型矩阵设置
      // 这里需要延迟执行，确保模型完全初始化
      setTimeout(() => {
        this.setupModelMatrix();
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

  // ========== 新增自适应功能方法 ==========

  /**
   * 使用自适应配置初始化模型
   */
  async initWithAdaptive(
    canvasId: string,
    modelSettingPath: string,
    modelSetting: any,
    adaptiveConfig: AdaptiveConfig
  ): Promise<void> {
    this.adaptiveConfig = adaptiveConfig;
    this.isAdaptiveMode = adaptiveConfig.enabled;

    if (this.adaptiveConfig.logAdaptiveChanges) {
      logger.info('使用自适应模式初始化Live2D模型', { adaptiveConfig });
    }

    // 先执行标准初始化
    await this.init(canvasId, modelSettingPath, modelSetting);

    // 如果启用自适应模式，立即应用当前Canvas尺寸的自适应设置
    if (this.isAdaptiveMode && this.canvas) {
      const canvasWidth = this.canvas.width;
      const canvasHeight = this.canvas.height;

      // 假设显示尺寸与Canvas尺寸成比例（可以后续通过updateAdaptiveLayout更新）
      const displayWidth = canvasWidth / (window.devicePixelRatio || 1);
      const displayHeight = canvasHeight / (window.devicePixelRatio || 1);

      this.updateAdaptiveLayout(canvasWidth, canvasHeight, displayWidth, displayHeight);

      if (this.adaptiveConfig.logAdaptiveChanges) {
        logger.info('初始化后立即应用自适应设置', {
          canvasSize: { width: canvasWidth, height: canvasHeight },
          displaySize: { width: displayWidth, height: displayHeight }
        });
      }
    }
  }

  /**
   * 更新自适应配置
   */
  updateAdaptiveConfig(config: Partial<AdaptiveConfig>): void {
    if (this.adaptiveConfig) {
      this.adaptiveConfig = { ...this.adaptiveConfig, ...config };
      this.isAdaptiveMode = this.adaptiveConfig.enabled;

      if (this.adaptiveConfig.logAdaptiveChanges) {
        logger.info('更新自适应配置', { config });
      }
    }
  }

  /**
   * 启用或禁用自适应模式
   */
  setAdaptiveMode(enabled: boolean): void {
    this.isAdaptiveMode = enabled && (this.adaptiveConfig?.enabled ?? false);

    if (this.adaptiveConfig?.logAdaptiveChanges) {
      logger.info('切换自适应模式', { enabled: this.isAdaptiveMode });
    }
  }

  /**
   * 更新自适应布局
   */
  updateAdaptiveLayout(
    canvasWidth: number,
    canvasHeight: number,
    displayWidth: number,
    displayHeight: number
  ): void {
    if (!this.isAdaptiveMode || !this.adaptiveConfig || !this.canvas) {
      return;
    }

    // 检查是否需要更新Canvas尺寸
    if (this.canvas.width !== canvasWidth || this.canvas.height !== canvasHeight) {
      this.canvas.width = canvasWidth;
      this.canvas.height = canvasHeight;

      // 更新设备到屏幕的变换矩阵
      if (this.deviceToScreen) {
        this.deviceToScreen.identity();
        this.deviceToScreen.multTranslate(-canvasWidth / 2.0, -canvasHeight / 2.0);
        this.deviceToScreen.multScale(2 / canvasWidth, -2 / canvasWidth);
      }
    }

    // 计算自适应参数
    const adaptiveParams = this.calculateAdaptiveParams(
      canvasWidth, canvasHeight, displayWidth, displayHeight
    );

    // 应用自适应设置
    this.applyAdaptiveMatrices(adaptiveParams);

    // 记录更新
    this.lastCanvasSize = { width: canvasWidth, height: canvasHeight };

    if (this.adaptiveConfig.logAdaptiveChanges) {
      logger.trace('应用自适应布局', {
        canvasSize: { width: canvasWidth, height: canvasHeight },
        displaySize: { width: displayWidth, height: displayHeight },
        adaptiveParams
      });
    }
  }

  /**
   * 计算自适应参数
   */
  private calculateAdaptiveParams(
    canvasWidth: number,
    canvasHeight: number,
    displayWidth: number,
    displayHeight: number
  ): AdaptiveParams {
    if (!this.adaptiveConfig) {
      throw new Error('自适应配置未设置');
    }

    const canvasAspect = canvasWidth / canvasHeight;
    const displayAspect = displayWidth / displayHeight;

    // 计算视图边界
    const viewBounds = this.calculateViewBounds(displayAspect);

    // 计算模型缩放
    const modelScale = this.calculateModelScale(canvasWidth, canvasHeight, displayWidth, displayHeight);

    // 计算模型位置
    const modelPosition = this.calculateModelPosition(displayAspect);

    return { viewBounds, modelScale, modelPosition };
  }

  /**
 * 计算视图边界
 */
  private calculateViewBounds(aspectRatio: number): ViewBounds {
    const config = this.adaptiveConfig!;

    // 基于原始逻辑，但进行适当扩展
    const left = LAppDefine.VIEW_LOGICAL_LEFT;
    const right = LAppDefine.VIEW_LOGICAL_RIGHT;

    if (aspectRatio > 1) {
      // 横屏：扩展垂直范围以适应宽屏
      const ratio = 1 / aspectRatio;
      return {
        left,
        right,
        bottom: -ratio * config.verticalExpansion,
        top: ratio * config.verticalExpansion
      };
    } else {
      // 竖屏或正方形：保持原始比例
      const ratio = aspectRatio;
      return {
        left,
        right,
        bottom: -ratio,
        top: ratio
      };
    }
  }

  /**
   * 计算模型缩放
   */
  private calculateModelScale(
    canvasWidth: number,
    canvasHeight: number,
    displayWidth: number,
    displayHeight: number
  ): number {
    const config = this.adaptiveConfig!;

    // 基础缩放：确保模型适合显示区域
    let scale = config.baseScale;

    // 根据显示尺寸相对于基准尺寸(250x250)的比例调整
    const displayAspect = displayWidth / displayHeight;
    const sizeScale = Math.min(displayWidth / 250, displayHeight / 250);

    // 应用尺寸缩放因子
    scale *= Math.pow(sizeScale, config.sizeScaleFactor);

    // 根据宽高比进行微调
    if (displayAspect > 1.5) {
      // 超宽屏：适当缩小
      scale *= config.wideScreenScale;
    } else if (displayAspect < 0.7) {
      // 超高屏：适当放大
      scale *= config.tallScreenScale;
    }

    // 限制在合理范围内
    return Math.max(config.minScale, Math.min(config.maxScale, scale));
  }

  /**
   * 计算模型位置
   */
  private calculateModelPosition(aspectRatio: number): { x: number; y: number } {
    const config = this.adaptiveConfig!;
    const rules = config.aspectRatioRules;

    // 根据宽高比应用位置规则
    if (aspectRatio >= rules.ultraWide.threshold) {
      return { x: rules.ultraWide.offsetX, y: rules.ultraWide.offsetY };
    } else if (aspectRatio >= rules.wide.threshold) {
      return { x: rules.wide.offsetX, y: rules.wide.offsetY };
    } else if (aspectRatio >= rules.square.threshold) {
      return { x: rules.square.offsetX, y: rules.square.offsetY };
    } else if (aspectRatio >= rules.tall.threshold) {
      return { x: rules.tall.offsetX, y: rules.tall.offsetY };
    } else {
      return { x: rules.ultraTall.offsetX, y: rules.ultraTall.offsetY };
    }
  }

  /**
 * 应用自适应矩阵设置
 */
  private applyAdaptiveMatrices(params: AdaptiveParams): void {
    if (!this.viewMatrix || !this.projMatrix) {
      logger.warn('视图矩阵或投影矩阵未初始化，无法应用自适应设置');
      return;
    }

    if (this.adaptiveConfig?.logAdaptiveChanges) {
      logger.info('应用自适应矩阵设置:', params);
    }

    // 更新视图矩阵的屏幕范围
    this.viewMatrix.setScreenRect(
      params.viewBounds.left,
      params.viewBounds.right,
      params.viewBounds.bottom,
      params.viewBounds.top
    );

    // 更新投影矩阵（保持原有逻辑）
    if (this.canvas) {
      const width = this.canvas.width;
      const height = this.canvas.height;
      this.projMatrix.identity();
      this.projMatrix.multScale(1, width / height);
    }

    // 更新模型矩阵 - 不要重置，只调整缩放和位置
    const model = this.live2DMgr.getModel();
    if (model && model.modelMatrix) {
      // 设置模型缩放
      model.modelMatrix.setWidth(params.modelScale);

      // 设置模型位置
      model.modelMatrix.setCenterPosition(
        params.modelPosition.x,
        params.modelPosition.y
      );

      if (this.adaptiveConfig?.logAdaptiveChanges) {
        logger.info('模型矩阵已更新:', {
          scale: params.modelScale,
          position: params.modelPosition,
          viewBounds: params.viewBounds
        });
      }
    } else {
      logger.warn('模型或模型矩阵未初始化，无法应用模型变换');
    }
  }

  /**
   * 获取当前自适应状态
   */
  getAdaptiveStatus(): {
    isEnabled: boolean;
    config: AdaptiveConfig | null;
    lastCanvasSize: { width: number; height: number } | null;
  } {
    return {
      isEnabled: this.isAdaptiveMode,
      config: this.adaptiveConfig,
      lastCanvasSize: this.lastCanvasSize
    };
  }

  /**
   * 重置为非自适应模式（恢复原始行为）
   */
  resetToOriginalMode(): void {
    this.isAdaptiveMode = false;

    if (!this.canvas || !this.viewMatrix || !this.projMatrix) return;

    // 恢复原始的视图矩阵设置
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ratio = height / width;

    this.viewMatrix.setScreenRect(
      LAppDefine.VIEW_LOGICAL_LEFT,
      LAppDefine.VIEW_LOGICAL_RIGHT,
      -ratio,
      ratio
    );

    // 恢复原始的投影矩阵
    this.projMatrix.identity();
    this.projMatrix.multScale(1, width / height);

    // 恢复模型矩阵
    const model = this.live2DMgr.getModel();
    if (model && model.modelMatrix) {
      model.modelMatrix.setWidth(2);
      model.modelMatrix.setCenterPosition(0, 0);
    }

    if (this.adaptiveConfig?.logAdaptiveChanges) {
      logger.info('重置为原始模式');
    }
  }

  // ========== 新增Canvas适配模型尺寸功能 ==========

  /**
   * 获取模型的原始Canvas尺寸
   */
  getModelCanvasSize(): { width: number; height: number } | null {
    const model = this.live2DMgr.getModel();
    if (model && model.live2DModel) {
      return {
        width: model.live2DModel.getCanvasWidth(),
        height: model.live2DModel.getCanvasHeight()
      };
    }
    return null;
  }

  /**
   * 根据容器宽度计算适合的Canvas尺寸（保持模型宽高比）
   */
  calculateAdaptiveCanvasSize(containerWidth: number): { width: number; height: number } | null {
    const modelSize = this.getModelCanvasSize();
    if (!modelSize) return null;

    const modelAspect = modelSize.width / modelSize.height;
    const adaptiveWidth = containerWidth;
    const adaptiveHeight = containerWidth / modelAspect;

    return {
      width: Math.floor(adaptiveWidth),
      height: Math.floor(adaptiveHeight)
    };
  }

  /**
   * 应用Canvas自适应尺寸
   */
  applyAdaptiveCanvasSize(containerWidth: number): boolean {
    if (!this.canvas) return false;

    const adaptiveSize = this.calculateAdaptiveCanvasSize(containerWidth);
    if (!adaptiveSize) return false;

    // 更新Canvas尺寸
    this.canvas.width = adaptiveSize.width;
    this.canvas.height = adaptiveSize.height;

    // 重新计算相关矩阵
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ratio = height / width;

    // 更新视图矩阵
    if (this.viewMatrix) {
      this.viewMatrix.setScreenRect(
        LAppDefine.VIEW_LOGICAL_LEFT,
        LAppDefine.VIEW_LOGICAL_RIGHT,
        -ratio,
        ratio
      );
    }

    // 更新投影矩阵
    if (this.projMatrix) {
      this.projMatrix.identity();
      this.projMatrix.multScale(1, width / height);
    }

    // 更新设备到屏幕的变换矩阵
    if (this.deviceToScreen) {
      this.deviceToScreen.identity();
      this.deviceToScreen.multTranslate(-width / 2.0, -height / 2.0);
      this.deviceToScreen.multScale(2 / width, -2 / width);
    }

    logger.info('Canvas尺寸已自适应模型:', {
      modelSize: this.getModelCanvasSize(),
      canvasSize: adaptiveSize,
      containerWidth
    });

    return true;
  }
}

export default Cubism2Model; 