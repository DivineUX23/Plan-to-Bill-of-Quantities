"""
Floor Plan Measurement System
Author: Assistant
Description: Measures wall lengths and total girth from PDF floor plans using OpenCV
"""


import cv2
import numpy as np  
from pdf2image import convert_from_path 
import matplotlib.pyplot as plt  


INPUT_PDF = "floor_plan.pdf" 
DPI = 300 
SCALE_FACTOR = 0.01  
MIN_WALL_AREA = 500 
MORPH_KERNEL_SIZE = (3, 3) 
CONTOUR_APPROX_EPSILON = 0.02  


try:
    print(f"Converting PDF to image at {DPI} DPI...")
    pages = convert_from_path(INPUT_PDF, dpi=DPI, poppler_path=r"Release-24.08.0-0\poppler-24.08.0\Library\bin")
    if not pages:
        raise ValueError("No pages found in PDF")
    
    pil_image = pages[0]
    img = np.array(pil_image) 
    
    img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
    
except Exception as e:
    print(f"Error processing PDF: {str(e)}")
    exit()


try:
    print("Preprocessing image...")
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    _, thresh = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)
    
    kernel = np.ones(MORPH_KERNEL_SIZE, np.uint8)
    morphed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)
    
except Exception as e:
    print(f"Error in image preprocessing: {str(e)}")
    exit()

try:
    print("Detecting contours...")
    contours, hierarchy = cv2.findContours(
        morphed, 
        cv2.RETR_TREE, 
        cv2.CHAIN_APPROX_SIMPLE
    )
    
    if not contours:
        raise ValueError("No contours found - check thresholding parameters")

except Exception as e:
    print(f"Error in contour detection: {str(e)}")
    exit()


print("Filtering wall contours...")
wall_contours = []

for i, contour in enumerate(contours):
    area = cv2.contourArea(contour)
    if area < MIN_WALL_AREA:
        continue
        
    if hierarchy[0][i][3] != -1:
        continue 
        
    epsilon = CONTOUR_APPROX_EPSILON * cv2.arcLength(contour, True)
    approx = cv2.approxPolyDP(contour, epsilon, True)
    
    if len(approx) >= 4:
        wall_contours.append(contour)


if not wall_contours:
    print("Warning: No walls detected - adjust filtering parameters")
    exit()


print("Calculating measurements...")
total_girth = 0.0
wall_data = []

for i, contour in enumerate(wall_contours):
    perimeter_px = cv2.arcLength(contour, closed=True)
    perimeter_m = perimeter_px * SCALE_FACTOR
    
    wall_data.append({
        "id": i+1,
        "perimeter_px": perimeter_px,
        "perimeter_m": perimeter_m,
        "area_m2": cv2.contourArea(contour) * (SCALE_FACTOR ** 2)
    })
    
    total_girth += perimeter_m
print("\n=== Measurement Results ===")
print(f"Total wall girth: {total_girth:.2f} meters")
print(f"Number of walls detected: {len(wall_contours)}")

print("\nIndividual Wall Measurements:")
for wall in wall_data:
    print(f"Wall {wall['id']}:")
    print(f"  - Perimeter: {wall['perimeter_m']:.2f}m")
    print(f"  - Area: {wall['area_m2']:.2f}m²")

try:
    result_img = img.copy()
    cv2.drawContours(result_img, wall_contours, -1, (0, 255, 0), 2)
    
    # Create comparison plot
    plt.figure(figsize=(15, 7))
    
    plt.subplot(1, 3, 1)
    plt.title("Original Image")
    plt.imshow(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    plt.axis('off')
    
    plt.subplot(1, 3, 2)
    plt.title("Processed Image")
    plt.imshow(morphed, cmap='gray')
    plt.axis('off')
    
    plt.subplot(1, 3, 3)
    plt.title("Detected Walls")
    plt.imshow(cv2.cvtColor(result_img, cv2.COLOR_BGR2RGB))
    plt.axis('off')
    
    plt.tight_layout()
    plt.show()

except Exception as e:
    print(f"Visualization error: {str(e)}")


"""
Critical Implementation Notes:

1. Scale Factor Calibration:
   - THIS IS THE MOST IMPORTANT PARAMETER
   - Calculate using a known measurement in the PDF:
     scale_factor = real_world_length / pixel_length
   - Example: If a 5m wall is 500px long:
     scale_factor = 5 / 500 = 0.01 m/px

2. Threshold Adjustment:
   - If walls aren't detected, adjust the 200 value in cv2.threshold
   - Use cv2.THRESH_OTSU for automatic thresholding:
     _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

3. Filtering Parameters:
   - MIN_WALL_AREA: Increase if detecting small false positives
   - MORPH_KERNEL_SIZE: Increase to fill larger gaps in walls
   - CONTOUR_APPROX_EPSILON: Reduce for more precise contour shapes

4. PDF Quality:
   - Vector PDFs (CAD exports) work best
   - For scanned PDFs, add preprocessing steps:
     - Deskewing (cv2.warpAffine)
     - Noise removal (cv2.fastNlMeansDenoising)
     - Sharpening filters

5. Advanced Use Cases:
   - For complex walls, implement ML-based segmentation
   - For multi-room analysis, use cv2.findContours with RETR_CCOMP
   - Add text removal using inpainting if labels interfere
"""