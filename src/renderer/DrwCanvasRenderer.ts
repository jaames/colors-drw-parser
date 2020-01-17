// Extremely naive Colors .drw renderer, using the HTML5 canvas API
// This is good enough for general testing / debugging, but can't (and probably never will) accurately render every painting

import { DrwLayerBase, DrwRendererBase } from './DrwRendererBase';
import { DrwParser, BrushType, BrushControl } from '../parser';

import brushHardTex from '../textures/brush_hard.png';
import brushSoftTex from '../textures/brush_soft.png';
import brushBristleTex from '../textures/brush_bristle.png';

console.log(brushHardTex)

class DrwCanvasRendererLayer extends DrwLayerBase {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public hasChanged: boolean = false;

  constructor () {
    super();
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
  }

  setSize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
  }
}

export class DrwCanvasRenderer extends DrwRendererBase<DrwCanvasRendererLayer> {

  private activeLayer: DrwCanvasRendererLayer;

  private tmpLayer = this.createLayer();

  private brushTextures: HTMLImageElement[];
  private brushCanvas: HTMLCanvasElement;
  private brushCtx: CanvasRenderingContext2D;
  private brushPoints: [number, number][] = [];
  private dirtyRegion = {xMin: 0, yMin: 0, xMax: 0, yMax: 0};
  
  constructor(drw: DrwParser) {
    super(drw);
    this.brushCanvas = document.createElement('canvas');
    this.brushCtx = this.brushCanvas.getContext('2d');
  }

