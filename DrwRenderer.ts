// Extremely naive Colors .drw renderer, using the HTML5 canvas API
// Most drw commands seem to work okay, however only very basic brushes are currently supported
// This is good enough for general testing / debug, but can't (and probably never will) accurately render paintings
// It would probably be a better idea to try implementimg brush rendering in webGL

import { 
  Color,
  CommandType,
  BrushControl,
  BrushType,
  LayerAction,
  DrwParser,
} from './DrwParser';

import brushHardTex from './brushtextures/brush_hard.png';
import brushSoftTex from './brushtextures/brush_soft.png';
import brushBristleTex from './brushtextures/brush_bristle.png';

type Vec2 = [number, number];

interface ToolState {
  activeLayerCtx: CanvasRenderingContext2D;
  layer: number;
  color: Color;
  brushPoints: Vec2[],
  brushType: BrushType;
  brushControl: BrushControl;
  brushRadius: number;
  opacity: number;
  pressure: number;
  isDrawing: boolean;
  x: number;
  y: number;
  flipX: boolean;
  flipY: boolean;
  user: number;
};

class DrwLayer {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public isVisible: boolean = true;

  constructor () {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
  }
}

export class DrwRenderer {

  public width: number;
  public height: number;
  public drw: DrwParser;
  public layers: DrwLayer[];

  private tmpLayer: DrwLayer;

  private brushTextures: HTMLImageElement[];
  private brushCanvas: HTMLCanvasElement;
  private brushCtx: CanvasRenderingContext2D;

  private state: ToolState = {
    activeLayerCtx: null,
    layer: 0,
    color: [0, 0, 0],
    brushPoints: [],
    brushType: BrushType.BRUSHTYPE_HARD,
    brushControl: BrushControl.BRUSHCONTROL_VARIABLEOPACITY,
    brushRadius: 20,
    opacity: 1,
    pressure: 0,
    isDrawing: false,
    x: 0,
    y: 0,
    flipX: false,
    flipY: false,
    user: 0,
  };
  
  constructor(drw: DrwParser) {
    this.drw = drw;
    this.layers = [
      new DrwLayer(),
      new DrwLayer(),
      new DrwLayer(),
      new DrwLayer(),
      new DrwLayer(),
    ];
    this.tmpLayer = new DrwLayer();
    this.setLayer(0);
    this.brushCanvas = document.createElement('canvas');
    this.brushCtx = this.brushCanvas.getContext('2d');
  }
  
