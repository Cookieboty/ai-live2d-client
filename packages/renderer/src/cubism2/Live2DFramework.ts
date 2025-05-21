/* global Live2D, Live2DMotion, AMotion, UtSystem, MotionQueueManager, PhysicsHair, UtDebug, PartsDataID */
/**
 *
 *  You can modify and use this source freely
 *  only for the development of application related Live2D.
 *
 *  (c) Live2D Inc. All rights reserved.
 */
import logger from '@/utils/logger';

// 声明全局变量类型
declare const Live2D: any;
declare const Live2DMotion: any;
declare const AMotion: any;
declare const UtSystem: any;
declare const MotionQueueManager: any;
declare const PhysicsHair: any;
declare const UtDebug: any;
declare const PartsDataID: any;

// 声明缺少的类型
declare class L2DPose {
  static load(buf: ArrayBuffer): L2DPose;
  updateParam(model: any): void;
}

declare class L2DPhysics {
  static load(buf: ArrayBuffer): L2DPhysics;
  updateParam(model: any): void;
}

// 定义平台管理器接口
export interface IPlatformManager {
  loadBytes(path: string, callback: (buffer: ArrayBuffer) => void): void;
  loadLive2DModel(path: string, callback: (model: any) => void): void;
  loadTexture(model: any, no: number, path: string, callback?: () => void): void;
  jsonParseFromBytes(buf: ArrayBuffer): any;
}

//============================================================
//============================================================
//  class L2DBaseModel
//============================================================
//============================================================
export class L2DBaseModel {
  live2DModel: any = null; // ALive2DModel
  modelMatrix: L2DModelMatrix | null = null; // L2DModelMatrix
  eyeBlink: L2DEyeBlink | null = null; // L2DEyeBlink
  physics: L2DPhysics | null = null; // L2DPhysics
  pose: L2DPose | null = null; // L2DPose
  initialized: boolean = false;
  updating: boolean = false;
  alpha: number = 1;
  accAlpha: number = 0;
  lipSync: boolean = false;
  lipSyncValue: number = 0;
  accelX: number = 0;
  accelY: number = 0;
  accelZ: number = 0;
  dragX: number = 0;
  dragY: number = 0;
  startTimeMSec: number | null = null;
  mainMotionManager: L2DMotionManager = new L2DMotionManager(); // L2DMotionManager
  expressionManager: L2DMotionManager = new L2DMotionManager(); // L2DMotionManager
  motions: { [key: string]: any } = {};
  expressions: { [key: string]: any } = {};
  isTexLoaded: boolean = false;

  //============================================================
  //    L2DBaseModel # getModelMatrix()
  //============================================================
  getModelMatrix(): L2DModelMatrix | null {
    return this.modelMatrix;
  }

  //============================================================
  //    L2DBaseModel # setAlpha()
  //============================================================
  setAlpha(a: number): void {
    if (a > 0.999) a = 1;
    if (a < 0.001) a = 0;
    this.alpha = a;
  }

  //============================================================
  //    L2DBaseModel # getAlpha()
  //============================================================
  getAlpha(): number {
    return this.alpha;
  }

  //============================================================
  //    L2DBaseModel # isInitialized()
  //============================================================
  isInitialized(): boolean {
    return this.initialized;
  }

  //============================================================
  //    L2DBaseModel # setInitialized()
  //============================================================
  setInitialized(v: boolean): void {
    this.initialized = v;
  }

  //============================================================
  //    L2DBaseModel # isUpdating()
  //============================================================
  isUpdating(): boolean {
    return this.updating;
  }

  //============================================================
  //    L2DBaseModel # setUpdating()
  //============================================================
  setUpdating(v: boolean): void {
    this.updating = v;
  }

  //============================================================
  //    L2DBaseModel # getLive2DModel()
  //============================================================
  getLive2DModel(): any {
    return this.live2DModel;
  }

  //============================================================
  //    L2DBaseModel # setLipSync()
  //============================================================
  setLipSync(v: boolean): void {
    this.lipSync = v;
  }

  //============================================================
  //    L2DBaseModel # setLipSyncValue()
  //============================================================
  setLipSyncValue(v: number): void {
    this.lipSyncValue = v;
  }

