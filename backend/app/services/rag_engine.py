import numpy as np
import re
import json
import logging
from typing import List, Dict, Any
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger("uvicorn.error")

class RAGEngine:
    @staticmethod
    def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
        """Chunks text using a sliding window approach with character overlap."""
        if not text:
            return []
        
        # Clean up excessive white spaces
        text = re.sub(r'\s+', ' ', text).strip()
        
        chunks = []
        start = 0
        text_len = len(text)
        
        while start < text_len:
            end = min(start + chunk_size, text_len)
            
            # Try to align chunk end with a sentence or word boundary if not at the end
            if end < text_len:
                # Look for sentence endings (., !, ?) in the last 100 characters of the window
                boundary = -1
                for i in range(end, max(end - 100, start), -1):
                    if text[i-1] in ('.', '!', '?') and text[i] == ' ':
                        boundary = i
                        break
                
                # If no sentence ending, look for space boundary
                if boundary == -1:
                    for i in range(end, max(end - 30, start), -1):
                        if text[i] == ' ':
                            boundary = i
                            break
                            
                if boundary != -1:
                    end = boundary
            
            chunks.append(text[start:end].strip())
            
            # Move starting point back by overlap
            start = end - overlap
            if start >= text_len or end >= text_len:
                break
            if start < 0:
                start = 0
                
        return chunks

    @staticmethod
    def retrieve_top_k(query: str, chunks: List[str], top_k: int = 5) -> List[Dict[str, Any]]:
        """Retrieves top K matching chunks using local TF-IDF cosine similarity.
        This runs 100% locally with zero external requirements.
        """
        if not chunks:
            return []
            
        try:
            # We add query to the end of the text list to run fit_transform together
            documents = chunks + [query]
            
            # Extract features using TF-IDF Vectorizer
            # Using sublinear_tf to scale counts logarithmically
            vectorizer = TfidfVectorizer(stop_words='english', sublinear_tf=True)
            tfidf_matrix = vectorizer.fit_transform(documents)
            
            # Separate chunks matrix and query vector
            chunks_vector = tfidf_matrix[:-1]
            query_vector = tfidf_matrix[-1]
            
            # Compute cosine similarity
            similarities = cosine_similarity(query_vector, chunks_vector).flatten()
            
            # Get indices sorted by descending score
            top_indices = np.argsort(similarities)[::-1][:top_k]
            
            results = []
            for idx in top_indices:
                score = float(similarities[idx])
                # Only include chunks with some similarity
                if score > 0.0:
                    results.append({
                        "text": chunks[idx],
                        "score": score,
                        "chunk_index": int(idx)
                    })
            
            # If no similarity matches, return the first few chunks
            if not results:
                for idx in range(min(top_k, len(chunks))):
                    results.append({
                        "text": chunks[idx],
                        "score": 0.0,
                        "chunk_index": idx
                    })
                    
            return results
            
        except Exception as e:
            logger.error(f"Error in RAG retrieval: {str(e)}")
            # Simple keyword search fallback
            query_words = set(query.lower().split())
            scores = []
            for idx, chunk in enumerate(chunks):
                match_count = sum(1 for word in query_words if word in chunk.lower())
                scores.append((match_count, idx))
            
            scores.sort(reverse=True)
            results = []
            for score, idx in scores[:top_k]:
                results.append({
                    "text": chunks[idx],
                    "score": float(score),
                    "chunk_index": idx
                })
            return results
            
    @staticmethod
    def retrieve_with_embeddings(query: str, chunks: List[str], api_key: str = None, provider: str = "openai", top_k: int = 5) -> List[Dict[str, Any]]:
        """Retrieves top K using external embeddings (OpenAI / Gemini) if key is provided.
        Falls back to local TF-IDF if API errors or keys are missing.
        """
        # If no key, default to TF-IDF
        if not api_key:
            return RAGEngine.retrieve_top_k(query, chunks, top_k)
            
        try:
            # Placeholder for future integration (OpenAI/Gemini embeddings).
            # If it fails or is unconfigured, fall back to TF-IDF.
            return RAGEngine.retrieve_top_k(query, chunks, top_k)
        except Exception as e:
            logger.error(f"Error in embedding-based retrieval, falling back to TF-IDF: {str(e)}")
            return RAGEngine.retrieve_top_k(query, chunks, top_k)
