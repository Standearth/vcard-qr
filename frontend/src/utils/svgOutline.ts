import {
  Clipper,
  ClipType,
  ClipperOffset,
  EndType,
  JoinType,
  Paths,
  PolyFillType,
  PolyType,
} from 'clipper-lib';
import paper, { Path, Shape, Item } from 'paper';

type PaperPath = InstanceType<typeof Path>;
type PaperShape = InstanceType<typeof Shape>;
type PaperItem = InstanceType<typeof Item>;

const SCALE = 10000;

// --- Helper Functions ---

/**
 * Converts Clipper library paths back to an SVG path data string.
 */
function clipperToSvgPath(polytree: Paths): string {
  let d = '';
  for (const poly of polytree) {
    if (poly.length === 0) continue;
    d += `M ${poly[0].X / SCALE} ${poly[0].Y / SCALE} `;
    for (let i = 1; i < poly.length; i++) {
      d += `L ${poly[i].X / SCALE} ${poly[i].Y / SCALE} `;
    }
    d += 'Z ';
  }
  return d.trim();
}

/**
 * Converts a Paper.js path into a format suitable for the Clipper library.
 */
function pathToClipper(path: PaperPath): { X: number; Y: number }[] {
  const workingPath = path.clone();
  workingPath.flatten(0.2);

  if (workingPath.clockwise) {
    workingPath.reverse();
  }

  const finalClipperPoints = workingPath.segments.map((s) => {
    const worldPoint = path.localToGlobal(s.point);
    return {
      X: Math.round(worldPoint.x * SCALE),
      Y: Math.round(worldPoint.y * SCALE),
    };
  });
  return finalClipperPoints;
}

/**
 * Pre-processes the raw SVG string, converting inline styles to direct attributes
 * to ensure Paper.js can read them correctly.
 */
function preprocessSvg(svgData: string): string {
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgData, 'image/svg+xml');
  const svgElement = svgDoc.documentElement;

  const allElements = svgElement.getElementsByTagName('*');

  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
    if (el.hasAttribute('style')) {
      const styleAttr = el.getAttribute('style');
      if (styleAttr) {
        styleAttr.split(';').forEach((rule) => {
          const [property, value] = rule.split(':').map((s) => s.trim());
          if (property && value) {
            el.setAttribute(property, value);
          }
        });
        el.removeAttribute('style');
      }
    }
  }

  const serializer = new XMLSerializer();
  return serializer.serializeToString(svgElement);
}

/**
 * Takes a collection of Paper.js items and generates their corresponding final outlines.
 */
function createIndividualOutlines(
  visibleItems: PaperItem[],
  margin: number
): Paths {
  const allOutlinedPaths: Paths = [];

  visibleItems.forEach((item) => {
    const pathItem = (
      item instanceof Shape ? item.toPath() : item.clone()
    ) as PaperPath;

    const clipperInput = pathToClipper(pathItem);
    if (clipperInput.length === 0) return;

    if (!pathItem.closed) {
      // --- HANDLE LINES (OPEN PATHS) ---
      const correctStrokeWidth = item.style.strokeWidth || 1;
      const finalOffset = new ClipperOffset();
      const finalOffsetPaths: Paths = [];
      const totalOffset = margin + correctStrokeWidth;
      finalOffset.AddPaths(
        [clipperInput],
        JoinType.jtRound,
        EndType.etOpenRound
      );
      finalOffset.Execute(finalOffsetPaths, totalOffset * SCALE);
      allOutlinedPaths.push(...finalOffsetPaths);
    } else {
      // --- HANDLE SHAPES (CLOSED PATHS) ---
      const finalOffset = new ClipperOffset();
      const finalOffsetPaths: Paths = [];
      finalOffset.AddPaths(
        [clipperInput],
        JoinType.jtRound,
        EndType.etClosedPolygon
      );
      finalOffset.Execute(finalOffsetPaths, margin * SCALE);
      allOutlinedPaths.push(...finalOffsetPaths);
    }
  });

  return allOutlinedPaths;
}

/**
 * Filters out paths that are "holes" by checking their orientation.
 */
function removeHoles(paths: Paths): Paths {
  return paths.filter((path) => (Clipper as any).Orientation(path));
}

// --- Main Function ---

export function generateOutlineInBrowser(
  svgData: string,
  margin: number,
  viewBoxWidth: number,
  viewBoxHeight: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const modifiedSvgData = preprocessSvg(svgData);

    paper.setup(new paper.Size(viewBoxWidth, viewBoxHeight));

    paper.project.importSVG(modifiedSvgData, {
      applyMatrix: false,
      onLoad: (item: PaperItem) => {
        try {
          item.position = new paper.Point(0, 0);
          item.matrix.reset();

          const visibleItems = item.getItems({
            recursive: true,
            match: (i: PaperItem) =>
              (i instanceof Shape || i instanceof Path) &&
              i.visible &&
              ((i.fillColor && i.fillColor.alpha > 0) ||
                (i.strokeColor && i.strokeColor.alpha > 0)),
          });

          if (visibleItems.length === 0) {
            resolve('');
            return;
          }

          const allOutlinedPaths = createIndividualOutlines(
            visibleItems,
            margin
          );

          // Union all the individual outlines into a single (potentially multi-part) shape
          const finalMerger = new Clipper();
          const finalMergedPath: Paths = [];
          finalMerger.AddPaths(allOutlinedPaths, PolyType.ptSubject, true);
          finalMerger.Execute(
            ClipType.ctUnion,
            finalMergedPath,
            PolyFillType.pftNonZero,
            PolyFillType.pftNonZero
          );

          const outlinesWithoutHoles = removeHoles(finalMergedPath);

          const finalPathData = clipperToSvgPath(outlinesWithoutHoles);

          paper.project.clear();
          paper.view.remove();
          resolve(finalPathData);
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      },
      onError: (error: string) => {
        reject(new Error(`Failed to import SVG: ${error}`));
      },
    });
  });
}
