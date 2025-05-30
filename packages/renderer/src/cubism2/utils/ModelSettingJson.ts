import { Live2DFramework } from '../Live2DFramework';

interface ModelJson {
  [key: string]: any;
}

class ModelSettingJson {
  private readonly NAME: string = 'name';
  private readonly ID: string = 'id';
  private readonly MODEL: string = 'model';
  private readonly TEXTURES: string = 'textures';
  private readonly HIT_AREAS: string = 'hit_areas';
  private readonly PHYSICS: string = 'physics';
  private readonly POSE: string = 'pose';
  private readonly EXPRESSIONS: string = 'expressions';
  private readonly MOTION_GROUPS: string = 'motions';
  private readonly SOUND: string = 'sound';
  private readonly FADE_IN: string = 'fade_in';
  private readonly FADE_OUT: string = 'fade_out';
  private readonly LAYOUT: string = 'layout';
  private readonly INIT_PARAM: string = 'init_param';
  private readonly INIT_PARTS_VISIBLE: string = 'init_parts_visible';
  private readonly VALUE: string = 'val';
  private readonly FILE: string = 'file';
  private readonly BACKGROUND: string = 'background';

  public json: ModelJson = {};

  loadModelSetting(path: string, callback: () => void): void {
    const pm = Live2DFramework.getPlatformManager();
    if (!pm) return;

    pm.loadBytes(path, (buf: ArrayBuffer) => {
      const str = String.fromCharCode.apply(null, new Uint8Array(buf) as any);
      this.json = JSON.parse(str);

      // 移除背景字段，防止加载背景图片导致阴影
      if (this.json[this.BACKGROUND]) {
        delete this.json[this.BACKGROUND];
      }

      callback();
    });
  }

  getTextureFile(n: number): string | null {
    if (this.json[this.TEXTURES] == null || this.json[this.TEXTURES][n] == null)
      return null;

    return this.json[this.TEXTURES][n];
  }

  getModelFile(): string {
    return this.json[this.MODEL];
  }

  getTextureNum(): number {
    if (this.json[this.TEXTURES] == null) return 0;

    return this.json[this.TEXTURES].length;
  }

  getHitAreaNum(): number {
    if (this.json[this.HIT_AREAS] == null) return 0;

    return this.json[this.HIT_AREAS].length;
  }

  getHitAreaID(n: number): string | null {
    if (
      this.json[this.HIT_AREAS] == null ||
      this.json[this.HIT_AREAS][n] == null
    )
      return null;

    return this.json[this.HIT_AREAS][n][this.ID];
  }

  getHitAreaName(n: number): string | null {
    if (
      this.json[this.HIT_AREAS] == null ||
      this.json[this.HIT_AREAS][n] == null
    )
      return null;

    return this.json[this.HIT_AREAS][n][this.NAME];
  }

  getPhysicsFile(): string | null {
    return this.json[this.PHYSICS];
  }

  getPoseFile(): string | null {
    return this.json[this.POSE];
  }

  getExpressionNum(): number {
    return this.json[this.EXPRESSIONS] == null
      ? 0
      : this.json[this.EXPRESSIONS].length;
  }

  getExpressionFile(n: number): string | null {
    if (this.json[this.EXPRESSIONS] == null) return null;
    return this.json[this.EXPRESSIONS][n][this.FILE];
  }

  getExpressionName(n: number): string | null {
    if (this.json[this.EXPRESSIONS] == null) return null;
    return this.json[this.EXPRESSIONS][n][this.NAME];
  }

  getLayout(): any {
    return this.json[this.LAYOUT];
  }

  getInitParamNum(): number {
    return this.json[this.INIT_PARAM] == null
      ? 0
      : this.json[this.INIT_PARAM].length;
  }

  getMotionNum(name: string): number {
    if (
      this.json[this.MOTION_GROUPS] == null ||
      this.json[this.MOTION_GROUPS][name] == null
    )
      return 0;

    return this.json[this.MOTION_GROUPS][name].length;
  }

  getMotionFile(name: string, n: number): string | null {
    if (
      this.json[this.MOTION_GROUPS] == null ||
      this.json[this.MOTION_GROUPS][name] == null ||
      this.json[this.MOTION_GROUPS][name][n] == null
    )
      return null;

    return this.json[this.MOTION_GROUPS][name][n][this.FILE];
  }

  getMotionSound(name: string, n: number): string | null {
    if (
      this.json[this.MOTION_GROUPS] == null ||
      this.json[this.MOTION_GROUPS][name] == null ||
      this.json[this.MOTION_GROUPS][name][n] == null ||
      this.json[this.MOTION_GROUPS][name][n][this.SOUND] == null
    )
      return null;

    return this.json[this.MOTION_GROUPS][name][n][this.SOUND];
  }

  getMotionFadeIn(name: string, n: number): number {
    if (
      this.json[this.MOTION_GROUPS] == null ||
      this.json[this.MOTION_GROUPS][name] == null ||
      this.json[this.MOTION_GROUPS][name][n] == null ||
      this.json[this.MOTION_GROUPS][name][n][this.FADE_IN] == null
    )
      return 1000;

    return this.json[this.MOTION_GROUPS][name][n][this.FADE_IN];
  }

  getMotionFadeOut(name: string, n: number): number {
    if (
      this.json[this.MOTION_GROUPS] == null ||
      this.json[this.MOTION_GROUPS][name] == null ||
      this.json[this.MOTION_GROUPS][name][n] == null ||
      this.json[this.MOTION_GROUPS][name][n][this.FADE_OUT] == null
    )
      return 1000;

    return this.json[this.MOTION_GROUPS][name][n][this.FADE_OUT];
  }

  getInitParamID(n: number): string | null {
    if (
      this.json[this.INIT_PARAM] == null ||
      this.json[this.INIT_PARAM][n] == null
    )
      return null;

    return this.json[this.INIT_PARAM][n][this.ID];
  }

  getInitParamValue(n: number): number {
    if (
      this.json[this.INIT_PARAM] == null ||
      this.json[this.INIT_PARAM][n] == null
    )
      return NaN;

    return this.json[this.INIT_PARAM][n][this.VALUE];
  }

  getInitPartsVisibleNum(): number {
    return this.json[this.INIT_PARTS_VISIBLE] == null
      ? 0
      : this.json[this.INIT_PARTS_VISIBLE].length;
  }

  getInitPartsVisibleID(n: number): string | null {
    if (
      this.json[this.INIT_PARTS_VISIBLE] == null ||
      this.json[this.INIT_PARTS_VISIBLE][n] == null
    )
      return null;
    return this.json[this.INIT_PARTS_VISIBLE][n][this.ID];
  }

  getInitPartsVisibleValue(n: number): number {
    if (
      this.json[this.INIT_PARTS_VISIBLE] == null ||
      this.json[this.INIT_PARTS_VISIBLE][n] == null
    )
      return NaN;

    return this.json[this.INIT_PARTS_VISIBLE][n][this.VALUE];
  }
}

export default ModelSettingJson; 