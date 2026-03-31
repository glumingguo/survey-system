import pdfplumber

pdf_path = 'D:/A生活/生活记录/PDF答卷/沈阳27白领人妻戚睿入门篇.pdf'

# 读取PDF
with pdfplumber.open(pdf_path) as pdf:
    # 只看第2页和第3页，这些页应该有问题
    for page_num in [1, 2, 3, 4]:
        print(f"\n{'='*80}")
        print(f"Page {page_num}:")
        print(f"{'='*80}")
        page = pdf.pages[page_num - 1]
        text = page.extract_text()
        lines = text.split('\n')
        for i, line in enumerate(lines[:30]):  # 只显示前30行
            print(f"{i:3}: |{line}|")
