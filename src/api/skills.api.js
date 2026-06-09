// ═══════════════════════════════════════════
// Skills API Client
// ═══════════════════════════════════════════

import client from './client.js'

const BASE = '/api/skills'

export const skillsApi = {
  listSkills(projectPath) {
    const params = projectPath ? `?project=${encodeURIComponent(projectPath)}` : ''
    return client.get(`${BASE}${params}`)
  },

  getSkill(slug, projectPath) {
    const params = projectPath ? `?project=${encodeURIComponent(projectPath)}` : ''
    return client.get(`${BASE}/${encodeURIComponent(slug)}${params}`)
  },

  installSkill(slug, skill, projectPath) {
    return client.post(BASE, { slug, skill, projectPath })
  },

  updateSkill(slug, skill, projectPath) {
    return client.put(`${BASE}/${encodeURIComponent(slug)}`, { skill, projectPath })
  },

  deleteSkill(slug, projectPath) {
    return client.delete(`${BASE}/${encodeURIComponent(slug)}`, { data: { projectPath } })
  },

  getMarketplace() {
    return client.get(`${BASE}/marketplace/all`)
  },

  installFromMarketplace(skillId, projectPath) {
    return client.post(`${BASE}/marketplace/install`, { skillId, projectPath })
  },

  uploadSkillFile(filename, content, projectPath) {
    return client.post(`${BASE}/upload`, { filename, content, projectPath })
  },
}
