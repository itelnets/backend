const fs = require('fs');
let c = fs.readFileSync('src/utils/invoiceUtils.ts', 'utf8');
c = c.split("replace(/\\\\//g, '.')").join("replace(/\\//g, '.')");
fs.writeFileSync('src/utils/invoiceUtils.ts', c);
