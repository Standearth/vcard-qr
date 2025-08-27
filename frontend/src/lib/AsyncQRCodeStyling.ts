// frontend/src/lib/AsyncQRCodeStyling.ts
import QRCodeStyling, { Options } from 'qr-code-styling';
import { generateOutlineInBrowser } from '../utils/svgOutline';

// Define necessary types locally to avoid external dependencies
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

// Cache for outline and the calculated vertex data
interface CacheEntry {
  outline: OutlineResult;
  vertices?: number[][][]; // Now an array of polygons (vertex arrays)
}
const outlineCache = new Map<string, CacheEntry>();

// Feature flag for all visual and console debugging
const VISUAL_DEBUG = import.meta.env.VITE_VISUAL_DEBUG === 'true';

// Helper to check if an image source is an SVG
const isSvg = (imageSrc?: string): boolean => {
  if (!imageSrc) return false;
  return (
    imageSrc.startsWith('data:image/svg+xml') || imageSrc.startsWith('<svg')
  );
};

/**
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
  private _wrapSize = 0.1;

  constructor(options?: Partial<Options>) {
    super(options);
  }

  public override update(
    options?: Partial<Options> & {
      dotHidingMode?: 'box' | 'shape' | 'off';
      wrapSize?: number;
    }
  ): void {
    const dotType = options?.dotsOptions?.type;
    const dotHidingMode = options?.dotHidingMode ?? 'shape';
    this._wrapSize = options?.wrapSize ?? 0.1;

    const canUseCustomLogic =
      isSvg(options?.image) && (dotType === 'dots' || dotType === 'square');
    this._shouldApplyCustomLogic =
      dotHidingMode === 'shape' && canUseCustomLogic;

    // Capture the original margin before it's sanitized
    const originalImageMargin = options?.imageOptions?.margin;
    const sanitizedOptions = { ...options };

    const processUpdate = (): void => {
      this._extension = (svg: SVGElement): void => {
        this.applyCustomizations(svg);
      };

      // Sanitize imageOptions just before passing to the superclass
      if (sanitizedOptions.imageOptions) {
        if (dotHidingMode === 'off') {
          sanitizedOptions.imageOptions.hideBackgroundDots = false;
        } else if (dotHidingMode === 'box') {
          sanitizedOptions.imageOptions.hideBackgroundDots = true;
        } else if (dotHidingMode === 'shape') {
          // When wrapping, we handle dot hiding manually, so we tell the library not to hide any.
          sanitizedOptions.imageOptions.hideBackgroundDots = false;
          // The library should not add any margin, as our outline already includes it.
          sanitizedOptions.imageOptions.margin = 0;
        }
      }

      super.update(sanitizedOptions);
    };
    if (this._shouldApplyCustomLogic && options?.image) {
      this.createImageOutline(options.image, originalImageMargin)
        .then((outlineResult) => {
          this._customOutlineResult = outlineResult;
        })
        .catch(() => {
          this._customOutlineResult = null;
          this._shouldApplyCustomLogic = false;
        })
        .finally(processUpdate);
    } else {
      this._customOutlineResult = null;
      processUpdate();
    }
  }

  private applyCustomizations(svgElement: SVGElement): void {
    if (VISUAL_DEBUG) {
      const oldDebugGroup = svgElement.querySelector('#debug-group');
      if (oldDebugGroup) {
        oldDebugGroup.remove();
      }
    }

    if (
      !this._shouldApplyCustomLogic ||
      !this._customOutlineResult ||
      !(svgElement instanceof SVGSVGElement) ||
      !this._qr
    ) {
      return;
    }

    const { transform } = this.getOutlineTransform(
      svgElement,
      this._customOutlineResult
    );

    const cacheKey = `${
      this._customOutlineResult.path
    }-${JSON.stringify(transform)}`;
    const cachedEntry = outlineCache.get(cacheKey);
    let polygons: number[][][];

    if (cachedEntry?.vertices) {
      polygons = cachedEntry.vertices;
    } else {
      const pathData = this._customOutlineResult.path;
      const pathCommands = pathData
        .split(/(?=[M])/)
        .filter((s) => s.startsWith('M'));
      const newPolygons: number[][][] = [];

      for (const command of pathCommands) {
        const pathElement = document.createElementNS(
          'http://www.w3.org/2000/svg',
          'path'
        );
        pathElement.setAttribute('d', command);
        const totalLength = pathElement.getTotalLength();
        if (totalLength === 0) continue;

        const step = Math.max(2, totalLength / 200);
        const vertices: number[][] = [];
        for (let i = 0; i < totalLength; i += step) {
          const p = pathElement.getPointAtLength(i);
          const transformedPoint = this.applyTransform(
            { x: p.x, y: p.y },
            transform
          );
          vertices.push([transformedPoint.x, transformedPoint.y]);
        }
        newPolygons.push(vertices);
      }
      polygons = newPolygons;
      outlineCache.set(cacheKey, {
        outline: this._customOutlineResult,
        vertices: polygons,
      });
    }

    const dotClipPath = svgElement.querySelector('defs > clipPath[id*="dot"]');
    if (!dotClipPath) {
      return;
    }

    let debugGroup: SVGGElement | null = null;
    if (VISUAL_DEBUG) {
      debugGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      debugGroup.id = 'debug-group';
      svgElement.appendChild(debugGroup);

      polygons.forEach((vertices) => {
        const debugPolygon = document.createElementNS(
          'http://www.w3.org/2000/svg',
          'polygon'
        );
        debugPolygon.setAttribute(
          'points',
          vertices.map((p) => p.join(',')).join(' ')
        );
        debugPolygon.setAttribute('fill', 'rgba(255, 0, 0, 0.05)');
        debugPolygon.setAttribute('stroke', 'red');
        debugPolygon.setAttribute('stroke-width', '1');
        debugGroup!.appendChild(debugPolygon);
      });
    }

    const dots = dotClipPath.querySelectorAll('rect, circle');

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    polygons.flat().forEach((v) => {
      minX = Math.min(minX, v[0]);
      minY = Math.min(minY, v[1]);
      maxX = Math.max(maxX, v[0]);
      maxY = Math.max(maxY, v[1]);
    });

    if (dots.length > 0) {
      const firstDot = dots[0];
      let dotRadius = 0;
      if (firstDot.tagName.toLowerCase() === 'circle') {
        dotRadius = parseFloat(firstDot.getAttribute('r') || '0');
      } else {
        const dotWidth = parseFloat(firstDot.getAttribute('width') || '0');
        dotRadius = dotWidth / 2;
      }
      minX -= dotRadius;
      minY -= dotRadius;
      maxX += dotRadius;
      maxY += dotRadius;
    }

    if (VISUAL_DEBUG) {
      const debugOuterRect = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'rect'
      );
      debugOuterRect.setAttribute('x', String(minX));
      debugOuterRect.setAttribute('y', String(minY));
      debugOuterRect.setAttribute('width', String(maxX - minX));
      debugOuterRect.setAttribute('height', String(maxY - minY));
      debugOuterRect.setAttribute('fill', 'rgba(0,0,0,0.05');
      debugOuterRect.setAttribute('stroke', 'black');
      debugOuterRect.setAttribute('stroke-width', '1');
      debugGroup!.appendChild(debugOuterRect);
    }

    const smallerDimension = Math.min(maxX - minX, maxY - minY);
    const contractedAmount = smallerDimension * this._wrapSize * 0.5;

    const innerBounds = {
      minX: minX + contractedAmount,
      minY: minY + contractedAmount,
      maxX: maxX - contractedAmount,
      maxY: maxY - contractedAmount,
    };

    if (VISUAL_DEBUG) {
      const debugInnerRect = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'rect'
      );
      debugInnerRect.setAttribute('x', String(innerBounds.minX));
      debugInnerRect.setAttribute('y', String(innerBounds.minY));
      debugInnerRect.setAttribute(
        'width',
        String(innerBounds.maxX - innerBounds.minX)
      );
      debugInnerRect.setAttribute(
        'height',
        String(innerBounds.maxY - innerBounds.minY)
      );
      debugInnerRect.setAttribute('fill', 'rgba(0,0,0,0.05');
      debugInnerRect.setAttribute('stroke', 'black');
      debugInnerRect.setAttribute('stroke-width', '1');
      debugGroup!.appendChild(debugInnerRect);
    }

    dots.forEach((dot) => {
      dot.setAttribute('visibility', 'visible');
      let dotCenter: Point;
      let dotX: number, dotY: number, dotWidth: number, dotHeight: number;

      if (dot.tagName.toLowerCase() === 'circle') {
        const cx = parseFloat(dot.getAttribute('cx') || '0');
        const cy = parseFloat(dot.getAttribute('cy') || '0');
        const r = parseFloat(dot.getAttribute('r') || '0');
        dotCenter = { x: cx, y: cy };
        dotX = cx - r;
        dotY = cy - r;
        dotWidth = r * 2;
        dotHeight = r * 2;
      } else {
        dotX = parseFloat(dot.getAttribute('x') || '0');
        dotY = parseFloat(dot.getAttribute('y') || '0');
        dotWidth = parseFloat(dot.getAttribute('width') || '0');
        dotHeight = parseFloat(dot.getAttribute('height') || '0');
        dotCenter = { x: dotX + dotWidth / 2, y: dotY + dotHeight / 2 };
      }

      let shouldHide = false;
      let debugColor = 'green';
      let isInCorridor = false;

      if (
        dotCenter.x < minX ||
        dotCenter.x > maxX ||
        dotCenter.y < minY ||
        dotCenter.y > maxY
      ) {
        debugColor = 'grey';
      } else if (
        dotCenter.x > innerBounds.minX &&
        dotCenter.x < innerBounds.maxX &&
        dotCenter.y > innerBounds.minY &&
        dotCenter.y < innerBounds.maxY
      ) {
        shouldHide = true;
      } else {
        isInCorridor = true;
        const corners: Point[] = [
          { x: dotX, y: dotY },
          { x: dotX + dotWidth, y: dotY },
          { x: dotX, y: dotY + dotHeight },
          { x: dotX + dotWidth, y: dotY + dotHeight },
        ];

        let isInsidePolygon = false;
        for (const corner of corners) {
          for (const vertices of polygons) {
            if (isPointInPolygon(corner, vertices)) {
              isInsidePolygon = true;
              break;
            }
          }
          if (isInsidePolygon) break;
        }

        if (isInsidePolygon) {
          shouldHide = true;
        } else {
          debugColor = 'orange';
        }
      }

      if (shouldHide) {
        dot.setAttribute('visibility', 'hidden');
      }

      if (VISUAL_DEBUG) {
        const debugCircle = document.createElementNS(
          'http://www.w3.org/2000/svg',
          'circle'
        );
        debugCircle.setAttribute('cx', String(dotCenter.x));
        debugCircle.setAttribute('cy', String(dotCenter.y));
        debugCircle.setAttribute('r', '1');
        debugCircle.setAttribute('fill', debugColor);
        debugGroup!.appendChild(debugCircle);

        if (isInCorridor) {
          const dotBox = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'rect'
          );
          dotBox.setAttribute('x', String(dotX));
          dotBox.setAttribute('y', String(dotY));
          dotBox.setAttribute('width', String(dotWidth));
          dotBox.setAttribute('height', String(dotHeight));
          dotBox.setAttribute('fill', 'rgba(0,0,0,0.1');
          dotBox.setAttribute('stroke', 'rgba(50,50,50,1');
          dotBox.setAttribute('stroke-width', '1');
          debugGroup!.appendChild(dotBox);
        }
      }
    });
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
  ): { transform: Matrix } {
    const renderedImage = svg.querySelector('image');
    if (!renderedImage) {
      throw new Error('Could not find rendered image element in SVG.');
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

    return {
      transform: {
        a: scale,
        b: 0,
        c: 0,
        d: scale,
        e: translateX,
        f: translateY,
      },
    };
  }

  private async createImageOutline(
    imageUrl: string,
    margin = 0
  ): Promise<OutlineResult> {
    const cacheKey = `${imageUrl}-${margin}`;
    const cached = outlineCache.get(cacheKey);
    if (cached?.outline) {
      return cached.outline;
    }

    let svgText: string;
    if (imageUrl.startsWith('data:image/svg+xml;base64,')) {
      svgText = atob(imageUrl.substring('data:image/svg+xml;base64,'.length));
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
    if (!viewBoxAttr)
      throw new Error('SVG must have a viewBox attribute for outlining.');

    const [x, y, width, height] = viewBoxAttr.split(' ').map(parseFloat);
    const path = await generateOutlineInBrowser(svgText, margin, width, height);

    const outline: OutlineResult = { path, viewBox: { x, y, width, height } };
    outlineCache.set(cacheKey, { outline });
    return outline;
  }
}

export default AsyncQRCodeStyling;
