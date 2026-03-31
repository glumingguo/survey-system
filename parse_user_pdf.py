import pdfplumber
import json
import re

pdf_path = 'D:/A生活/生活记录/PDF答卷/沈阳27白领人妻戚睿入门篇.pdf'

# 读取PDF
questions = []
with pdfplumber.open(pdf_path) as pdf:
    full_text = ""
    for i, page in enumerate(pdf.pages):
        text = page.extract_text()
        if text:
            full_text += f"\n=== Page {i+1} ===\n"
            full_text += text

# 分割成行
lines = full_text.split('\n')

# 解析问题
current_question = None
question_count = 0

for i, line in enumerate(lines):
    line = line.strip()
    if not line:
        continue

    # 匹配问题模式：* 数字. 或 * 数字
    match = re.match(r'\*\s*(\d+)\.?\s*(.*)', line)

    if match:
        # 保存前一个问题
        if current_question:
            questions.append(current_question)

        # 开始新问题
        question_num = match.group(1)
        question_text = match.group(2).strip()

        question_count += 1
        current_question = {
            'number': question_num,
            'title': question_text if question_text else f"问题 {question_num}",
            'type': 'singleChoice',  # 默认为单选
            'options': []
        }
    elif current_question:
        # 检查是否是选项（以"是"、"否"等开头）
        if line.startswith('是') or line.startswith('否') or line.startswith('没有') or line.startswith('有过'):
            if line not in current_question['options']:
                current_question['options'].append(line)
        # 如果行较长且不是选项，可能是问题描述的补充
        elif len(line) > 20 and not line.startswith('==='):
            if current_question['title'] and len(line) > len(current_question['title']):
                current_question['title'] = line

# 保存最后一个问题
if current_question:
    questions.append(current_question)

# 输出结果
print(f"Found {len(questions)} questions")
print("="*80)

for i, q in enumerate(questions[:20]):  # 只显示前20个
    print(f"\nQuestion {i+1}:")
    print(f"  Number: {q['number']}")
    print(f"  Title: {q['title'][:100]}")
    print(f"  Type: {q['type']}")
    print(f"  Options ({len(q['options'])}):")
    for opt in q['options'][:5]:
        print(f"    - {opt[:80]}")
    print("-"*80)

# 保存为JSON
with open('parsed_questions.json', 'w', encoding='utf-8') as f:
    json.dump(questions, f, ensure_ascii=False, indent=2)

print(f"\nSaved {len(questions)} questions to parsed_questions.json")
