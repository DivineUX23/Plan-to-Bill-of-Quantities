"""
Interactive Floor Plan Measurement Tool with Centered Image
Author: Assistant
Description: Click-based wall length measurement system with centered image and scale conversion
"""

import cv2
import numpy as np
from pdf2image import convert_from_path

class FloorPlanMeasurer:
    def __init__(self, pdf_path, dpi=300, scale_factor=0.01):
        """
        Initialize the measurement system
        
        :param pdf_path: Path to PDF floor plan
        :param dpi: Resolution for PDF conversion
        :param scale_factor: Meters per pixel (calibrate this)
        """

        self.pages = convert_from_path(pdf_path, dpi=dpi, poppler_path=r"Release-24.08.0-0\poppler-24.08.0\Library\bin")

        self.img = np.array(self.pages[0])
        self.img = cv2.cvtColor(self.img, cv2.COLOR_RGB2BGR)
        self.scale_factor = scale_factor
        
        self.perimeter_points = []  
        self.internal_walls = []    
        self.current_mode = 'perimeter' 
        
        self.window_name = 'Floor Plan'
        cv2.namedWindow(self.window_name, cv2.WINDOW_NORMAL)
        self.img_offset_x, self.img_offset_y = 0, 0 
        self.img_scale = 1.0  
        
        cv2.setMouseCallback(self.window_name, self.mouse_callback)
        
        print("=== Measurement Controls ===")
        print("Left Click: Add measurement point")
        print("R: Reset all measurements")
        print("M: Toggle between perimeter/internal modes")
        print("U: Undo last point")
        print("C: Calculate current measurements")
        print("Q: Quit")

    def mouse_callback(self, event, x, y, flags, param):
        img_x = int((x - self.img_offset_x) / self.img_scale)
        img_y = int((y - self.img_offset_y) / self.img_scale)
        
        if event == cv2.EVENT_LBUTTONDOWN:
            if 0 <= img_x < self.img.shape[1] and 0 <= img_y < self.img.shape[0]:
                if self.current_mode == 'perimeter':
                    self.perimeter_points.append((img_x, img_y))
                elif self.current_mode == 'internal':
                    if len(self.internal_walls) == 0 or len(self.internal_walls[-1]) == 2:
                        self.internal_walls.append([(img_x, img_y)])
                    else:
                        self.internal_walls[-1].append((img_x, img_y))

    def calculate_distance(self, pt1, pt2):
        """Calculate real-world distance between two points"""
        pixel_dist = np.sqrt((pt2[0]-pt1[0])**2 + (pt2[1]-pt1[1])**2)
        return pixel_dist * self.scale_factor

    def draw_measurements(self):
        """Draw all measurements on the image"""
        display_img = self.img.copy()
        
        if len(self.perimeter_points) > 0:
            for i in range(1, len(self.perimeter_points)):
                cv2.line(display_img, self.perimeter_points[i-1], 
                        self.perimeter_points[i], (0,255,0), 2)
            # Draw points
            for pt in self.perimeter_points:
                cv2.circle(display_img, pt, 5, (0,0,255), -1)
        
        # Draw internal walls
        for wall in self.internal_walls:
            if len(wall) == 2:
                cv2.line(display_img, wall[0], wall[1], (255,0,0), 2)
                cv2.circle(display_img, wall[0], 5, (255,0,0), -1)
                cv2.circle(display_img, wall[1], 5, (255,0,0), -1)
            elif len(wall) == 1:
                cv2.circle(display_img, wall[0], 5, (255,0,0), -1)
        
        # Add mode indicator
        mode_text = f"Mode: {self.current_mode.capitalize()}"
        cv2.putText(display_img, mode_text, (10,30), 
                   cv2.FONT_HERSHEY_SIMPLEX, 1, (255,255,255), 2)
        
        return display_img


    def center_image(self, window_width, window_height):
        """Calculate offsets to center the image in the window"""
        img_height, img_width = self.img.shape[:2]
        
        scale_x = window_width / img_width
        scale_y = window_height / img_height
        
        self.img_scale = max(0.1, min(scale_x, scale_y))
        
        self.img_offset_x = int((window_width - img_width * self.img_scale) / 2)
        self.img_offset_y = int((window_height - img_height * self.img_scale) / 2)

    def run(self):
        """Main interaction loop"""
        while True:
            rect = cv2.getWindowImageRect(self.window_name)
            if rect is None or rect[2] <= 0 or rect[3] <= 0:
                window_width, window_height = 800, 600
                cv2.resizeWindow(self.window_name, window_width, window_height)
            else:
                window_width, window_height = rect[2], rect[3]
            
            self.center_image(window_width, window_height)
            
            display_img = self.draw_measurements()
            
            resized_img = cv2.resize(display_img, None, 
                                fx=max(0.1, self.img_scale), 
                                fy=max(0.1, self.img_scale))
            
            canvas_height = max(1, window_height)
            canvas_width = max(1, window_width)
            canvas = np.zeros((canvas_height, canvas_width, 3), dtype=np.uint8)
            
            y_end = min(self.img_offset_y + resized_img.shape[0], canvas_height)
            x_end = min(self.img_offset_x + resized_img.shape[1], canvas_width)
            
            if y_end > self.img_offset_y and x_end > self.img_offset_x:
                canvas[
                    self.img_offset_y:y_end,
                    self.img_offset_x:x_end
                ] = resized_img[:y_end-self.img_offset_y, :x_end-self.img_offset_x]
            
            cv2.imshow(self.window_name, canvas)
            
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                break
            elif key == ord('r'):
                self.perimeter_points = []
                self.internal_walls = []
            elif key == ord('m'):
                self.current_mode = 'internal' if self.current_mode == 'perimeter' else 'perimeter'
            elif key == ord('u'):
                if self.current_mode == 'perimeter' and self.perimeter_points:
                    self.perimeter_points.pop()
                elif self.current_mode == 'internal' and self.internal_walls:
                    self.internal_walls.pop()
            elif key == ord('c'):
                self.show_results()

        cv2.destroyAllWindows()

    def show_results(self):
        """Calculate and display measurement results"""
        total_perimeter = 0
        total_internal = 0
        
        for i in range(1, len(self.perimeter_points)):
            total_perimeter += self.calculate_distance(
                self.perimeter_points[i-1],
                self.perimeter_points[i]
            )
        
        for wall in self.internal_walls:
            if len(wall) == 2:
                total_internal += self.calculate_distance(wall[0], wall[1])
        
        print("\n=== Measurement Results ===")
        print(f"External Perimeter: {total_perimeter:.2f} meters")
        print(f"Total Internal Girth: {total_internal:.2f} meters")
        print(f"Combined Total: {total_perimeter + total_internal:.2f} meters")

if __name__ == "__main__":
    PDF_PATH = "floor_plan.pdf"
    DPI = 300  
    SCALE_FACTOR = 0.01  
    
    measurer = FloorPlanMeasurer(PDF_PATH, dpi=DPI, scale_factor=SCALE_FACTOR)
    measurer.run()