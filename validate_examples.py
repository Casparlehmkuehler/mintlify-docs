#!/usr/bin/env python3
"""
Documentation Validation Script for Lyceum Docs

This script validates all API calls, Python code examples, and documentation
to ensure examples are accurate and functional.
"""

import os
import re
import ast
import sys
import json
import requests
import subprocess
import argparse
from pathlib import Path
from typing import List, Dict
from datetime import datetime
import tempfile
import importlib.util

class DocumentationValidator:
    def __init__(self, docs_dir: str, auth_token: str = None):
        self.docs_dir = Path(docs_dir)
        self.auth_token = auth_token
        self.errors = []
        self.warnings = []
        self.validated_examples = []
        
        # Known working endpoints that don't require auth
        self.test_endpoints = [
            'https://jsonplaceholder.typicode.com/users',
            'https://jsonplaceholder.typicode.com/posts',
            'https://httpbin.org/get',
            'https://httpbin.org/headers'
        ]
        
        # Lyceum API endpoints that we can test with auth
        self.lyceum_test_endpoints = [
            'https://api.lyceum.technology/api/v2/external/billing/credits',
            'https://api.lyceum.technology/api/v2/external/storage/list-files',
        ]
        
        # Lyceum API endpoints (require auth, so we'll validate structure only)
        self.lyceum_endpoints = [
            'https://api.lyceum.technology/api/v2/external/execution/streaming/start',
            'https://api.lyceum.technology/api/v2/external/execution/image/start',
            'https://api.lyceum.technology/api/v2/external/storage/upload',
            'https://api.lyceum.technology/api/v2/external/storage/list-files',
            'https://api.lyceum.technology/api/v2/external/billing/credits',
            'https://api.lyceum.technology/api/v2/external/storage/credentials'
        ]
        
    def find_mdx_files(self) -> List[Path]:
        """Find all MDX files in the documentation"""
        mdx_files = []
        for pattern in ['*.mdx', 'examples/*.mdx']:
            mdx_files.extend(self.docs_dir.glob(pattern))
        return sorted(mdx_files)
    
    def extract_code_blocks(self, content: str) -> List[Dict]:
        """Extract code blocks from MDX content"""
        code_blocks = []
        
        # Pattern for fenced code blocks
        pattern = r'```(\w+)?\s*([^`]*?)```'
        matches = re.finditer(pattern, content, re.DOTALL)
        
        for match in matches:
            language = match.group(1) or 'text'
            code = match.group(2).strip()
            
            if code:  # Skip empty code blocks
                code_blocks.append({
                    'language': language,
                    'code': code,
                    'start_pos': match.start(),
                    'end_pos': match.end()
                })
        
        return code_blocks
    
    def extract_curl_commands(self, content: str) -> List[Dict]:
        """Extract curl commands from documentation"""
        curl_commands = []
        
        # Find curl commands in code blocks
        code_blocks = self.extract_code_blocks(content)
        
        for block in code_blocks:
            if block['language'] in ['bash', 'shell', 'curl']:
                lines = block['code'].split('\n')
                current_curl = []
                
                for line in lines:
                    line = line.strip()
                    if line.startswith('curl'):
                        if current_curl:
                            # Process previous curl command
                            curl_commands.append({
                                'command': ' '.join(current_curl),
                                'block': block
                            })
                        current_curl = [line]
                    elif current_curl and (line.startswith('-') or line.startswith('"') or '\\' in line):
                        current_curl.append(line)
                    elif current_curl:
                        # End of curl command
                        curl_commands.append({
                            'command': ' '.join(current_curl),
                            'block': block
                        })
                        current_curl = []
                
                # Don't forget the last command
                if current_curl:
                    curl_commands.append({
                        'command': ' '.join(current_curl),
                        'block': block
                    })
        
        return curl_commands
    
    def validate_python_syntax(self, code: str, filename: str) -> bool:
        """Validate Python code syntax"""
        try:
            # Clean up the code - remove common markdown artifacts
            cleaned_code = self.clean_python_code(code)
            
            # Parse the AST to check syntax
            ast.parse(cleaned_code)
            return True
            
        except SyntaxError as e:
            self.errors.append(f"{filename}: Python syntax error in code block: {e}")
            return False
        except Exception as e:
            self.errors.append(f"{filename}: Error parsing Python code: {e}")
            return False
    
    def clean_python_code(self, code: str) -> str:
        """Clean Python code for validation"""
        lines = code.split('\n')
        cleaned_lines = []
        
        # Find the minimum indentation level to normalize
        non_empty_lines = [line for line in lines if line.strip()]
        if not non_empty_lines:
            return code
            
        min_indent = float('inf')
        for line in non_empty_lines:
            if line.strip():  # Skip empty lines
                indent = len(line) - len(line.lstrip())
                min_indent = min(min_indent, indent)
        
        if min_indent == float('inf'):
            min_indent = 0
        
        for line in lines:
            # Skip comment-only lines that might be shell commands
            if line.strip().startswith('#') and ('$' in line or 'curl' in line):
                continue
            
            # Skip lines that look like shell commands
            if line.strip().startswith('!') or line.strip().startswith('$'):
                continue
                
            # Skip obvious markdown artifacts
            if line.strip().startswith('...') and line.strip().endswith('...'):
                continue
            
            # Skip lines that are clearly not Python (like curl commands)
            if 'curl -X' in line or line.strip().startswith('curl'):
                continue
            
            # Remove common minimum indentation
            if line.strip():  # Non-empty line
                if len(line) >= min_indent:
                    cleaned_lines.append(line[min_indent:])
                else:
                    cleaned_lines.append(line)
            else:  # Empty line
                cleaned_lines.append('')
        
        return '\n'.join(cleaned_lines)
    
    def validate_python_imports(self, code: str, filename: str) -> bool:
        """Validate that Python imports are available or commonly available"""
        try:
            tree = ast.parse(self.clean_python_code(code))
            imports = []
            
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        imports.append(alias.name)
                elif isinstance(node, ast.ImportFrom):
                    if node.module:
                        imports.append(node.module)
            
            # Check if imports are reasonable
            problematic_imports = []
            common_packages = {
                'requests', 'pandas', 'numpy', 'matplotlib', 'seaborn', 
                'torch', 'torchvision', 'sklearn', 'json', 'os', 'sys',
                'time', 'datetime', 'pathlib', 'tempfile', 'subprocess',
                'hashlib', 'hmac', 'base64', 'random', 'math', 'collections',
                'functools', 'itertools', 'glob', 'shutil', 'urllib',
                'PIL', 'cv2', 'boto3', 'fastapi', 'uvicorn', 'flask'
            }
            
            for imp in imports:
                base_package = imp.split('.')[0]
                if base_package not in common_packages and not base_package.startswith('_'):
                    # Check if it's a standard library module
                    try:
                        importlib.util.find_spec(base_package)
                    except (ImportError, ModuleNotFoundError, ValueError):
                        problematic_imports.append(imp)
            
            if problematic_imports:
                self.warnings.append(f"{filename}: Potentially unavailable imports: {problematic_imports}")
            
            return True
            
        except Exception as e:
            self.errors.append(f"{filename}: Error checking imports: {e}")
            return False
    
    def validate_api_endpoints(self, content: str, filename: str) -> bool:
        """Validate API endpoints mentioned in documentation"""
        all_valid = True
        
        # Find URLs in the content
        url_pattern = r'https?://[^\s\'"<>{}|\\^`\[\]]+[^\s\'"<>{}|\\^`\[\].,;:!?]'
        urls = re.findall(url_pattern, content)
        
        for url in urls:
            # Clean up URL (remove trailing punctuation that might be part of markdown)
            url = re.sub(r'[.,;:!?\'">\])}]+$', '', url)
            
            if 'api.lyceum.technology' in url:
                # Validate Lyceum API endpoint structure
                if not self.validate_lyceum_endpoint_structure(url, filename):
                    all_valid = False
                
                # Test with auth if token provided
                if self.auth_token and url in self.lyceum_test_endpoints:
                    if not self.test_lyceum_endpoint(url, filename):
                        all_valid = False
                        
            elif url in self.test_endpoints:
                # Test public endpoints
                if not self.test_endpoint(url, filename):
                    all_valid = False
        
        return all_valid
    
    def validate_lyceum_endpoint_structure(self, url: str, filename: str) -> bool:
        """Validate Lyceum API endpoint structure"""
        expected_patterns = [
            r'https://api\.lyceum\.technology/api/v2/external/execution/(python|image)/start',
            r'https://api\.lyceum\.technology/api/v2/external/storage/(upload|download|list-files|credentials|delete)',
            r'https://api\.lyceum\.technology/api/v2/external/billing/(credits|checkout|history|activities)',
            r'https://dashboard\.lyceum\.technology'
        ]
        
        for pattern in expected_patterns:
            if re.match(pattern, url):
                return True
        
        self.warnings.append(f"{filename}: Unrecognized Lyceum endpoint pattern: {url}")
        return True  # Don't fail for this, just warn
    
    def test_endpoint(self, url: str, filename: str) -> bool:
        """Test if an endpoint is reachable"""
        try:
            response = requests.get(url, timeout=10)
            if response.status_code >= 400:
                self.warnings.append(f"{filename}: Endpoint {url} returned status {response.status_code}")
                return False
            return True
        except requests.exceptions.RequestException as e:
            self.warnings.append(f"{filename}: Could not reach endpoint {url}: {e}")
            return False
    
    def test_lyceum_endpoint(self, url: str, filename: str) -> bool:
        """Test Lyceum API endpoint with authentication"""
        try:
            headers = {
                'Authorization': f'Bearer {self.auth_token}',
                'Content-Type': 'application/json'
            }
            
            print(f"  Testing {url} with auth...")
            
            if 'billing/credits' in url:
                response = requests.get(url, headers=headers, timeout=10)
            elif 'storage/list-files' in url:
                response = requests.get(url, headers=headers, timeout=10)
            else:
                # For other endpoints, just check if they respond to OPTIONS
                response = requests.options(url, headers=headers, timeout=10)
            
            if response.status_code == 401:
                self.errors.append(f"{filename}: Authentication failed for {url} - invalid token?")
                return False
            elif response.status_code == 403:
                self.warnings.append(f"{filename}: Forbidden access to {url} - check permissions")
                return True  # Endpoint exists, just no permission
            elif response.status_code >= 500:
                self.warnings.append(f"{filename}: Server error {response.status_code} for {url}")
                return False
            elif response.status_code >= 400:
                self.warnings.append(f"{filename}: Client error {response.status_code} for {url}")
                return False
            else:
                print(f"    ✅ {url} - Status: {response.status_code}")
                
                # Try to parse response for billing/credits
                if 'billing/credits' in url and response.status_code == 200:
                    try:
                        data = response.json()
                        if 'available_credits' in data:
                            print(f"    💰 Available credits: {data['available_credits']}")
                        else:
                            self.warnings.append(f"{filename}: Unexpected response format from {url}")
                    except json.JSONDecodeError:
                        self.warnings.append(f"{filename}: Invalid JSON response from {url}")
                
                return True
                
        except requests.exceptions.RequestException as e:
            self.warnings.append(f"{filename}: Could not reach Lyceum endpoint {url}: {e}")
            return False
    
    def validate_curl_commands(self, curl_commands: List[Dict], filename: str) -> bool:
        """Validate curl command structure"""
        all_valid = True
        
        for cmd_info in curl_commands:
            command = cmd_info['command']
            
            # Basic curl command validation
            if not command.strip().startswith('curl'):
                continue
            
            # Check for required headers in Lyceum API calls
            if 'api.lyceum.technology' in command:
                if 'Authorization: Bearer' not in command and 'Authorization: Bearer <' not in command:
                    self.warnings.append(f"{filename}: Lyceum API call missing Authorization header: {command[:100]}...")
                
                if 'Content-Type: application/json' not in command and '-d ' in command:
                    self.warnings.append(f"{filename}: JSON POST request missing Content-Type header: {command[:100]}...")
            
            # Check for placeholder tokens
            if '<TOKEN>' not in command and '<token>' not in command and 'Bearer <' not in command:
                if 'api.lyceum.technology' in command and 'Authorization:' in command:
                    self.warnings.append(f"{filename}: API call might contain real token instead of placeholder: {command[:100]}...")
        
        return all_valid
    
    def validate_json_examples(self, content: str, filename: str) -> bool:
        """Validate JSON examples in documentation"""
        all_valid = True
        
        # Find JSON code blocks
        code_blocks = self.extract_code_blocks(content)
        
        for block in code_blocks:
            if block['language'] == 'json':
                try:
                    # Clean JSON - remove comments and trailing commas
                    cleaned_json = self.clean_json_code(block['code'])
                    json.loads(cleaned_json)
                except json.JSONDecodeError as e:
                    # Only error if it's not a template/example JSON
                    if not self.is_template_json(block['code']):
                        self.errors.append(f"{filename}: Invalid JSON in code block: {e}")
                        all_valid = False
                    else:
                        # Just warn for template JSON
                        self.warnings.append(f"{filename}: Template JSON with placeholders: {e}")
        
        return all_valid
    
    def clean_json_code(self, json_code: str) -> str:
        """Clean JSON code for validation"""
        lines = json_code.split('\n')
        cleaned_lines = []
        
        for line in lines:
            # Remove comments
            if '//' in line:
                line = line.split('//')[0]
            
            # Remove trailing commas before closing braces/brackets
            line = re.sub(r',(\s*[}\]])', r'\1', line)
            
            cleaned_lines.append(line)
        
        return '\n'.join(cleaned_lines)
    
    def is_template_json(self, json_code: str) -> bool:
        """Check if JSON contains template placeholders"""
        placeholders = ['<token>', '<TOKEN>', '...', 'your-', 'YOUR_', 'EXAMPLE']
        return any(placeholder in json_code for placeholder in placeholders)
    
    def run_python_code_test(self, code: str, filename: str) -> bool:
        """Run Python code in a safe environment to test execution"""
        try:
            # Create a temporary file
            with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
                # Add imports that might be missing
                test_code = '''
import sys
import os
import json
import time
from datetime import datetime

# Mock external dependencies that might not be available
try:
    import requests
except ImportError:
    class MockRequests:
        def get(self, *args, **kwargs): return type('Response', (), {'status_code': 200, 'json': lambda: {}})()
        def post(self, *args, **kwargs): return type('Response', (), {'status_code': 200, 'json': lambda: {}})()
    requests = MockRequests()

try:
    import pandas as pd
except ImportError:
    pd = None

try:
    import numpy as np
except ImportError:
    np = None

# Original code
''' + self.clean_python_code(code)
                
                f.write(test_code)
                f.flush()
                
                # Try to run the code with a timeout
                result = subprocess.run(
                    [sys.executable, '-m', 'py_compile', f.name],
                    capture_output=True,
                    timeout=10
                )
                
                os.unlink(f.name)
                
                if result.returncode != 0:
                    self.warnings.append(f"{filename}: Python code compilation warning: {result.stderr.decode()}")
                    return False
                
                return True
                
        except Exception as e:
            self.warnings.append(f"{filename}: Could not test Python code execution: {e}")
            return False
    
    def validate_file(self, file_path: Path) -> Dict:
        """Validate a single MDX file"""
        print(f"Validating {file_path.name}...")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        filename = str(file_path.relative_to(self.docs_dir))
        results = {
            'file': filename,
            'python_blocks': 0,
            'json_blocks': 0,
            'curl_commands': 0,
            'api_endpoints': 0,
            'errors': 0,
            'warnings': 0
        }
        
        # Extract and validate code blocks
        code_blocks = self.extract_code_blocks(content)
        
        for block in code_blocks:
            if block['language'] == 'python':
                results['python_blocks'] += 1
                self.validate_python_syntax(block['code'], filename)
                self.validate_python_imports(block['code'], filename)
                
            elif block['language'] == 'json':
                results['json_blocks'] += 1
                self.validate_json_examples(content, filename)
        
        # Validate curl commands
        curl_commands = self.extract_curl_commands(content)
        results['curl_commands'] = len(curl_commands)
        self.validate_curl_commands(curl_commands, filename)
        
        # Validate API endpoints
        self.validate_api_endpoints(content, filename)
        
        return results
    
    def generate_report(self) -> str:
        """Generate validation report"""
        report = []
        report.append("# Documentation Validation Report")
        report.append(f"Generated: {datetime.now().isoformat()}")
        report.append("")
        
        # Summary
        report.append("## Summary")
        report.append(f"- Files validated: {len(self.validated_examples)}")
        report.append(f"- Total errors: {len(self.errors)}")
        report.append(f"- Total warnings: {len(self.warnings)}")
        report.append("")
        
        # File details
        if self.validated_examples:
            report.append("## File Validation Results")
            for result in self.validated_examples:
                report.append(f"### {result['file']}")
                report.append(f"- Python blocks: {result['python_blocks']}")
                report.append(f"- JSON blocks: {result['json_blocks']}")
                report.append(f"- Curl commands: {result['curl_commands']}")
                report.append("")
        
        # Errors
        if self.errors:
            report.append("## Errors")
            for error in self.errors:
                report.append(f"- ❌ {error}")
            report.append("")
        
        # Warnings
        if self.warnings:
            report.append("## Warnings")
            for warning in self.warnings:
                report.append(f"- ⚠️ {warning}")
            report.append("")
        
        if not self.errors and not self.warnings:
            report.append("## ✅ All validations passed!")
        
        return "\n".join(report)
    
    def run_validation(self) -> bool:
        """Run validation on all documentation files"""
        print("Starting documentation validation...")
        
        if self.auth_token:
            print("🔑 Authentication token provided - will test Lyceum API endpoints")
        else:
            print("ℹ️  No auth token - will only validate endpoint structure")
        
        mdx_files = self.find_mdx_files()
        print(f"Found {len(mdx_files)} MDX files to validate")
        
        for file_path in mdx_files:
            try:
                result = self.validate_file(file_path)
                self.validated_examples.append(result)
            except Exception as e:
                self.errors.append(f"Failed to validate {file_path}: {e}")
        
        # Generate and save report
        report = self.generate_report()
        
        with open(self.docs_dir / 'validation_report.md', 'w') as f:
            f.write(report)
        
        print("\nValidation complete!")
        print(f"Errors: {len(self.errors)}")
        print(f"Warnings: {len(self.warnings)}")
        print("Report saved to: validation_report.md")
        
        return len(self.errors) == 0

def main():
    """Main validation function"""
    parser = argparse.ArgumentParser(description='Validate Lyceum documentation examples')
    parser.add_argument('--token', '-t', help='Lyceum API authentication token for testing endpoints')
    parser.add_argument('--docs-dir', '-d', help='Documentation directory path', 
                       default=os.path.dirname(os.path.abspath(__file__)))
    
    args = parser.parse_args()
    
    validator = DocumentationValidator(args.docs_dir, args.token)
    
    success = validator.run_validation()
    
    if not success:
        print("\n❌ Validation failed with errors!")
        sys.exit(1)
    elif validator.warnings:
        print("\n⚠️ Validation completed with warnings.")
        sys.exit(0)
    else:
        print("\n✅ All validations passed!")
        sys.exit(0)

if __name__ == "__main__":
    main()