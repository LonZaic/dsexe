// ═══════════════════════════════════════════
// Skill Store — Skill state management
// ═══════════════════════════════════════════

import { ref, computed } from 'vue'
import { skillsApi } from '../api/skills.api.js'

const skills = ref([])
const loading = ref(false)
const error = ref(null)
const marketplaceSkills = ref([])
const marketplaceLoading = ref(false)

export function useSkillStore() {
  const userSkills = computed(() =>
    skills.value.filter(s => s.userInvocable !== false)
  )
  const autoSkills = computed(() =>
    skills.value.filter(s => s.userInvocable === false)
  )

  async function loadSkills(projectPath) {
    loading.value = true
    error.value = null
    try {
      const data = await skillsApi.listSkills(projectPath)
      skills.value = data.skills || []
    } catch (e) {
      error.value = e.message
      skills.value = []
    } finally {
      loading.value = false
    }
  }

  async function installSkill(slug, skill, projectPath) {
    await skillsApi.installSkill(slug, skill, projectPath)
    await loadSkills(projectPath)
  }

  async function updateSkill(slug, skill, projectPath) {
    await skillsApi.updateSkill(slug, skill, projectPath)
    await loadSkills(projectPath)
  }

  async function deleteSkill(slug, projectPath) {
    await skillsApi.deleteSkill(slug, projectPath)
    await loadSkills(projectPath)
  }

  async function loadMarketplace() {
    marketplaceLoading.value = true
    try {
      const data = await skillsApi.getMarketplace()
      marketplaceSkills.value = data.skills || []
    } catch (e) {
      marketplaceSkills.value = []
    } finally {
      marketplaceLoading.value = false
    }
  }

  async function installFromMarketplace(skillId, projectPath) {
    const result = await skillsApi.installFromMarketplace(skillId, projectPath)
    await loadSkills(projectPath)
    return result
  }

  return {
    skills, loading, error,
    marketplaceSkills, marketplaceLoading,
    userSkills, autoSkills,
    loadSkills, installSkill, updateSkill, deleteSkill,
    loadMarketplace, installFromMarketplace,
  }
}
