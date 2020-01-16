export type Color = [number, number, number]; // r, g, b

export enum BrushControl {
  BRUSHCONTROL_FULL = 0,
  BRUSHCONTROL_VARIABLEOPACITY = 1,
  BRUSHCONTROL_VARIABLESIZE = 2,
  BRUSHCONTROL_VARIABLESIZEOPACITY = 3,
  BRUSHCONTROL_DISTANCEOPACITY = 4,
  BRUSHCONTROL_ERASER = 5,
};

export enum BrushType {
  BRUSHTYPE_HARD = 0,
  BRUSHTYPE_SOFT = 1,
  BRUSHTYPE_BRISTLE = 2,
};

export enum LayerAction {
  LAYERACTION_SET = 0,
  LAYERACTION_NEWPOS = 1,
  LAYERACTION_CLEAR = 2,
  LAYERACTION_COPY = 3,
};

export const enum CommandType {
  TYPE_DRAW = 0,
  TYPE_DRAWEND = 1,
  TYPE_COLORCHANGE = 2,
  TYPE_SIZECHANGE = 3,
};

export interface DrawCommand {
  type: CommandType.TYPE_DRAW;
  pressure: number;
  x: number;
  y: number;
};

export interface DrawEndCommand {
  type: CommandType.TYPE_DRAWEND;
  layer: number;
  layerAction: LayerAction; 
};

export interface ColorChangeCommand {
  type: CommandType.TYPE_COLORCHANGE;
  color: Color;
  user: number;
  flipX: boolean;
  flipY: boolean;
};

export interface SizeChangeCommand {
  type: CommandType.TYPE_SIZECHANGE;
  size: number;
  brushControl: BrushControl;
  brushType: BrushType;
  opacity: number;
};

export type DrwCommand = DrawCommand | DrawEndCommand | ColorChangeCommand | SizeChangeCommand;