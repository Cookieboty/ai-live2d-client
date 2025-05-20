/**
 *
 *  You can modify and use this source freely
 *  only for the development of application related Live2D.
 *
 *  (c) Live2D Inc. All rights reserved.
 */

class MatrixStack {
  static matrixStack: number[] = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  static depth: number = 0;
  static currentMatrix: number[] = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  static tmp: number[] = new Array(16);

  static reset(): void {
    this.depth = 0;
  }

  static loadIdentity(): void {
    for (let i = 0; i < 16; i++) {
      this.currentMatrix[i] = i % 5 == 0 ? 1 : 0;
    }
  }

  static push(): void {
    const offset = this.depth * 16;
    const nextOffset = (this.depth + 1) * 16;

    if (this.matrixStack.length < nextOffset + 16) {
      this.matrixStack.length = nextOffset + 16;
    }

    for (let i = 0; i < 16; i++) {
      this.matrixStack[nextOffset + i] = this.currentMatrix[i];
    }

    this.depth++;
  }

  static pop(): void {
    this.depth--;
    if (this.depth < 0) {
      this.depth = 0;
    }

    const offset = this.depth * 16;
    for (let i = 0; i < 16; i++) {
      this.currentMatrix[i] = this.matrixStack[offset + i];
    }
  }

  static getMatrix(): number[] {
    return this.currentMatrix;
  }

  static multMatrix(matNew: number[]): void {
    let i, j, k;

    for (i = 0; i < 16; i++) {
      this.tmp[i] = 0;
    }

    for (i = 0; i < 4; i++) {
      for (j = 0; j < 4; j++) {
        for (k = 0; k < 4; k++) {
          this.tmp[i + j * 4] +=
            this.currentMatrix[i + k * 4] * matNew[k + j * 4];
        }
      }
    }
    for (i = 0; i < 16; i++) {
      this.currentMatrix[i] = this.tmp[i];
    }
  }
}

export default MatrixStack; 