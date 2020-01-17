// Typescript parser for Colors .drw files
// Implementation by James Daniel (https://jamesdaniel.dev | https://twitter.com/rakujira)
// Huge thanks to Jens Andersson from Collecting Smiles for providing documentation for their format :)
// Docs: https://www.dropbox.com/s/fmjptpshi93bojp/DRW%20Format%201200.docx?dl=0

// TODO: implement parsing from a .drw stream? 

import { 
  DrwHeader, 
  DrwFlags, 
  DrwPlatform 
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
    return {
      id:                    this.data.getInt32(0x00, LITTLE_ENDIAN),
      version:               this.data.getInt32(0x04, LITTLE_ENDIAN), 
      originalColorsVersion: this.data.getInt32(0x08, LITTLE_ENDIAN),
      colorsVersion:         this.data.getInt32(0x0C, LITTLE_ENDIAN),
      orientation:           this.data.getInt32(0x10, LITTLE_ENDIAN),
      time:                  this.data.getInt32(0x14, LITTLE_ENDIAN), // drawing time, in seconds
      numSaves:              this.data.getInt32(0x18, LITTLE_ENDIAN),
      platform:              this.data.getInt32(0x1C, LITTLE_ENDIAN),
      aspectRatio:           this.data.getFloat32(0x20, LITTLE_ENDIAN), // width divided by height
      flags: {
        isDownloaded:        ((flags << 0) & 0x1) == 1,
        is3d:                ((flags << 1) & 0x1) == 1,
      },
      galleryId:             this.data.getInt32(0x28, LITTLE_ENDIAN),
      subPlatform:           this.data.getInt32(0x2C, LITTLE_ENDIAN), // no idea what this means lol
      // skip 12 unused(?) bytes
      numCommands:           this.data.getInt32(0x3C, LITTLE_ENDIAN),
      author:                this.readUtf8(0x40, 64),
      originalAuthor:        this.readUtf8(0x80, 64),
      name:                  this.readUtf8(0xC0, 128)
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
      case CommandType.TYPE_DRAW:
        const pressure = (cmd >> 2) & 0xFF;
        const x =        (cmd >> 10) & 0x7FF;
        const y =        (cmd >> 21) & 0x7FF;
        return {
          type: CommandType.TYPE_DRAW,
          pressure: pressure / 255,
          // x and y range is 0 to 1, and should be multiplied by canvas width
          x: (x - 512) / 1024,
          y: (y - 512) / 1024,
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
        const flipX = ((cmd >> 26) & 0x1);
        const flipY = ((cmd >> 27) & 0x1);
        const user =  (cmd >> 28) & 0x7;
        const isColorChange = (flipX === 0) && (flipY === 0) && (user === 0);
        return {
          type: CommandType.TYPE_COLORCHANGE,
          color: isColorChange ? [r, g, b] : null,
          user: user > 0 ? (user - 1) : null,
          flipX: flipX === 1,
          flipY: flipY === 1
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
        // Byte is invalid; skip its
        o++;
        continue;
      }
      result += String.fromCharCode(char);
    }
    return result;
  }

};