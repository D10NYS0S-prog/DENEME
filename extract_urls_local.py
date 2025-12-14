import re

file_path = r'C:\Users\Ahmet Hakan UYSAL\.gemini\antigravity\scratch\uyap-desktop\imerek_src\portal\main.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find all occurrences of .ajx and print surrounding text
matches = re.finditer(r'([a-zA-Z0-9_/]+\.ajx)', content)

print("Found .ajx endpoints:")
unique_endpoints = set()
for match in matches:
    unique_endpoints.add(match.group(1))

for endpoint in sorted(unique_endpoints):
    print(f"- {endpoint}")
