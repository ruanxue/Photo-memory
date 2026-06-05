<template>
  <section class="user-page">
    <div class="section-head">
      <div>
        <h1 class="section-title">修改密码</h1>
        <p class="section-subtitle">修改后建议重新登录。</p>
      </div>
    </div>
    <el-form ref="formRef" class="profile-form surface" :model="form" :rules="rules" label-position="top">
      <el-form-item label="原密码" prop="oldPassword"><el-input v-model="form.oldPassword" type="password" show-password /></el-form-item>
      <el-form-item label="新密码" prop="newPassword"><el-input v-model="form.newPassword" type="password" show-password /></el-form-item>
      <el-form-item label="确认新密码" prop="confirmPassword"><el-input v-model="form.confirmPassword" type="password" show-password /></el-form-item>
      <el-button type="primary" @click="save">修改密码</el-button>
    </el-form>
  </section>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { authApi } from '../../api/auth.api.js';

const formRef = ref(null);
const form = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' });
const rules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [{ required: true, min: 8, message: '新密码至少 8 位', trigger: 'blur' }],
  confirmPassword: [{ required: true, message: '请确认新密码', trigger: 'blur' }]
};

const save = async () => {
  await formRef.value.validate();
  await authApi.changePassword(form);
  ElMessage.success('密码已修改');
  Object.assign(form, { oldPassword: '', newPassword: '', confirmPassword: '' });
};
</script>

<style scoped>
.profile-form {
  max-width: 520px;
  padding: 22px;
}
</style>
