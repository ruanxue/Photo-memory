<template>
  <section class="user-page">
    <div class="section-head">
      <div>
        <h1 class="section-title">个人资料</h1>
        <p class="section-subtitle">更新头像、昵称、邮箱和个人介绍。</p>
      </div>
    </div>
    <el-form class="profile-form surface" :model="form" label-position="top">
      <el-form-item label="头像 URL"><el-input v-model="form.avatar" /></el-form-item>
      <el-form-item label="昵称"><el-input v-model="form.nickname" /></el-form-item>
      <el-form-item label="邮箱"><el-input v-model="form.email" /></el-form-item>
      <el-form-item label="简介"><el-input v-model="form.bio" type="textarea" :rows="4" /></el-form-item>
      <el-button type="primary" @click="save">保存资料</el-button>
    </el-form>
  </section>
</template>

<script setup>
import { reactive } from 'vue';
import { ElMessage } from 'element-plus/es/components/message/index';
import { useAuthStore } from '../../stores/auth.store.js';

const auth = useAuthStore();
const form = reactive({
  avatar: auth.user?.avatar || '',
  nickname: auth.user?.nickname || '',
  email: auth.user?.email || '',
  bio: auth.user?.bio || ''
});

const save = async () => {
  await auth.updateProfile(form);
  ElMessage.success('资料已更新');
};
</script>

<style scoped>
.profile-form {
  max-width: 680px;
  padding: 22px;
}
</style>
