from pypdf import PdfReader
import sys

# 设置输出编码为UTF-8
sys.stdout.reconfigure(encoding='utf-8')

# 读取PDF文件
reader = PdfReader('D:/A生活/生活记录/PDF答卷/沈阳27白领人妻戚睿入门篇.pdf')

# 提取所有页面的文本
for i, page in enumerate(reader.pages):
    print(f'\n--- Page {i+1} ---')
    text = page.extract_text()
    if text:
        print(text)
    else:
        print('(No text extracted from this page)')

