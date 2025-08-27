// frontend/src/lib/clipper-lib.d.ts
declare module 'clipper-lib' {
  export interface Point {
    X: number;
    Y: number;
  }
  export type Path = Point[];
  export type Paths = Path[];

  export enum PolyType {
    ptSubject,
    ptClip,
  }
  export enum ClipType {
    ctIntersection,
    ctUnion,
    ctDifference,
    ctXor,
  }
  export enum PolyFillType {
    pftEvenOdd,
    pftNonZero,
    pftPositive,
    pftNegative,
  }
  export enum JoinType {
    jtSquare,
    jtRound,
    jtMiter,
  }
  export enum EndType {
    etClosedPolygon,
    etClosedLine,
    etOpenButt,
    etOpenSquare,
    etOpenRound,
  }

  export class Clipper {
    constructor();
    AddPaths(paths: Paths, polyType: PolyType, closed: boolean): void;
    Execute(
      clipType: ClipType,
      solution: Paths,
      subjFillType: PolyFillType,
      clipFillType: PolyFillType
    ): boolean;
    static CleanPolygon(polygon: Path, distance?: number): Path;
    static CleanPolygons(polygons: Paths, distance?: number): Paths;
    static Orientation(path: Path): boolean;
  }

  export class ClipperOffset {
    constructor(miterLimit?: number, arcTolerance?: number);
    AddPaths(paths: Paths, joinType: JoinType, endType: EndType): void;
    Execute(solution: Paths, delta: number): void;
  }
}
