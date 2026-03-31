const fs = require('fs');
const text = fs.readFileSync('pdf_output.txt', 'utf8');
const lines = text.split('\n').map(l => l.trim()).filter(l => l);

// 查看更多行
console.log('Lines around question 1-3:');
lines.slice(14, 25).forEach((l, i) => {
  console.log((14+i) + ': "' + l + '"');
});
