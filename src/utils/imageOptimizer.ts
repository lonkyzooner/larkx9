/**
 * Image optimization utilities for LARK
 * 
 * This module provides functions for optimizing images to improve
 * application performance and reduce bandwidth usage.
 */

// Default image optimization settings
const DEFAULT_QUALITY = 0.8;
const DEFAULT_MAX_WIDTH = 1200;
const DEFAULT_MAX_HEIGHT = 1200;

/**
 * Options for image optimization
 */
interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  preserveExif?: boolean;
}

/**
 * Resize an image to fit within the specified dimensions while maintaining aspect ratio
 * @param file Image file to resize
 * @param options Resize options
 * @returns Promise resolving to a Blob containing the resized image
 */
export async function resizeImage(
  file: File | Blob,
  options: ImageOptimizationOptions = {}
): Promise<Blob> {
  const {
    maxWidth = DEFAULT_MAX_WIDTH,
    maxHeight = DEFAULT_MAX_HEIGHT,
    quality = DEFAULT_QUALITY,
    format = 'jpeg',
    preserveExif = false
  } = options;

  return new Promise((resolve, reject) => {
    // Create file reader to read the image
    const reader = new FileReader();
    reader.onload = (event) => {
      // Create an image element to load the image data
      const img = new Image();
      img.onload = () => {
        // Calculate new dimensions while maintaining aspect ratio
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
        
        // Create a canvas to draw the resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        // Draw the image on the canvas
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert canvas to blob
        const mimeType = format === 'webp' 
          ? 'image/webp' 
          : format === 'png' 
            ? 'image/png' 
            : 'image/jpeg';
        
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Could not create blob from canvas'));
              return;
            }
            
            // If preserving EXIF data is requested and the input is a JPEG,
            // we would need to extract and reapply EXIF data here.
            // This would require additional libraries like exif-js.
            
            resolve(blob);
          },
          mimeType,
          quality
        );
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      // Set the image source to the loaded file data
      img.src = event.target?.result as string;
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    // Read the file as a data URL
    reader.readAsDataURL(file);
  });
}

/**
 * Convert an image to a WebP format for better compression
 * @param file Image file to convert
 * @param quality Quality of the output WebP image (0-1)
 * @returns Promise resolving to a Blob containing the WebP image
 */
export async function convertToWebP(
  file: File | Blob,
  quality: number = DEFAULT_QUALITY
): Promise<Blob> {
  return resizeImage(file, {
    maxWidth: DEFAULT_MAX_WIDTH,
    maxHeight: DEFAULT_MAX_HEIGHT,
    quality,
    format: 'webp'
  });
}

/**
 * Create a thumbnail from an image
 * @param file Image file to create thumbnail from
 * @param maxDimension Maximum width or height of the thumbnail
 * @returns Promise resolving to a Blob containing the thumbnail
 */
export async function createThumbnail(
  file: File | Blob,
  maxDimension: number = 200
): Promise<Blob> {
  return resizeImage(file, {
    maxWidth: maxDimension,
    maxHeight: maxDimension,
    quality: 0.7,
    format: 'jpeg'
  });
}

/**
 * Check if WebP format is supported by the browser
 * @returns Promise resolving to a boolean indicating WebP support
 */
export async function isWebPSupported(): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve(img.width > 0 && img.height > 0);
    };
    img.onerror = () => {
      resolve(false);
    };
    img.src = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
  });
}

/**
 * Optimize an image for the current device and network conditions
 * @param file Image file to optimize
 * @returns Promise resolving to an optimized image blob
 */
export async function optimizeImageForCurrentConditions(file: File | Blob): Promise<Blob> {
  // Define extended Navigator interface with all required properties
  interface ExtendedNavigator extends Navigator {
    connection?: {
      effectiveType: string;
      saveData: boolean;
    };
    deviceMemory?: number;
  }

  // Cast navigator to our extended interface
  const extendedNav = navigator as ExtendedNavigator;
  
  // Check if the connection is slow
  const connection = extendedNav.connection;
  const isSlowConnection = connection && 
    (connection.effectiveType === '2g' || connection.saveData);
  
  // Check available memory
  const isLowMemoryDevice = extendedNav.deviceMemory !== undefined && extendedNav.deviceMemory < 4;
  
  // Determine appropriate settings based on conditions
  let quality = DEFAULT_QUALITY;
  let maxWidth = DEFAULT_MAX_WIDTH;
  let maxHeight = DEFAULT_MAX_HEIGHT;
  let format: 'jpeg' | 'png' | 'webp' = 'jpeg';
  
  // Adjust settings for slow connections or low memory devices
  if (isSlowConnection || isLowMemoryDevice) {
    quality = 0.6;
    maxWidth = 800;
    maxHeight = 800;
  }
  
  // Use WebP if supported
  if (await isWebPSupported()) {
    format = 'webp';
  }
  
  // Optimize the image with the determined settings
  return resizeImage(file, {
    maxWidth,
    maxHeight,
    quality,
    format
  });
}

/**
 * Calculate the estimated file size of an image after optimization
 * @param originalSize Original file size in bytes
 * @param options Optimization options
 * @returns Estimated file size in bytes
 */
export function estimateOptimizedSize(
  originalSize: number,
  options: ImageOptimizationOptions = {}
): number {
  const {
    quality = DEFAULT_QUALITY,
    format = 'jpeg'
  } = options;
  
  // Compression ratios based on format
  const compressionRatios = {
    jpeg: 0.3,
    png: 0.5,
    webp: 0.2
  };
  
  // Estimate size based on quality and format
  const compressionRatio = compressionRatios[format];
  const qualityFactor = quality * 1.5; // Higher quality means less compression
  
  return Math.round(originalSize * compressionRatio * qualityFactor);
}
