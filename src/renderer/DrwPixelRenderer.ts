
import { DrwLayerBase, DrwRendererBase } from './DrwRendererBase';
import { DrwParser, BrushType, BrushControl } from '../parser';
import { BrushEngine } from './BrushEngine';

class DrwPixelLayer extends DrwLayerBase {

  static elementSize: number = 4;

  public pixels: Uint8ClampedArray;
  public hasChanged: boolean = false;

  setSize(width: number, height: number) {
    
    this.pixels = new Uint8ClampedArray(width * height * DrwPixelLayer.elementSize);
  }

}

export class DrwPixelRenderer extends DrwRendererBase<DrwPixelLayer> {

  public brushEngine: BrushEngine;
  private activeLayer: DrwPixelLayer;
  private pixels: Uint8ClampedArray;

  private tmpPixelBuffer: Uint8ClampedArray;

  constructor(drw?: DrwParser) {
    super(drw);
    this.brushEngine = new BrushEngine();
  }

  public blitTo(ctx: CanvasRenderingContext2D) {
    // Canvas background is always white
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, this.width, this.height);
    const img = ctx.getImageData(0, 0, this.width, this.height);
    const dst = img.data;
    // const layerPixels = this.activeLayer.pixels;
    for (let layerIndex = 4; layerIndex >= 0; layerIndex--) {
      const layer = this.layers[layerIndex];
      const src = layer.pixels;
      for (let o = 0; o < dst.length; o += 4) {
        const a = src[o + 3] / 255; // src alpha
        dst[o + 0] = src[o + 0] + (1 - a) * dst[o + 0]; // r
        dst[o + 1] = src[o + 1] + (1 - a) * dst[o + 1]; // g
        dst[o + 2] = src[o + 2] + (1 - a) * dst[o + 2]; // b
        dst[o + 3] = src[o + 3] + (1 - a) * dst[o + 3]; // a
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  public createLayer() {
    return new DrwPixelLayer();
  }

  public setSize(width: number, height?: number) {
    super.setSize(width, height);
    this.tmpPixelBuffer = new Uint8ClampedArray(this.width * this.height * DrwPixelLayer.elementSize);
  }

  public setLayer(layerIndex: number) {
    super.setLayer(layerIndex);
    this.activeLayer = this.layers[layerIndex];
  }

  public copyLayer(srcLayerIndex: number, dstLayerIndex: number) {
    const isSrcLower = srcLayerIndex > dstLayerIndex; // (higher layer index value = lower layer)
    const dstLayer = this.layers[dstLayerIndex];
    const srcLayer = this.layers[srcLayerIndex];
    const topLayer = isSrcLower ? dstLayer : srcLayer;
    const lowLayer = isSrcLower ? srcLayer : dstLayer;
    const dst = dstLayer.pixels;
    const top = topLayer.pixels;
    const low = lowLayer.pixels;
    for (let o = 0; o < dst.length; o += 4) {
      const a = top[o + 3] / 255;
      dst[o + 0] = top[o + 0] + (1 - a) * low[o + 0]; // r
      dst[o + 1] = top[o + 1] + (1 - a) * low[o + 1]; // g
      dst[o + 2] = top[o + 2] + (1 - a) * low[o + 2]; // b
      dst[o + 3] = top[o + 3] + (1 - a) * low[o + 3]; // a
    }
    // Mark layer as changed
    this.layers[dstLayerIndex].hasChanged = true;
  }

  public clearLayer(layerIndex: number) {
    const layer = this.layers[layerIndex];
    layer.pixels.fill(0);
    layer.hasChanged = true;
  }

  public resetLayer(layerIndex: number) {
    this.clearLayer(layerIndex);
  }

  public updateBrush() {}

  public flip(flipX: boolean, flipY: boolean) {
    // TODO: find ways to speed this up.... it's super slow
    // ideas:
    //        https://codereview.stackexchange.com/questions/29618/image-flip-algorithm-in-c
    this.layers.forEach(layer => {
      // Copy layer pixels to temp buffer
      this.tmpPixelBuffer.set(layer.pixels);
      if (flipX)
      {
        for (let y = 0; y < this.height; y++)
        {
          for (let srcX = 0, dstX = this.width - 1; srcX < this.width; srcX++, dstX--)
          {
            const srcPtr = (y * this.width + srcX) * 4;
            const dstPtr = (y * this.width + dstX) * 4;
            layer.pixels[dstPtr] = this.tmpPixelBuffer[srcPtr];
            layer.pixels[dstPtr + 1] = this.tmpPixelBuffer[srcPtr + 1];
            layer.pixels[dstPtr + 2] = this.tmpPixelBuffer[srcPtr + 2];
            layer.pixels[dstPtr + 3] = this.tmpPixelBuffer[srcPtr + 3];
          }
        }
      }
      else if (flipY)
      {
        for (let srcY = 0, dstY = this.height - 1; srcY < this.height; srcY++, dstY--)
        {
          for (let x = 0; x < this.width; x++)
          {
            const srcPtr = (srcY * this.width + x) * 4;
            const dstPtr = (dstY * this.width + x) * 4;
            layer.pixels[dstPtr] = this.tmpPixelBuffer[srcPtr];
            layer.pixels[dstPtr + 1] = this.tmpPixelBuffer[srcPtr + 1];
            layer.pixels[dstPtr + 2] = this.tmpPixelBuffer[srcPtr + 2];
            layer.pixels[dstPtr + 3] = this.tmpPixelBuffer[srcPtr + 3];
          }
        }
      }
      layer.hasChanged = true;
    });
  }

  public beginStroke(x: number, y: number, pressure: number) {
    const toolState = this.toolState;
    this.brushEngine.drawBrush(this.userState, x, y, pressure);
    toolState.lastPressure = pressure;
    toolState.lastX = x;
    toolState.lastY = y;
  }

  public strokeTo(x: number, y: number, pressure: number) {
    const toolState = this.toolState;
    this.brushEngine.drawBrushStroke(this.userState, toolState.lastX, toolState.lastY, toolState.lastPressure, x, y, pressure);
    toolState.lastPressure = pressure;
    toolState.lastX = x;
    toolState.lastY = y;
  }

  public finalizeStroke() {
    const dirtyRegion = this.userState.dirtyRegion;
    const activeLayer = this.activeLayer;
    if (dirtyRegion.hasChanged) {
      this.brushEngine.compositeIntoPixelBuffer(this.userState, activeLayer.pixels);
      activeLayer.hasChanged = true;
      // clear alpha buffer
      this.userState.alphaBuffer.fill(0);
      dirtyRegion.reset();
    }
  }

}