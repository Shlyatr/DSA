<template>
  <div class="flex flex-col items-center p-10">
    <div class="flex flex-col w-1/2">
      <label for="address"><code>raw_address</code></label>
      <div class="flex gap-2 w-full">
        <input type="text" name="address" id="address" class="px-3 py-2 border w-[70%] outline-0">
        <button class="px-3 py-2 bg-black text-white cursor-pointer">send</button>
      </div>
    </div>

    <div class="flex flex-col w-1/2 mt-10">
      <label for="address"><code>[raw_address]</code></label>
      <div class="flex gap-2 w-full">
        <textarea name="address" id="address" class="px-3 py-2 border w-[70%] outline-0"></textarea>
        <button class="px-3 py-2 bg-black text-white cursor-pointer">send</button>
      </div>
    </div>
  </div>
</template>

<script setup></script>