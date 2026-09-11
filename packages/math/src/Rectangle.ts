export class Rectangle {
  constructor(public x = 0, public y = 0, public width = 0, public height = 0) {}
  contains(x: number, y: number): boolean { return x >= this.x && y >= this.y && x <= this.x + this.width && y <= this.y + this.height }
}
