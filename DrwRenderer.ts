// Extremely naive Colors .drw renderer, using the HTML5 canvas API
// Most drw commands seem to work okay, however only very basic brushes are currently supported
// This is good enough for general testing / debug, but can't (and probably never will) accurately render paintings
// It would probably be a better idea to try implementimg brush rendering in webGL

import { 
  Color,
  CommandType,
  BrushCommand,
  BrushEndCommand,
  ColorChangeCommand,
  SizeChangeCommand,
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

  private brushPoints: Vec2[] = [];
  private state: ToolState = {
    activeLayerCtx: null,
    layer: 0,
    color: [0, 0, 0],
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
    ctx.clearRect(0, 0, this.width, this.height);
    for (let layerIndex = 4; layerIndex >= 0; layerIndex--) {
      const layer = this.layers[layerIndex];
      if (layer.isVisible) ctx.drawImage(this.layers[layerIndex].canvas, 0, 0);
    }
  }

  public handleCommand(cmdIndex: number) {
    const cmd = this.drw.getCommand(cmdIndex);
    if (cmd.type === CommandType.TYPE_BRUSH) {
      this.handleDrawCommand(cmd);
    } 
    else if (cmd.type === CommandType.TYPE_BRUSHEND) {
      this.handleDrawEndCommand(cmd);
    }
    else if (cmd.type === CommandType.TYPE_COLORCHANGE) {
      this.handleColorChangeCommand(cmd);
    }
    else if (cmd.type === CommandType.TYPE_SIZECHANGE) {
      this.handleSizeChangeCommand(cmd);
    }
  }

  private handleDrawCommand(cmd: BrushCommand) {
    const { state } = this;
    const x = cmd.x * this.width;
    const y = cmd.y * this.height;
    this.brushPoints.push([x, y]);
    state.pressure = cmd.pressure;
    state.x = x;
    state.y = y;
    state.isDrawing = true;
  }

  private handleDrawEndCommand(cmd: BrushEndCommand) {
    const { state } = this;
    if (cmd.layer === null) {
      this.brushStroke();
      state.isDrawing = false;
    } else {
      if (cmd.layerAction === LayerAction.LAYERACTION_SET) {
        this.setLayer(cmd.layer);
      }
      else if (cmd.layerAction === LayerAction.LAYERACTION_NEWINDEX) {
        this.moveLayer(state.layer, cmd.layer);
        this.setLayer(state.layer);
      }
      else if (cmd.layerAction === LayerAction.LAYERACTION_CLEAR) {
        this.clearLayer(cmd.layer);
      }
      else if (cmd.layerAction === LayerAction.LAYERACTION_COPY) {
        this.copyLayer(state.layer, cmd.layer);
      }
    }
  }

  private handleColorChangeCommand(cmd: ColorChangeCommand) {
    if (cmd.color !== null) {
      this.state.color = cmd.color;
      this.updateBrush();
    } 
    else {
      if (cmd.flipX || cmd.flipY) {
        this.flip(cmd.flipX, cmd.flipY);
      }
      this.state.flipX = cmd.flipX;
      this.state.flipY = cmd.flipY;
      this.state.user = cmd.user;
    }
  }

  private handleSizeChangeCommand(cmd: SizeChangeCommand) {
    this.state.brushControl = cmd.brushControl;
    this.state.brushType = cmd.brushType;
    this.state.brushRadius = cmd.size * this.width;
    this.state.opacity = cmd.opacity;
    this.updateBrush();
  }

  private updateBrush() {
    const state = this.state;
    const ctx = this.brushCtx;
    const [r, g, b] = state.color;
    const brushRadius = state.brushRadius;
    const brushSize = Math.max(brushRadius * 2, 1);
    const brushTexture = this.brushTextures[state.brushType];
    // setting canvas size also clears it
    this.brushCanvas.width = brushSize;
    this.brushCanvas.height = brushSize;
    ctx.drawImage(brushTexture, 0, 0, brushSize, brushSize);
    // Apply color to the entire brush stroke
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.globalCompositeOperation = 'source-over';
  }

  private brushStroke() {
    const state = this.state;
    const brushRadius = state.brushRadius;
    const brushSize = brushRadius * 2;
    const brushTexture = this.brushCanvas;

    // Draw stroke to tmp layer
    // The stroke is drawn with no opacity, then composited onto the actual layer later
    // This is the only way to ensure consistent opacity across the stroke, accurate to the way Colors draws them
    const ctx = this.tmpLayer.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // If there's only one set of coords, use a single brush stamp
    if (this.brushPoints.length === 1) {
      const [x, y] = this.brushPoints[0];
      ctx.drawImage(brushTexture, x - brushRadius, y - brushRadius);
    }
    // Otherwise connect points with lines of brush stamps
    else {
      // For each stroke segment
      for (let i = 1; i < this.brushPoints.length - 1; i++) {
        const [x0, y0] = this.brushPoints[i - 1];
        const [x1, y1] = this.brushPoints[i];
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
    }
    // Clear stroke segments
    this.brushPoints = [];
    // Composite tmp layer to active layer
    // Eraser: removes from layer 
    if (state.brushControl === BrushControl.BRUSHCONTROL_ERASER) {
      state.activeLayerCtx.globalCompositeOperation = 'destination-out';
      // TODO: not sure if this is 100% correct, maybe check this
      state.activeLayerCtx.globalAlpha = state.opacity;
      state.activeLayerCtx.drawImage(this.tmpLayer.canvas, 0, 0);
      state.activeLayerCtx.globalCompositeOperation = 'source-over';
      state.activeLayerCtx.globalAlpha = 1;
    } 
    // There's other BrushControl types but I'm unsure how to implement those
    else {
      state.activeLayerCtx.globalAlpha = state.pressure * state.opacity;
      state.activeLayerCtx.drawImage(this.tmpLayer.canvas, 0, 0);
      state.activeLayerCtx.globalAlpha = 1;
    }
  }

  private setLayer(index: number) {
    this.state.layer = index;
    this.state.activeLayerCtx = this.layers[index].ctx;
  }

  private moveLayer(srcIndex: number, dstIndex: number) {
    const srcLayer = this.layers.splice(srcIndex, 1)[0];
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