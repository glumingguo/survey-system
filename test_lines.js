const fs = require('fs');
const text = fs.readFileSync('pdf_output.txt', 'utf8');
const lines = text.split('\n').map(l => l.trim()).filter(l => l);
console.log('Total lines:', lines.length);
console.log('Lines containing numbers:');
lines.forEach((l, i) => { 
  if (/^\d+[\.\t]/.test(l) || /^\d+、/.test(l)) { 
    console.log(i + ': ' + l.substring(0, 80)); 
  }
});
