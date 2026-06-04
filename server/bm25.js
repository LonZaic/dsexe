// ═══════════════════════════════════════════
// BM25 — Pure JS implementation
// No dependencies, ~100 lines
// ═══════════════════════════════════════════

class BM25 {
  constructor(documents, { k1 = 1.5, b = 0.75 } = {}) {
    this.k1 = k1
    this.b = b
    this.documents = documents
    this._index()
  }

  _index() {
    // Tokenize all documents
    this.tokenized = this.documents.map(doc => this._tokenize(doc))
    // Document lengths
    this.docLengths = this.tokenized.map(t => t.length)
    this.avgDocLen = this.docLengths.reduce((a, b) => a + b, 0) / this.docLengths.length || 1
    // IDF computation
    this.idf = {}
    const N = this.documents.length
    const dfs = {}
    for (const tokens of this.tokenized) {
      const seen = new Set()
      for (const t of tokens) {
        if (!seen.has(t)) { seen.add(t); dfs[t] = (dfs[t] || 0) + 1 }
      }
    }
    for (const [term, df] of Object.entries(dfs)) {
      this.idf[term] = Math.log(1 + (N - df + 0.5) / (df + 0.5))
    }
  }

  _tokenize(text) {
    if (!text) return []
    return text.toLowerCase()
      .replace(/[^\w一-鿿]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 0)
  }

  search(query, topK = 10) {
    const queryTokens = this._tokenize(query)
    if (!queryTokens.length) return []
    const scores = this.documents.map((_, idx) => {
      let score = 0
      const docTokens = this.tokenized[idx]
      const docLen = this.docLengths[idx]
      const tf = {}
      for (const t of docTokens) { tf[t] = (tf[t] || 0) + 1 }
      for (const qt of queryTokens) {
        const idf = this.idf[qt] || 0
        const f = tf[qt] || 0
        const numerator = f * (this.k1 + 1)
        const denominator = f + this.k1 * (1 - this.b + this.b * docLen / this.avgDocLen)
        score += idf * numerator / denominator
      }
      return { index: idx, score }
    })
    return scores
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(s => ({ ...s, text: this.documents[s.index] }))
  }

  // Add documents without full re-index (for incremental updates)
  addDocument(text) {
    this.documents.push(text)
    // Fast re-index: just add the new doc
    const tokens = this._tokenize(text)
    this.tokenized.push(tokens)
    this.docLengths.push(tokens.length)
    this.avgDocLen = this.docLengths.reduce((a, b) => a + b, 0) / this.docLengths.length
    // Update IDF for new terms
    const seen = new Set(tokens)
    const N = this.documents.length
    for (const t of seen) {
      let df = 0
      for (const tok of this.tokenized) { if (tok.includes(t)) df++ }
      this.idf[t] = Math.log(1 + (N - df + 0.5) / (df + 0.5))
    }
  }
}

module.exports = { BM25 }
