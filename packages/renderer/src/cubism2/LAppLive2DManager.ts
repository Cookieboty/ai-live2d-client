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

    // 清理WebGL状态，确保背景透明
    this.clearWebGLState(gl);

    const oldModel = this.model;
    const newModel = new LAppModel();

    await newModel.loadModelSetting(modelSettingPath, modelSetting);
    if (oldModel) {
      oldModel.release(gl);
    }
    this.model = newModel;
    this.reloading = false;

    // 再次确保背景透明
    this.resetWebGLBackground(gl);

    // 关键修复：在模型切换完成后强制清除背景色，防止残留
    // 这是根据Live2D社区论坛的解决方案
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
  }

  /**
   * 清理WebGL状态
   */
  private clearWebGLState(gl: WebGLRenderingContext): void {
    // 设置透明背景色
    gl.clearColor(0.0, 0.0, 0.0, 0.0);

    // 多次清除所有缓冲区，确保彻底清理
    for (let i = 0; i < 15; i++) {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
      if (i < 8) {
        gl.flush();
        gl.finish();
      }
    }

    // 删除所有纹理对象，防止纹理残留
    const maxTextureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
    for (let i = 0; i < maxTextureUnits; i++) {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
    }

    // 重置所有WebGL状态到默认值
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);

    // 重置混合状态 - 确保正确的alpha混合
    gl.disable(gl.BLEND);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.blendEquation(gl.FUNC_ADD);

    // 重置深度测试和模板测试
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.disable(gl.STENCIL_TEST);

    // 重置视口
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // 强制清除Canvas的背景色
    const canvas = gl.canvas as HTMLCanvasElement;
    if (canvas) {
      canvas.style.background = 'transparent';
      canvas.style.backgroundColor = 'transparent';
    }

    // 最后再次清除缓冲区 - 增加清除次数
    for (let i = 0; i < 10; i++) {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
      gl.flush();
      gl.finish();
    }

    // 关键修复：在清理完成后强制设置背景色，防止残留
    // 这是根据Live2D社区论坛的解决方案
    gl.clearColor(0.0, 0.0, 0.0, 0.0);

    logger.trace('WebGL状态已彻底清理，背景已重置为透明');
  }

  /**
   * 重置WebGL背景
   */
  private resetWebGLBackground(gl: WebGLRenderingContext): void {
    // 确保背景色为完全透明
    gl.clearColor(0.0, 0.0, 0.0, 0.0);

    // 多次清除缓冲区以确保彻底清理
    for (let i = 0; i < 15; i++) {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
      if (i < 8) {
        gl.flush();
        gl.finish();
      }
    }

    // 重置像素存储参数
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);

    // 强制设置Canvas元素的背景为透明
    const canvas = gl.canvas as HTMLCanvasElement;
    if (canvas) {
      canvas.style.background = 'transparent';
      canvas.style.backgroundColor = 'transparent';
    }

    // 再次设置透明背景并清除
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    for (let i = 0; i < 8; i++) {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
      gl.flush();
      gl.finish();
    }

    // 关键修复：在重置完成后强制设置背景色，防止残留
    // 这是根据Live2D社区论坛的解决方案
    gl.clearColor(0.0, 0.0, 0.0, 0.0);

    logger.trace('WebGL背景已彻底重置为透明');
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