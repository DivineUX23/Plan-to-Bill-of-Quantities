import cv2
import numpy as np
from pdf2image import convert_from_path

def pdf_to_image(pdf_path, dpi=300):
    """
    Converts the first page of a PDF to an OpenCV image (BGR).
    
    Parameters:
      pdf_path (str): Path to the PDF file.
      dpi (int): Resolution for conversion.
    
    Returns:
      image (ndarray): OpenCV BGR image.
    """
    images = convert_from_path(pdf_path, dpi=dpi, poppler_path=r"Release-24.08.0-0\poppler-24.08.0\Library\bin")

    if not images:
        raise ValueError("No pages found in the PDF.")
    image = cv2.cvtColor(np.array(images[0]), cv2.COLOR_RGB2BGR)
    return image

mode = None
external_points = []
internal_points = []
internal_total = 0.0
image = None
image_copy = None

def mouse_callback(event, x, y, flags, param):
    global mode, external_points, internal_points, image_copy, internal_total
    if event == cv2.EVENT_LBUTTONDOWN:
        if mode == 'external':
            external_points.append((x, y))
            cv2.circle(image_copy, (x, y), 3, (0, 255, 0), -1)
            if len(external_points) > 1:
                cv2.line(image_copy, external_points[-2], external_points[-1], (255, 0, 0), 2)
        elif mode == 'internal':
            internal_points.append((x, y))
            cv2.circle(image_copy, (x, y), 3, (0, 0, 255), -1)
            # Every two points define a segment
            if len(internal_points) % 2 == 0:
                cv2.line(image_copy, internal_points[-2], internal_points[-1], (0, 0, 255), 2)
                p1 = np.array(internal_points[-2])
                p2 = np.array(internal_points[-1])
                segment_length = np.linalg.norm(p2 - p1)
                internal_total += segment_length
                print(f"Internal segment length (pixels): {segment_length:.2f}")
        cv2.imshow("Floor Plan", image_copy)

def compute_polygon_perimeter(points):
    """
    Computes the perimeter of a polygon defined by a list of points.
    If the first and last points are close, the closing edge is added.
    """
    if len(points) < 2:
        return 0.0
    perimeter = 0.0
    for i in range(1, len(points)):
        perimeter += np.linalg.norm(np.array(points[i]) - np.array(points[i - 1]))

    if len(points) > 2 and np.linalg.norm(np.array(points[0]) - np.array(points[-1])) < 10:
        perimeter += np.linalg.norm(np.array(points[0]) - np.array(points[-1]))
    return perimeter

def main():
    global mode, external_points, internal_points, image, image_copy, internal_total

    pdf_path = "floor_plan.pdf" 
    try:
        image = pdf_to_image(pdf_path, dpi=300)
    except Exception as e:
        print("Error converting PDF:", e)
        return

    image_copy = image.copy()

    cv2.namedWindow("Floor Plan")
    cv2.setMouseCallback("Floor Plan", mouse_callback)

    print("Instructions:")
    print("  Press 'e' for EXTERNAL wall mode (click along wall edges to form a polygon).")
    print("  Press 'i' for INTERNAL wall mode (click start and end points of each segment).")
    print("  Press 'r' to reset the current mode's points/drawing.")
    print("  Press 'c' to calculate and display the current measurement.")
    print("  Press 'q' (or ESC) to quit.")

    external_perimeter = 0.0

    while True:
        cv2.imshow("Floor Plan", image_copy)
        key = cv2.waitKey(1) & 0xFF

        if key == ord('e'):
            mode = 'external'
            external_points = []
            image_copy = image.copy()
            print("Switched to EXTERNAL mode. Click along the wall edge.")
        elif key == ord('i'):
            mode = 'internal'
            internal_points = []
            internal_total = 0.0
            image_copy = image.copy()
            print("Switched to INTERNAL mode. Click the start and end of each segment.")
        elif key == ord('r'):
            if mode == 'external':
                external_points = []
                image_copy = image.copy()
                print("External wall points reset.")
            elif mode == 'internal':
                internal_points = []
                internal_total = 0.0
                image_copy = image.copy()
                print("Internal wall points reset.")
        elif key == ord('c'):
            if mode == 'external':
                external_perimeter = compute_polygon_perimeter(external_points)
                print(f"External wall perimeter (pixels): {external_perimeter:.2f}")
                external_points = []
                image_copy = image.copy()
            elif mode == 'internal':
                print(f"Total internal wall length (pixels): {internal_total:.2f}")
                internal_points = []
                image_copy = image.copy()
        elif key == ord('q') or key == 27:
            break

    cv2.destroyAllWindows()

if __name__ == '__main__':
    main()
