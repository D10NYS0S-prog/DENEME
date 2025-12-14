
import os
import re

file_path = r"c:\Users\Ahmet Hakan UYSAL\.gemini\antigravity\scratch\uyap-desktop\imerek_src\portal\main.js"

def extract_context(content, search_term, window=1000):
    indices = [m.start() for m in re.finditer(re.escape(search_term), content)]
    results = []
    for index in indices:
        start = max(0, index - 100)
        end = min(len(content), index + window)
        snippet = content[start:end]
        results.append(f"--- MATCH FOR '{search_term}' ---\n{snippet}\n-----------------------------")
    return results

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Search for dosyaTaraflariAl
    ctx1 = extract_context(content, "dosyaTaraflariAl", 2000)
    for c in ctx1:
        print(c)

    # Search for dosyalariEsitle
    ctx2 = extract_context(content, "dosyalariEsitle", 2000)
    for c in ctx2:
        print(c)
        
except Exception as e:
    print(f"Error: {e}")
