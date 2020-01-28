
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

  constructor(drw: DrwParser) {
    super(drw);
    this.brushEngine = new BrushEngine();
  }

  public blitTo(ctx: CanvasRenderingContext2D) {
    // Canvas background is always white
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, this.width, this.height);
    const img = ctx.getImageData(0, 0, this.width, this.height);
    const pixels = img.data;
    const layerPixels = this.pixels;
    console.log(layerPixels)
    for (let o = 0; o < pixels.length; o++) {
      pixels[o] = layerPixels[o];
    }
    ctx.putImageData(img, 0, 0);
  }

  protected createLayer() {
    return new DrwPixelLayer();
  }

  public setSize(width: number, height?: number) {
    super.setSize(width, height);
    this.pixels = new Uint8ClampedArray(this.width * this.height * DrwPixelLayer.numChannels);
  }

  protected setLayer(layerIndex: number) {
    super.setLayer(layerIndex);
    // this.activeLayer = this.layers[layerIndex];
    // TODO implement layers
    this.activeLayer = this.layers[0];
  }

  protected copyLayer() {}

  protected clearLayer() {}

  protected resetLayer() {}

  protected updateBrush() {}

  protected flip() {}

  protected beginStroke(x: number, y: number, pressure: number) {
    this.brushEngine.drawBrush(this.userState, x, y, pressure);
  }

  protected strokeTo(x: number, y: number, pressure: number) {
    const toolState = this.toolState;
    this.brushEngine.drawBrushStroke(this.userState, toolState.lastX, toolState.lastY, toolState.lastPressure, x, y, pressure);
  }

  protected finalizeStroke() {
    const dirtyRegion = this.userState.dirtyRegion;
    if (dirtyRegion.hasChanged) {
      this.brushEngine.compositeIntoPixelBuffer(this.userState, this.pixels);
      this.activeLayer.hasChanged = true;
      // clear alpha buffer
      this.userState.alphaBuffer.fill(0);
      dirtyRegion.reset();
    }
  }

}