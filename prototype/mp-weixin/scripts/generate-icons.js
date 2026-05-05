const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '../images');

// 创建简单的 PNG 图标 (1x1 像素的透明图片作为占位符)
const createPlaceholderIcon = (color) => {
  // 简单的 24x24 PNG 文件头和数据
  // 使用 base64 编码的简单图标
  const icons = {
    gold: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAOUlEQVRIS2NkGGDAOMJZMAowDgBg8ABfAAHWA4gJgBnYADcAbVAGbwAKsAdcgC9wBE4AE9gFfgBGwBVYAOXAArABywDH8AA7oH9YV6gC8wAAAABJRU5ErkJggg==', 'base64'),
    gray: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAOUlEQVRIS2NkGGDAOMJZMAowDgBg8ABfAAHWA4gJgBnYADcAbVAGbwAKsAdcgC9wBE4AE9gFfgBGwBVYAOXAArABywDH8AA7oH9YV6gC8wAAAABJRU5ErkJggg==', 'base64'),
  };
  return icons[color] || icons.gray;
};

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 创建图标文件
const icons = [
  { name: 'browse.png', color: 'gray' },
  { name: 'browse-active.png', color: 'gold' },
  { name: 'profile.png', color: 'gray' },
  { name: 'profile-active.png', color: 'gold' },
];

icons.forEach(({ name, color }) => {
  const filePath = path.join(iconsDir, name);
  fs.writeFileSync(filePath, createPlaceholderIcon(color));
  console.log(`Created icon: ${filePath}`);
});

console.log('All icons generated successfully!');
