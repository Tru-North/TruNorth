from typing import List
import httpx
from app.core.config import settings


async def embed_texts(texts: List[str]) -> List[List[float]]:
    """Return embeddings (one per input) using Azure OpenAI deployment."""
    if not settings.AZURE_FOUNDRY_API_KEY or not settings.AZURE_FOUNDRY_ENDPOINT:
        raise RuntimeError("Azure Foundry credentials are required for embeddings")

    deployment = settings.AZURE_EMBEDDINGS_DEPLOYMENT
    url = f"{settings.AZURE_FOUNDRY_ENDPOINT}/openai/deployments/{deployment}/embeddings?api-version=2025-01-01-preview"
    headers = {
        "api-key": settings.AZURE_FOUNDRY_API_KEY,
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(url, headers=headers, json={"input": texts})
        response.raise_for_status()
        payload = response.json()
        data = payload.get("data", [])
        return [item["embedding"] for item in data]