  //============================================================
  //    L2DBaseModel # setAccel()
  //============================================================
  setAccel(x: number, y: number, z: number): void {
    this.accelX = x;
    this.accelY = y;
    this.accelZ = z;
  }

  //============================================================
  //    L2DBaseModel # setDrag()
  //============================================================
  setDrag(x: number, y: number): void {
    this.dragX = x;
    this.dragY = y;
  }

  //============================================================
  //    L2DBaseModel # getMainMotionManager()
  //============================================================
  getMainMotionManager(): L2DMotionManager {
    return this.mainMotionManager;
  }

  //============================================================
  //    L2DBaseModel # getExpressionManager()
  //============================================================
  getExpressionManager(): L2DMotionManager {
    return this.expressionManager;
  }

  // 加载模型数据
  loadModelData(path: string, callback: (model: any) => void): void {
    const pm = Live2DFramework.getPlatformManager();
    logger.info('Load model : ' + path);

    if (!pm) return;

    pm.loadLive2DModel(path, (l2dModel) => {
      this.live2DModel = l2dModel;
      this.live2DModel.saveParam();

      const _err = Live2D.getError();

      if (_err != 0) {
        logger.error('Error : Failed to loadModelData().');
        return;
      }

      this.modelMatrix = new L2DModelMatrix(
        this.live2DModel.getCanvasWidth(),
        this.live2DModel.getCanvasHeight(),
      );
      this.modelMatrix.setWidth(2);
      this.modelMatrix.setCenterPosition(0, 0);

      callback(this.live2DModel);
    });
  }

  // 加载纹理
  loadTexture(no: number, path: string, callback: () => void): void {
    texCounter++;

    const pm = Live2DFramework.getPlatformManager();
    if (!pm) return;

    logger.info('Load Texture : ' + path);

    pm.loadTexture(this.live2DModel, no, path, () => {
      texCounter--;
      if (texCounter == 0) this.isTexLoaded = true;
      if (typeof callback == 'function') callback();
    });
  }

  // 加载动作
  loadMotion(name: string | null, path: string, callback: (motion: any) => void): void {
    const pm = Live2DFramework.getPlatformManager();
    if (!pm) return;

    logger.trace('Load Motion : ' + path);

    let motion = null;

    pm.loadBytes(path, (buf) => {
      motion = Live2DMotion.loadMotion(buf);
      if (name != null) {
        this.motions[name] = motion;
      }
      callback(motion);
    });
  }

  // 加载表情
  loadExpression(name: string, path: string, callback?: () => void): void {
    const pm = Live2DFramework.getPlatformManager();
    if (!pm) return;

    logger.trace('Load Expression : ' + path);

    pm.loadBytes(path, (buf) => {
      if (name != null) {
        this.expressions[name] = L2DExpressionMotion.loadJson(buf);
      }
      if (typeof callback == 'function') callback();
    });
  }

  // 加载姿势
  loadPose(path: string, callback: () => void): void {
    const pm = Live2DFramework.getPlatformManager();
    if (!pm) return;

    logger.trace('Load Pose : ' + path);
    try {
      pm.loadBytes(path, (buf) => {
        this.pose = L2DPose.load(buf);
        if (typeof callback == 'function') callback();
      });
    } catch (e) {
      logger.warn(String(e));
    }
  }

  // 加载物理属性
  loadPhysics(path: string): void {
    const pm = Live2DFramework.getPlatformManager();
    if (!pm) return;

    logger.trace('Load Physics : ' + path);
    try {
      pm.loadBytes(path, (buf) => {
        this.physics = L2DPhysics.load(buf);
      });
    } catch (e) {
      logger.warn(String(e));
    }
  }

