import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const productsPath = path.join(__dirname, 'products.json');

export const productsData = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
