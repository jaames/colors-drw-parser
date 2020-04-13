// Typescript parser for Colors .drw files
// Implementation by James Daniel (https://jamesdaniel.dev | https://twitter.com/rakujira)
// Huge thanks to Jens Andersson from Collecting Smiles for providing documentation for their format :)
// Docs: https://www.dropbox.com/s/fmjptpshi93bojp/DRW%20Format%201200.docx?dl=0

// TODO: handle orientation
// TODO: implement parsing from a stream? 

import { 
  DrwFlags, 
  DrwPlatform,
  DrwOrientation,
} from './DrwHeader';

import {
  Color, 
  BrushControl,
  BrushType,
  LayerAction,
  CommandType,
  DrawCommand,
  DrawEndCommand,
  ColorChangeCommand,
  SizeChangeCommand,
  DrwCommand,
} from './DrwCommand';

const LITTLE_ENDIAN = true;

export class DrwParser {

  private data: DataView;
  public id: number;
  public version: number;
  public originalColorsVersion: number;
  public colorsVersion: number;
  public orientation: DrwOrientation;
  public time: number;
  public platform: DrwPlatform;
  public numSaves: number; // number of times the file has been saved
  public aspectRatio: number;
  public flags: DrwFlags;
  public galleryId: number;
  public subPlatform: DrwPlatform; // not sure what this is?
  public numCommands: number;
  public author: string;
  public originalAuthor: string;
  public name: string;

  constructor(arrayBuffer: ArrayBuffer) {
    const data = new DataView(arrayBuffer);
    this.data = data;
    // Parse file header
    const flags = this.data.getInt32(36, LITTLE_ENDIAN);
    // return {
    this.id =                    data.getInt32(0x00, LITTLE_ENDIAN);
    this.version =               data.getInt32(0x04, LITTLE_ENDIAN);
    this.originalColorsVersion = data.getInt32(0x08, LITTLE_ENDIAN);
    this.colorsVersion =         data.getInt32(0x0C, LITTLE_ENDIAN);
    this.orientation =           data.getInt32(0x10, LITTLE_ENDIAN);
    this.time =                  data.getInt32(0x14, LITTLE_ENDIAN); // drawing time, in seconds
    this.numSaves =              data.getInt32(0x18, LITTLE_ENDIAN);
    this.platform =              data.getInt32(0x1C, LITTLE_ENDIAN);
    this.aspectRatio =           data.getFloat32(0x20, LITTLE_ENDIAN); // width divided by height
    this.flags = {
      downloaded: ((flags >> 0) & 0x1) === 1,
      is3d:       ((flags >> 1) & 0x1) === 1,
      reference:  ((flags >> 4) & 0x1) === 1,
      undo:       ((flags >> 8) & 0x1) === 1,
      flip:       ((flags >> 9) & 0x1) === 1,
      eyedrop:    ((flags >> 10) & 0x1) === 1,
      eraser:     ((flags >> 26) & 0x1) === 1,
    };
    this.galleryId =            data.getInt32(0x28, LITTLE_ENDIAN);
    this.subPlatform =          data.getInt32(0x2C, LITTLE_ENDIAN); // no idea what this means lol
    // skip 12 unused(?) bytes
    this.numCommands =          data.getInt32(0x3C, LITTLE_ENDIAN);
    this.author =               this.readUtf8(0x40, 64);
    this.originalAuthor =       this.readUtf8(0x80, 64);
    this.name =                 this.readUtf8(0xC0, 128);
  }

  // Fetch a drw from a url
  // These can be fetched from the colorslive s3 bucket:
  // https://s3.amazonaws.com/colorslive/drw/< painting id >-< some base64 string? >.drw
  static async loadFromUrl(url: string): Promise<DrwParser> {
    return fetch(url)
      .then(response => response.arrayBuffer())
      .then(data => new DrwParser(data));
  }

