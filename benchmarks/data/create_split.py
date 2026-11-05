import json
import random
from collections import defaultdict

def create_split():
    with open("benchmarks/data/human_labeled/rag_questions.jsonl", "r", encoding="utf-8") as f:
        questions = [json.loads(line) for line in f]
        
    by_type = defaultdict(list)
    for q in questions:
        by_type[q["type"]].append(q)
        
    rng = random.Random(42)
    dev_set = []
    test_set = []
    
    print("Stratified Split Breakdown (seed=42):")
    for q_type, q_list in sorted(by_type.items()):
        rng.shuffle(q_list)
        n = len(q_list)
        n_dev = n // 2 + (n % 2 if q_type in ["direct", "multi-hop"] else 0)
        dev = q_list[:n_dev]
        test = q_list[n_dev:]
        dev_set.extend(dev)
        test_set.extend(test)
        print(f"  {q_type:15s}: Total={n:2d} -> DEV={len(dev):2d}, TEST={len(test):2d}")
        
    dev_set.sort(key=lambda x: x["id"])
    test_set.sort(key=lambda x: x["id"])
    
    print(f"\nTotal DEV:  {len(dev_set)}")
    print(f"Total TEST: {len(test_set)}")
    
    with open("benchmarks/data/human_labeled/dev_questions.jsonl", "w", encoding="utf-8") as f:
        for q in dev_set:
            f.write(json.dumps(q) + "\n")
            
    with open("benchmarks/data/human_labeled/test_questions.jsonl", "w", encoding="utf-8") as f:
        for q in test_set:
            f.write(json.dumps(q) + "\n")
            
    print("Saved dev_questions.jsonl and test_questions.jsonl successfully.")

if __name__ == "__main__":
    create_split()

