
import os

file_path = r"c:\Users\Ahmet Hakan UYSAL\.gemini\antigravity\scratch\uyap-desktop\imerek_src\portal\main.js"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Search for the definition of tasksRequests
search_term = "tasksRequests"
index = content.find(search_term)

if index != -1:
    start = max(0, index)
    end = min(len(content), index + 10000) # Get a good chunk of 10KB
    print(content[start:end])
else:
    print("Not found")
