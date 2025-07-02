import { Arrow } from "./arrow";
import { Circle } from "./circle";

type ArrowParams = Partial<ConstructorParameters<typeof Arrow>[0]>;
type BallParams = ConstructorParameters<typeof Circle>[0] & {
  arrowParams?: ArrowParams;
  arrowMagnitude?: number;
};

export class Ball extends Circle {
  private _arrowParams: ArrowParams;
  private _arrowMagnitude: number;
  private _velocityArrow: Arrow | null = null;

  constructor(params: BallParams) {
    const { arrowParams, arrowMagnitude, ...rest } = params;
    super(rest);

    this._arrowParams = arrowParams ?? {
      tipLength: 10,
      stroke: 4,
      color: [0.8, 0.4, 0.6, 1],
    };
    this._arrowMagnitude = arrowMagnitude ?? this.radius * 2;
  }

  get direction() {
    const velocity = this.velocity;
    const length = Math.sqrt(velocity[0] ** 2 + velocity[1] ** 2);
    return [velocity[0] / length, velocity[1] / length];
  }

  get drawEntities() {
    const entities = super.drawEntities;
    if (!this._velocityArrow) {
      this._velocityArrow = new Arrow({
        basePosition: this.position,
        tipPosition: [
          this.position[0] + this.direction[0] * 10,
          this.position[1] + this.direction[1] * 10,
        ],
        ...this._arrowParams,
      });
    }
    return [...entities, ...this._velocityArrow.drawEntities];
  }

  delete() {
    super.delete();
    if (this._velocityArrow) {
      this._velocityArrow.delete();
    }
  }

  sync() {
    super.sync();
    if (this._velocityArrow) {
      this._velocityArrow.basePosition = this.position;
      this._velocityArrow.tipPosition = [
        this.position[0] + this.direction[0] * this._arrowMagnitude,
        this.position[1] + this.direction[1] * this._arrowMagnitude,
      ];
      this._velocityArrow.sync();
    }
  }
}
