export class Region {
  public xMin: number;
  public yMin: number;
  public xMax: number;
  public yMax: number;

  constructor() {
    this.reset();
  }

  get width() {
    return this.xMax - this.xMin;
  }

  get height() {
    return this.yMax - this.yMin;
  }

  reset() {
    this.xMin = 100000000;
    this.yMin = 100000000;
    this.xMax = -100000000;
    this.yMax = -100000000;
  }

  // Adjust region to combine point
  adjustForPoint(x: number, y: number) {
    this.xMin = Math.min(this.xMin, x);
    this.yMin = Math.min(this.yMin, y);
    this.xMax = Math.max(this.xMax, x);
    this.yMax = Math.max(this.yMax, y);
  }

  clampBounds(xMin: number, yMin: number, xMax: number, yMax: number) {
    this.xMin = Math.max(this.xMin, xMin);
    this.yMin = Math.max(this.yMin, yMin);
    this.xMax = Math.min(this.xMax, xMax);
    this.yMax = Math.min(this.yMax, yMax);
  }
  
}