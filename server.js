const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
  console.log('Carpeta uploads creada');
} else {
  console.log('Carpeta uploads existe');
}

const VIDEOS_JSON = path.join(__dirname, 'videos.json');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    const filename = `${baseName}-${Date.now()}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({ storage });

app.use(express.json());

function loadVideos() {
  if (!fs.existsSync(VIDEOS_JSON)) return [];
  try {
    const raw = fs.readFileSync(VIDEOS_JSON, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error leyendo videos.json:', e);
    return [];
  }
}

function saveVideos(videos) {
  try {
    fs.writeFileSync(VIDEOS_JSON, JSON.stringify(videos, null, 2));
    console.log('videos.json actualizado');
  } catch (e) {
    console.error('Error guardando videos.json:', e);
  }
}

function calculateScore(combo) {
  const palabras_valores = { 'XTB': 1, 'RXTB': 1, 'XTBV': 1, 'RXTBV': 1 };
  if (!combo) return { puntaje: 0, desconocido: true };
  const parts = combo.trim().toUpperCase().split(/\s+/);
  let total = 0;
  let desconocido = false;
  for (const trick of parts) {
    if (palabras_valores.hasOwnProperty(trick)) {
      total += palabras_valores[trick];
    } else {
      desconocido = true;
    }
  }
  return { puntaje: total, desconocido };
}

app.post('/upload', upload.single('video'), (req, res) => {
  console.log('POST /upload recibido');

  if (!req.file) {
    console.log('No se subió archivo video');
    return res.status(400).json({ success: false, message: 'No video uploaded' });
  }
  console.log('Archivo recibido:', req.file.filename);

  const { title, combo } = req.body;
  
  // Leer isUnderground e isTutorial con exactitud
  const isUnderground = req.body.isUnderground === 'true';
  const isTutorial = req.body.isTutorial === 'true';

  const videos = loadVideos();

  const scoreData = calculateScore(combo);

  const newVideo = {
    id: Date.now(),
    title: title || 'Sin título',
    combo: combo || '',
    isUnderground: !!isUnderground,
    isTutorial: !!isTutorial,
    views: 0,
    date: new Date().toISOString(),
    url: '/uploads/' + req.file.filename,
    puntajeCombo: scoreData.puntaje,
    desconocido: scoreData.desconocido,
  };

  videos.push(newVideo);

  try {
    saveVideos(videos);
  } catch (e) {
    console.error('Error guardando videos:', e);
    return res.status(500).json({ success: false, message: 'Error saving videos' });
  }

  res.json({ success: true, video: newVideo });
});

app.get('/videos', (req, res) => {
  const tab = req.query.tab || 'underground';
  let videos = loadVideos();

  if (tab === 'underground') {
    videos = videos.filter(v => v.isUnderground);
    videos.sort((a, b) => b.puntajeCombo - a.puntajeCombo);
  } else if (tab === 'tutorials') {
    videos = videos.filter(v => v.isTutorial);
    videos.sort((a, b) => new Date(b.date) - new Date(a.date));  // Ordenar tutoriales por fecha
  }

  res.json({ success: true, videos });
});

app.use('/uploads', express.static(UPLOAD_DIR));

app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