  // 简单的命中测试
  hitTestSimple(drawID: string, testX: number, testY: number): boolean {
    const drawIndex = this.live2DModel.getDrawDataIndex(drawID);

    if (drawIndex < 0) return false;

    const points = this.live2DModel.getTransformedPoints(drawIndex);
    let left = this.live2DModel.getCanvasWidth();
    let right = 0;
    let top = this.live2DModel.getCanvasHeight();
    let bottom = 0;

    for (let j = 0; j < points.length; j = j + 2) {
      const x = points[j];
      const y = points[j + 1];

      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
    const tx = this.modelMatrix!.invertTransformX(testX);
    const ty = this.modelMatrix!.invertTransformY(testY);

    return left <= tx && tx <= right && top <= ty && ty <= bottom;
  }
}

let texCounter = 0;

// L2DExpressionMotion类型声明
class L2DExpressionMotion extends AMotion {
  paramList: any[] = [];

  static loadJson(buf: ArrayBuffer): L2DExpressionMotion {
    const ret = new L2DExpressionMotion();
    const pm = Live2DFramework.getPlatformManager();
    if (!pm) return ret;

    const json = pm.jsonParseFromBytes(buf);

    // ...加载逻辑简化...

    return ret;
  }

  updateParamExe(model: any, timeMSec: number, weight: number, motionQueueEnt: any): void {
    // ...更新逻辑简化...
  }
}

//============================================================
//============================================================
//  class L2DEyeBlink
//============================================================
//============================================================
export class L2DEyeBlink {
  nextBlinkTime: number | null = null;
  stateStartTime: number | null = null;
  blinkIntervalMsec: number = 4000;
  closingMotionMsec: number = 100;
  closedMotionMsec: number = 50;
  openingMotionMsec: number = 150;
  closeIfZero: boolean = true;
  eyeID_L: string = 'PARAM_EYE_L_OPEN';
  eyeID_R: string = 'PARAM_EYE_R_OPEN';
  eyeState: string = 'STATE_FIRST';

  calcNextBlink(): number {
    const time = UtSystem.getUserTimeMSec();
    const r = Math.random();
    return time + r * (2 * this.blinkIntervalMsec - 1);
  }

  setInterval(blinkIntervalMsec: number): void {
    this.blinkIntervalMsec = blinkIntervalMsec;
  }

  setEyeMotion(
    closingMotionMsec: number,
    closedMotionMsec: number,
    openingMotionMsec: number,
  ): void {
    this.closingMotionMsec = closingMotionMsec;
    this.closedMotionMsec = closedMotionMsec;
    this.openingMotionMsec = openingMotionMsec;
  }

  updateParam(model: any): void {
    // ...更新逻辑简化...
  }
}

//============================================================
//============================================================
//  class L2DMatrix44
//============================================================
//============================================================
export class L2DMatrix44 {
  tr: Float32Array = new Float32Array(16);

  constructor() {
    this.identity();
  }

  static mul(a: Float32Array | number[], b: Float32Array | number[], dst: Float32Array | number[]): void {
    const c: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const n = 4;
    let i, j, k;
    for (i = 0; i < n; i++) {
      for (j = 0; j < n; j++) {
        for (k = 0; k < n; k++) {
          c[i + j * 4] += a[i + k * 4] * b[k + j * 4];
        }
      }
    }
    for (i = 0; i < 16; i++) {
      dst[i] = c[i];
    }
  }

  identity(): void {
    for (let i = 0; i < 16; i++) this.tr[i] = i % 5 == 0 ? 1 : 0;
  }

  getArray(): Float32Array {
    return this.tr;
  }

  getCopyMatrix(): Float32Array {
    return new Float32Array(this.tr);
  }

  setMatrix(tr: Float32Array | number[]): void {
    if (this.tr == null || this.tr.length != this.tr.length) return;
    for (let i = 0; i < 16; i++) this.tr[i] = tr[i];
  }

  getScaleX(): number {
    return this.tr[0];
  }

  getScaleY(): number {
    return this.tr[5];
  }

  transformX(src: number): number {
    return this.tr[0] * src + this.tr[12];
  }

  transformY(src: number): number {
    return this.tr[5] * src + this.tr[13];
  }

  invertTransformX(src: number): number {
    return (src - this.tr[12]) / this.tr[0];
  }

  invertTransformY(src: number): number {
    return (src - this.tr[13]) / this.tr[5];
  }

  multTranslate(shiftX: number, shiftY: number): void {
    const tr1 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, shiftX, shiftY, 0, 1];
    L2DMatrix44.mul(tr1, this.tr, this.tr);
  }

