import pdfplumber
import sys
import json

# 设置输出编码为UTF-8
sys.stdout.reconfigure(encoding='utf-8')

# 读取PDF文件
questions = []

with pdfplumber.open('D:/A生活/生活记录/PDF答卷/沈阳27白领人妻戚睿入门篇.pdf') as pdf:
    for i, page in enumerate(pdf.pages):
        text = page.extract_text()
        if text:
            print(f'\n--- Page {i+1} ---')
            print(text)
            # 保存到文件
            questions.append({
                'page': i+1,
                'text': text
            })

# 保存为JSON文件
with open('questions_data.json', 'w', encoding='utf-8') as f:
    json.dump(questions, f, ensure_ascii=False, indent=2)

print('\n\n数据已保存到 questions_data.json')
