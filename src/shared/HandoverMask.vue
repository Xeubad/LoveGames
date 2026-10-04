<template>
  <div class="lg-modal">
    <div class="lg-modal__panel">
      <p class="hm-emoji">🙈</p>
      <h2 class="lg-modal__title">{{ title }}</h2>
      <p class="lg-modal__text">{{ description }}</p>
      <button class="lg-btn lg-btn--primary lg-btn--block" type="button" @click="emit('ready')">
        {{ confirmText }}
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  confirmText: { type: String, default: '我准备好了' }
})

const emit = defineEmits(['ready'])
</script>

<style scoped>
.hm-emoji {
  margin-bottom: var(--lg-sp-3);
  font-size: 52px;
  line-height: 1;
}
</style>
