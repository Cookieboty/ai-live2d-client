/* global UtSystem, document */
import { L2DBaseModel, Live2DFramework, L2DEyeBlink, L2DMotionManager } from './Live2DFramework';
import ModelSettingJson from './utils/ModelSettingJson';
import LAppDefine from './LAppDefine';
import MatrixStack from './utils/MatrixStack';
import logger from '@/utils/logger';

// 声明全局变量
declare const UtSystem: {
  getUserTimeMSec(): number;
};

//============================================================
//============================================================
//  class LAppModel     extends L2DBaseModel
//============================================================
//============================================================
class LAppModel extends L2DBaseModel {
  modelHomeDir: string = '';
  modelSetting: ModelSettingJson | null = null;
  tmpMatrix: number[] = [];

  constructor() {
    super();
  }

  loadJSON(callback: () => void): void {
    if (!this.modelSetting) return;

    const path = this.modelHomeDir + this.modelSetting.getModelFile();

    this.loadModelData(path, () => {
      for (let i = 0; i < this.modelSetting!.getTextureNum(); i++) {
        const texPaths =
          this.modelHomeDir + this.modelSetting!.getTextureFile(i);

        this.loadTexture(i, texPaths, () => {
          if (this.isTexLoaded) {
            if (this.modelSetting!.getExpressionNum() > 0) {
              this.expressions = {};

              for (
                let j = 0;
                j < this.modelSetting!.getExpressionNum();
                j++
              ) {
                const expName = this.modelSetting!.getExpressionName(j);
                if (!expName) continue;

                const expFilePath =
                  this.modelHomeDir +
                  this.modelSetting!.getExpressionFile(j);

                this.loadExpression(expName, expFilePath);
              }
            } else {
              this.expressionManager = new L2DMotionManager();
              this.expressions = {};
            }

            if (this.eyeBlink == null) {
              this.eyeBlink = new L2DEyeBlink();
            }

            if (this.modelSetting!.getPhysicsFile() != null) {
              this.loadPhysics(
                this.modelHomeDir + this.modelSetting!.getPhysicsFile()!,
              );
            } else {
              this.physics = null;
            }

            if (this.modelSetting!.getPoseFile() != null) {
              this.loadPose(
                this.modelHomeDir + this.modelSetting!.getPoseFile()!,
                () => {
                  if (this.pose) {
                    this.pose.updateParam(this.live2DModel);
                  }
                },
              );
            } else {
              this.pose = null;
            }

            if (this.modelSetting!.getLayout() != null) {
              const layout = this.modelSetting!.getLayout();
              if (layout['width'] != null && this.modelMatrix)
                this.modelMatrix.setWidth(layout['width']);
              if (layout['height'] != null && this.modelMatrix)
                this.modelMatrix.setHeight(layout['height']);

              if (layout['x'] != null && this.modelMatrix) this.modelMatrix.setX(layout['x']);
              if (layout['y'] != null && this.modelMatrix) this.modelMatrix.setY(layout['y']);
              if (layout['center_x'] != null && this.modelMatrix)
                this.modelMatrix.centerX(layout['center_x']);
              if (layout['center_y'] != null && this.modelMatrix)
                this.modelMatrix.centerY(layout['center_y']);
              if (layout['top'] != null && this.modelMatrix)
                this.modelMatrix.top(layout['top']);
              if (layout['bottom'] != null && this.modelMatrix)
                this.modelMatrix.bottom(layout['bottom']);
              if (layout['left'] != null && this.modelMatrix)
                this.modelMatrix.left(layout['left']);
              if (layout['right'] != null && this.modelMatrix)
                this.modelMatrix.right(layout['right']);
            }

            for (let j = 0; j < this.modelSetting!.getInitParamNum(); j++) {
              const paramId = this.modelSetting!.getInitParamID(j);
              if (paramId) {
                const value = this.modelSetting!.getInitParamValue(j);
                this.live2DModel.setParamFloat(paramId, value);
              }
            }

            for (
              let j = 0;
              j < this.modelSetting!.getInitPartsVisibleNum();
              j++
            ) {
              const visibleId = this.modelSetting!.getInitPartsVisibleID(j);
              if (visibleId) {
                const value = this.modelSetting!.getInitPartsVisibleValue(j);
                this.live2DModel.setPartsOpacity(visibleId, value);
              }
            }

            this.live2DModel.saveParam();

            this.preloadMotionGroup(LAppDefine.MOTION_GROUP_IDLE);
            this.mainMotionManager.stopAllMotions();

            // 隐藏背景部件，确保透明背景
            this.hideBackgroundParts();

            this.setUpdating(false);
            this.setInitialized(true);

            if (typeof callback === 'function') callback();
          }
        });
      }
    });
  }

