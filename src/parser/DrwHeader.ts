// PLATFORM_XO and PLATFORM_WII are unreleased versions of Colors, found in the Colors Drw Viewer app
// PLATFORM_SWITCH inferred from a painting made with the Colors Live Switch alpha: https://www.colorslive.com/details/4394769
export enum DrwPlatform {
  PLATFORM_NDS = 0,
  PLATFORM_PC = 1,
  PLATFORM_XO = 2,
  PLATFORM_IOS = 3,
  PLATFORM_WII = 4,
  PLATFORM_3DS = 6,
  PLATFORM_ANDROID = 7,
  PLATFORM_VITA = 8,
  PLATFORM_SWITCH = 18
};

export interface DrwFlags {
  isDownloaded: boolean;
  is3d: boolean;
};

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
  flags: DrwFlags;
  galleryId: number;
  subPlatform: DrwPlatform; // not sure what this is?
  numCommands: number;
  author: string;
  originalAuthor: string;
  name: string;
};