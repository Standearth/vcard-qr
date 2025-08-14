import QRCodeStyling, { Options } from 'qr-code-styling';
import { generateOutlineInBrowser } from '../utils/svgOutline';
import paper from 'paper';

interface OutlineResult {
  path: string;
  viewBox: {
    width: number;
    height: number;
    x: number;
    y: number;
  };
}

// Helper to check if an image source is an SVG
const isSvg = (imageSrc?: string): boolean => {
  if (!imageSrc) return false;
  return (
    imageSrc.startsWith('data:image/svg+xml') || imageSrc.startsWith('<svg')
  );
};

class AsyncQRCodeStyling extends QRCodeStyling {
  private _customOutlineResult: OutlineResult | null = null;
  private _shouldApplyCustomLogic = false;

  constructor(options?: Partial<Options>) {
    super(options);
  }

  public override async update(options?: Partial<Options>): Promise<void> {
    const dotType = options?.dotsOptions?.type;
    this._shouldApplyCustomLogic =
      isSvg(options?.image) &&
      !!options?.imageOptions?.hideBackgroundDots &&
      (dotType === 'dots' || dotType === 'square');

    if (this._shouldApplyCustomLogic && options?.image) {
      try {
        this._customOutlineResult = await this.createImageOutline(
          options.image,
          options.imageOptions?.margin || 0
        );
      } catch (error) {
        this._customOutlineResult = null;
        this._shouldApplyCustomLogic = false; // Fallback if outline fails
      }
    } else {
      this._customOutlineResult = null;
    }

    const sanatizedOptions = { ...options };

    // If using custom logic, disable the library's built-in dot removal.
    // Otherwise, let the library handle it normally.
    if (this._shouldApplyCustomLogic && sanatizedOptions.imageOptions) {
      sanatizedOptions.imageOptions = {
        ...sanatizedOptions.imageOptions,
        hideBackgroundDots: false,
      };
    }

    (this as any)._extension = (svg: SVGElement) => {
      this.applyCustomizations(svg);
    };

    super.update(sanatizedOptions);
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

    const outlinePath = new paper.Path(this._customOutlineResult.path);
    const matrix = new paper.Matrix(
      transform.a,
      transform.c,
      transform.b,
      transform.d,
      transform.e,
      transform.f
    );
    outlinePath.transform(matrix);

    const dotClipPath = svgElement.querySelector('defs > clipPath[id*="dot"]');
    if (dotClipPath) {
      const dots = dotClipPath.querySelectorAll('rect, circle');

      const itemToElementMap = new Map<paper.Item, Element>();
      const dotItems: paper.Item[] = [];

      dots.forEach((dot) => {
        let dotPath: paper.Path;
        if (dot.tagName.toLowerCase() === 'circle') {
          const cx = parseFloat(dot.getAttribute('cx') || '0');
          const cy = parseFloat(dot.getAttribute('cy') || '0');
          const r = parseFloat(dot.getAttribute('r') || '0');
          dotPath = new paper.Path.Circle({
            center: new paper.Point(cx, cy),
            radius: r,
          });
        } else {
          const x = parseFloat(dot.getAttribute('x') || '0');
          const y = parseFloat(dot.getAttribute('y') || '0');
          const width = parseFloat(dot.getAttribute('width') || '0');
          const height = parseFloat(dot.getAttribute('height') || '0');
          dotPath = new paper.Path.Rectangle({
            from: new paper.Point(x, y),
            to: new paper.Point(x + width, y + height),
          });
        }
        itemToElementMap.set(dotPath, dot);
        dotItems.push(dotPath);
      });

      dotItems.forEach((item) => {
        if (
          outlinePath.intersects(item) ||
          outlinePath.contains(item.position)
        ) {
          const elementToRemove = itemToElementMap.get(item);
          if (elementToRemove) {
            elementToRemove.remove();
          }
        }
      });

      const oldId = dotClipPath.id;
      const newId = `${oldId}-modified-${Date.now()}`;
      dotClipPath.id = newId;

      const dotGroup = svgElement.querySelector(
        `[clip-path="url('#${oldId}')"]`
      ) as SVGElement | null;
      if (dotGroup) {
        dotGroup.setAttribute('clip-path', `url('#${newId}')`);
      }
    }

    paper.project.clear();
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

    const scaledOutlineWidth = outlineResult.viewBox.width * scale;
    const scaledOutlineHeight = outlineResult.viewBox.height * scale;

    const translateX =
      finalLogoStartX +
      (finalLogoWidth - scaledOutlineWidth) / 2 -
      outlineResult.viewBox.x * scale;
    const translateY =
      finalLogoStartY +
      (finalLogoHeight - scaledOutlineHeight) / 2 -
      outlineResult.viewBox.y * scale;

    const transformMatrix = new DOMMatrix()
      .translate(translateX, translateY)
      .scale(scale);

    return {
      transform: transformMatrix,
      transformString: `translate(${translateX} ${translateY}) scale(${scale})`,
    };
  }

  private async createImageOutline(
    imageUrl: string,
    margin = 0
  ): Promise<OutlineResult> {
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
    return { path, viewBox: { x, y, width, height } };
  }
}

export default AsyncQRCodeStyling;