  translate(x: number, y: number): void {
    this.tr[12] = x;
    this.tr[13] = y;
  }

  translateX(x: number): void {
    this.tr[12] = x;
  }

  translateY(y: number): void {
    this.tr[13] = y;
  }

  multScale(scaleX: number, scaleY: number): void {
    const tr1 = [scaleX, 0, 0, 0, 0, scaleY, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    L2DMatrix44.mul(tr1, this.tr, this.tr);
  }

  scale(scaleX: number, scaleY: number): void {
    this.tr[0] = scaleX;
    this.tr[5] = scaleY;
  }
}

//============================================================
//============================================================
//  class L2DModelMatrix       extends     L2DMatrix44
//============================================================
//============================================================
export class L2DModelMatrix extends L2DMatrix44 {
  width: number;
  height: number;

  constructor(w: number, h: number) {
    super();
    this.width = w;
    this.height = h;
  }

  setPosition(x: number, y: number): void {
    this.translate(x, y);
  }

  setCenterPosition(x: number, y: number): void {
    const w = this.width * this.getScaleX();
    const h = this.height * this.getScaleY();
    this.translate(x - w / 2, y - h / 2);
  }

  top(y: number): void {
    this.setY(y);
  }

  bottom(y: number): void {
    const h = this.height * this.getScaleY();
    this.translateY(y - h);
  }

  left(x: number): void {
    this.setX(x);
  }

  right(x: number): void {
    const w = this.width * this.getScaleX();
    this.translateX(x - w);
  }

  centerX(x: number): void {
    const w = this.width * this.getScaleX();
    this.translateX(x - w / 2);
  }

  centerY(y: number): void {
    const h = this.height * this.getScaleY();
    this.translateY(y - h / 2);
  }

  setX(x: number): void {
    this.translateX(x);
  }

  setY(y: number): void {
    this.translateY(y);
  }

  setHeight(h: number): void {
    const scaleX = h / this.height;
    const scaleY = -scaleX;
    this.scale(scaleX, scaleY);
  }

  setWidth(w: number): void {
    const scaleX = w / this.width;
    const scaleY = -scaleX;
    this.scale(scaleX, scaleY);
  }
}

//============================================================
//============================================================
//  class L2DMotionManager     extends     MotionQueueManager
//============================================================
//============================================================
export class L2DMotionManager extends MotionQueueManager {
  currentPriority: number | null = null;
  reservePriority: number | null = null;

  constructor() {
    super();
  }

  getCurrentPriority(): number | null {
    return this.currentPriority;
  }

  getReservePriority(): number | null {
    return this.reservePriority;
  }

  reserveMotion(priority: number): boolean {
    if (this.reservePriority !== null && this.reservePriority >= priority) {
      return false;
    }
    if (this.currentPriority !== null && this.currentPriority >= priority) {
      return false;
    }

    this.reservePriority = priority;

    return true;
  }

  setReservePriority(val: number): void {
    this.reservePriority = val;
  }

  updateParam(model: any): boolean {
    const updated = super.updateParam(model);

    if (this.isFinished()) {
      this.currentPriority = 0;
    }

    return updated;
  }

  startMotionPrio(motion: any, priority: number): any {
    if (priority === this.reservePriority) {
      this.reservePriority = 0;
    }
    this.currentPriority = priority;
    return this.startMotion(motion, false);
  }
}

//============================================================
//============================================================
//  class L2DTargetPoint
//============================================================
//============================================================
export class L2DTargetPoint {
  EPSILON: number = 0.01; // 变化的最小值
  faceTargetX: number = 0;
  faceTargetY: number = 0;
  faceX: number = 0;
  faceY: number = 0;
  faceVX: number = 0;
  faceVY: number = 0;
  lastTimeSec: number = 0;

  setPoint(x: number, y: number): void {
    this.faceTargetX = x;
    this.faceTargetY = y;
  }

  getX(): number {
    return this.faceX;
  }

  getY(): number {
    return this.faceY;
  }