  async loadModelSetting(modelSettingPath: string, modelSetting: any): Promise<void> {
    this.setUpdating(true);
    this.setInitialized(false);

    this.modelHomeDir = modelSettingPath.substring(
      0,
      modelSettingPath.lastIndexOf('/') + 1,
    );

    this.modelSetting = new ModelSettingJson();

    // 移除背景字段，防止加载背景图片导致阴影
    if (modelSetting && modelSetting.background) {
      console.log('检测到模型配置中的背景字段，已移除以确保透明背景:', modelSetting.background);
      delete modelSetting.background;
    }

    this.modelSetting.json = modelSetting;
    await new Promise<void>(resolve => this.loadJSON(resolve));
  }

  load(gl: WebGLRenderingContext, modelSettingPath: string, callback: () => void): void {
    this.setUpdating(true);
    this.setInitialized(false);

    this.modelHomeDir = modelSettingPath.substring(
      0,
      modelSettingPath.lastIndexOf('/') + 1,
    );

    this.modelSetting = new ModelSettingJson();

    this.modelSetting.loadModelSetting(modelSettingPath, () => {
      this.loadJSON(callback);
    });
  }

  release(gl: WebGLRenderingContext): void {
    // 获取平台管理器
    const pm = Live2DFramework.getPlatformManager();

    // 删除纹理
    if (pm && gl && (pm as any).texture) {
      gl.deleteTexture((pm as any).texture);
    }
  }

  preloadMotionGroup(name: string): void {
    if (!this.modelSetting) return;

    for (let i = 0; i < this.modelSetting.getMotionNum(name); i++) {
      const file = this.modelSetting.getMotionFile(name, i);
      if (!file) continue;

      this.loadMotion(file, this.modelHomeDir + file, motion => {
        if (!motion) return;

        motion.setFadeIn(this.modelSetting!.getMotionFadeIn(name, i));
        motion.setFadeOut(this.modelSetting!.getMotionFadeOut(name, i));
      });
    }
  }

