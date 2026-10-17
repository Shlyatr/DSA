<template>
  <Navbar/>
  <RouterView/>
</template>

<script setup>
import Navbar from './components/Navbar.vue';

// import { reactive, ref } from 'vue';
// import api from './axios/axios';

// // 1. Одиночный адрес
// const address = reactive({
//   raw_address: ''
// });
// const raw_address_res = ref(null);

// // 2. Текстовый JSON-массив
// const address_array = ref('');
// const address_array_res = ref(null);

// // 3. Переменные для файла
// const selectedFile = ref(null);
// const file_res = ref(null);

// const parseAddress = async () => {
//   try {
//     const res = await api.post('/parse', address);
//     raw_address_res.value = res.data.result;
//   } catch (error) {
//     console.error('Ошибка при парсинге адреса:', error);
//   }
// };

// const batchAddress = async () => {
//   try {
//     if (!address_array.value.trim()) return;

//     const parsedJson = JSON.parse(address_array.value);
//     const res = await api.post('/parse/batch', parsedJson);

//     address_array_res.value = res.data;
//   } catch (error) {
//     if (error instanceof SyntaxError) {
//       alert('Ошибка: Введенный текст не является валидным JSON!');
//     } else {
//       console.error('Ошибка при массовой обработке:', error);
//     }
//   }
// };

// // Перехват выбранного файла из input
// const handleFileUpload = (event) => {
//   selectedFile.value = event.target.files[0];
// };

// // Отправка файла на бэкенд
// const sendFile = async () => {
//   if (!selectedFile.value) {
//     alert('Пожалуйста, выберите .json файл!');
//     return;
//   }

//   try {
//     // Создаем multipart/form-data объект
//     const formData = new FormData();
//     formData.append('file', selectedFile.value);

//     // Отправка на эндпоинт загрузки файла
//     const res = await api.post('/parse/file', formData, {
//       headers: {
//         'Content-Type': 'multipart/form-data'
//       }
//     });

//     file_res.value = res.data;
//   } catch (error) {
//     console.error('Ошибка при отправке файла:', error);
//     alert(error.response?.data?.error || 'Ошибка сервера при загрузке файла');
//   }
// };
</script>