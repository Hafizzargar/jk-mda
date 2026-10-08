const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../../supabase/tests/employee_security.test.sql');
let content = fs.readFileSync(filePath, 'utf8');

// Replace public.create_article(...) with the new signature
content = content.replace(
  /public\.create_article\(\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*(true|false)\s*\)/g,
  (match, p1, p2, p3, p4, p5, p6) => {
    // p1 = title, p2 = summary (excerpt), p3 = body (content), p4 = category, p5 = language, p6 = submit
    return `public.create_article('${p1}', '${p2}', '${p3}', 'test-slug-' || floor(random() * 1000000)::text, null, '${p4}', null, null, null)`;
  }
);

fs.writeFileSync(filePath, content);
console.log('Fixed employee_security.test.sql');
