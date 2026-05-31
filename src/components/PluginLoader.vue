<template>
  <div class="plugin-loader-wrapper">
    <!-- Gear icon button -->
    <button class="gear-button" @click="isOpen = true" title="プラグイン設定">⚙</button>

    <!-- Modal -->
    <div v-if="isOpen" class="plugin-modal" @click.self="isOpen = false">
      <div class="modal-content">
        <div class="modal-header">
          <h2>プラグイン管理</h2>
          <button class="close-btn" @click="isOpen = false">✕</button>
        </div>

        <!-- Installed plugins list -->
        <div class="section">
          <h3>インストール済み</h3>
          <div v-if="installed.length === 0" class="empty-state">
            プラグインはまだインストールされていません
          </div>
          <div v-else class="plugin-list">
            <div v-for="plugin in installed" :key="plugin.id" class="plugin-item">
              <div class="plugin-info">
                <div class="plugin-name">{{ plugin.id }}</div>
                <div class="plugin-type">{{ plugin.type === 'genre' ? 'ジャンル' : 'デッキ拡張' }}</div>
              </div>
              <button class="delete-btn" @click="uninstallPlugin(plugin.id)">削除</button>
            </div>
          </div>
        </div>

        <!-- Install area -->
        <div class="section">
          <h3>新しいプラグインをインストール</h3>

          <!-- Error message -->
          <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>

          <!-- Textarea -->
          <textarea
            v-model="jsonInput"
            class="json-input"
            placeholder="JSONをここに貼り付けてください..."
            @drop="handleDrop"
            @dragover.prevent
            @dragenter.prevent
          ></textarea>

          <!-- Install button -->
          <button
            class="install-btn"
            @click="installPlugin"
            :disabled="!jsonInput.trim()"
          >
            インストール
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { pluginManager } from '../plugins/PluginManager'

const isOpen = ref(false)
const jsonInput = ref('')
const errorMessage = ref('')
const installed = reactive(pluginManager.listInstalled())

function installPlugin() {
  errorMessage.value = ''

  try {
    const json = JSON.parse(jsonInput.value)
    const result = pluginManager.install(json)

    if (result.success) {
      // Update installed list
      installed.splice(0)
      installed.push(...pluginManager.listInstalled())

      jsonInput.value = ''

      // Reload page
      setTimeout(() => {
        window.location.reload()
      }, 500)
    } else {
      errorMessage.value = result.error || 'Unknown error'
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    errorMessage.value = `JSON parse error: ${msg}`
  }
}

function uninstallPlugin(id: string) {
  if (!confirm(`「${id}」を削除しますか？`)) return

  pluginManager.uninstall(id)
  installed.splice(0)
  installed.push(...pluginManager.listInstalled())

  setTimeout(() => {
    window.location.reload()
  }, 500)
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  const files = e.dataTransfer?.files
  if (!files) return

  const file = files[0]
  if (!file.name.endsWith('.json')) {
    errorMessage.value = 'JSONファイルのみ対応しています'
    return
  }

  const reader = new FileReader()
  reader.onload = (ev) => {
    jsonInput.value = ev.target?.result as string
  }
  reader.readAsText(file)
}
</script>

<style scoped>
.plugin-loader-wrapper {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 999;
}

.gear-button {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #333;
  color: #fff;
  border: none;
  cursor: pointer;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.gear-button:hover {
  background: #555;
}

.plugin-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #eee;
  position: sticky;
  top: 0;
  background: white;
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
}

.section {
  padding: 16px;
  border-bottom: 1px solid #eee;
}

.section:last-child {
  border-bottom: none;
}

.section h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #333;
}

.empty-state {
  color: #999;
  font-size: 13px;
  padding: 8px;
}

.plugin-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.plugin-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 4px;
}

.plugin-info {
  flex: 1;
}

.plugin-name {
  font-weight: 600;
  font-size: 13px;
}

.plugin-type {
  font-size: 11px;
  color: #999;
  margin-top: 2px;
}

.delete-btn {
  background: #ff6b6b;
  color: white;
  border: none;
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.delete-btn:hover {
  background: #ff5252;
}

.error-message {
  background: #ffe0e0;
  color: #d32f2f;
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  margin-bottom: 12px;
}

.json-input {
  width: 100%;
  height: 200px;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  resize: vertical;
  box-sizing: border-box;
}

.install-btn {
  width: 100%;
  padding: 10px;
  margin-top: 12px;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: background 0.2s;
}

.install-btn:hover:not(:disabled) {
  background: #45a049;
}

.install-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>
