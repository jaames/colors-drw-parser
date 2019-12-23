// Typescript parser for Colors .drw files
// Implementation by James Daniel (https://jamesdaniel.dev | https://twitter.com/rakujira)
// Huge thanks to Jens Andersson from Collecting Smiles for providing documentation for their format :)
// Docs: https://www.dropbox.com/s/fmjptpshi93bojp/DRW%20Format%201200.docx?dl=0

const LITTLE_ENDIAN = true;

export type Color = [number, number, number]; // r, g, b

export interface DrwHeader {
  id: number;
  version: number;
  originalColorsVersion: number;
  colorsVersion: number;
  orientation: number;
  time: number;
  platform: DrwPlatform;
  numSaves: number; // number of times the file has been saved
  aspectRatio: number;
  // flags
  isDownloaded: boolean;
  is3d: boolean;
  galleryId: number;
  subPlatform: DrwPlatform; // not sure what this is?
  numCommands: number;
  author: string;
  originalAuthor: string;
  name: string;
};

export enum DrwPlatform {
  PLATFORM_NDS = 0,
  PLATFORM_PC = 1,
  PLATFORM_IOS = 3,
  PLATFORM_3DS = 6,
  PLATFORM_ANDROID = 7,
  PLATFORM_VITA = 8,
};

export const enum CommandType {
  TYPE_BRUSH = 0,
  TYPE_BRUSHEND = 1,
  TYPE_COLORCHANGE = 2,
  TYPE_SIZECHANGE = 3,
};

export interface BrushCommand {
  type: CommandType.TYPE_BRUSH;
  pressure: number;
  x: number;
  y: number;
};

export interface BrushEndCommand {
  type: CommandType.TYPE_BRUSHEND;
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

export type DrwCommand = BrushCommand | BrushEndCommand | ColorChangeCommand | SizeChangeCommand;

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
  LAYERACTION_NEWINDEX = 1,
  LAYERACTION_CLEAR = 2,
  LAYERACTION_COPY = 3,
};

export class DrwParser {

  private data: DataView;
  public header: DrwHeader;

  constructor(arrayBuffer: ArrayBuffer) {
    this.data = new DataView(arrayBuffer);
    this.header = this.getHeader();
  }

  get numCommands() {
    return this.header.numCommands;
  }

  // Fetch a drw from a url
  // These can be fetched from the colorslive s3 bucket:
  // https://s3.amazonaws.com/colorslive/drw/< painting id >-< some base64 string? >.drw
  static async loadFromUrl(url: string): Promise<DrwParser> {
    return fetch(url)
      .then(response => response.arrayBuffer())
      .then(data => new DrwParser(data));
  }

  // Read file header, fairly straightforward
  public getHeader(): DrwHeader {
    const flags = this.data.getInt32(36, LITTLE_ENDIAN);
    return <DrwHeader>{
      id:                       this.data.getInt32(0,  LITTLE_ENDIAN),
      version:                  this.data.getInt32(4,  LITTLE_ENDIAN), 
      originalColorsVersion:    this.data.getInt32(8,  LITTLE_ENDIAN),
      colorsVersion:            this.data.getInt32(12, LITTLE_ENDIAN),
      orientation:              this.data.getInt32(16, LITTLE_ENDIAN),
      time:                     this.data.getInt32(20, LITTLE_ENDIAN), // drawing time, in seconds
      numSaves:                 this.data.getInt32(24, LITTLE_ENDIAN),
      platform:    <DrwPlatform>this.data.getInt32(28, LITTLE_ENDIAN),
      aspectRatio:              this.data.getFloat32(32, LITTLE_ENDIAN), // width divided by height
      isDownloaded:             ((flags << 0) & 0x1) == 1,
      is3d:                     ((flags << 1) & 0x1) == 1,
      galleryId:                this.data.getInt32(40, LITTLE_ENDIAN),
      subPlatform: <DrwPlatform>this.data.getInt32(44, LITTLE_ENDIAN), // no idea what this means lol
      // skip 12 unused(?) bytes
      numCommands:              this.data.getInt32(60, LITTLE_ENDIAN),
      author:                   this.readUtf8(64, 64),
      originalAuthor:           this.readUtf8(128, 64),
      name:                     this.readUtf8(192, 128)
    };
  }

  // Read drawing command
  public getCommand(index: number): DrwCommand {
    // Check if command is out of range
    if (index > this.header.numCommands - 1) {
      return null;
    }
    // offset = 320 (start of command stream) + 4 (size of command) * index
    const cmd = this.data.getInt32(320 + index * 4, LITTLE_ENDIAN);
    const type = cmd & 0x3;
    switch (type) {
      case CommandType.TYPE_BRUSH:
        const pressure = (cmd >> 2) & 0xFF;
        const x =        (cmd >> 10) & 0x7FF;
        const y =        (cmd >> 21) & 0x7FF;
        return {
          type: CommandType.TYPE_BRUSH,
          pressure: pressure / 255,
          x: (x - 512) / 1024,
          y: (y - 512) / 1024,
        };
      case CommandType.TYPE_BRUSHEND:
        // 1 unused bit
        const layer =       (cmd >> 3) & 0xFF;
        const layerAction = (cmd >> 11) & 0x3;
        return {
          type: CommandType.TYPE_BRUSHEND,
          layer: layer > 0 ? ( layer - 1) : null,
          layerAction: <LayerAction>layerAction
        };
      case CommandType.TYPE_COLORCHANGE:
        const b =     (cmd >> 2) & 0xFF;
        const g =     (cmd >> 10) & 0xFF;
        const r =     (cmd >> 18) & 0xFF;
        const flipX = ((cmd >> 26) & 0x1);
        const flipY = ((cmd >> 27) & 0x1);
        const user =  (cmd >> 28) & 0x7;
        return {
          type: CommandType.TYPE_COLORCHANGE,
          color: ((flipX === 0) && (flipY === 0) && (user === 0)) ? [r, g, b] : null,
          user: user > 0 ? (user - 1) : null,
          flipX: flipX === 1,
          flipY: flipY === 1
        };
      case CommandType.TYPE_SIZECHANGE:
        const size =                        (cmd >> 2) & 0xFFFF;
        const brushControl = <BrushControl>((cmd >> 18) & 0x7);
        const brushType =       <BrushType>((cmd >> 21) & 0x7);
        const opacity =                     (cmd >> 24) & 0xFF;
        return {
          type: CommandType.TYPE_SIZECHANGE,
          size: size / 0xFFFF,
          brushControl,
          brushType,
          opacity: opacity / 255
        };
    }
  }

  // Quick util to read a utf8 string from file
  // Strings will be read until max length (numBytes) or a null char (0x00) is encountered
  private readUtf8(offset: number, numBytes: number) {
    const chars = new Uint8Array(this.data.buffer, offset, numBytes);
    let result = '';
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      if (char === 0) break; // break string on null bytes
      result += String.fromCharCode(char);
    }
    return result;
  }

};