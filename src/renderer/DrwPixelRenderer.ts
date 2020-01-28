
import { DrwLayerBase, DrwRendererBase } from './DrwRendererBase';
import { DrwParser, BrushType, BrushControl } from '../parser';
import { BrushEngine } from './BrushEngine';

class DrwPixelLayer extends DrwLayerBase {

  static numChannels: number = 4;

  public pixels: Uint8ClampedArray;
  public hasChanged: boolean = false;

  setSize(width: number, height: number) {
    this.pixels = new Uint8ClampedArray(width * height * DrwPixelLayer.numChannels);
  }

}

export class DrwPixelRenderer extends DrwRendererBase<DrwPixelLayer> {

  public brushEngine: BrushEngine;
  private activeLayer: DrwPixelLayer;
  private pixels: Uint8ClampedArray;

  private tmpPixelBuffer: Uint8ClampedArray;

  constructor(drw: DrwParser) {
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
      const layer = this.layers[layerIndex];const src = layer.pixels;
      for (let o = 0; o < dst.length; o += 4) {
        const a = src[o + 3] / 255;
        dst[o + 0] = src[o + 0] + (1 - a) * dst[o + 0];
        dst[o + 1] = src[o + 1] + (1 - a) * dst[o + 1];
        dst[o + 2] = src[o + 2] + (1 - a) * dst[o + 2];
        dst[o + 3] = src[o + 3] + (1 - a) * dst[o + 3];
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  protected createLayer() {
    return new DrwPixelLayer();
  }

  public setSize(width: number, height?: number) {
    super.setSize(width, height);
    this.pixels = new Uint8ClampedArray(this.width * this.height * DrwPixelLayer.numChannels);
    this.tmpPixelBuffer = new Uint8ClampedArray(this.width * this.height * DrwPixelLayer.numChannels);
  }

  protected setLayer(layerIndex: number) {
    super.setLayer(layerIndex);
    this.activeLayer = this.layers[layerIndex];
  }

  protected copyLayer(srcLayerIndex: number, dstLayerIndex: number) {
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
      dst[o + 0] = top[o + 0] + (1 - a) * low[o + 0];
      dst[o + 1] = top[o + 1] + (1 - a) * low[o + 1];
      dst[o + 2] = top[o + 2] + (1 - a) * low[o + 2];
      dst[o + 3] = top[o + 3] + (1 - a) * low[o + 3];
    }
    // Mark layer as changed
    this.layers[dstLayerIndex].hasChanged = true;
  }

  protected clearLayer(layerIndex: number) {
    const layer = this.layers[layerIndex]
    layer.pixels.fill(0);
    layer.hasChanged = true;
  }

  protected resetLayer(layerIndex: number) {
    this.clearLayer(layerIndex);
  }

  protected updateBrush() {}

  protected flip(flipX: boolean, flipY: boolean) {
    const activeLayer = this.activeLayer;


    TODO: this should flip all the pixels in every layer

    // Copy layer pixels to temp buffer
    this.tmpPixelBuffer.set(activeLayer.pixels);
    for (let y = 0; y <= this.height; y++) {

    }
  }

  protected beginStroke(x: number, y: number, pressure: number) {
    this.brushEngine.drawBrush(this.userState, x, y, pressure);
  }

  protected strokeTo(x: number, y: number, pressure: number) {
    const toolState = this.toolState;
    this.brushEngine.drawBrushStroke(this.userState, toolState.lastX, toolState.lastY, toolState.lastPressure, x, y, pressure);
  }

  protected finalizeStroke() {
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