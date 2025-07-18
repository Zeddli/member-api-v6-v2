/**
 * Script to validate that seeded data in the local API matches test_data_api.json.
 * For each member, fetches data from the API and compares it to the expected data.
 */
const fs = require('fs')
const path = require('path')
const axios = require('axios')
const _ = require('lodash')

const API_BASE = 'http://localhost:3000/v5'

function normalize(val) {
  if (Array.isArray(val)) return val.map(normalize)
  if (val && typeof val === 'object') {
    const out = {}
    for (const k of Object.keys(val)) {
      if (val[k] !== undefined && val[k] !== null) out[k] = normalize(val[k])
    }
    return out
  }
  return val
}

async function validateMember(member) {
  let passed = true
  // Validate /members/:handle
  try {
    const res = await axios.get(`${API_BASE}/members/${encodeURIComponent(member.handle)}`)
    const apiData = normalize(res.data)
    const expected = normalize(_.pick(member, ['handle', 'handleLower', 'userId', 'firstName', 'lastName', 'status']))
    for (const k of Object.keys(expected)) {
      if (!_.isEqual(apiData[k], expected[k])) {
        console.log(`[FAIL] /members/${member.handle} field '${k}' mismatch: expected`, expected[k], 'got', apiData[k])
        passed = false
      }
    }
  } catch (err) {
    console.log(`[FAIL] /members/${member.handle} error:`, err.response ? err.response.status : err.message)
    passed = false
  }
  // Validate /members/:handle/stats
  try {
    const res = await axios.get(`${API_BASE}/members/${encodeURIComponent(member.handle)}/stats`)
    const apiStats = normalize(res.data)
    const expectedStats = normalize(member.stats)
    if (!_.isEqual(apiStats, expectedStats)) {
      console.log(`[FAIL] /members/${member.handle}/stats mismatch`)
      passed = false
    }
  } catch (err) {
    console.log(`[FAIL] /members/${member.handle}/stats error:`, err.response ? err.response.status : err.message)
    passed = false
  }
  // Validate /members/:handle/stats/history if present
  if (member.statsHistory) {
    try {
      const res = await axios.get(`${API_BASE}/members/${encodeURIComponent(member.handle)}/stats/history`)
      const apiHistory = normalize(res.data)
      const expectedHistory = normalize(member.statsHistory)
      if (!_.isEqual(apiHistory, expectedHistory)) {
        console.log(`[FAIL] /members/${member.handle}/stats/history mismatch`)
        passed = false
      }
    } catch (err) {
      console.log(`[FAIL] /members/${member.handle}/stats/history error:`, err.response ? err.response.status : err.message)
      passed = false
    }
  }
  if (passed) {
    console.log(`[PASS] ${member.handle}`)
  }
  return passed
}

async function main() {
  const filePath = path.join(__dirname, '../../test_data_api.json')
  const raw = fs.readFileSync(filePath, 'utf8')
  const members = JSON.parse(raw)
  let passCount = 0, failCount = 0
  for (const member of members) {
    const passed = await validateMember(member)
    if (passed) passCount++
    else failCount++
  }
  console.log(`Validation complete. Passed: ${passCount}, Failed: ${failCount}`)
}

main().catch(e => { console.error(e); process.exit(1) }) 