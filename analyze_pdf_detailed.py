from pypdf import PdfReader
import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

pdf_path = 'D:/A生活/生活记录/PDF答卷/沈阳27白领人妻戚睿入门篇.pdf'
reader = PdfReader(pdf_path)

# 提取所有文本
full_text = ""
for i, page in enumerate(reader.pages):
    text = page.extract_text()
    full_text += f"\n=== Page {i+1} ===\n"
    full_text += text
    full_text += "\n"

# 查找问题模式
print("Looking for question patterns...")
print("="*80)

# 模式1: 数字+点
pattern1 = re.findall(r'\d+\.\s*[^\n]{10,100}', full_text)
print(f"\nPattern 1 (Number + dot): Found {len(pattern1)} matches")
for i, match in enumerate(pattern1[:10]):
    print(f"  {i+1}. {match[:80]}")

# 模式2: * 标记
pattern2 = re.findall(r'\*\s*\d+\.\s*', full_text)
print(f"\nPattern 2 (* number): Found {len(pattern2)} matches")
for i, match in enumerate(pattern2[:10]):
    print(f"  {i+1}. {match}")

# 模式3: 中文数字
pattern3 = re.findall(r'[一二三四五六七八九十]+\.\s*[^\n]{10,100}', full_text)
print(f"\nPattern 3 (Chinese numbers): Found {len(pattern3)} matches")
for i, match in enumerate(pattern3[:10]):
    print(f"  {i+1}. {match[:80]}")

# 查找答案/选项
print("\n" + "="*80)
print("Looking for options/answers...")
print("="*80)

# 查找以选项形式出现的文本
lines = full_text.split('\n')
option_lines = [line.strip() for line in lines if line.strip() and (line.startswith('A.') or line.startswith('B.') or line.startswith('C.') or line.startswith('D.') or line.startswith('是') or line.startswith('否'))]

print(f"\nFound {len(option_lines)} potential option lines:")
for i, line in enumerate(option_lines[:20]):
    print(f"  {i+1}. {line[:80]}")

# 分析PDF的实际结构
print("\n" + "="*80)
print("PDF Structure Analysis:")
print("="*80)

# 查找包含"问"或题目的行
question_lines = [line for line in lines if '问' in line or '题' in line or '愿意' in line or '是' in line or '否' in line]
print(f"\nLines containing question keywords: {len(question_lines)}")
for i, line in enumerate(question_lines[:20]):
    print(f"  {i+1}. {line[:80]}")
