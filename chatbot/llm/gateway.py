"""
Juno AI LLM Gateway

This module is responsible for:
- Sending user messages to the LLM
- Understanding natural-language questions
- Extracting intent and entities
- Returning structured JSON
- Keeping LLM logic separate from Flask
"""

import json
import os

from dotenv import load_dotenv
from openai import OpenAI


load_dotenv()


class JunoLLMGateway:
    """LLM gateway for Juno AI, backed by a local Ollama server."""

    # Ollama serves an OpenAI-compatible API under /v1, so we keep using
    # the `openai` client library and just point it at Ollama.
    # https://github.com/ollama/ollama/blob/main/docs/openai.md
    DEFAULT_BASE_URL = "http://localhost:11434/v1"
    DEFAULT_MODEL = "llama3.2:3b"

    def __init__(self):
        base_url = os.getenv("OLLAMA_BASE_URL", self.DEFAULT_BASE_URL)

        # Ollama ignores the API key, but the client requires one.
        self.client = OpenAI(
            api_key="ollama",
            base_url=base_url,
            timeout=float(os.getenv("JUNO_LLM_TIMEOUT", "45")),
            max_retries=0,
        )

        self.model = os.getenv("JUNO_LLM_MODEL", self.DEFAULT_MODEL)

    def understand(self, message: str) -> dict:
        """
        Convert a natural-language user message into
        structured intent and entities.
        """

        system_prompt = """
You are Juno, the AI assistant for ReFlow,
a wastewater and treated-water management platform.

Your job is to understand the user's request.

Return ONLY valid JSON.

Supported intents:

- greeting
- help
- user_role
- stp_information
- nearest_stp
- stp_recommendation
- stp_capacity_query
- order_status
- order_history
- latest_order
- order_quantity
- total_order_quantity
- order_count
- tanker_status
- delivery_status
- routing
- demand
- my_location
- general

Extract these entities when present:

- location
- quantity_kld
- order_id
- stp_name

Rules:

1. Understand natural language.
2. Understand spelling mistakes and informal language.
3. "for", "near", "in", "around", and "at"
   can introduce a location.
4. Never invent a location.
5. If a location is not explicitly mentioned,
   return null.
6. Never calculate STP distances yourself.
7. Never invent order status, STP capacity,
   delivery status, tanker status, or other
   live ReFlow data.
8. If the user asks about live ReFlow information,
   identify the correct intent and entities only.
9. Preserve the user's requested quantity in KLD
   when one is explicitly mentioned.

Return exactly this JSON structure:

{
  "intent": "...",
  "location": null,
  "quantity_kld": null,
  "order_id": null,
  "stp_name": null,
  "confidence": 0.0
}
"""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message},
            ],
            # Ollama's JSON mode constrains the output to valid JSON.
            response_format={"type": "json_object"},
            temperature=0,
        )

        raw_output = (response.choices[0].message.content or "").strip()

        # Small models sometimes wrap JSON in a ```json ... ``` fence even
        # when asked not to - strip that before parsing.
        if raw_output.startswith("```"):
            raw_output = raw_output.strip("`")
            if raw_output.lower().startswith("json"):
                raw_output = raw_output[4:]
            raw_output = raw_output.strip()

        try:
            result = json.loads(raw_output)
        except json.JSONDecodeError as exc:
            raise ValueError(
                f"Juno LLM returned invalid JSON: {raw_output}"
            ) from exc

        return result