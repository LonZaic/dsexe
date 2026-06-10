<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-logo">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="13" stroke="var(--accent)" stroke-width="1.5"/>
          <path d="M10 16h12M16 10v12M10 10l12 12M10 22l12-12" stroke="var(--accent)" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
      </div>
      <h1>SuperDS</h1>
      <p class="subtitle">{{ isRegister ? t('registerSub') : t('loginSub') }}</p>
      <div class="form">
        <input
          v-model="name"
          :placeholder="t('username')"
          maxlength="20"
          @keydown.enter="submit"
          autofocus
        />
        <input
          v-model="password"
          type="password"
          :placeholder="t('password')"
          @keydown.enter="submit"
        />
        <button class="form-btn" @click="submit" :disabled="loading">
          {{ loading ? t('pleaseWait') : (isRegister ? t('createAccount') : t('loginBtn')) }}
        </button>
        <button class="form-btn-outline" @click="isRegister = !isRegister">
          {{ isRegister ? t('toLogin') : t('toRegister') }}
        </button>
        <p v-if="error" class="error">{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { auth, saveAuth } from '../api/index.js'
import { connect } from '../api/ws.js'
import { useI18n } from '../composables/useI18n.js'

const { t } = useI18n()

const router = useRouter()
const name = ref('')
const password = ref('')
const isRegister = ref(false)
const loading = ref(false)
const error = ref('')

async function submit() {
  error.value = ''
  if (!name.value.trim() || !password.value) {
    error.value = t('loginError')
    return
  }
  loading.value = true
  try {
    let result
    if (isRegister.value) {
      result = await auth.register(name.value.trim(), password.value)
    } else {
      result = await auth.login(name.value.trim(), password.value)
    }
    saveAuth(result.token, { id: result.id, name: result.name })
    connect(result.token)
    router.push('/')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
}

.login-card {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 40px;
  width: 380px;
  max-width: 92vw;
}

.login-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.login-card h1 {
  font-size: 22px;
  font-weight: 500;
  color: var(--text);
  text-align: center;
  margin-bottom: 4px;
  letter-spacing: -0.3px;
}

.subtitle {
  font-size: 14px;
  color: var(--text2);
  text-align: center;
  margin-bottom: 4px;
  font-weight: 300;
}

.sub-hint {
  font-size: 12px;
  color: var(--text3);
  text-align: center;
  margin-bottom: 24px;
  font-weight: 300;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.form input {
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 14px;
  font-family: inherit;
  font-weight: 300;
  color: var(--text);
  outline: none;
  transition: border-color .15s;
}
.form input:focus { border-color: var(--border2); }
.form input::placeholder { color: var(--text3); }

.form-btn {
  padding: 10px;
  border-radius: 8px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 14px;
  font-family: inherit;
  font-weight: 400;
  cursor: pointer;
  transition: background .15s;
  margin-top: 4px;
}
.form-btn:hover:not(:disabled) { background: var(--accent-hover); }
.form-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.form-btn-outline {
  background: transparent;
  border: 1px solid var(--border2);
  color: var(--text2);
  padding: 10px;
  border-radius: 8px;
  font-size: 13px;
  font-family: inherit;
  font-weight: 300;
  cursor: pointer;
  transition: background .15s, color .15s;
}
.form-btn-outline:hover { background: var(--bg3); color: var(--text); }

.error {
  font-size: 12px;
  color: var(--red);
  text-align: center;
  margin-top: 4px;
  font-weight: 300;
}
</style>
