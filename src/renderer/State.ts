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

  public alphaBuffer: Uint8ClampedArray;
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
    this.alphaBuffer = new Uint8ClampedArray(width * height);
    this.dirtyRegion = new Region();
  }

}