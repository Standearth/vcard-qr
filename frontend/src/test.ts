import { generateOutlineInBrowser } from './utils/svgOutline';

async function runTestForSVG(
  svgUrl: string,
  containerId: string,
  enableLogging: boolean
) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const originalSvgContainer = container.querySelector('.original-svg');
  const outputSvgElement = container.querySelector(
    '.output-svg'
  ) as SVGElement | null;
  if (!originalSvgContainer || !outputSvgElement) return;

  try {
    const response = await fetch(svgUrl);
    const svgText = await response.text();

    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
    const originalSvgElement = svgDoc.querySelector('svg');
    if (!originalSvgElement) throw new Error('SVG element not found');

    const viewBox = originalSvgElement.getAttribute('viewBox');
    if (!viewBox) throw new Error(`Input SVG "${svgUrl}" has no viewBox.`);

    const viewBoxParts = viewBox.split(' ').map(Number);
    const viewBoxWidth = viewBoxParts[2];
    const viewBoxHeight = viewBoxParts[3];

    if (enableLogging) console.log(`--- Running Test for ${svgUrl} ---`);

    const margin = 5;
    const finalPath = await generateOutlineInBrowser(
      svgText,
      margin,
      viewBoxWidth,
      viewBoxHeight
    );

    // Make the original SVG fluid by removing fixed dimensions
    originalSvgElement.removeAttribute('width');
    originalSvgElement.removeAttribute('height');
    originalSvgElement.setAttribute('preserveAspectRatio', 'xMinYMin meet');

    // Configure the output SVG to match the viewBox and alignment
    outputSvgElement.setAttribute('viewBox', viewBox);
    outputSvgElement.setAttribute('preserveAspectRatio', 'xMinYMin meet');

    // Render the original and the outline
    originalSvgContainer.innerHTML = '';
    originalSvgContainer.appendChild(originalSvgElement);

    outputSvgElement.innerHTML = ''; // Clear previous debug output

    const finalPathElement = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path'
    );
    finalPathElement.setAttribute('d', finalPath);
    finalPathElement.setAttribute('fill', 'none');
    finalPathElement.setAttribute('stroke', 'red');
    finalPathElement.setAttribute('stroke-width', '.5');

    outputSvgElement.appendChild(finalPathElement);

    if (enableLogging) console.log('Test complete!');
  } catch (error) {
    console.error(`Failed to run test for ${svgUrl}:`, error);
  }
}

// Run the tests
runTestForSVG('/test.svg', 'simple-test', false);
runTestForSVG('/three-shapes.svg', 'three-shapes', false);
runTestForSVG('/Stand_WiFi.svg', 'complex-test', true);
