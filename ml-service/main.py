"""
ML Service for Lost & Found - HuggingFace + Google Gemini
Production-grade image analysis and semantic search without local models.
Python 3.13 compatible.
"""

import os
import logging
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from collections import OrderedDict

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import numpy as np
import httpx
import google.generativeai as genai

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ml_service")

# Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
EMBEDDING_DIMENSION = 768
CACHE_TTL_SECONDS = 3600

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

app = FastAPI(
    title="Lost & Found ML Service",
    description="Google Gemini text embeddings and semantic search",
    version="3.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Models
class TextRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000)

class TextListRequest(BaseModel):
    texts: List[str] = Field(..., min_items=1, max_items=100)

class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    item_descriptions: List[Dict[str, Any]] = Field(..., min_items=1)
    threshold: Optional[float] = Field(default=0.3, ge=0.0, le=1.0)
    use_hybrid: Optional[bool] = Field(default=True)

class SimilarityRequest(BaseModel):
    embedding_a: List[float] = Field(..., min_items=768, max_items=768)
    embedding_b: List[float] = Field(..., min_items=768, max_items=768)

# Shared HTTP client for connection pooling
http_client: Optional[httpx.AsyncClient] = None

# Simple LRU cache for embeddings
class LRUCache:
    def __init__(self, capacity: int = 500):
        self.cache: OrderedDict = OrderedDict()
        self.capacity = capacity
        self.timestamps: Dict[str, datetime] = {}

    def get(self, key: str) -> Optional[Any]:
        if key not in self.cache:
            return None
        if key in self.timestamps:
            if datetime.now() - self.timestamps[key] > timedelta(seconds=CACHE_TTL_SECONDS):
                del self.cache[key]
                del self.timestamps[key]
                return None
        self.cache.move_to_end(key)
        return self.cache[key]

    def put(self, key: str, value: Any):
        if key in self.cache:
            self.cache.move_to_end(key)
        self.cache[key] = value
        self.timestamps[key] = datetime.now()
        if len(self.cache) > self.capacity:
            oldest = next(iter(self.cache))
            del self.cache[oldest]
            if oldest in self.timestamps:
                del self.timestamps[oldest]

embedding_cache = LRUCache(capacity=1000)

# Utility Functions
def normalize_vector(vec: List[float]) -> List[float]:
    """Normalize vector to unit length."""
    arr = np.array(vec, dtype=float)
    norm = np.linalg.norm(arr)
    if norm > 0:
        arr = arr / norm
    return arr.tolist()

