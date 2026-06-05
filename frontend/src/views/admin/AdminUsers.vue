<template>
  <section class="admin-page">
    <div class="section-head">
      <div>
        <h1 class="section-title">用户管理</h1>
        <p class="section-subtitle">搜索、新增、禁用、设置管理员和重置密码。</p>
      </div>
      <el-button type="primary" @click="openCreate">新增用户</el-button>
    </div>
    <div class="toolbar surface">
      <el-input v-model="q" clearable placeholder="搜索用户" @keyup.enter="load" />
      <el-button type="primary" @click="load">搜索</el-button>
    </div>
    <el-table :data="users" class="surface">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="username" label="用户名" />
      <el-table-column prop="email" label="邮箱" />
      <el-table-column label="角色" width="90">
        <template #default="{ row }">{{ formatUserRole(row.role) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">{{ formatUserStatus(row.status) }}</template>
      </el-table-column>
      <el-table-column label="照片" width="90"><template #default="{ row }">{{ row._count?.photos || 0 }}</template></el-table-column>
      <el-table-column label="操作" width="360" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="openEdit(row)">编辑</el-button>
          <el-button size="small" @click="toggleStatus(row)">{{ row.status === 'active' ? '禁用' : '启用' }}</el-button>
          <el-button size="small" @click="toggleRole(row)">{{ row.role === 'admin' ? '设为用户' : '设为管理员' }}</el-button>
          <el-button size="small" @click="resetPassword(row)">重置密码</el-button>
          <el-button size="small" type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <Pagination v-model:page="page" v-model:page-size="pageSize" :total="total" @update:page="load" @update:page-size="reload" />

    <el-dialog v-model="dialogVisible" :title="currentId ? '编辑用户' : '新增用户'" width="520px">
      <el-form :model="form" label-position="top">
        <el-form-item label="用户名"><el-input v-model="form.username" /></el-form-item>
        <el-form-item label="邮箱"><el-input v-model="form.email" /></el-form-item>
        <el-form-item v-if="!currentId" label="密码"><el-input v-model="form.password" type="password" show-password /></el-form-item>
        <el-form-item label="昵称"><el-input v-model="form.nickname" /></el-form-item>
        <el-form-item label="角色"><el-select v-model="form.role"><el-option label="普通用户" value="user" /><el-option label="管理员" value="admin" /></el-select></el-form-item>
        <el-form-item label="状态"><el-select v-model="form.status"><el-option label="启用" value="active" /><el-option label="禁用" value="disabled" /></el-select></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { adminApi } from '../../api/admin.api.js';
import Pagination from '../../components/common/Pagination.vue';
import { formatUserRole, formatUserStatus } from '../../utils/format.js';

const users = ref([]);
const q = ref('');
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const dialogVisible = ref(false);
const currentId = ref(null);
const form = reactive({ username: '', email: '', password: '', nickname: '', role: 'user', status: 'active' });

const load = async () => {
  const res = await adminApi.users({ q: q.value, page: page.value, pageSize: pageSize.value });
  users.value = res.data;
  total.value = res.meta?.total || 0;
};
const reload = () => { page.value = 1; load(); };
const openCreate = () => { currentId.value = null; Object.assign(form, { username: '', email: '', password: '', nickname: '', role: 'user', status: 'active' }); dialogVisible.value = true; };
const openEdit = (row) => { currentId.value = row.id; Object.assign(form, row, { password: '' }); dialogVisible.value = true; };
const save = async () => {
  if (currentId.value) await adminApi.updateUser(currentId.value, form);
  else await adminApi.createUser(form);
  ElMessage.success('已保存');
  dialogVisible.value = false;
  load();
};
const toggleStatus = async (row) => { await adminApi.userStatus(row.id, { status: row.status === 'active' ? 'disabled' : 'active' }); load(); };
const toggleRole = async (row) => { await adminApi.userRole(row.id, { role: row.role === 'admin' ? 'user' : 'admin' }); load(); };
const resetPassword = async (row) => {
  const { value } = await ElMessageBox.prompt('请输入新密码', `重置 ${row.username} 的密码`, { inputValue: '12345678' });
  await adminApi.resetPassword(row.id, { password: value || '12345678' });
  ElMessage.success('密码已重置');
};
const remove = async (row) => { await ElMessageBox.confirm(`确定删除用户 ${row.username} 吗？`, '删除用户', { type: 'warning' }); await adminApi.deleteUser(row.id); load(); };
onMounted(load);
</script>

<style scoped>
.toolbar { padding: 14px; }
.toolbar .el-input { width: 240px; }
</style>
