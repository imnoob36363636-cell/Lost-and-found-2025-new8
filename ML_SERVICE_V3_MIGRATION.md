# ML Service v3 Migration Guide

## Overview

ML Service has been upgraded from v2 to v3. Key changes:

- **Removed**: Image captioning (Gemini, HuggingFace BLIP-2) and all related color/brightness analysis
- **Kept**: Text embeddings (Gemini text-embedding-004, 768-dim normalized) and semantic search
- **New**: Similar items recommendation on item detail page with cosine similarity computation

## API Changes

### Removed Endpoints

- `POST /caption` - Image captioning endpoint
- Related image processing functions

### Endpoints Kept

- `POST /embedding` - Single text to embedding
- `POST /embeddings/batch` - Batch text to embeddings
- `POST /search` - Semantic search with hybrid scoring
- `GET /health` - Health check

### New Endpoints

- `POST /similarity` - Compute cosine similarity between two embeddings
  - Request body: `{ "embedding_a": [...], "embedding_b": [...] }`
  - Response: `{ "success": true, "similarity": 0.85 }`

## Backend Changes

### Controllers

**itemController.js**
- `getItemById` now returns `similarItems` array in response
- Computes cosine similarity for all active items (limit 100)
- Returns top 5 items with similarity >= 0.40
- Each similar item includes: id, title, imageUrl, category, similarity (3 decimals), link

**uploadController.js**
- Removed AI caption generation
- Now only returns `{ url: imageUrl }`

### Models

**Item.js**
- Removed `aiGeneratedDescription` field
- Removed `embeddingGenerated` field
- Kept `embedding` field (768-dim array)

### Services

**mlService.js**
- Removed `generateImageCaption` function
- Added `computeSimilarity(embeddingA, embeddingB)` function

## Frontend Changes

### API Utility

**src/utils/api.ts**
- `uploadImage` now returns only `string` (URL), not object with aiCaption

### Pages

**UploadItem.tsx**
- Removed `aiCaption` and `generatingCaption` states
- Removed AI description generation from image upload
- Removed UI indicators for AI caption generation

**ItemDetails.tsx**
- Added `SimilarItem` interface
- Added `similarItems` state
- Fetch similar items from API response
- New section: "AI Suggested Similar Items" displays top 5 items in grid
- Each card shows: image, title, category badge, similarity percentage

## Database Migration

### Backfill Embeddings

For existing items without embeddings, run the backfill script:

```bash
cd backend
node scripts/backfillEmbeddings.js
```

This script:
1. Finds all items without embeddings
2. Generates embeddings in batches of 10
3. Stores normalized 768-dim embeddings in MongoDB
4. Includes error handling and progress logging

### Manual Steps (if needed)

If items have old fields to remove:

```javascript
// MongoDB query to remove old caption-related fields
db.items.updateMany(
  {},
  {
    $unset: {
      aiGeneratedDescription: "",
      embeddingGenerated: ""
    }
  }
)
```

## Configuration

No new environment variables required. Uses existing:
- `GEMINI_API_KEY` - For text embeddings
- `ML_SERVICE_URL` - ML service endpoint

## Testing

### Verify Embeddings Work

```bash
curl -X POST http://localhost:8000/embedding \
  -H "Content-Type: application/json" \
  -d '{"text": "Black leather wallet"}'
```

### Verify Similarity Computation

```bash
curl -X POST http://localhost:8000/similarity \
  -H "Content-Type: application/json" \
  -d '{"embedding_a": [0.1, 0.2, ...], "embedding_b": [0.15, 0.25, ...]}'
```

### Test Similar Items on Item Detail

1. Upload at least 3-4 items with embeddings
2. Navigate to an item detail page
3. Verify "AI Suggested Similar Items" section appears if items exist
4. Check similarity scores are between 0-1 and displayed as percentages

## Performance Notes

- Similar items computation runs inline on `GET /items/:id`
- Limits DB query to 100 random active items to avoid timeout
- Uses ML service `/similarity` endpoint for each comparison
- Consider caching similar items in production for high-traffic items

## Rollback (if needed)

1. Restore previous ML service deployment
2. Revert uploadController.js to use `generateImageCaption`
3. Restore aiGeneratedDescription to UploadItem component
4. Restore aiCaption handling in uploadImage utility

## Support

For issues with embeddings generation, check:
- GEMINI_API_KEY is configured
- ML service is running and healthy: `GET /health`
- Batch embedding limits (max 100 texts per request)
