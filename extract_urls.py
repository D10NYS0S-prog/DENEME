
import os
import re

file_path = r"c:\Users\Ahmet Hakan UYSAL\.gemini\antigravity\scratch\uyap-desktop\imerek_src\portal\main.js"

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Regex to capture strings inside single or double quotes
    # This is a simple approximation
    strings = re.findall(r'["\'](.*?)["\']', content)

    print("--- Found .ajx endpoints ---")
    found = False
    for s in strings:
        if ".ajx" in s:
            print(s)
            found = True
    
    if not found:
        print("No .ajx strings found.")

except Exception as e:
    print(f"Error: {e}")
