const fs = require('fs');
const text = fs.readFileSync('pdf_output.txt', 'utf8');

// 测试解析函数
function parseQuestionsFromText(text) {
  const questions = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);

  let currentQuestion = null;
  let pendingTitle = null;

  const numberAtEndPattern = /(.+?)\s+(\d+)[\.\t]\s*$/;
  const numberOnlyPattern = /^(\d+)[\.\t]\s*$/;

  const sectionKeywords = ['准备篇', '基本信息', '仪式感', '羞耻调教', '进阶篇', 
    '匿名', '完成时间', '感谢', '谢谢', '提交'];

  const skipPatterns = [
    /^第\s*\d+\s*页$/, /^页码$/, /^共\d+页$/,
    /^[\s]*$/, /^[-=*_]{5,}$/,
    /^--\s*\d+\s*of\s*\d+\s*--$/,
  ];

  const isRequired = (line) => line.includes('*');

  const isOption = (line) => {
    if (/^\d+[\.\t]/.test(line)) return false;
    if (/\s+\d+[\.\t]/.test(line)) return false;
    if (line.includes('*')) return false;
    if (line.length > 3 && line.length < 50) return true;
    return false;
  };

  const isSectionTitle = (line) => {
    return sectionKeywords.some(k => line.includes(k));
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (skipPatterns.some(p => p.test(line))) continue;
    if (line.length < 2) continue;
    if (isSectionTitle(line)) continue;

    let match;
    let title = '';
    let number = 0;

    match = line.match(numberAtEndPattern);
    if (match) {
      title = match[1].trim().replace(/\s*\*+\s*/g, '');
      number = parseInt(match[2]);
    }
    else if (numberOnlyPattern.test(line)) {
      if (pendingTitle) {
        title = pendingTitle;
        number = parseInt(line.match(numberOnlyPattern)[1]);
        pendingTitle = null;
      }
    }
    else {
      if (!currentQuestion || currentQuestion.title) {
        if (currentQuestion && currentQuestion.title && isOption(line)) {
          if (!currentQuestion.options) currentQuestion.options = [];
          currentQuestion.options.push(line);
          continue;
        }
        pendingTitle = line.replace(/\s*\*+\s*/g, '');
        continue;
      }
    }

    if (title && title.length > 0) {
      if (currentQuestion && currentQuestion.title) {
        if (currentQuestion.options && currentQuestion.options.length >= 2) {
          currentQuestion.type = 'singleChoice';
        } else {
          currentQuestion.type = 'text';
          currentQuestion.options = undefined;
        }
        questions.push(currentQuestion);
      }

      const required = line.includes('*');

      currentQuestion = {
        id: 'q_' + Date.now() + '_' + questions.length,
        title: title,
        type: 'text',
        required: required,
        options: []
      };
      continue;
    }

    if (currentQuestion && currentQuestion.title) {
      if (isOption(line)) {
        if (!currentQuestion.options) currentQuestion.options = [];
        currentQuestion.options.push(line);
      }
    }
  }

  if (currentQuestion && currentQuestion.title) {
    if (currentQuestion.options && currentQuestion.options.length >= 2) {
      currentQuestion.type = 'singleChoice';
    } else {
      currentQuestion.type = 'text';
      currentQuestion.options = undefined;
    }
    questions.push(currentQuestion);
  }

  return questions.filter(q => q.title && q.title.length > 0);
}

const result = parseQuestionsFromText(text);
console.log('Total questions:', result.length);
console.log('First 15 questions:');
result.slice(0, 15).forEach((q, i) => {
  console.log(i + 1 + '. ' + q.title.substring(0, 60));
  if (q.options) console.log('   Options: ' + q.options.length + ': ' + q.options.slice(0,2).join(', '));
});
