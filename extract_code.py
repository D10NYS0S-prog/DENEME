
import os

file_path = r"c:\Users\Ahmet Hakan UYSAL\.gemini\antigravity\scratch\uyap-desktop\imerek_src\portal\main.js"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

search_term = "dosyalariEsitle"
index = content.find(search_term)

if index != -1:
    start = max(0, index - 100)
    end = min(len(content), index + 3000)
    print(content[start:end])
else:
    print("Not found")
