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
  PLATFORM_SPEN = 12, // Galaxy S-Pen 
  PLATFORM_WIN8 = 13,
  PLATFORM_SWITCH = 18
};

export enum DrwOrientation {
  NORMAL = 0,
  COUNTER_CLOCKWISE = 1,
  CLOCKWISE = 2,
  UPSIDE_DOWN = 3
};

export interface DrwFlags {
  downloaded: boolean;
  is3d: boolean;
  reference: boolean;
  undo: boolean;
  flip: boolean;
  eyedrop: boolean;
  eraser: boolean;
};