import QRCodeStyling, { Options } from 'qr-code-styling';
import { generateOutlineInBrowser } from '../utils/svgOutline';

// Re-defining the paper.js types locally to remove the dependency
type Point = { x: number; y: number };
type Matrix = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

interface OutlineResult {
  path: string;
  viewBox: {
    width: number;
    height: number;
    x: number;
    y: number;
  };
}

// Simple cache for outline results
interface CacheEntry {
  outline: OutlineResult;
  vertices?: number[][]; // Vertices can be cached too
}
const outlineCache = new Map<string, CacheEntry>();

// Helper to check if an image source is an SVG
const isSvg = (imageSrc?: string): boolean => {
  if (!imageSrc) return false;
  return (
    imageSrc.startsWith('data:image/svg+xml') || imageSrc.startsWith('<svg')
  );
};

/**
 * A lightweight point-in-polygon implementation.
 * Checks if a point is inside a polygon using the ray-casting algorithm.
 * @param point The point to check { x, y }.
 * @param vs The vertices of the polygon [[x1, y1], [x2, y2], ...].
 * @returns True if the point is inside the polygon.
 */
function isPointInPolygon(point: Point, vs: number[][]): boolean {
  const { x, y } = point;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0],
      yi = vs[i][1];
    const xj = vs[j][0],
      yj = vs[j][1];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

class AsyncQRCodeStyling extends QRCodeStyling {
  private _customOutlineResult: OutlineResult | null = null;
  private _shouldApplyCustomLogic = false;

  constructor(options?: Partial<Options>) {
    super(options);
  }

  public override async update(
    options?: Partial<Options> & { dotHidingMode?: 'box' | 'shape' | 'off' }
  ): Promise<void> {
    const dotType = options?.dotsOptions?.type;
    const dotHidingMode = options?.dotHidingMode ?? 'shape';

    const canUseCustomLogic =
      isSvg(options?.image) && (dotType === 'dots' || dotType === 'square');
    this._shouldApplyCustomLogic =
      dotHidingMode === 'shape' && canUseCustomLogic;

    const sanatizedOptions = { ...options };
    if (sanatizedOptions.imageOptions) {
      if (dotHidingMode === 'off') {
        sanatizedOptions.imageOptions.hideBackgroundDots = false;
      } else if (dotHidingMode === 'box') {
        sanatizedOptions.imageOptions.hideBackgroundDots = true;
      } else if (dotHidingMode === 'shape') {
        sanatizedOptions.imageOptions.hideBackgroundDots = !canUseCustomLogic;
      }
    }

    if (this._shouldApplyCustomLogic && options?.image) {
      try {
        this._customOutlineResult = await this.createImageOutline(
          options.image,
          options.imageOptions?.margin || 0
        );
      } catch {
        this._customOutlineResult = null;
        this._shouldApplyCustomLogic = false;
        if (sanatizedOptions.imageOptions) {
          sanatizedOptions.imageOptions.hideBackgroundDots = true;
        }
      }
    } else {
      this._customOutlineResult = null;
    }

    (this as any)._extension = (svg: SVGElement) => {
      this.applyCustomizations(svg);
    };

    setTimeout(() => {
      super.update(sanatizedOptions);
    }, 250);
  }

  private applyCustomizations(svgElement: SVGElement): void {
    if (!this._shouldApplyCustomLogic || !this._customOutlineResult) {
      return;
    }
    if (!(svgElement instanceof SVGSVGElement)) {
      console.error('Custom outline can only be applied to an SVGSVGElement.');
      return;
    }

    const { transform } = this.getOutlineTransform(
      svgElement,
      this._customOutlineResult
    );

    // Check cache for vertices first
    const cacheKey = `${this._customOutlineResult.path}-${JSON.stringify(transform)}`;
    let cachedEntry = outlineCache.get(this._customOutlineResult.path);

    let vertices: number[][];

    if (cachedEntry && cachedEntry.vertices) {
      vertices = cachedEntry.vertices;
    } else {
      // Convert SVG path data to an array of points for our lightweight algorithm
      const pathElement = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      );
      pathElement.setAttribute('d', this._customOutlineResult.path);
      const totalLength = pathElement.getTotalLength();
      const step = 2; // Sample points along the path. Smaller is more accurate but slower.
      const newVertices: number[][] = [];
      for (let i = 0; i < totalLength; i += step) {
        const p = pathElement.getPointAtLength(i);
        const transformedPoint = this.applyTransform(
          { x: p.x, y: p.y },
          transform
        );
        newVertices.push([transformedPoint.x, transformedPoint.y]);
      }
      vertices = newVertices;
      // Store vertices in cache
      if (cachedEntry) {
        cachedEntry.vertices = vertices;
      }
    }

    // Get the bounding box of the transformed polygon for pre-filtering
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    vertices.forEach((v) => {
      minX = Math.min(minX, v[0]);
      minY = Math.min(minY, v[1]);
      maxX = Math.max(maxX, v[0]);
      maxY = Math.max(maxY, v[1]);
    });
    const polygonBounds = { minX, minY, maxX, maxY };