  update(): void {
    if (this.live2DModel == null) {
      logger.error('Failed to update.');
      return;
    }

    const timeMSec = UtSystem.getUserTimeMSec() - (this.startTimeMSec || 0);
    const timeSec = timeMSec / 1000.0;
    const t = timeSec * 2 * Math.PI;

    if (this.mainMotionManager.isFinished()) {
      this.startRandomMotion(
        LAppDefine.MOTION_GROUP_IDLE,
        LAppDefine.PRIORITY_IDLE,
      );
    }

    //-----------------------------------------------------------------

    this.live2DModel.loadParam();

    const update = this.mainMotionManager.updateParam(this.live2DModel);
    if (!update) {
      if (this.eyeBlink != null) {
        this.eyeBlink.updateParam(this.live2DModel);
      }
    }

    this.live2DModel.saveParam();

    //-----------------------------------------------------------------

    if (
      this.expressionManager != null &&
      this.expressions != null &&
      !this.expressionManager.isFinished()
    ) {
      this.expressionManager.updateParam(this.live2DModel);
    }

    this.live2DModel.addToParamFloat('PARAM_ANGLE_X', this.dragX * 30, 1);
    this.live2DModel.addToParamFloat('PARAM_ANGLE_Y', this.dragY * 30, 1);
    this.live2DModel.addToParamFloat(
      'PARAM_ANGLE_Z',
      this.dragX * this.dragY * -30,
      1,
    );

    this.live2DModel.addToParamFloat('PARAM_BODY_ANGLE_X', this.dragX * 10, 1);

    this.live2DModel.addToParamFloat('PARAM_EYE_BALL_X', this.dragX, 1);
    this.live2DModel.addToParamFloat('PARAM_EYE_BALL_Y', this.dragY, 1);

    this.live2DModel.addToParamFloat(
      'PARAM_ANGLE_X',
      Number(15 * Math.sin(t / 6.5345)),
      0.5,
    );
    this.live2DModel.addToParamFloat(
      'PARAM_ANGLE_Y',
      Number(8 * Math.sin(t / 3.5345)),
      0.5,
    );
    this.live2DModel.addToParamFloat(
      'PARAM_ANGLE_Z',
      Number(10 * Math.sin(t / 5.5345)),
      0.5,
    );
    this.live2DModel.addToParamFloat(
      'PARAM_BODY_ANGLE_X',
      Number(4 * Math.sin(t / 15.5345)),
      0.5,
    );
    this.live2DModel.setParamFloat(
      'PARAM_BREATH',
      Number(0.5 + 0.5 * Math.sin(t / 3.2345)),
      1,
    );

    if (this.physics != null) {
      this.physics.updateParam(this.live2DModel);
    }

    if (this.lipSync == null) {
      this.live2DModel.setParamFloat('PARAM_MOUTH_OPEN_Y', this.lipSyncValue);
    }

    if (this.pose != null) {
      this.pose.updateParam(this.live2DModel);
    }

    // 确保背景部件始终隐藏
    this.hideBackgroundParts();

    this.live2DModel.update();

    // 在每次更新后强制隐藏背景部件，防止动作文件激活背景
    this.hideBackgroundParts();
  }

  setRandomExpression(): void {
    const tmp: string[] = [];
    for (const name in this.expressions) {
      tmp.push(name);
    }

    const no = parseInt(String(Math.random() * tmp.length));

    this.setExpression(tmp[no]);
  }

  startRandomMotion(name: string, priority: number): void {
    if (!this.modelSetting) return;

    // 如果指定的motion group不存在，尝试查找第一个可用的motion group
    let motionGroup = name;
    if (this.modelSetting.getMotionNum(name) === 0) {
      // 尝试查找第一个可用的motion group
      const availableGroups = this.getAvailableMotionGroups();
      if (availableGroups.length > 0) {
        motionGroup = availableGroups[0];
        logger.trace(`Motion group '${name}' not found, using '${motionGroup}' instead`);
      } else {
        logger.warn(`No motion groups available for model`);
        return;
      }
    }

    const max = this.modelSetting.getMotionNum(motionGroup);
    const no = parseInt(String(Math.random() * max));
    this.startMotion(motionGroup, no, priority);
  }

  // 新增方法：获取模型可用的motion groups
  getAvailableMotionGroups(): string[] {
    if (!this.modelSetting || !this.modelSetting.json.motions) {
      return [];
    }

    const groups: string[] = [];
    for (const groupName in this.modelSetting.json.motions) {
      if (this.modelSetting.getMotionNum(groupName) > 0) {
        groups.push(groupName);
      }
    }

    return groups;
  }

  startMotion(name: string, no: number, priority: number): void {
    if (!this.modelSetting) return;

    const motionName = this.modelSetting.getMotionFile(name, no);

    if (motionName == null || motionName == '') {
      logger.error('Failed to motion.');
      return;
    }

    if (priority == LAppDefine.PRIORITY_FORCE) {
      this.mainMotionManager.setReservePriority(priority);
    } else if (!this.mainMotionManager.reserveMotion(priority)) {
      logger.trace('Motion is running.');
      return;
    }

    let motion: any;

    if (this.motions[name] == null) {
      this.loadMotion(null, this.modelHomeDir + motionName, mtn => {
        motion = mtn;

        // 在动作加载完成后，隐藏背景部件
        this.hideBackgroundParts();

        this.setFadeInFadeOut(name, no, priority, motion);
      });
    } else {
      motion = this.motions[name];

      // 在动作开始前，隐藏背景部件
      this.hideBackgroundParts();

      this.setFadeInFadeOut(name, no, priority, motion);
    }
  }

