"""Optional AI Vision floor plan detector.

Supports Gemini (google-genai / REST) or OpenAI (gpt-4o) when configured.
Returns walls, rooms and openings directly in SheetGeometry format.
"""

from __future__ import annotations

import base64
import json
import logging
from typing import Any

import httpx

from ...config import get_settings
from ...schemas import SheetGeometry
from ..specs import Specs

logger = logging.getLogger(__name__)

PROMPT = """Analyze this floor plan image and extract the structural layout in JSON format:
{
  "walls": [
    {
      "id": "w1",
      "kind": "external", // or "internal"
      "points": [[x1, y1], [x2, y2]],
      "closed": false
    }
  ],
  "rooms": [
    {
      "id": "r1",
      "name": "Bed Room 1",
      "points": [[x1, y1], [x2, y2], [x3, y3], [x4, y4]]
    }
  ],
  "openings": [
    {
      "id": "o1",
      "type": "D1", // or D2, W1, W2
      "x": 120.5,
      "y": 340.2,
      "count": 1
    }
  ]
}
All coordinates must be in exact image pixel coordinates corresponding to the provided image.
Return ONLY valid JSON matching this schema.
"""


async def detect_ai_vision(
    image_bytes: bytes,
    width_px: int,
    height_px: int,
    specs: Specs,
) -> tuple[SheetGeometry, float | None, list[str]]:
    s = get_settings()
    notes: list[str] = []

    if not s.ai_vision_enabled:
        return SheetGeometry(), None, ["AI vision is disabled in configuration."]

    b64_img = base64.b64encode(image_bytes).decode("utf-8")

    if s.ai_vision_provider == "gemini" and s.gemini_api_key:
        notes.append(f"Querying Gemini AI Vision ({s.gemini_model})...")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{s.gemini_model}:generateContent?key={s.gemini_api_key}"
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": PROMPT},
                        {"inlineData": {"mimeType": "image/png", "data": b64_img}},
                    ]
                }
            ],
            "generationConfig": {"responseMimeType": "application/json"},
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                notes.append(f"Gemini API returned error: {resp.status_code} {resp.text[:100]}")
                return SheetGeometry(), None, notes
            data = resp.json()
            try:
                text_content = data["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(text_content)
                geom = SheetGeometry.model_validate(parsed)
                notes.append("Successfully parsed AI vision geometry.")
                return geom, None, notes
            except Exception as e:
                notes.append(f"Failed to parse AI vision response: {e}")
                return SheetGeometry(), None, notes

    elif s.ai_vision_provider == "openai" and s.openai_api_key:
        notes.append(f"Querying OpenAI Vision ({s.openai_model})...")
        url = "https://api.openai.com/v1/chat/completions"
        headers = {"Authorization": f"Bearer {s.openai_api_key}", "Content-Type": "application/json"}
        payload = {
            "model": s.openai_model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": PROMPT},
                        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64_img}"}},
                    ],
                }
            ],
            "response_format": {"type": "json_object"},
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code != 200:
                notes.append(f"OpenAI API returned error: {resp.status_code}")
                return SheetGeometry(), None, notes
            data = resp.json()
            try:
                text_content = data["choices"][0]["message"]["content"]
                parsed = json.loads(text_content)
                geom = SheetGeometry.model_validate(parsed)
                notes.append("Successfully parsed AI vision geometry.")
                return geom, None, notes
            except Exception as e:
                notes.append(f"Failed to parse OpenAI response: {e}")
                return SheetGeometry(), None, notes

    notes.append(f"AI vision provider '{s.ai_vision_provider}' is not configured with an API key.")
    return SheetGeometry(), None, notes
