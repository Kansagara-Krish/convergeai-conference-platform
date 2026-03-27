import os
import sys

# Add backend directory to path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from services.auto_drive_uploader import upload_to_drive, log_metadata

def test_upload():
    # Find a sample image in static
    sample_image = None
    generated_dir = os.path.join(backend_dir, "static", "generated")
    if os.path.exists(generated_dir):
        files = [f for f in os.listdir(generated_dir) if f.endswith(".png")]
        if files:
            sample_image = os.path.join(generated_dir, files[0])
    
    if not sample_image:
        print("No sample image found in static/generated. Please generate an image first.")
        # Try to find any png in backend
        for root, dirs, files in os.walk(backend_dir):
            for f in files:
                if f.endswith(".png"):
                    sample_image = os.path.join(root, f)
                    break
            if sample_image:
                break
    
    if not sample_image:
        print("No png files found in the backend directory.")
        return

    print(f"Testing upload of: {sample_image}")
    link, error = upload_to_drive(sample_image, "test_user")
    
    if link:
        print(f"SUCCESS! Link: {link}")
        log_metadata("test_user", link)
    else:
        print(f"FAILED! Error: {error}")

if __name__ == "__main__":
    test_upload()
