/**
 * @file AsyncQRCodeStyling.ts
 * @author Matthew Carroll
 * @description A wrapper for the 'qr-code-styling' library to provide a truly async, reliable update method.
 * @version 1.2.0
 */

import QRCodeStyling, { Options } from 'qr-code-styling';

/**
 * A wrapper class that extends QRCodeStyling to provide a truly async `update` method.
 */
class AsyncQRCodeStyling extends QRCodeStyling {
  private _isInitialRender = true;

  constructor(options?: Partial<Options>) {
    super(options);
  }

  /**
   * Overrides the original update method with a new async version that
   * correctly waits for the QR code to be fully rendered. The complex
   * workaround for the mobile rendering bug is only applied on the first call.
   * @param {Partial<Options>} options - The options object to pass to the update method.
   * @returns {Promise<void>} A promise that resolves when the QR code is guaranteed to be fully rendered.
   */
  async update(options?: Partial<Options>): Promise<void> {
    // Call the original update method to start the render.
    super.update(options);

    // Always await the library's internal drawing promise.
    if ((this as any)._canvasDrawingPromise) {
      await (this as any)._canvasDrawingPromise;
    }

    // Only apply the expensive workaround on the very first render.
    if (this._isInitialRender) {
      this._isInitialRender = false; // Set the flag so this block never runs again.

      // Return a new promise that handles the browser render delay
      // and performs the corrective redraw.
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          if (options?.data) {
            super.update({ data: options.data });
          }
          resolve();
        }, 250);
      });
    }
  }
}

export default AsyncQRCodeStyling;
