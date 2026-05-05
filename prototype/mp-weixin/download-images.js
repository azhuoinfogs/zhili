const fs = require('fs');
const path = require('path');
const https = require('https');

const images = [
  { name: 'banner.jpg', url: 'https://neeko-copilot.bytedance.net/api/text_to_image?prompt=elegant%20gift%20box%20collection%20with%20luxury%20packaging%2C%20golden%20ribbons%2C%20chinese%20traditional%20style%2C%20warm%20lighting%2C%20premium%20quality%2C%20gift%20shop%20banner&image_size=landscape_16_9' },
  { name: 'tea-gift.jpg', url: 'https://neeko-copilot.bytedance.net/api/text_to_image?prompt=elegant%20chinese%20tea%20gift%20box%20with%20red%20packaging&image_size=square' },
  { name: 'candle-set.jpg', url: 'https://neeko-copilot.bytedance.net/api/text_to_image?prompt=luxury%20scented%20candle%20gift%20set%20elegant%20packaging&image_size=square' },
  { name: 'pen-gift.jpg', url: 'https://neeko-copilot.bytedance.net/api/text_to_image?prompt=vintage%20fountain%20pen%20gift%20box%20luxury%20stationery&image_size=square' },
  { name: 'succulent.jpg', url: 'https://neeko-copilot.bytedance.net/api/text_to_image?prompt=cute%20succulent%20plants%20in%20ceramic%20pot%20gift%20set&image_size=square' },
  { name: 'chocolate.jpg', url: 'https://neeko-copilot.bytedance.net/api/text_to_image?prompt=artisan%20chocolate%20gift%20box%20premium%20packaging&image_size=square' },
  { name: 'silk-scarf.jpg', url: 'https://neeko-copilot.bytedance.net/api/text_to_image?prompt=elegant%20silk%20scarf%20with%20floral%20pattern%20gift&image_size=square' },
  { name: 'smart-band.jpg', url: 'https://neeko-copilot.bytedance.net/api/text_to_image?prompt=smart%20fitness%20band%20modern%20design%20gift&image_size=square' },
  { name: 'notebook.jpg', url: 'https://neeko-copilot.bytedance.net/api/text_to_image?prompt=leather%20bound%20journal%20notebook%20premium%20gift&image_size=square' }
];

const downloadDir = path.join(__dirname, 'images');

if (!fs.existsSync(downloadDir)) {
  fs.mkdirSync(downloadDir, { recursive: true });
}

let completed = 0;

images.forEach((image, index) => {
  const filePath = path.join(downloadDir, image.name);
  const file = fs.createWriteStream(filePath);
  
  https.get(image.url, (response) => {
    response.pipe(file);
    
    file.on('finish', () => {
      file.close();
      completed++;
      console.log(`[${completed}/${images.length}] 已下载: ${image.name}`);
      
      if (completed === images.length) {
        console.log('\n✅ 所有图片下载完成！');
        console.log(`图片已保存到: ${downloadDir}`);
      }
    });
    
    file.on('error', (err) => {
      console.error(`下载 ${image.name} 失败:`, err.message);
      completed++;
    });
  }).on('error', (err) => {
    console.error(`请求 ${image.name} 失败:`, err.message);
    completed++;
  });
});
