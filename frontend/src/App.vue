<template>
  <div class="flex flex-col items-center p-10">
    <div class="flex flex-col w-1/2">
      <label for="address"><code>raw_address</code></label>
      <div class="flex gap-2 w-full">
        <input type="text" v-model="address.raw_address" name="address" id="address" class="px-3 py-2 border w-[70%] outline-0">
        <button @click="parseAddress" class="px-3 py-2 bg-black text-white cursor-pointer">send</button>
      </div>
    </div>

<pre v-if="raw_address_res" class="bg-black p-5 text-white mt-5">
  <code>
    {{ raw_address_res }}
  </code>
</pre>

    <div class="flex flex-col w-1/2 mt-10">
      <label for="address"><code>[raw_address]</code></label>
      <div class="flex gap-2 w-full">
        <textarea name="address" v-model="address_array" id="address" class="px-3 py-2 border w-[70%] outline-0"></textarea>
        <button @click="batchAddress" class="px-3 py-2 bg-black text-white cursor-pointer">send</button>
      </div>
    </div>

<pre v-if="address_array_res" class="bg-black p-5 text-white mt-5">
  <code>
    {{ address_array_res }}
  </code>
</pre>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import api from './axios/axios';

const address = reactive({
  raw_address: ''
});
const raw_address_res = ref(null);

const address_array = ref(null);
const address_array_res = ref(null);


const parseAddress = async() => {
  try {
    const res = await api.post('/parse', address);

    raw_address_res.value = res.data.result
  } catch (error) {
    console.log(error)
  }
}

const batchAddress = async() => {
  try {
    const res = await api.post('/parse/batch', JSON.parse(address_array.value));

    address_array_res.value = res.data
  } catch (error) {
    console.log(error)
  }
}
</script>