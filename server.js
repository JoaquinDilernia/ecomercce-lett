import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Usar el middleware CORS
app.use(cors());

// Servir archivos estáticos de la aplicación React
app.use(express.static(path.join(__dirname, 'build')));

// Ruta para servir los datos JSON
app.get('/api/posts', (req, res) => {
  res.sendFile(path.join(__dirname, 'data.json'));
});

// Servir la aplicación React para cualquier otra ruta
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});