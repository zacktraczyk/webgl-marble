class Stage {
  // TODO:
  // private readonly _vdu: VDU;
  // private readonly _physics: Physics;

  readonly height: number;
  readonly width: number;

  constructor({
    width = 600,
    height = 600,
  }: {
    width?: number;
    height?: number;
  }) {
    this.height = height;
    this.width = width;

    // this._vdu = new VDU("#gl-canvas");
    // this._physics = new Physics();
  }

  // add(drawable: Drawable | Physical) {
  // this._vdu.add(drawable);
  // this._physics.add(drawable);
  // }

  // update(elapsed: number) {
  //   this._physics.update(elapsed);
  // }

  // render() {
  //   this._vdu.render();
  // }
}

export default Stage;