  update(): void {
    // ...更新逻辑简化...
    const curTimeSec = UtSystem.getUserTimeMSec();

    if (this.lastTimeSec == 0) {
      this.lastTimeSec = curTimeSec;
      return;
    }

    const deltaTimeWeight = ((curTimeSec - this.lastTimeSec) * L2DTargetPoint.FRAME_RATE) / 1000.0;
    this.lastTimeSec = curTimeSec;

    // ...复杂计算简化...

    // 根据目标点更新当前位置
    const dx = this.faceTargetX - this.faceX;
    const dy = this.faceTargetY - this.faceY;

    if (Math.abs(dx) <= this.EPSILON && Math.abs(dy) <= this.EPSILON) return;

    // ...后续计算简化...

    // 最终位置更新
    this.faceX += this.faceVX;
    this.faceY += this.faceVY;
  }

  static FRAME_RATE: number = 30;
}

//============================================================
//============================================================
//  class L2DViewMatrix        extends     L2DMatrix44
//============================================================
//============================================================
export class L2DViewMatrix extends L2DMatrix44 {
  screenLeft: number | null = null;
  screenRight: number | null = null;
  screenTop: number | null = null;
  screenBottom: number | null = null;
  maxLeft: number | null = null;
  maxRight: number | null = null;
  maxTop: number | null = null;
  maxBottom: number | null = null;
  max: number = Number.MAX_VALUE;
  min: number = 0;

  getMaxScale(): number {
    return this.max;
  }

  getMinScale(): number {
    return this.min;
  }

  setMaxScale(v: number): void {
    this.max = v;
  }

  setMinScale(v: number): void {
    this.min = v;
  }

  isMaxScale(): boolean {
    return this.getScaleX() == this.max;
  }

  isMinScale(): boolean {
    return this.getScaleX() == this.min;
  }

  adjustTranslate(shiftX: number, shiftY: number): void {
    // ...调整位置逻辑...
  }

  adjustScale(cx: number, cy: number, scale: number): void {
    const targetScale = scale * this.tr[0];
    if (targetScale < this.min) {
      if (this.tr[0] > 0) scale = this.min / this.tr[0];
    } else if (targetScale > this.max) {
      if (this.tr[0] > 0) scale = this.max / this.tr[0];
    }

    const tr1 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, cx, cy, 0, 1];
    const tr2 = [scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const tr3 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -cx, -cy, 0, 1];

    L2DMatrix44.mul(tr3, this.tr, this.tr);
    L2DMatrix44.mul(tr2, this.tr, this.tr);
    L2DMatrix44.mul(tr1, this.tr, this.tr);
  }

  setScreenRect(
    left: number,
    right: number,
    bottom: number,
    top: number,
  ): void {
    this.screenLeft = left;
    this.screenRight = right;
    this.screenTop = top;
    this.screenBottom = bottom;
  }

  setMaxScreenRect(
    left: number,
    right: number,
    bottom: number,
    top: number,
  ): void {
    this.maxLeft = left;
    this.maxRight = right;
    this.maxTop = top;
    this.maxBottom = bottom;
  }

  getScreenLeft(): number | null {
    return this.screenLeft;
  }

  getScreenRight(): number | null {
    return this.screenRight;
  }

  getScreenBottom(): number | null {
    return this.screenBottom;
  }

  getScreenTop(): number | null {
    return this.screenTop;
  }

  getMaxLeft(): number | null {
    return this.maxLeft;
  }

  getMaxRight(): number | null {
    return this.maxRight;
  }

  getMaxBottom(): number | null {
    return this.maxBottom;
  }

  getMaxTop(): number | null {
    return this.maxTop;
  }
}

//============================================================
//============================================================
//  class Live2DFramework
//============================================================
//============================================================
export class Live2DFramework {
  static platformManager: IPlatformManager | null = null;

  static getPlatformManager(): IPlatformManager | null {
    return Live2DFramework.platformManager;
  }

  static setPlatformManager(platformManager: IPlatformManager): void {
    Live2DFramework.platformManager = platformManager;
  }
}

// 导出默认的模块
export default {
  L2DBaseModel,
  L2DEyeBlink,
  L2DMatrix44,
  L2DModelMatrix,
  L2DMotionManager,
  L2DTargetPoint,
  L2DViewMatrix,
  Live2DFramework
}; 