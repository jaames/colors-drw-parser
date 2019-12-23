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

interface ToolState {
  layerCtx: CanvasRenderingContext2D,
  isDrawing: boolean,
  color: Color,
  brushType: BrushType,
  brushControl: BrushControl,
  brushRadius: number;
  opacity: number,
  layer: number,
  user: number,
  pressure: number,
  x: number,
  y: number,
  flipX: boolean,
  flipY: boolean,
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
  public tmp: DrwLayer;
  public state: ToolState = {
    layerCtx: null,
    isDrawing: false,
    color: [0, 0, 0],
    brushType: BrushType.BRUSHTYPE_HARD,
    brushControl: BrushControl.BRUSHCONTROL_VARIABLEOPACITY,
    brushRadius: 20,
    opacity: 1,
    pressure: 0,
    user: 0,
    layer: 0,
    x: 0,
    y: 0,
    flipX: false,
    flipY: false
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
    this.tmp = new DrwLayer();
    this.setLayer(0);
  }

  public setCanvasWidth(width: number) {
    const height = width / this.drw.header.aspectRatio;
    this.width = width;
    this.height = height;
    this.layers.forEach(layer => {
      layer.canvas.width = width;
      layer.canvas.height = height;
    });
    this.tmp.canvas.width = width;
    this.tmp.canvas.height = height;
  }

  // Composite all the painting layers into a single canvas
  // Only needs to be done to produce a final image
  public blitTo(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, this.width, this.height);
    for (let layerIndex = 4; layerIndex >= 0; layerIndex --) {
      const layer = this.layers[layerIndex];
      if (layer.isVisible) ctx.drawImage(this.layers[layerIndex].canvas, 0, 0);
    }
  }

  public setLayer(index: number) {
    this.state.layer = index;
    this.state.layerCtx = this.layers[index].ctx;
  }

  public swapLayer(srcIndex: number, dstIndex: number) {
    // TODO: this is wrong, looks like it just moves one layer and reshuffles the rest
    const tmp = this.layers[srcIndex];
    this.layers[srcIndex] = this.layers[dstIndex];
    this.layers[dstIndex] = tmp;
  }

  public copyLayer(srcIndex: number, dstIndex: number) {
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
  
  public clearLayer(index: number) {
    this.layers[index].ctx.clearRect(0, 0, this.width, this.height);
  }

  public flip(flipX: boolean, flipY: boolean) {
    const tmp = this.tmp;
    const width = this.width;
    const height = this.height;
    const scaleX = flipX ? -1 : 1;
    const scaleY = flipY ? -1 : 1;
    // this is horribly slow but i can't think of a better way to implement it
    this.layers.forEach(layer => {
      // copy layer to tmp
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

  public handleCommand(cmdIndex: number) {
    const cmd = this.drw.getCommand(cmdIndex);
    switch (cmd.type) {
      case CommandType.TYPE_BRUSH:
        this.handleDraw(cmd);
        break;
      case CommandType.TYPE_BRUSHEND:
        this.handleDrawEnd(cmd);
        break;
      case CommandType.TYPE_COLORCHANGE:
        this.handleColorChange(cmd);
        break;
      case CommandType.TYPE_SIZECHANGE:
        this.handleSizeChange(cmd);
        break;
    }
  }

  public handleDraw(cmd: BrushCommand) {
    const { state } = this;
    const ctx = state.layerCtx;
    const x = cmd.x * this.width;
    const y = cmd.y * this.height;
    state.pressure = cmd.pressure;
    if (!state.isDrawing) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      state.isDrawing = true;
    } else {
      ctx.lineTo(x, y);
    }
    state.x = x;
    state.y = y;
  }

  public handleDrawEnd(cmd: BrushEndCommand) {
    const { state } = this;
    const ctx = state.layerCtx;
    if (cmd.layer === null) {
      if (state.brushControl === BrushControl.BRUSHCONTROL_ERASER) {
        ctx.globalCompositeOperation = "destination-out";
      }
      ctx.globalAlpha = state.pressure * state.opacity;
      ctx.lineWidth = state.brushRadius * 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const [r, g, b] = state.color;
      ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      this.state.isDrawing = false;
    } else {
      switch (cmd.layerAction) {
        case LayerAction.LAYERACTION_SET:
          this.setLayer(cmd.layer);
          break;
        case LayerAction.LAYERACTION_SWAP:
          this.swapLayer(this.state.layer, cmd.layer);
          this.setLayer(this.state.layer);
          break;
        case LayerAction.LAYERACTION_CLEAR:
          this.clearLayer(cmd.layer);
          break;
        case LayerAction.LAYERACTION_COPY:
          this.copyLayer(this.state.layer, cmd.layer);
          break;
      }
    }
    
  }

  public handleColorChange(cmd: ColorChangeCommand) {
    if (cmd.color !== null) {
      this.state.color = cmd.color;
    }
    if (cmd.flipX || cmd.flipY) {
      this.flip(cmd.flipX, cmd.flipY);
    }
    this.state.flipX = cmd.flipX;
    this.state.flipY = cmd.flipY;
  }

  public handleSizeChange(cmd: SizeChangeCommand) {
    this.state.brushControl = cmd.brushControl;
    this.state.brushType = cmd.brushType;
    this.state.brushRadius = cmd.size * this.width;
    this.state.opacity = cmd.opacity;
  }

}