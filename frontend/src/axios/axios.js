import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
});

export async function parseAddress(rawAddress) {
  const res = await api.post('/parse', { raw_address: rawAddress });
  return res.data;
}

export async function batchAddress(jsonArray) {
  const res = await api.post('/parse/batch', jsonArray);
  return res.data;
}

export async function sendFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await api.post('/parse/file', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
}