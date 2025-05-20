/* global Live2D */
import { Live2DFramework } from './Live2DFramework';
import LAppModel from './LAppModel';
import PlatformManager from './PlatformManager';
import LAppDefine from './LAppDefine';
import logger from '@/utils/logger';

// 声明Live2D全局对象
declare const Live2D: {
  init(): void;
};

class LAppLive2DManager {
  private model: LAppModel | null = null;
  private reloading: boolean = false;

  constructor() {
    Live2D.init();
    Live2DFramework.setPlatformManager(new PlatformManager());
  }

  getModel(): LAppModel | null {
    return this.model;
  }

  releaseModel(gl: WebGLRenderingContext): void {
    if (this.model) {
      this.model.release(gl);
      this.model = null;
    }
  }

  release(gl?: WebGLRenderingContext): void {
    if (gl) {
      this.releaseModel(gl);
    }
  }

  async changeModel(gl: WebGLRenderingContext, modelSettingPath: string): Promise<void> {
    return new Promise((resolve) => {
      if (this.reloading) return;
      this.reloading = true;

      const oldModel = this.model;
      const newModel = new LAppModel();

      newModel.load(gl, modelSettingPath, () => {
        if (oldModel) {
          oldModel.release(gl);
        }
        this.model = newModel;
        this.reloading = false;
        resolve();
      });
    });
  }

  async changeModelWithJSON(gl: WebGLRenderingContext, modelSettingPath: string, modelSetting: any): Promise<void> {
    if (this.reloading) return;
    this.reloading = true;

    const oldModel = this.model;
    const newModel = new LAppModel();

    await newModel.loadModelSetting(modelSettingPath, modelSetting);
    if (oldModel) {
      oldModel.release(gl);
    }
    this.model = newModel;
    this.reloading = false;
  }

  setDrag(x: number, y: number): void {
    if (this.model) {
      this.model.setDrag(x, y);
    }
  }

  maxScaleEvent(): void {
    logger.trace('Max scale event.');
    if (this.model) {
      this.model.startRandomMotion(
        LAppDefine.MOTION_GROUP_PINCH_IN,
        LAppDefine.PRIORITY_NORMAL,
      );
    }
  }

  minScaleEvent(): void {
    logger.trace('Min scale event.');
    if (this.model) {
      this.model.startRandomMotion(
        LAppDefine.MOTION_GROUP_PINCH_OUT,
        LAppDefine.PRIORITY_NORMAL,
      );
    }
  }

  tapEvent(x: number, y: number): boolean {
    logger.trace('tapEvent view x:' + x + ' y:' + y);

    if (!this.model) return false;

    if (this.model.hitTest(LAppDefine.HIT_AREA_HEAD, x, y)) {
      logger.trace('Tap face.');
      this.model.setRandomExpression();
    } else if (this.model.hitTest(LAppDefine.HIT_AREA_BODY, x, y)) {
      logger.trace('Tap body.');
      this.model.startRandomMotion(
        LAppDefine.MOTION_GROUP_TAP_BODY,
        LAppDefine.PRIORITY_NORMAL,
      );
    }
    return true;
  }
}

export default LAppLive2DManager; 