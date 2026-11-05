"""
CortexAI Span-Based Retrieval Relevance Matcher
Rule: A retrieved chunk is relevant if its text contains the answer_span (normalized for whitespace and case).
Never matches on chunk IDs.
Handles spans crossing chunk boundaries: counts as relevant if a chunk contains
the core span or a boundary prefix/suffix of the span of at least min_boundary_chars length.
"""
import re

def normalize_text(text: str) -> str:
    if not text:
        return ""
    # Lowercase and collapse all whitespace (spaces, tabs, newlines)
    return " ".join(text.lower().split())

def is_chunk_relevant(chunk_text: str, answer_span: str, min_boundary_chars: int = 25) -> bool:
    """
    Checks if a chunk is relevant to an answer span.
    1. Full normalized substring match.
    2. Boundary-crossing match: if a chunk contains a prefix or suffix
       of the span of at least min_boundary_chars length.
    """
    if not answer_span or not chunk_text:
        return False
        
    norm_chunk = normalize_text(chunk_text)
    norm_span = normalize_text(answer_span)
    
    # 1. Direct normalized substring match
    if norm_span in norm_chunk:
        return True
        
    # 2. Boundary crossing check:
    # If a span was split across chunks, the end of chunk A will contain a prefix of the span,
    # or the beginning of chunk B will contain a suffix of the span.
    span_len = len(norm_span)
    if span_len >= min_boundary_chars:
        # Check if any prefix of length >= min_boundary_chars is at chunk tail / chunk body
        for l in range(span_len, min_boundary_chars - 1, -5):
            if norm_span[:l] in norm_chunk:
                return True
        # Check if any suffix of length >= min_boundary_chars is at chunk head / chunk body
        for l in range(min_boundary_chars, span_len + 1, 5):
            if norm_span[-l:] in norm_chunk:
                return True
            
    return False

def evaluate_retrieval_for_query(retrieved_chunks, question_obj):
    """
    Evaluates retrieval for a single question object.
    Returns:
      hit: bool (at least 1 relevant chunk in top-k)
      mrr: float (1.0 / rank of first relevant chunk)
      ranks: list of ranks (1-indexed) of relevant chunks
      crossing_boundary_detected: bool
    """
    if not question_obj.get("answerable", True):
        # Unanswerable questions have no relevant chunks in corpus
        return {
            "hit": False,
            "mrr": 0.0,
            "ranks": [],
            "crossing_boundary": False
        }
        
    answer_span = question_obj.get("answer_span", "")
    if not answer_span:
        return {"hit": False, "mrr": 0.0, "ranks": [], "crossing_boundary": False}
        
    ranks = []
    first_rank = None
    crossing_boundary = False
    
    norm_span = normalize_text(answer_span)
    
    for idx, chunk in enumerate(retrieved_chunks):
        rank = idx + 1
        chunk_text = chunk if isinstance(chunk, str) else chunk.get("text", "")
        norm_chunk = normalize_text(chunk_text)
        
        if norm_span in norm_chunk:
            ranks.append(rank)
            if first_rank is None:
                first_rank = rank
        elif is_chunk_relevant(chunk_text, answer_span):
            ranks.append(rank)
            crossing_boundary = True
            if first_rank is None:
                first_rank = rank
                
    mrr = 1.0 / first_rank if first_rank is not None else 0.0
    return {
        "hit": len(ranks) > 0,
        "mrr": mrr,
        "ranks": ranks,
        "crossing_boundary": crossing_boundary
    }
