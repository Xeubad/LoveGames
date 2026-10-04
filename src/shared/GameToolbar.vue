<template>
  <header class="lg-toolbar">
    <button class="lg-btn lg-btn--quiet lg-btn--sm" type="button" @click="goBack">
      ← 游戏列表
    </button>

    <div class="lg-toolbar__title">
      <span v-if="icon" class="lg-toolbar__icon">{{ icon }}</span>
      <span>{{ title }}</span>
    </div>

    <div class="lg-toolbar__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup>
import { useRouter } from 'vue-router'

const props = defineProps({
  title: { type: String, required: true },
  icon: { type: String, default: '' },
  /** 返回目标，默认回游戏选择页 */
  to: { type: String, default: '/' }
})

const router = useRouter()

const goBack = () => {
  router.push(props.to)
}
</script>