def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Compute cosine similarity between two vectors."""
    a_np = np.array(a, dtype=float)
    b_np = np.array(b, dtype=float)
    if a_np.size == 0 or b_np.size == 0:
        return 0.0
    norm_a = np.linalg.norm(a_np)
    norm_b = np.linalg.norm(b_np)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a_np, b_np) / (norm_a * norm_b))

def normalize_text_for_cache(text: str) -> str:
    """Normalize short text for caching."""
    return text.strip().lower()[:500]

# Google Gemini Embeddings
async def generate_gemini_embedding(text: str) -> List[float]:
    """Generate embedding using Google Gemini text-embedding-004."""
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY not configured")

    cache_key = normalize_text_for_cache(text)
    cached = embedding_cache.get(cache_key)
    if cached is not None:
        return cached

    def _embed_sync(t: str):
        result = genai.embed_content(
            model="models/text-embedding-004",
            content=t,
            task_type="retrieval_document"
        )
        if isinstance(result, dict) and "embedding" in result:
            return result["embedding"]
        if hasattr(result, 'embedding'):
            return result.embedding
        raise RuntimeError("Unexpected Gemini embedding response")

    try:
        embedding = await asyncio.to_thread(_embed_sync, text)
        normalized = normalize_vector(list(map(float, embedding)))
        embedding_cache.put(cache_key, normalized)
        return normalized
    except Exception as e:
        logger.error(f"Gemini embedding error: {e}")
        raise HTTPException(status_code=500, detail=f"Embedding generation failed: {str(e)}")

# Hybrid Search Scoring
def keyword_match_score(query: str, text: str) -> float:
    """Simple keyword overlap score."""
    query_words = set(query.lower().split())
    text_words = set(text.lower().split())
    if not query_words:
        return 0.0
    intersection = query_words.intersection(text_words)
    return len(intersection) / len(query_words)

def category_boost(query: str, category: str) -> float:
    """Boost score if query matches category."""
    if category.lower() in query.lower():
        return 0.15
    return 0.0

# Startup/Shutdown
@app.on_event("startup")
async def startup_event():
    logger.info("ML Service started - Gemini text embeddings enabled")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("ML Service shutdown")

# API Endpoints
@app.get("/")
async def root():
    return {
        "service": "Lost & Found ML Service v3.0",
        "features": {
            "text_embeddings": "Google Gemini text-embedding-004 (768-dim, normalized)",
            "semantic_search": "Hybrid scoring with vector + keyword matching",
            "similarity": "Cosine similarity computation helper"
        },
        "endpoints": {
            "embedding": "/embedding",
            "embeddings_batch": "/embeddings/batch",
            "similarity": "/similarity",
            "search": "/search",
            "health": "/health"
        },
        "configuration": {
            "embedding_dimension": EMBEDDING_DIMENSION,
            "cache_enabled": True,
            "cache_ttl_seconds": CACHE_TTL_SECONDS
        }
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "gemini_configured": bool(GEMINI_API_KEY),
        "embedding_dimension": EMBEDDING_DIMENSION,
        "cache_size": len(embedding_cache.cache)
    }

@app.post("/embedding")
async def embedding_endpoint(request: TextRequest):
    """Generate 768-dimensional Gemini embedding for text."""
    try:
        embedding = await generate_gemini_embedding(request.text)
        return {
            "success": True,
            "embedding": embedding,
            "dimension": len(embedding)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Embedding error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/embeddings/batch")
async def embeddings_batch_endpoint(request: TextListRequest):
    """Generate embeddings for multiple texts in parallel."""
    semaphore = asyncio.Semaphore(10)

    async def _embed_with_semaphore(text: str):
        async with semaphore:
            try:
                return await generate_gemini_embedding(text)
            except Exception as e:
                logger.error(f"Batch embedding error: {e}")
                return [0.0] * EMBEDDING_DIMENSION

    embeddings = await asyncio.gather(*[_embed_with_semaphore(t) for t in request.texts])

    return {
        "success": True,
        "embeddings": embeddings,
        "count": len(embeddings)
    }

@app.post("/similarity")
async def similarity_endpoint(request: SimilarityRequest):
    """Compute cosine similarity between two embeddings."""
    try:
        score = cosine_similarity(request.embedding_a, request.embedding_b)
        return {
            "success": True,
            "similarity": float(score)
        }
    except Exception as e:
        logger.error(f"Similarity error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/search")
async def search_endpoint(request: SearchRequest):
    """
    Semantic search with hybrid scoring.
    Combines vector similarity + keyword matching + category boosting.
    """
    try:
        query_embedding = await generate_gemini_embedding(request.query)
        query_arr = np.array(query_embedding, dtype=float)

        results = []

        for idx, item in enumerate(request.item_descriptions):
            if item.get("embedding") and len(item["embedding"]) == EMBEDDING_DIMENSION:
                item_embedding = normalize_vector(item["embedding"])
            else:
                item_text = " ".join([
                    str(item.get("title", "")),
                    str(item.get("description", "")),
                    str(item.get("category", "")),
                    str(item.get("location", ""))
                ]).strip()

                if not item_text:
                    item_embedding = [0.0] * EMBEDDING_DIMENSION
                else:
                    try:
                        item_embedding = await generate_gemini_embedding(item_text)
                    except Exception:
                        item_embedding = [0.0] * EMBEDDING_DIMENSION

            item_arr = np.array(item_embedding, dtype=float)
            vector_sim = cosine_similarity(query_arr.tolist(), item_arr.tolist())

            if request.use_hybrid:
                item_text = " ".join([
                    str(item.get("title", "")),
                    str(item.get("description", ""))
                ])
                keyword_sim = keyword_match_score(request.query, item_text)
                cat_boost = category_boost(request.query, str(item.get("category", "")))
                final_score = (0.7 * vector_sim) + (0.2 * keyword_sim) + (0.1 * cat_boost)
            else:
                final_score = vector_sim

            if final_score > 0.7:
                confidence = "high"
            elif final_score > 0.5:
                confidence = "medium"
            else:
                confidence = "low"

            results.append({
                "item_id": str(item.get("id") or item.get("_id") or f"item_{idx}"),
                "similarity": float(final_score),
                "vector_similarity": float(vector_sim),
                "confidence": confidence,
                "title": item.get("title", ""),
                "description": item.get("description", ""),
                "category": item.get("category", ""),
                "location": item.get("location", ""),
                "type": item.get("type", ""),
                "imageUrl": item.get("imageUrl", ""),
                "createdAt": item.get("createdAt", ""),
                "user": item.get("user", {})
            })

        filtered = [r for r in results if r["similarity"] >= request.threshold]
        filtered.sort(key=lambda x: x["similarity"], reverse=True)

        return {
            "success": True,
            "results": filtered,
            "count": len(filtered),
            "total_scanned": len(results),
            "threshold": request.threshold,
            "hybrid_scoring": request.use_hybrid
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=f"Semantic search failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
