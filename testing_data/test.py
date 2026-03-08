import os
from google import genai
from PIL import Image
from io import BytesIO
import base64
import threading
import itertools
import sys
import time

# ===== LOADER FUNCTION =====
stop_loader = False

def loader():
    spinner = itertools.cycle(['|', '/', '-', '\\'])
    while not stop_loader:
        sys.stdout.write(f"\rGenerating image... {next(spinner)}")
        sys.stdout.flush()
        time.sleep(0.2)
    sys.stdout.write("\rImage generation complete!     \n")


# ===== USER INPUT =====
api_key = input("Enter your Gemini API key: ")
image1_path = input("Enter first image path: ")
image2_path = input("Enter second image path: ")
prompt = input("Enter prompt: ")

# ===== SET API KEY =====
os.environ["GOOGLE_API_KEY"] = api_key
client = genai.Client()

# ===== READ IMAGES =====
with open(image1_path, "rb") as f:
    image1_bytes = f.read()

with open(image2_path, "rb") as f:
    image2_bytes = f.read()

# ===== CONVERT TO BASE64 =====
image1_base64 = base64.b64encode(image1_bytes).decode("utf-8")
image2_base64 = base64.b64encode(image2_bytes).decode("utf-8")

# ===== START LOADER =====
loader_thread = threading.Thread(target=loader)
loader_thread.start()

# ===== SEND REQUEST TO GEMINI =====
response = client.models.generate_content(
    model="gemini-3.1-flash-image-preview",
    contents=[
        {"text": prompt},
        {
            "inline_data": {
                "mime_type": "image/png",
                "data": image1_base64
            }
        },
        {
            "inline_data": {
                "mime_type": "image/png",
                "data": image2_base64
            }
        }
    ]
)

# ===== STOP LOADER =====
stop_loader = True
loader_thread.join()

# ===== CREATE OUTPUT FOLDER =====
output_folder = "generated_images"
os.makedirs(output_folder, exist_ok=True)

# ===== SAVE GENERATED IMAGE =====
saved = False

for part in response.candidates[0].content.parts:
    if part.inline_data:
        image_bytes = part.inline_data.data
        image = Image.open(BytesIO(image_bytes))

        output_path = os.path.join(output_folder, "generated_result.png")
        image.save(output_path)

        print(f"Image saved at: {output_path}")
        saved = True

if not saved:
    print("No image returned from Gemini.")