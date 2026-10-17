<template>
  <div class="flex flex-col items-center p-10">
    <!-- 1. Парсинг одного адреса -->
    <div class="flex flex-col w-1/2">
      <label for="address"><code>raw_address</code></label>
      <div class="flex gap-2 w-full">
        <input 
          type="text" 
          v-model="address.raw_address" 
          id="address" 
          class="px-3 py-2 border w-[70%] outline-0"
        >
        <button @click="parseAddress" class="px-3 py-2 bg-black text-white cursor-pointer">send</button>
      </div>
    </div>

    <pre v-if="raw_address_res" class="bg-black p-5 text-white mt-5 w-1/2 overflow-x-auto">
      <code>{{ raw_address_res }}</code>
    </pre>

    <!-- 2. Парсинг массива из Textarea -->
    <div class="flex flex-col w-1/2 mt-10">
      <label for="address_batch"><code>[raw_address] (JSON в тексте)</code></label>
      <div class="flex gap-2 w-full">
        <textarea 
          id="address_batch" 
          v-model="address_array" 
          rows="6"
          placeholder="Вставьте JSON-массив объектов..."
          class="px-3 py-2 border w-[70%] outline-0 font-mono text-sm"
        ></textarea>
        <button @click="batchAddress" class="px-3 py-2 bg-black text-white cursor-pointer self-start">send</button>
      </div>
    </div>

    <pre v-if="address_array_res" class="bg-black p-5 text-white mt-5 w-1/2 overflow-x-auto">
      <code>{{ address_array_res }}</code>
    </pre>

    <!-- 3. Парсинг из JSON-файла -->
    <div class="flex flex-col w-1/2 mt-10">
      <label for="file_upload"><code>Загрузка JSON файла</code></label>
      <div class="flex gap-2 w-full items-center">
        <input 
          type="file" 
          id="file_upload" 
          accept=".json" 
          @change="handleFileUpload" 
          class="border px-3 py-2 w-[70%]"
        />
        <button @click="sendFile" class="px-3 py-2 bg-black text-white cursor-pointer">send file</button>
      </div>
    </div>

    <pre v-if="file_res" class="bg-black p-5 text-white mt-5 w-1/2 overflow-x-auto">
      <code>{{ file_res }}</code>
    </pre>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import api from './axios/axios';

// 1. Одиночный адрес
const address = reactive({
  raw_address: ''
});
const raw_address_res = ref(null);

// 2. Текстовый JSON-массив
const address_array = ref('');
const address_array_res = ref(null);

// 3. Переменные для файла
const selectedFile = ref(null);
const file_res = ref(null);

const parseAddress = async () => {
  try {
    const res = await api.post('/parse', address);
    raw_address_res.value = res.data.result;
  } catch (error) {
    console.error('Ошибка при парсинге адреса:', error);
  }
};

const batchAddress = async () => {
  try {
    if (!address_array.value.trim()) return;

    const parsedJson = JSON.parse(address_array.value);
    const res = await api.post('/parse/batch', parsedJson);

    address_array_res.value = res.data;
  } catch (error) {
    if (error instanceof SyntaxError) {
      alert('Ошибка: Введенный текст не является валидным JSON!');
    } else {
      console.error('Ошибка при массовой обработке:', error);
    }
  }
};

// Перехват выбранного файла из input
const handleFileUpload = (event) => {
  selectedFile.value = event.target.files[0];
};

// Отправка файла на бэкенд
const sendFile = async () => {
  if (!selectedFile.value) {
    alert('Пожалуйста, выберите .json файл!');
    return;
  }

  try {
    // Создаем multipart/form-data объект
    const formData = new FormData();
    formData.append('file', selectedFile.value);

    // Отправка на эндпоинт загрузки файла
    const res = await api.post('/parse/file', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    file_res.value = res.data;
  } catch (error) {
    console.error('Ошибка при отправке файла:', error);
    alert(error.response?.data?.error || 'Ошибка сервера при загрузке файла');
  }
};
</script>