  /**
   * 隐藏模型的背景部件
   */
  private hideBackgroundParts(): void {
    if (!this.live2DModel) return;

    // 隐藏常见的背景部件
    const backgroundParts = [
      'PARTS_01_BACKGROUND',
      'PARTS_BACKGROUND',
      'BACKGROUND',
      'BG'
    ];

    backgroundParts.forEach(partId => {
      try {
        // 强制设置背景部件为完全不可见
        this.live2DModel.setPartsOpacity(partId, 0);

        // 使用setParamFloat方法强制设置背景可见性参数为0
        try {
          this.live2DModel.setParamFloat(`VISIBLE:${partId}`, 0);
        } catch (e) {
          // 忽略参数不存在的错误
        }

        // 尝试直接设置部件可见性参数（不带VISIBLE前缀）
        try {
          this.live2DModel.setParamFloat(partId, 0);
        } catch (e) {
          // 忽略参数不存在的错误
        }

        logger.trace(`已强制隐藏背景部件: ${partId}`);
      } catch (error) {
        // 如果部件不存在，忽略错误
      }
    });

    // 强制更新模型以应用参数变化
    try {
      this.live2DModel.update();
    } catch (e) {
      // 忽略更新错误
    }
  }

  setFadeInFadeOut(name: string, no: number, priority: number, motion: any): void {
    if (!this.modelSetting) return;

    const motionName = this.modelSetting.getMotionFile(name, no);
    if (!motionName) return;

    motion.setFadeIn(this.modelSetting.getMotionFadeIn(name, no));
    motion.setFadeOut(this.modelSetting.getMotionFadeOut(name, no));

    logger.trace('Start motion : ' + motionName);

    // 在动作开始前强制隐藏背景部件
    this.hideBackgroundParts();

    if (this.modelSetting.getMotionSound(name, no) == null) {
      this.mainMotionManager.startMotionPrio(motion, priority);
    } else {
      const soundName = this.modelSetting.getMotionSound(name, no);
      // var player = new Sound(this.modelHomeDir + soundName);

      const snd = document.createElement('audio');
      snd.src = this.modelHomeDir + soundName;

      logger.trace('Start sound : ' + soundName);

      snd.play();
      this.mainMotionManager.startMotionPrio(motion, priority);
    }

    // 在动作开始后再次确保背景部件隐藏
    setTimeout(() => {
      this.hideBackgroundParts();
    }, 50);
  }

  setExpression(name: string): void {
    const motion = this.expressions[name];

    logger.trace('Expression : ' + name);

    this.expressionManager.startMotion(motion, false);
  }

  draw(gl: WebGLRenderingContext): void {
    MatrixStack.push();

    if (this.modelMatrix) {
      MatrixStack.multMatrix(this.modelMatrix.getArray());
    }

    this.tmpMatrix = MatrixStack.getMatrix();
    this.live2DModel.setMatrix(this.tmpMatrix);
    this.live2DModel.draw();

    MatrixStack.pop();
  }

  hitTest(id: string, testX: number, testY: number): boolean {
    if (!this.modelSetting) return false;

    const len = this.modelSetting.getHitAreaNum();
    for (let i = 0; i < len; i++) {
      if (id == this.modelSetting.getHitAreaName(i)) {
        const drawID = this.modelSetting.getHitAreaID(i);
        if (!drawID) continue;

        return this.hitTestSimple(drawID, testX, testY);
      }
    }

    return false;
  }
}

export default LAppModel; 