  // Fetch an image (for texture loading)
  private async fetchImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject();
      image.src = src; 
    });
  }

  // Load all the brush textures
  public async prepare() {
    return Promise.all([
      this.fetchImage(brushHardTex),
      this.fetchImage(brushSoftTex),
      this.fetchImage(brushBristleTex),
    ])
    .then((brushTextures) => {
      this.brushTextures = brushTextures;
      this.updateBrush();
      return this; // return renderer instance
    })
  }

  public setCanvasWidth(width: number) {
    const height = width / this.drw.header.aspectRatio;
    this.width = width;
    this.height = height;
    this.layers.forEach(layer => {
      layer.canvas.width = width;
      layer.canvas.height = height;
    });
    this.tmpLayer.canvas.width = width;
    this.tmpLayer.canvas.height = height;
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

  public handleCommand(cmdIndex: number) {
    const cmd = this.drw.getCommand(cmdIndex);
    const state = this.state;
    switch (cmd.type) {
      // TYPE_DRAW: begin a brush stroke
      case CommandType.TYPE_DRAW:
        const x = cmd.x * this.width;
        const y = cmd.y * this.height;
        state.brushPoints.push([x, y]);
        state.pressure = cmd.pressure;
        state.x = x;
        state.y = y;
        state.isDrawing = true;
        break;
      // TYPE_DRAWEND: either signifies the end of the brush stroke OR a layer operation
      case CommandType.TYPE_DRAWEND:
        if (cmd.layer === null) {
          if (state.brushPoints.length > 0) this.brushStroke();
          state.brushPoints = [];
          state.isDrawing = false;
        }
        else {
          switch (cmd.layerAction) {
            case LayerAction.LAYERACTION_SET:
              this.setLayer(cmd.layer);
              break;
            case LayerAction.LAYERACTION_NEWPOS:
              this.moveLayer(state.layer, cmd.layer);
              this.setLayer(state.layer);
              break;
            case LayerAction.LAYERACTION_CLEAR:
              this.clearLayer(cmd.layer);
              break;
            case LayerAction.LAYERACTION_COPY:
              this.copyLayer(state.layer, cmd.layer);
              break;
          }
        }
        break;
      // TYPE_COLORCHANGE: changes the brush color, OR flips the canvas, OR changes the user
      case CommandType.TYPE_COLORCHANGE:
        if (cmd.color !== null) {
          state.color = cmd.color;
          this.updateBrush();
        } 
        else {
          if (cmd.flipX || cmd.flipY) this.flip(cmd.flipX, cmd.flipY);
          state.flipX = cmd.flipX;
          state.flipY = cmd.flipY;
          state.user = cmd.user; // not sure how meaningful changing user is, should it reset tool state?
        }
        break;
      // TYPE_SIZECHANGE: changes the brush size, control, type and opacity 
      case CommandType.TYPE_SIZECHANGE:
        // Can any of these change mid-stroke?
        state.brushRadius = cmd.size * this.width;
        state.brushControl = cmd.brushControl;
        state.brushType = cmd.brushType;
        state.opacity = cmd.opacity;
        this.updateBrush();
        break;
    }
  }
  
  private updateBrush() {
    const state = this.state;
    const ctx = this.brushCtx;
    const [r, g, b] = state.color;
    const brushRadius = state.brushRadius;
    const brushSize = Math.max(brushRadius * 2, 1);
    const brushTexture = state.brushControl === BrushControl.BRUSHCONTROL_ERASER ? this.brushTextures[0] : this.brushTextures[state.brushType];
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

  private brushStroke() {
    const state = this.state;
    const brushPoints = state.brushPoints;
    const brushRadius = state.brushRadius;
    const brushTexture = this.brushCanvas;
    // Brush strokes are normally drawn by "stamping" the brush texture (with drawImage()) along the stroke path
    // However, this technique doesn't play nicely with the HTML5 canvas API when the brush size is small,
    // for some reason strokes look smaller than they should be and are rather jaggy
    // For small sizes, we can use the builtin canvas path drawing API, which looks close enough for such small brush sizes
    // Path drawing is also a *lot* quicker, so it's a nice optimization
    const usePathApi = brushRadius < 3;
    // If we're using brush stamping, we wanna use a temp layer to draw the brush stroke to then composite that to the active layer in one go
    // Otherwise we can get away with drawing directly to the active layer
    const ctx = usePathApi ? state.activeLayerCtx : this.tmpLayer.ctx;
    // Set up target canvas compositing
    if (state.brushControl === BrushControl.BRUSHCONTROL_ERASER) {
      // destination-out: anything drawing to the canvas in this mode will erase content
      state.activeLayerCtx.globalCompositeOperation = 'destination-out';
      // Using globalAlpha like this means the entire stroke can be drawn to the layer with a consistent alpha value
      // This seems to be consistent with how Color's brushes work (or at least on 3DS)
      // Also, eraser doesn't seem to use pressure, but I'm not sure if this is 100% correct?
      state.activeLayerCtx.globalAlpha = state.pressure * state.opacity;
    }
    // There's other BrushControl types but I'm unsure how to implement those :')
    else {
      state.activeLayerCtx.globalAlpha = state.pressure * state.opacity;
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
      // For each stroke segment
      for (let i = 1; i < brushPoints.length - 1; i++) {
        const [x0, y0] = brushPoints[i - 1];
        const [x1, y1] = brushPoints[i];
        // Stamp brush allong stroke segment
        const strokeDist = Math.sqrt(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2));
        const strokeAngle = Math.atan2(x1 - x0, y1 - y0);
        const dX = Math.sin(strokeAngle);
        const dY = Math.cos(strokeAngle);
        for (let step = 0; step < strokeDist; step += 1) {
          const x = x0 + dX * step;
          const y = y0 + dY * step;
          ctx.drawImage(brushTexture, x - brushRadius, y - brushRadius);
        }
      }
      // Composite tmp brush layer to the active painting layer
      state.activeLayerCtx.drawImage(this.tmpLayer.canvas, 0, 0);
    }
    // Clear stroke segments
    state.brushPoints = [];
    // Reset layer compositing
    state.activeLayerCtx.globalCompositeOperation = 'source-over';
    state.activeLayerCtx.globalAlpha = 1;
  }

  private setLayer(index: number) {
    this.state.layer = index;
    this.state.activeLayerCtx = this.layers[index].ctx;
  }

  private moveLayer(srcIndex: number, dstIndex: number) {
    // Remove from layer stack
    const srcLayer = this.layers.splice(srcIndex, 1)[0];
    // Reinsert into layer stack at new position
    this.layers.splice(dstIndex, 0, srcLayer);
  }

  private copyLayer(srcIndex: number, dstIndex: number) {
    const dstCtx = this.layers[dstIndex].ctx;
    // If the src layer is underneath the dst layer in the layer stack, the src layer should be composited underneath the dst layer
    // This can be done by setting the compositing operation
    const isSrcLower = srcIndex > dstIndex; // (higher layer index value = lower layer)
    if (isSrcLower) dstCtx.globalCompositeOperation = 'destination-over';
    // Draw src to dst
    dstCtx.drawImage(this.layers[srcIndex].canvas, 0, 0);
    // Reset the compositing operation to default
    if (isSrcLower) dstCtx.globalCompositeOperation = 'source-over';
  }
  
  private clearLayer(index: number) {
    this.layers[index].ctx.clearRect(0, 0, this.width, this.height);
  }

  private flip(flipX: boolean, flipY: boolean) {
    const tmp = this.tmpLayer;
    const width = this.width;
    const height = this.height;
    const scaleX = flipX ? -1 : 1;
    const scaleY = flipY ? -1 : 1;
    // Maybe manually flipping the pixel data would be better?
    this.layers.forEach(layer => {
      // Copy layer to tmp canvas
      tmp.ctx.clearRect(0, 0, width, height);
      tmp.ctx.drawImage(layer.canvas, 0, 0);
      // clear layer
      layer.ctx.clearRect(0, 0, width, height);
      // draw from tmp flipped
      layer.ctx.scale(scaleX, scaleY);
      layer.ctx.drawImage(tmp.canvas, flipX ? -width : 0, flipY ? -height : 0);
      // cleanup
      layer.ctx.scale(scaleX, scaleY);
    });
  }
}