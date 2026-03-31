from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# 注册中文字体（如果系统有支持）
# pdfmetrics.registerFont(TTFont('SimSun', 'C:/Windows/Fonts/simsun.ttc'))
# pdfmetrics.registerFont(TTFont('SimHei', 'C:/Windows/Fonts/simhei.ttf'))

def create_test_pdf(filename):
    c = canvas.Canvas(filename, pagesize=letter)
    width, height = letter

    # 标题
    c.setFont("Helvetica-Bold", 18)
    c.drawString(100, height - 50, "Sample Survey Questionnaire")

    # 第一题 - 单选题
    c.setFont("Helvetica-Bold", 12)
    c.drawString(100, height - 100, "1. What is your primary programming language?")
    c.setFont("Helvetica", 10)
    c.drawString(120, height - 120, "A. JavaScript")
    c.drawString(120, height - 140, "B. Python")
    c.drawString(120, height - 160, "C. Java")
    c.drawString(120, height - 180, "D. C++")

    # 第二题 - 多选题
    c.setFont("Helvetica-Bold", 12)
    c.drawString(100, height - 220, "2. Which frameworks do you use? (Multiple Choice)")
    c.setFont("Helvetica", 10)
    c.drawString(120, height - 240, "A. React")
    c.drawString(120, height - 260, "B. Vue")
    c.drawString(120, height - 280, "C. Angular")
    c.drawString(120, height - 300, "D. Django")

    # 第三题 - 问答题
    c.setFont("Helvetica-Bold", 12)
    c.drawString(100, height - 340, "3. Describe your experience with web development:")

    # 第四题 - 另一种格式
    c.setFont("Helvetica-Bold", 12)
    c.drawString(100, height - 380, "4. How long have you been programming?")
    c.setFont("Helvetica", 10)
    c.drawString(120, height - 400, "A. Less than 1 year")
    c.drawString(120, height - 420, "B. 1-3 years")
    c.drawString(120, height - 440, "C. 3-5 years")
    c.drawString(120, height - 460, "D. More than 5 years")

    # 第五题 - 问答题
    c.setFont("Helvetica-Bold", 12)
    c.drawString(100, height - 500, "5. What is your biggest challenge in programming?")

    c.save()
    print(f"Test PDF created: {filename}")

if __name__ == "__main__":
    create_test_pdf("test_survey.pdf")
