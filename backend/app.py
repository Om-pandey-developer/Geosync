import sys
import os

# Ensure backend directory is in python search path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app
import uvicorn

if __name__ == "__main__":
    # Hugging Face Spaces listens on port 7860
    port = int(os.environ.get("PORT", 7860))
    print(f"Starting GeoSync API on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
