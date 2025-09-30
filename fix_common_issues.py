#!/usr/bin/env python3
"""
Quick fix script for common documentation issues found by validation
"""

import re
import os
from pathlib import Path

def fix_curl_headers(content: str) -> str:
    """Fix missing Content-Type headers in curl commands"""
    
    # Pattern for curl POST with JSON data but missing Content-Type
    pattern = r'(curl -X POST[^\\]*?)(-d \'{[^}]*}\')'
    
    def add_content_type(match):
        curl_cmd = match.group(1)
        data_part = match.group(2)
        
        # Check if Content-Type header is already present
        if 'Content-Type:' in curl_cmd:
            return match.group(0)
        
        # Add Content-Type header before the data
        return curl_cmd + '-H "Content-Type: application/json" \\\n  ' + data_part
    
    return re.sub(pattern, add_content_type, content, flags=re.DOTALL)

def fix_json_formatting(content: str) -> str:
    """Fix common JSON formatting issues"""
    
    # Fix control characters in JSON strings
    content = re.sub(r'\\n', '\\\\n', content)
    content = re.sub(r'\\t', '\\\\t', content)
    
    return content

def fix_python_indentation_in_json(content: str) -> str:
    """Fix Python code that's embedded in JSON strings"""
    
    # Pattern for JSON with embedded Python code
    json_python_pattern = r'("python_code":\s*")(.*?)(")'
    
    def fix_embedded_python(match):
        prefix = match.group(1)
        python_code = match.group(2)
        suffix = match.group(3)
        
        # Fix common issues in embedded Python
        python_code = python_code.replace('\\n', '\\\\n')
        python_code = python_code.replace('"', '\\"')
        
        return prefix + python_code + suffix
    
    return re.sub(json_python_pattern, fix_embedded_python, content, flags=re.DOTALL)

def process_file(file_path: Path) -> bool:
    """Process a single file and fix common issues"""
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            original_content = f.read()
        
        content = original_content
        
        # Apply fixes
        content = fix_curl_headers(content)
        content = fix_json_formatting(content)
        content = fix_python_indentation_in_json(content)
        
        # Only write if content changed
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"✅ Fixed: {file_path.name}")
            return True
        else:
            print(f"ℹ️  No issues: {file_path.name}")
            return False
            
    except Exception as e:
        print(f"❌ Error processing {file_path}: {e}")
        return False

def main():
    """Main function"""
    docs_dir = Path(os.path.dirname(os.path.abspath(__file__)))
    
    # Find all MDX files
    mdx_files = []
    for pattern in ['*.mdx', 'examples/*.mdx']:
        mdx_files.extend(docs_dir.glob(pattern))
    
    mdx_files = sorted(mdx_files)
    print(f"Found {len(mdx_files)} MDX files to check")
    
    fixed_count = 0
    for file_path in mdx_files:
        if process_file(file_path):
            fixed_count += 1
    
    print(f"\n🔧 Fixed {fixed_count} files")
    print("Run validation again with: python validate_examples.py")

if __name__ == "__main__":
    main()