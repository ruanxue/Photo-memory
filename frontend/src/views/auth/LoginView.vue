<template>
  <section class="auth-page">
    <div class="auth-card surface">
      <h1>登录</h1>
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="用户名或邮箱" prop="account"><el-input v-model="form.account" /></el-form-item>
        <el-form-item label="密码" prop="password"><el-input v-model="form.password" type="password" show-password /></el-form-item>
        <el-button type="primary" size="large" :loading="loading" @click="submit">登录</el-button>
      </el-form>
      <p>还没有账号？<router-link to="/register">注册</router-link></p>
    </div>
  </section>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '../../stores/auth.store.js';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const formRef = ref(null);
const loading = ref(false);
const form = reactive({ account: '', password: '' });
const rules = {
  account: [{ required: true, message: '请输入用户名或邮箱', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
};

const submit = async () => {
  await formRef.value.validate();
  loading.value = true;
  try {
    await auth.login(form);
    ElMessage.success('登录成功');
    router.push(route.query.redirect || '/');
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.auth-page {
  min-height: calc(100vh - 72px);
  display: grid;
  place-items: center;
  padding: 36px 16px;
}

.auth-card {
  width: min(420px, 100%);
  padding: 28px;
}

h1 {
  margin-top: 0;
}

.el-button {
  width: 100%;
}

p {
  color: var(--theme-muted-strong);
}
</style>
