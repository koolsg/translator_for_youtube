import os
from dotenv import load_dotenv
from google import genai

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("No API Key found")
    exit(1)

client = genai.Client(api_key=api_key)
try:
    # models.list() returns an iterator or list
    models = client.models.list()
    print("Successfully called client.models.list()")

    count = 0
    for model in models:
        count += 1
        if count > 1:
            break
        print(f"Model Name: {model.name}")
        print(
            f"Model ID: {model.name}"
        )  # suspecting name might be the ID or display name
        print(f"Dir of model: {dir(model)}")
        if hasattr(model, "supported_generation_methods"):
            print(f"Supported methods: {model.supported_generation_methods}")

except Exception as e:
    print(f"Error: {e}")
