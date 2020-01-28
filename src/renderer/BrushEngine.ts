import {
  ToolState,
  UserState
} from './State';

import {
  BrushType,
  BrushControl
} from '../parser';

export class BrushEngine {

  public minBrushSize: number = 1.25;
  // Spacing between two brush stamps, these should be multiplied by brushSize
  public minSpacing = 0.03;
  public maxSpacing = 0.20;
  // Spacing for bristle brush is handled differently
  public bristleSpacing = 0.03;
  public spacingAtAlpha = 2 / 256;

  private getBrushWidth(userState: UserState, pressure: number) {
    const toolState = userState.toolState;
    let size = 0;
    if (toolState.brushControl & BrushControl.BRUSHCONTROL_VARIABLESIZE) {
      size = pressure * toolState.brushRadius;
    } else {
      size = toolState.brushRadius;
    }
    return Math.max(size, this.minBrushSize);
  }

  private getBrushOpacity(userState: UserState, pressure: number) {
    return pressure * 255 * userState.toolState.opacity;
  }

  drawBrush(userState: UserState, x: number, y: number, pressure: number) {
    // const alphaBuffer = userState.alphaBuffer;
    const imageWidth = userState.imageWidth;
    const imageHeight = userState.imageHeight;
    const alphaBuffer = userState.alphaBuffer;
    const dirtyRegion = userState.dirtyRegion;
    const aOpacity = this.getBrushOpacity(userState, pressure);
    const brushWidth = this.getBrushWidth(userState, pressure);
    const halfBrushWidth = brushWidth / 2;

    const xMin = Math.floor(x - halfBrushWidth);
    const yMin = Math.floor(y - halfBrushWidth);
    const xMax = Math.ceil(x + halfBrushWidth);
    const yMax = Math.ceil(y + halfBrushWidth);
    // adjust dirty rect
    dirtyRegion.adjustForPoint(xMin, yMin);
    dirtyRegion.adjustForPoint(xMax, yMax);

    const dstStride = imageWidth;
    
    for (let y = yMin; y <= yMax; y++) {
      // Only run if y is within image bounds
      if (y < 0) continue;
      if (y >= imageWidth) break;
      const dstOffset = y * dstStride;
      for (let x = xMin; x <= xMax; x++) {
        if (x < 0) continue;
        if (x >= imageWidth) break;
        const base = alphaBuffer[dstOffset + x];
        const src = (255 * aOpacity) >> 8;
        if (src > 0) alphaBuffer[dstOffset + x] = Math.max(Math.min(src + base - ((src * base) >> 8), aOpacity ), base);
      }
    }
  }

  drawBrushStroke(userState: UserState, x0: number, y0: number, pressure0: number, x1: number, y1: number, pressure1: number) {
    const toolState = userState.toolState;
    const brushControl = toolState.brushControl;
    const brushType = toolState.brushType;
    const alphaBuffer = userState.alphaBuffer;
    const dirtyRegion = userState.dirtyRegion;
    const minBrushSize = this.minBrushSize;

    let distX = x1 - x0;
    let distY = y1 - y0;
    let distPressure = pressure1 - pressure0;
    let strokeDist = Math.sqrt(distX * distX + distY * distY);
    // Avoid division by 0 later
    if (strokeDist === 0) strokeDist = 0.0001;

    // TODO: handle distance opacity here

    // calc interpolation constants
    let dX = distX / strokeDist;
    let dY = distY / strokeDist;
    let dA = distPressure / strokeDist;

    let spacing = 0;

    if (brushType == BrushType.BRUSHTYPE_BRISTLE) {
      spacing = this.bristleSpacing;
    }
    else if (dA === 0 || brushControl !== BrushControl.BRUSHCONTROL_VARIABLEOPACITY || brushType !== BrushType.BRUSHTYPE_HARD) {
      spacing = this.maxSpacing;
    }
    else {
      // Do this special spacing only for variable opacity with hard brush to avoid banding
      // Decrease spacing if alpha is changing rapidly
      spacing = Math.min(this.maxSpacing, Math.max(Math.abs(this.spacingAtAlpha / minBrushSize / (Math.abs(dA) * toolState.opacity)), this.minSpacing));
    }

    let dSpacing = spacing * this.getBrushWidth(userState, pressure0);
  
    // Distance is too small to interpolate
    if (strokeDist < dSpacing) {
      // TODO: look into force_draw branch in source -- where does force_draw come from? is it useful?
      return false;
    }
    // if (brushControl === BrushControl.BRUSHCONTROL_VARIABLESIZE || brushControl == BrushControl.BRUSHCONTROL_VARIABLESIZEOPACITY) {
    //   while (strokeDist >= dSpacing) {
    //     strokeDist -= dSpacing;
    //   }
    // }
    else {
      dX *= dSpacing;
      dY *= dSpacing;
      dA *= dSpacing;
      while (strokeDist >= dSpacing) {
        pressure0 += dA;
        x0 += dX;
        y0 += dY;
        strokeDist -= dSpacing;
        this.drawBrush(userState, x0, y0, pressure0);
      }
    }
    // console.log(userState.dirtyRegion)

  }

