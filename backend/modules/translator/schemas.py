from pydantic import BaseModel

class TranslationRequest(BaseModel):
    text: str
    model: str
    target_language: str

class TranslationResponse(BaseModel):
    translated_text: str
