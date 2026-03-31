from pypdf import PdfReader
import sys

sys.stdout.reconfigure(encoding='utf-8')

pdf_path = 'D:/A生活/生活记录/PDF答卷/沈阳27白领人妻戚睿入门篇.pdf'
reader = PdfReader(pdf_path)

print(f"Total pages: {len(reader.pages)}")
print("\n" + "="*80)
print("Page 1 preview:")
print("="*80)
page1 = reader.pages[0].extract_text()
print(page1[:1500])

print("\n" + "="*80)
print("Page 2 preview:")
print("="*80)
page2 = reader.pages[1].extract_text()
print(page2[:1500])

print("\n" + "="*80)
print("Page 3 preview:")
print("="*80)
page3 = reader.pages[2].extract_text()
print(page3[:1500])
