<template>
  <section class="auth-page">
    <div class="auth-card surface">
      <h1>注册</h1>
      <EmptyState v-if="!settings.settings.allowRegister" title="注册已关闭" description="当前站点暂不开放新用户注册。" />
      <el-form v-else ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="用户名" prop="username"><el-input v-model="form.username" /></el-form-item>
        <el-form-item label="邮箱" prop="email"><el-input v-model="form.email" /></el-form-item>
        <el-form-item label="密码" prop="password"><el-input v-model="form.password" type="password" show-password /></el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword"><el-input v-model="form.confirmPassword" type="password" show-password /></el-form-item>
        <el-button type="primary" size="large" :loading="loading" @click="submit">创建账号</el-button>
      </el-form>
      <p>已有账号？<router-link to="/login">登录</router-link></p>
    </div>
  </section>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '../../stores/auth.store.js';
import { useSettingsStore } from '../../stores/settings.store.js';
import EmptyState from '../../components/common/EmptyState.vue';

const router = useRouter();
const auth = useAuthStore();
const settings = useSettingsStore();
const formRef = ref(null);
const loading = ref(false);
const form = reactive({ username: '', email: '', password: '', confirmPassword: '' });
const rules = {
  username: [{ required: true, min: 3, message: '用户名至少 3 位', trigger: 'blur' }],
  email: [{ required: true, type: 'email', message: '请输入有效邮箱', trigger: 'blur' }],
  password: [{ required: true, min: 8, message: '密码至少 8 位', trigger: 'blur' }],
  confirmPassword: [{ required: true, message: '请确认密码', trigger: 'blur' }]
};

const submit = async () => {
  await formRef.value.validate();
  loading.value = true;
  try {
    await auth.register(form);
    ElMessage.success('注册成功');
    router.push('/user');
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
  width: min(440px, 100%);
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
