// 切换到 server 目录，使 node_modules 可见，然后启动服务
const path = require('path');
const serverDir = path.join(__dirname, '..', 'server');
process.chdir(serverDir);
require(path.join(serverDir, 'index.js'));

