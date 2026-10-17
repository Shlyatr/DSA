import express from 'express';
import cors from 'cors';
import { parseAddress, parseAddressDetailed } from './parser.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PATCH', 'PUT', "DELETE"],
  allowedHeaders: ['Content-Type']
}))

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.post('/api/parse', (req, res) => {
  try {
    const { raw_address } = req.body;

    if (!raw_address || typeof raw_address !== 'string') {
      return res.status(400).json({
        error: 'Поле "raw_address" обязательно и должно быть строкой'
      });
    }

    const record = { id: req.body.id, raw_address };
    if (req.query.explain) {
      const { result, meta } = parseAddressDetailed(record);
      return res.status(200).json({ result, meta });
    }

    return res.status(200).json({
      result: parseAddress(record)
    });
  } catch (error) {
    console.error('Ошибка при парсинге адреса:', error);
    return res.status(500).json({
      error: 'Внутренняя ошибка сервера при обработке адреса'
    });
  }
});

app.post('/api/parse/batch', (req, res) => {
  try {
    const items = Array.isArray(req.body) 
      ? req.body 
      : (req.body?.items || req.body?.data);

    if (!Array.isArray(items)) {
      return res.status(400).json({
        error: 'Запрос должен содержать JSON-массив объектов с полем "raw_address"'
      });
    }

    // На каждую входную запись всегда возвращается ответ (пустой, если разобрать нечего).
    const parsed = items.map((item) => (typeof item === 'string' ? { raw_address: item } : item || {}))
      .map((item) => parseAddress(item));

    // ?format=flat — плоский массив в формате ТЗ (sample_output.json)
    if (req.query.format === 'flat') {
      return res.status(200).json(parsed);
    }

    const results = items.map((item, index) => (
      typeof item === 'string'
        ? { index, result: parsed[index] }
        : { ...item, result: parsed[index] }
    ));

    return res.status(200).json(results);
  } catch (error) {
    console.error('Ошибка при массовом парсинге:', error);
    return res.status(500).json({
      error: 'Внутренняя ошибка сервера при массовой обработке'
    });
  }
});

app.listen(PORT, () => {
  console.log(`REST API сервер запущен на порту ${PORT}`);
  console.log(`Health check доступен по адресу: http://localhost:${PORT}/api/health`);
});