  // Load all the brush textures
  public async prepare() {
    // Fetch an image (for texture loading)
    async function fetchImage(src: string): Promise<HTMLImageElement> {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject();
        image.src = src; 
      });
    }
    return Promise.all([
      fetchImage(brushHardTex),
      fetchImage(brushSoftTex),
      fetchImage(brushBristleTex),
    ])
    .then((brushTextures) => {
      this.brushTextures = brushTextures;
      this.updateBrush();
      return this; // return renderer instance
    })
  }

  // Composite all the painting layers into a single canvas
  // Only needs to be done to produce a final image
  public blitTo(ctx: CanvasRenderingContext2D) {
    // Canvas background is always white?
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, this.width, this.height);
    for (let layerIndex = 4; layerIndex >= 0; layerIndex--) {
      const layer = this.layers[layerIndex];
      if (layer.isVisible) ctx.drawImage(this.layers[layerIndex].canvas, 0, 0);
    }
  }

  public setCanvasWidth(width: number) {
    super.setCanvasWidth(width);
    this.tmpLayer.setSize(this.width, this.height);
  }
  
  protected updateBrush() {
    const state = this.toolState;
    const ctx = this.brushCtx;
    const [r, g, b] = state.color;
    const brushRadius = state.brushRadius;
    const brushSize = Math.max(brushRadius * 2, 1);
    const brushTexture = this.brushTextures[state.brushType];
    // Setting canvas size also clears it
    this.brushCanvas.width = brushSize;
    this.brushCanvas.height = brushSize;
    ctx.drawImage(brushTexture, 0, 0, brushSize, brushSize);
    // Apply color
    // Using source-in means whatever is drawn next uses the alpha channel from the existing canvas content (in this case, our brush texture)
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(0, 0, brushSize, brushSize);
    // Reset to default compositing op
    ctx.globalCompositeOperation = 'source-over';
  }

  protected beginStroke(x: number, y: number, pressure: number) {
    this.brushPoints.push([x, y]);
  }

  protected strokeTo(x: number, y: number, pressure: number) {
    this.brushPoints.push([x, y]);
  }

  protected finalizeStroke() {
    const activeLayer = this.activeLayer;
    const state = this.toolState;
    const dirtyRegion = this.dirtyRegion;
    const brushPoints = this.brushPoints;
    const brushTexture = this.brushCanvas;
    const brushRadius = state.brushRadius;
    // Brush strokes are normally drawn by "stamping" the brush texture (with drawImage()) along the stroke path
    // However, this technique doesn't play nicely with the HTML5 canvas API when the brush size is small,
    // for some reason strokes look smaller than they should be and are rather jaggy
    // For small sizes, we can use the builtin canvas path drawing API, which looks close enough for such small brush sizes
    // Path drawing is also a *lot* quicker, so it's a nice optimization
    const usePathApi = brushRadius < 2;
    // If we're using brush stamping, we wanna use a temp layer to draw the brush stroke to then composite that to the active layer in one go
    // Otherwise we can get away with drawing directly to the active layer
    const ctx = usePathApi ? activeLayer.ctx : this.tmpLayer.ctx;
    // Set up target layer compositing
    if (state.brushControl === BrushControl.BRUSHCONTROL_ERASER) {
      // destination-out: anything drawing to the canvas in this mode will erase content
      activeLayer.ctx.globalCompositeOperation = 'destination-out';
    } else {
      // source-over: default compositing
      activeLayer.ctx.globalCompositeOperation = 'source-over';
    }
    // Using globalAlpha like this means the entire stroke can be drawn to the layer with a consistent alpha value
    // This seems to be consistent with how Color's brushes work (or at least on 3DS?)
    if ((state.brushControl & BrushControl.BRUSHCONTROL_VARIABLEOPACITY) || (state.brushControl & BrushControl.BRUSHCONTROL_VARIABLESIZE)) {
      activeLayer.ctx.globalAlpha = state.pressure * state.opacity;
    } else {
      activeLayer.ctx.globalAlpha = state.opacity;
    }
    // Clear tmp layer if we're going to stamp to it
    if (!usePathApi) {
      this.tmpLayer.ctx.clearRect(0, 0, this.width, this.height);
    }
    // This is where we use the canvas path API to draw small strokes
    if ((usePathApi) && (brushPoints.length > 0)) {
      const [r, g, b] = state.color;
      ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.lineWidth = brushRadius * 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(brushPoints[0][0], brushPoints[0][1]);
      for (let i = 1; i < brushPoints.length - 1; i++) {
        ctx.lineTo(brushPoints[i][0], brushPoints[i][1]);
      }
      ctx.stroke();
    }
    // If there's only one set of brush coords, use a single brush stamp
    else if (brushPoints.length === 1) {
      const [x, y] = brushPoints[0];
      ctx.drawImage(brushTexture, x - brushRadius, y - brushRadius);
    }
    // Otherwise connect points with lines of brush stamps
    else if (brushPoints.length > 1) {
      // Dirty region keeps track of the area of pixels changed by the brushstroke
      dirtyRegion.xMin = this.width;
      dirtyRegion.xMax = 0;
      dirtyRegion.yMin = this.height;
      dirtyRegion.yMax = 0;
      // For each stroke segment
      for (let i = 1; i < brushPoints.length - 1; i++) {
        const [x0, y0] = brushPoints[i - 1];
        const [x1, y1] = brushPoints[i];
        dirtyRegion.xMin = Math.min(dirtyRegion.xMin, x0, x1);
        dirtyRegion.yMin = Math.min(dirtyRegion.yMin, y0, y1);
        dirtyRegion.xMax = Math.max(dirtyRegion.xMax, x0, x1);
        dirtyRegion.yMax = Math.max(dirtyRegion.yMax, y0, y1);
        // Stamp brush allong stroke segment
        const dX = x1 - x0;
        const dY = y1 - y0;
        const strokeDist = Math.sqrt(dX * dX + dY * dY);
        const stepX = dX / strokeDist;
        const stepY = dY / strokeDist;
        const distStep = Math.max(brushRadius * 0.1, 1);
        for (let currDist = 0; currDist < strokeDist; currDist += distStep) {
          const x = x0 + stepX * currDist;
          const y = y0 + stepY * currDist;
          ctx.drawImage(brushTexture, x - brushRadius, y - brushRadius);
        }
      }
      const xMin = Math.floor(dirtyRegion.xMin - brushRadius);
      const yMin = Math.floor(dirtyRegion.yMin - brushRadius);
      const xMax = Math.ceil(dirtyRegion.xMax + brushRadius);
      const yMax = Math.ceil(dirtyRegion.yMax + brushRadius);
      // Composite tmp brush layer to the active painting layer
      activeLayer.ctx.drawImage(this.tmpLayer.canvas, xMin, yMin, xMax - xMin, yMax - yMin, xMin, yMin, xMax - xMin, yMax - yMin);
    }
    // Clear stroke segments
    this.brushPoints = [];
    // Mark layer as changed
    this.layers[state.layer].hasChanged = true;
  }

  protected createLayer() {
    return new DrwCanvasRendererLayer();
  }

  protected setLayer(layerIndex: number) {
    super.setLayer(layerIndex);
    this.activeLayer = this.layers[layerIndex];
  }

  protected moveLayer(srcLayerIndex: number, dstLayerIndex: number) {
    super.moveLayer(srcLayerIndex, dstLayerIndex);
    // Mark layers as changed
    this.layers[srcLayerIndex].hasChanged = true;
    this.layers[dstLayerIndex].hasChanged = true;
  }

  protected copyLayer(srcLayerIndex: number, dstLayerIndex: number) {
    const dstCtx = this.layers[dstLayerIndex].ctx;
    // If the src layer is underneath the dst layer in the layer stack, the src layer should be composited underneath the dst layer
    // This can be done by setting the compositing operation
    const isSrcLower = srcLayerIndex > dstLayerIndex; // (higher layer index value = lower layer)
    if (isSrcLower) {
      dstCtx.globalCompositeOperation = 'destination-over';
    } else {
      dstCtx.globalCompositeOperation = 'source-over';
    }
    dstCtx.globalAlpha = 1;
    // Draw src to dst
    dstCtx.drawImage(this.layers[srcLayerIndex].canvas, 0, 0);
    // Mark layer as changed
    this.layers[dstLayerIndex].hasChanged = true;
  }
  
  protected clearLayer(layerIndex: number) {
    this.layers[layerIndex].ctx.clearRect(0, 0, this.width, this.height);
    // Mark layer as changed
    this.layers[layerIndex].hasChanged = true;
  }

  protected resetLayer(index: number) {
    this.layers[index].ctx.clearRect(0, 0, this.width, this.height);
    // Mark layer as changed
    this.layers[index].hasChanged = true;
  }

  protected flip(flipX: boolean, flipY: boolean) {
    const tmp = this.tmpLayer;
    const width = this.width;
    const height = this.height;
    const scaleX = flipX ? -1 : 1;
    const scaleY = flipY ? -1 : 1;
    tmp.ctx.globalCompositeOperation = 'source-over';
    tmp.ctx.globalAlpha = 1;
    // Maybe manually flipping the pixel data would be better?
    this.layers.forEach(layer => {
      // Copy layer to tmp canvas
      tmp.ctx.clearRect(0, 0, width, height);
      tmp.ctx.drawImage(layer.canvas, 0, 0);
      // clear layer
      layer.ctx.clearRect(0, 0, width, height);
      // draw from tmp flipped
      layer.ctx.globalCompositeOperation = 'source-over';
      layer.ctx.globalAlpha = 1;
      layer.ctx.scale(scaleX, scaleY);
      layer.ctx.drawImage(tmp.canvas, flipX ? -width : 0, flipY ? -height : 0);
      // cleanup
      layer.ctx.scale(scaleX, scaleY);
      // Mark layer as changed
      layer.hasChanged = true;
    });
  }
}