  // Read drawing command
  public getCommand(index: number): DrwCommand {
    // Check if command is out of range
    if (index > this.numCommands - 1) {
      return null;
    }
    // Command offset = 320 (start of command stream) + 4 (size of command) * index
    const cmd = this.data.getInt32(320 + index * 4, LITTLE_ENDIAN);
    // Handle 2-bit command type
    switch (cmd & 0x3) {
      case CommandType.TYPE_DRAW:
        const pressure = (cmd >> 2) & 0xFF;
        const xRaw =     (cmd >> 10) & 0x7FF;
        const yRaw =     (cmd >> 21) & 0x7FF;
        return {
          type: CommandType.TYPE_DRAW,
          pressure: pressure / 255,
          // x and y range is 0 to 1, and should be multiplied by canvas width later
          x: (xRaw - 512) / 1024,
          y: (yRaw - 512) / 1024,
        };

      case CommandType.TYPE_DRAWEND:
        // 1 unused bit
        const layer =       (cmd >> 3) & 0xFF;
        const layerAction = (cmd >> 11) & 0x3;
        return {
          type: CommandType.TYPE_DRAWEND,
          layer: layer === 0 ? null : (layer - 1),
          layerAction: layerAction
        };

      case CommandType.TYPE_COLORCHANGE:
        const b =     (cmd >> 2) & 0xFF;
        const g =     (cmd >> 10) & 0xFF;
        const r =     (cmd >> 18) & 0xFF;
        const flipXRaw = ((cmd >> 26) & 0x1);
        const flipYRaw = ((cmd >> 27) & 0x1);
        const user =  (cmd >> 28) & 0x7;
        const isColorChange = (flipXRaw === 0) && (flipYRaw === 0) && (user === 0);
        return {
          type: CommandType.TYPE_COLORCHANGE,
          color: isColorChange ? [r, g, b] : null,
          user: user > 0 ? (user - 1) : null,
          flipX: flipXRaw === 1,
          flipY: flipYRaw === 1
        };

      case CommandType.TYPE_SIZECHANGE:
        const size =         (cmd >> 2) & 0xFFFF;
        const brushControl = ((cmd >> 18) & 0x7);
        const brushType =    ((cmd >> 21) & 0x7);
        const opacity =      (cmd >> 24) & 0xFF;
        return {
          type: CommandType.TYPE_SIZECHANGE,
          // size range is 0 to 1, and should be multiplied by canvas width to get the brush radius
          size: size / 0xFFFF,
          brushControl: brushControl,
          brushType: brushType,
          opacity: opacity / 255
        };
    }
  }

  // Quick util to read a multibyte utf8 string from file
  // Strings will be read until max length (numBytes) or a null char (0x00) is encountered
  private readUtf8(offset: number, numBytes: number): string {
    const buffer = new Uint8Array(this.data.buffer, offset, numBytes);
    let o = 0;
    let result = '';
    while (o < buffer.length) {
      let char = 0;
      // Break string on null bytes
      if (buffer[o] === 0) {
        break;
      } else if (buffer[o] < 0x80) {
        // Single byte char
        char = buffer[o++];
      } else if ((buffer[o] & 0xe0) == 0xc0) {
        // Two byte char
        char = ((buffer[o++] & 0x1f) <<  6) | 
               ((buffer[o++] & 0x3f) <<  0);
      } else if ((buffer[o] & 0xf0) == 0xe0) {
        // Three byte char
        char = ((buffer[o++] & 0x0f) << 12) |
               ((buffer[o++] & 0x3f) <<  6) |
               ((buffer[o++] & 0x3f) <<  0);
      } else if ((buffer[0] & 0xf8) == 0xf0 && (buffer[0] <= 0xf4)) {
        // Four byte char
        char = ((buffer[o++] & 0x07) << 18) |
               ((buffer[o++] & 0x3f) << 12) |
               ((buffer[o++] & 0x3f) <<  6) |
               ((buffer[o++] & 0x3f) <<  0);
      } else {
        // Byte is invalid; skip it
        o++;
        continue;
      }
      result += String.fromCharCode(char);
    }
    return result;
  }

};