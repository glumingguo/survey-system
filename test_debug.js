const fs = require('fs');
const text = fs.readFileSync('pdf_output.txt', 'utf8');
const lines = text.split('\n').map(l => l.trim()).filter(l => l);

// 查看前30行
console.log('First 30 lines:');
lines.slice(0, 30).forEach((l, i) => {
  console.log(i + ': "' + l + '"');
});