    const dotClipPath = svgElement.querySelector('defs > clipPath[id*="dot"]');
    if (dotClipPath) {
      const dots = dotClipPath.querySelectorAll('rect, circle');
      dots.forEach((dot) => {
        let dotBounds: {
          minX: number;
          minY: number;
          maxX: number;
          maxY: number;
        };

        if (dot.tagName.toLowerCase() === 'circle') {
          const cx = parseFloat(dot.getAttribute('cx') || '0');
          const cy = parseFloat(dot.getAttribute('cy') || '0');
          const r = parseFloat(dot.getAttribute('r') || '0');
          dotBounds = {
            minX: cx - r,
            minY: cy - r,
            maxX: cx + r,
            maxY: cy + r,
          };
        } else {
          const x = parseFloat(dot.getAttribute('x') || '0');
          const y = parseFloat(dot.getAttribute('y') || '0');
          const width = parseFloat(dot.getAttribute('width') || '0');
          const height = parseFloat(dot.getAttribute('height') || '0');
          dotBounds = { minX: x, minY: y, maxX: x + width, maxY: y + height };
        }

        // Bounding box check first for performance
        if (
          dotBounds.maxX > polygonBounds.minX &&
          dotBounds.minX < polygonBounds.maxX &&
          dotBounds.maxY > polygonBounds.minY &&
          dotBounds.minY < polygonBounds.maxY
        ) {
          // If the bounding boxes overlap, check the four corners of the dot
          const corners: Point[] = [
            { x: dotBounds.minX, y: dotBounds.minY }, // Top-left
            { x: dotBounds.maxX, y: dotBounds.minY }, // Top-right
            { x: dotBounds.minX, y: dotBounds.maxY }, // Bottom-left
            { x: dotBounds.maxX, y: dotBounds.maxY }, // Bottom-right
          ];

          for (const corner of corners) {
            if (isPointInPolygon(corner, vertices)) {
              dot.setAttribute('visibility', 'hidden');
              break; // No need to check other corners if one is inside
            }
          }
        }
      });
    }
  }

  private applyTransform(point: Point, matrix: Matrix): Point {
    return {
      x: matrix.a * point.x + matrix.c * point.y + matrix.e,
      y: matrix.b * point.x + matrix.d * point.y + matrix.f,
    };
  }

  private getOutlineTransform(
    svg: SVGSVGElement,
    outlineResult: OutlineResult
  ) {
    const renderedImage = svg.querySelector('image');
    if (!renderedImage) {
      throw new Error('Could not find rendered image element.');
    }

    const finalLogoStartX = parseFloat(renderedImage.getAttribute('x') || '0');
    const finalLogoStartY = parseFloat(renderedImage.getAttribute('y') || '0');
    const finalLogoWidth = parseFloat(
      renderedImage.getAttribute('width') || '0'
    );
    const finalLogoHeight = parseFloat(
      renderedImage.getAttribute('height') || '0'
    );

    const scale = Math.min(
      finalLogoWidth / outlineResult.viewBox.width,
      finalLogoHeight / outlineResult.viewBox.height
    );

    const translateX =
      finalLogoStartX +
      (finalLogoWidth - outlineResult.viewBox.width * scale) / 2 -
      outlineResult.viewBox.x * scale;
    const translateY =
      finalLogoStartY +
      (finalLogoHeight - outlineResult.viewBox.height * scale) / 2 -
      outlineResult.viewBox.y * scale;

    const transformMatrix = {
      a: scale,
      b: 0,
      c: 0,
      d: scale,
      e: translateX,
      f: translateY,
    };

    return {
      transform: transformMatrix,
    };
  }

  private async createImageOutline(
    imageUrl: string,
    margin = 0
  ): Promise<OutlineResult> {
    const cacheKey = `${imageUrl}-${margin}`;
    const cached = outlineCache.get(cacheKey);
    if (cached) {
      return cached.outline;
    }

    let svgText: string;

    if (imageUrl.startsWith('data:image/svg+xml;base64,')) {
      const base64 = imageUrl.substring('data:image/svg+xml;base64,'.length);
      svgText = atob(base64);
    } else if (imageUrl.startsWith('<svg')) {
      svgText = imageUrl;
    } else {
      const response = await fetch(imageUrl);
      if (!response.ok)
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      svgText = await response.text();
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svgElement = doc.documentElement as unknown as SVGSVGElement;
    const viewBoxAttr = svgElement.getAttribute('viewBox');
    if (!viewBoxAttr) throw new Error('SVG must have a viewBox attribute.');

    const [x, y, width, height] = viewBoxAttr.split(' ').map(parseFloat);
    const path = await generateOutlineInBrowser(svgText, margin, width, height);

    const outline: OutlineResult = { path, viewBox: { x, y, width, height } };
    outlineCache.set(cacheKey, { outline }); // Store the new outline in the cache
    return outline;
  }
}

export default AsyncQRCodeStyling;