  compositeIntoPixelBuffer(userState: UserState, outputBuffer: Uint8ClampedArray) {
    const imageWidth = userState.imageWidth;
    const imageHeight = userState.imageHeight;
    const alphaBuffer = userState.alphaBuffer;
    const toolState = userState.toolState;
    const dirtyRegion = userState.dirtyRegion;

    dirtyRegion.clampBounds(0, 0, imageWidth, imageHeight);

    let srcStride = imageWidth;
    let dstStride = imageWidth * 4;

    if (toolState.brushControl === BrushControl.BRUSHCONTROL_ERASER) {
      for (let y = dirtyRegion.yMin; y <= dirtyRegion.yMax; y++) {
        let srcOffset = (y * srcStride) + dirtyRegion.xMin;
        let dstOffset = (y * dstStride) + dirtyRegion.xMin * 4;
        for (let x = dirtyRegion.xMin; x <= dirtyRegion.xMax; x++) {
          const brushOpacity = alphaBuffer[srcOffset];
          if (brushOpacity > 0) {
            const currentR = outputBuffer[dstOffset];
            const currentG = outputBuffer[dstOffset + 1];
            const currentB = outputBuffer[dstOffset + 2];
            const currentA = outputBuffer[dstOffset + 3];
            const z = 255 - brushOpacity;
            const dstR = (currentR * z) >> 8;
            const dstG = (currentG * z) >> 8;
            const dstB = (currentB * z) >> 8;
            const dstA = (currentA * z) >> 8;
            outputBuffer[dstOffset] = dstR;
            outputBuffer[dstOffset + 1] = dstG;
            outputBuffer[dstOffset + 2] = dstB;
            outputBuffer[dstOffset + 3] = dstA;
          }
          srcOffset += 1;
          dstOffset += 4;
        }
      }
    } else {
      const [strokeR, strokeG, strokeB] = toolState.color;
      for (let y = dirtyRegion.yMin; y <= dirtyRegion.yMax; y++) {
        let srcOffset = (y * srcStride) + dirtyRegion.xMin;
        let dstOffset = (y * dstStride) + dirtyRegion.xMin * 4;
        for (let x = dirtyRegion.xMin; x <= dirtyRegion.xMax; x++) {
          const brushOpacity = alphaBuffer[srcOffset];
          if (brushOpacity > 0) {
            const currentR = outputBuffer[dstOffset];
            const currentG = outputBuffer[dstOffset + 1];
            const currentB = outputBuffer[dstOffset + 2];
            const currentA = outputBuffer[dstOffset + 3];
            const z = 255 - brushOpacity;
            const dstR = ((brushOpacity * strokeR + brushOpacity) >> 8) + ((z * currentR + z) >> 8);
            const dstG = ((brushOpacity * strokeG + brushOpacity) >> 8) + ((z * currentG + z) >> 8);
            const dstB = ((brushOpacity * strokeB + brushOpacity) >> 8) + ((z * currentB + z) >> 8);
            const dstA =  brushOpacity + ((z * currentA + z) >> 8);
            outputBuffer[dstOffset] = dstR;
            outputBuffer[dstOffset + 1] = dstG;
            outputBuffer[dstOffset + 2] = dstB;
            outputBuffer[dstOffset + 3] = dstA;
          }
  
          srcOffset += 1;
          dstOffset += 4;
        }
      }
    }

    
  }

}