import { 
  Color,
  CommandType,
  BrushControl,
  BrushType,
  LayerAction,
  DrwParser,
} from '../parser';

import { ToolState, UserState } from './State';
import { Region } from './Region';

interface UserStates {
  [key: number]: UserState;
}

export abstract class DrwLayerBase {
  public width: number;
  public height: number;
  public isVisible: boolean = true;

  public abstract setSize(width: number, height: number): void;
}

export abstract class DrwRendererBase<DrwLayer extends DrwLayerBase> {

  public width: number;
  public height: number;
  public aspectRatio: number = 1;
  public drw: DrwParser;
  public layers: DrwLayer[];

  public userStates: Map<number, UserState> = new Map();

  public userState: UserState;
  public dirtyRegion: Region;
  public toolState: ToolState;
  
  constructor(drw?: DrwParser, layerProps: any = {}) {
    if (drw !== undefined) {
      this.drw = drw;
      this.aspectRatio = drw.aspectRatio;
    }
    this.layers = [
      this.createLayer(layerProps),
      this.createLayer(layerProps),
      this.createLayer(layerProps),
      this.createLayer(layerProps),
      this.createLayer(layerProps),
    ];
    this.setUser(0);
    this.setLayer(0);
  }

  /**
   * Misc
   */

  // Mirror all canvas layers along the given axis
  protected abstract flip(flipX: boolean, flipY: boolean): void;

  // Switch the user that's currently drawing
  // Each user has their own tool state, drawing buffer, etc
  protected setUser(userIndex: number) {
    if (!this.userStates.has(userIndex)) {
      const newUserState = new UserState(this.width, this.height);
      newUserState.toolState.user = userIndex;
      this.userStates.set(userIndex, newUserState);
    }
    const userState = this.userStates.get(userIndex);
    this.userState = userState;
    this.toolState = userState.toolState;
    this.dirtyRegion = userState.dirtyRegion;
  }

  /**
   * Layer handling
   */

  // createLayer() returns a new Layer instance with the current canvas width + height
  protected abstract createLayer(layerProps?: any): DrwLayer;
  // setLayer() sets the active painting layer to layerIndex
  protected setLayer(layerIndex: number) {
    this.toolState.layer = layerIndex;
  }
  // moveLayer() moves the layer at srcLayerIndex to dstLayerIndex in the layer stack
  // setLayer() will be called to reset the active layer after moving
  protected moveLayer(srcLayerIndex: number, dstLayerIndex: number) {
    // Remove from layer stack
    const srcLayer = this.layers.splice(srcLayerIndex, 1)[0];
    // Reinsert into layer stack at new position
    this.layers.splice(dstLayerIndex, 0, srcLayer);
  };
  // copyLayer() copies the layer at srcLayerIndex to dstLayerIndex
  // NOTE: If the src layer is underneath the dst layer in the layer stack, the src layer should be composited *underneath* the dst layer
  // This can be done by checking that srcLayerIndex > dstLayerIndex (higher layer index value = lower layer)
  protected abstract copyLayer(srcLayerIndex: number, dstLayerIndex: number): void;
  // clearLayer() clears the pixels for the specified layerIndex
  // NOTE: this doesn't remove the layer from the stack, it just resets the pixels
  protected abstract clearLayer(layerIndex: number): void;
  // resetLayer() is essentially the same as clearLayer(), except it's only called when drawing playback needs to start with a blank slate
  protected abstract resetLayer(layerIndex: number): void;

  /**
   * Brush handling
   * Handling different brushControls and brushTypes, pressure/opacity, etc, is left to the renderer implementation
   */

  // updateBrush() is called after the color, brushRadius, brushControl, brushType or opacity have changed
  protected abstract updateBrush(): void;
  // beginStroke() starts preparing for a stroke to be drawn at (x, y)
  // At this point, only a single brush stamp should be drawn at (x, y)
  protected abstract beginStroke(x: number, y: number, pressure: number): void;
  // strokeTo() draws a brush stroke from (toolState.lastX, toolState.lastY) to (x, y)
  protected abstract strokeTo(x: number, y: number, pressure: number): void;
  // finalizeStroke() finishes the brush stroke and composites it to the currently active layer
  protected abstract finalizeStroke(): void;

  /**
   * Public API
   * Used for setting canvas size, handling playback, etc
   */

  public setSize(width: number, height?: number) {
    this.width = width;
    this.height = height === undefined ? width / this.aspectRatio : height;
    this.layers.forEach(layer => {
      layer.setSize(this.width, this.height);
    });
    this.userStates.forEach((userState) => {
      userState.setBufferSize(this.width, this.height);
    });
  }

  public render() {
    for (let cmd = 0; cmd < this.drw.numCommands; cmd++) {
      this.handleCommand(cmd);
    }
  }

  // Handle drw command @ cmdIndex
  public handleCommand(cmdIndex: number) {
    const cmd = this.drw.getCommand(cmdIndex);
    const toolState = this.toolState;
    switch (cmd.type) {
      // TYPE_DRAW: begin a brush stroke
      case CommandType.TYPE_DRAW:
        const x = cmd.x * this.width;
        const y = cmd.y * this.height;
        if (!toolState.isDrawing) {
          this.beginStroke(x, y, cmd.pressure);
        } else {
          this.strokeTo(x, y, cmd.pressure);
        }
        toolState.lastPressure = cmd.pressure;
        toolState.lastX = x;
        toolState.lastY = y;
        toolState.isDrawing = true;
        break;
      // TYPE_DRAWEND: either signifies the end of the brush stroke OR a layer operation
      case CommandType.TYPE_DRAWEND:
        if (cmd.layer === null) {
          this.finalizeStroke();
          toolState.isDrawing = false;
        } else {
          switch (cmd.layerAction) {
            case LayerAction.LAYERACTION_SET:
              this.setLayer(cmd.layer);
              break;
            case LayerAction.LAYERACTION_NEWPOS:
              this.moveLayer(toolState.layer, cmd.layer);
              this.setLayer(toolState.layer);
              break;
            case LayerAction.LAYERACTION_CLEAR:
              this.clearLayer(cmd.layer);
              break;
            case LayerAction.LAYERACTION_COPY:
              this.copyLayer(toolState.layer, cmd.layer);
              break;
          }
        }
        break;
      // TYPE_COLORCHANGE: changes the brush color, OR flips the canvas, OR changes the user
      case CommandType.TYPE_COLORCHANGE:
        if (cmd.color !== null) {
          toolState.color = cmd.color;
          this.updateBrush();
        } else {
          if (cmd.flipX) {
            this.flip(true, false);
          } else if (cmd.flipY) {
            this.flip(false, true);
          }
          toolState.user = cmd.user; // not sure how meaningful changing user is, should it reset tool state?
        }
        break;
      // TYPE_SIZECHANGE: changes the brush size, control, type and opacity 
      case CommandType.TYPE_SIZECHANGE:
        const minBrushWidth = Math.max(this.width / 256, 1.25);
        toolState.brushRadius = Math.max(cmd.size * this.width, minBrushWidth / 2);
        toolState.brushControl = cmd.brushControl;
        toolState.brushType = cmd.brushType;
        toolState.opacity = cmd.opacity;
        this.updateBrush();
        break;
    }
  }
}