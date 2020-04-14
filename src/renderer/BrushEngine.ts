import {
  ToolState,
  UserState
} from './State';

import {
  BrushType,
  BrushControl
} from '../parser';

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

type BrushCache = {
  [key in BrushType]: Map<number, Uint8Array>;
}

export class BrushEngine {

  private minBrushSize: number = 1.25;
  // Spacing between two brush stamps, these should be multiplied by brushSize
  private minSpacing = 0.03;
  private maxSpacing = 0.20;
  // Spacing for bristle brush is handled differently
  private bristleSpacing = 0.03;
  private spacingAtAlpha = 2 / 256;

  private brushCache: BrushCache = {
    [BrushType.BRUSHTYPE_HARD]: new Map<number, Uint8Array>(),
    [BrushType.BRUSHTYPE_SOFT]: new Map<number, Uint8Array>(),
    [BrushType.BRUSHTYPE_BRISTLE]: new Map<number, Uint8Array>(),
  };

  private getBrushRadius(userState: UserState, pressure: number) {
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

  private getCachedBrush(brushType: BrushType, width: number) {
    if (this.brushCache[brushType].has(width)) {
      return this.brushCache[brushType].get(width);
    }
    return null;
  }

  drawBrush(userState: UserState, x: number, y: number, pressure: number) {
    // const alphaBuffer = userState.alphaBuffer;
    const imageWidth = userState.imageWidth;
    const imageHeight = userState.imageHeight;
    const alphaBuffer = userState.alphaBuffer;
    const dirtyRegion = userState.dirtyRegion;
    const aOpacity = this.getBrushOpacity(userState, pressure);
    const brushType = userState.toolState.brushType;
    const brushWidth = this.getBrushRadius(userState, pressure) * 2;
    const halfBrushWidth = brushWidth / 2;

    const xMin = Math.floor(x - halfBrushWidth);
    const yMin = Math.floor(y - halfBrushWidth);
    const xMax = Math.ceil(x + halfBrushWidth);
    const yMax = Math.ceil(y + halfBrushWidth);

    let brushPixels;
    const cachedBrush = this.getCachedBrush(brushType, brushWidth);
    if (cachedBrush) {
      brushPixels = cachedBrush;
    } else {
      const w = xMax - xMin;
      const h = yMax - yMin;
      brushPixels = new Uint8Array(w * h);
      const half = w / 2;
      let ptr = 0;
      for (let y = -half; y < half; y++) {
        for (let x = -half; x < half; x++) {
          brushPixels[ptr] = Math.hypot(x, y) < half ? aOpacity : 0;
          ptr += 1;
        }
      }
      this.brushCache[brushType].set(brushWidth, brushPixels);
    }

    // adjust dirty rect
    dirtyRegion.adjustForPoint(xMin, yMin);
    dirtyRegion.adjustForPoint(xMax, yMax);

    const dstStride = imageWidth;
    
    for (let y = yMin, brushCoordY = 0; y < yMax; y++, brushCoordY++) {
      // Only run if y is within image bounds
      if (y < 0) continue;
      if (y >= imageWidth) break;
      const srcOffset = brushCoordY * brushWidth;
      const dstOffset = y * dstStride;
      for (let x = xMin, brushCoordX = 0; x < xMax; x++, brushCoordX++) {
        if (x < 0) continue;
        if (x >= imageWidth) break;
        const src = brushPixels[Math.floor(srcOffset + brushCoordX)];
        const base = alphaBuffer[dstOffset + x];
        if (src > 0) {
          alphaBuffer[dstOffset + x] = Math.max(Math.min(aOpacity + base - ((aOpacity * base) / 256), aOpacity), base);
        }
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

    let dSpacing = spacing * this.getBrushRadius(userState, pressure0);
  
    // Distance is too small to interpolate
    if (strokeDist < dSpacing) {
      // TODO: look into force_draw branch in source -- where does force_draw come from? is it useful?
      return false;
    }
    else if (brushControl === BrushControl.BRUSHCONTROL_VARIABLESIZE || brushControl == BrushControl.BRUSHCONTROL_VARIABLESIZEOPACITY) {
      // while (strokeDist >= dSpacing) {
      //   strokeDist -= dSpacing;
      // }
      return;
    }
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

  compositeIntoPixelBuffer(userState: UserState, outputBuffer: Uint8ClampedArray) 
  {
    const imageWidth = userState.imageWidth;
    const imageHeight = userState.imageHeight;
    const alphaBuffer = userState.alphaBuffer;
    const toolState = userState.toolState;
    const dirtyRegion = userState.dirtyRegion;

    dirtyRegion.clampBounds(0, 0, imageWidth, imageHeight);

    let srcStride = imageWidth;
    let dstStride = imageWidth * 4;

    if (toolState.brushControl === BrushControl.BRUSHCONTROL_ERASER) 
    {
      for (let y = dirtyRegion.yMin; y <= dirtyRegion.yMax; y++) {
        let srcPtr = (y * srcStride) + dirtyRegion.xMin;
        let dstPtr = (y * dstStride) + dirtyRegion.xMin * 4;
        for (let x = dirtyRegion.xMin; x <= dirtyRegion.xMax; x++) {
          const brushOpacity = alphaBuffer[srcPtr];
          if (brushOpacity > 0) {
            const currentR = outputBuffer[dstPtr];
            const currentG = outputBuffer[dstPtr + 1];
            const currentB = outputBuffer[dstPtr + 2];
            const currentA = outputBuffer[dstPtr + 3];
            const z = 255 - brushOpacity;
            const dstR = (currentR * z) / 256;
            const dstG = (currentG * z) / 256;
            const dstB = (currentB * z) / 256;
            const dstA = (currentA * z) / 256;
            outputBuffer[dstPtr] = dstR;
            outputBuffer[dstPtr + 1] = dstG;
            outputBuffer[dstPtr + 2] = dstB;
            outputBuffer[dstPtr + 3] = dstA;
          }
          srcPtr += 1;
          dstPtr += 4;
        }
      }
    }
    else 
    {
      const [strokeR, strokeG, strokeB] = toolState.color;
      for (let y = dirtyRegion.yMin; y <= dirtyRegion.yMax; y++) 
      {
        let srcPtr = (y * srcStride) + dirtyRegion.xMin;
        let dstPtr = (y * dstStride) + dirtyRegion.xMin * 4;
        for (let x = dirtyRegion.xMin; x <= dirtyRegion.xMax; x++) 
        {
          const brushOpacity = alphaBuffer[srcPtr];
          if (brushOpacity > 0) 
          {
            const currentR = outputBuffer[dstPtr];
            const currentG = outputBuffer[dstPtr + 1];
            const currentB = outputBuffer[dstPtr + 2];
            const currentA = outputBuffer[dstPtr + 3];
            const z = 255 - brushOpacity;
            const dstR = ((brushOpacity * strokeR + brushOpacity) + (z * currentR + z)) / 256;
            const dstG = ((brushOpacity * strokeG + brushOpacity) + (z * currentG + z)) / 256;
            const dstB = ((brushOpacity * strokeB + brushOpacity) + (z * currentB + z)) / 256;
            const dstA =  brushOpacity + ((z * currentA + z) / 256);
            outputBuffer[dstPtr] = dstR;
            outputBuffer[dstPtr + 1] = dstG;
            outputBuffer[dstPtr + 2] = dstB;
            outputBuffer[dstPtr + 3] = dstA;
          }
  
          srcPtr += 1;
          dstPtr += 4;
        }
      }
    }

    
  }

}