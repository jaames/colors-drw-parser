import { 
  Color,
  BrushControl,
  BrushType,
} from '../parser';

import {
  Region
} from './Region';

export interface ToolState {
  user: number;
  layer: number;
  color: Color;
  brushType: BrushType;
  brushControl: BrushControl;
  brushRadius: number;
  opacity: number;
  pressure: number;
  isDrawing: boolean;
  lastX: number;
  lastY: number;
  lastPressure: number;
  currentStrokeDistance: number;
};

export class UserState {

  public imageWidth: number;
  public imageHeight: number;
  // Brush will be drawn here
  public alphaBuffer: Uint8Array;
  // Currently affected region
  public dirtyRegion: Region;

  public toolState: ToolState = {
    user: 0,
    layer: 0,
    color: [0, 0, 0],
    brushType: BrushType.BRUSHTYPE_HARD,
    brushControl: BrushControl.BRUSHCONTROL_VARIABLEOPACITY,
    brushRadius: 20,
    opacity: 1,
    pressure: 0,
    isDrawing: false,
    lastX: 0,
    lastY: 0,
    lastPressure: 0,
    currentStrokeDistance: 0
  };

  constructor(width: number, height: number) {
    this.setBufferSize(width, height);
  }

  setBufferSize(width: number, height: number) {
    this.imageWidth = width;
    this.imageHeight = height;
    this.alphaBuffer = new Uint8Array(width * height);
    this.dirtyRegion = new Region();
  }

}