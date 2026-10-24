import cv2
import numpy as np
from pdf2image import convert_from_path

points = []
total_length = 0

SCREEN_WIDTH = 1280
SCREEN_HEIGHT = 720


def mouse_callback(event, x, y, flags, param):
    global points, total_length, resized_image, scale, pad_x, pad_y


    original_x = int((x - pad_x) / scale)  
    original_y = int((y - pad_y) / scale) 

    if event == cv2.EVENT_LBUTTONDOWN: 
        if len(points) > 0:
            prev_x, prev_y = points[-1]
            length = np.sqrt((original_x - prev_x)**2 + (original_y - prev_y)**2)
            total_length += length
            print(f"Segment length: {length:.2f} pixels")
        
        points.append((original_x, original_y))
        print(f"Clicked point: ({original_x}, {original_y})")

        cv2.circle(resized_image, (x, y), 5, (0, 0, 255), -1)
        if len(points) > 1:
            prev_resized_x = int(points[-2][0] * scale + pad_x)
            prev_resized_y = int(points[-2][1] * scale + pad_y)
            cv2.line(resized_image, (prev_resized_x, prev_resized_y), (x, y), (0, 255, 0), 2)
        cv2.imshow('Floor Plan', resized_image)

    elif event == cv2.EVENT_RBUTTONDOWN: 
        print(f"Total length (perimeter/girth): {total_length:.2f} pixels")
        print("Press 'q' to quit.")


def pdf_to_image(pdf_path, output_folder=None):
    images = convert_from_path(pdf_path, dpi=300, output_folder=output_folder, poppler_path=r"Release-24.08.0-0\poppler-24.08.0\Library\bin")
    return np.array(images[0])  

def resize_and_center_image(image, screen_width, screen_height):
    h, w = image.shape[:2]

    scale_x = screen_width / w
    scale_y = screen_height / h
    scale = min(scale_x, scale_y)

    new_w = int(w * scale)
    new_h = int(h * scale)
    resized_image = cv2.resize(image, (new_w, new_h))
    pad_x = (screen_width - new_w) // 2
    pad_y = (screen_height - new_h) // 2

    canvas = np.zeros((screen_height, screen_width, 3), dtype=np.uint8)

    canvas[pad_y:pad_y + new_h, pad_x:pad_x + new_w] = resized_image

    return canvas, scale, pad_x, pad_y
if __name__ == "__main__":
    pdf_path = 'floor_plan.pdf'

    image = pdf_to_image(pdf_path)

    resized_image, scale, pad_x, pad_y = resize_and_center_image(image, SCREEN_WIDTH, SCREEN_HEIGHT)

    cv2.namedWindow('Floor Plan')
    cv2.setMouseCallback('Floor Plan', mouse_callback)

    while True:
        cv2.imshow('Floor Plan', resized_image)
        key = cv2.waitKey(1) & 0xFF

        if key == ord('q'):
            break

    cv2.destroyAllWindows()