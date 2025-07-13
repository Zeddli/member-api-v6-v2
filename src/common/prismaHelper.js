const _ = require('lodash')
const helper = require('./helper')

const designBasicFields = [
  'name', 'numInquiries', 'submissions', 'passedScreening', 'avgPlacement',
  'screeningSuccessRate', 'submissionRate', 'winPercent'
]

const developSubmissionFields = [
  'appealSuccessRate', 'minScore', 'avgPlacement', 'reviewSuccessRate',
  'maxScore', 'avgScore', 'screeningSuccessRate', 'submissionRate', 'winPercent'
]

const developSubmissionBigIntFields = [
  'numInquiries', 'submissions', 'passedScreening', 'passedReview', 'appeals'
]

const developRankFields = [
  'overallPercentile', 'activeRank', 'overallCountryRank', 'reliability', 'rating',
  'minRating', 'volatility', 'overallSchoolRank', 'overallRank', 'activeSchoolRank',
  'activeCountryRank', 'maxRating', 'activePercentile'
]

const copilotFields = [
  'contests', 'projects', 'failures', 'reposts', 'activeContests', 'activeProjects', 'fulfillment'
]

const srmRankFields = [
  'rating', 'percentile', 'rank', 'countryRank', 'schoolRank',
  'volatility', 'maximumRating', 'minimumRating', 'defaultLanguage', 'competitions'
]

const srmDivisionFields = [
  'problemsSubmitted', 'problemsSysByTest', 'problemsFailed', 'levelName'
]

const marathonRankFields = [
  'rating', 'competitions', 'avgRank', 'avgNumSubmissions', 'bestRank',
  'topFiveFinishes', 'topTenFinishes', 'rank', 'percentile', 'volatility',
  'minimumRating', 'maximumRating', 'countryRank', 'schoolRank', 'defaultLanguage'
]

const auditFields = [
  'createdAt', 'createdBy', 'updatedAt', 'updatedBy'
]

/**
 * Convert member db data to response data
 * @param {Object} member member data from db
 */
function convertMember (member) {
  member.userId = helper.bigIntToNumber(member.userId)
  member.createdAt = member.createdAt.getTime()
  member.updatedAt = member.updatedAt.getTime()
  if (member.maxRating) {
    member.maxRating = _.omit(member.maxRating,
      ['id', 'userId', ...auditFields])
  }
  if (member.addresses) {
    member.addresses = _.map(member.addresses, d => _.omit(d,
      ['id', 'userId', ...auditFields]))
  }
  member.verified = member.verified || false
}

/**
 * Build skill list data with data from db
 * @param {Array} skillList skill list from db
 * @returns skill list in response
 */
function buildMemberSkills (skillList) {
  if (!skillList || skillList.length === 0) {
    return []
  }
  return _.map(skillList, item => {
    const ret = _.pick(item.skill, ['id', 'name'])
    ret.category = _.pick(item.skill.category, ['id', 'name'])
    if (item.displayMode) {
      ret.displayMode = _.pick(item.displayMode, ['id', 'name'])
    }
    // set levels
    if (item.levels && item.levels.length > 0) {
      ret.levels = _.map(item.levels,
        lvl => _.pick(lvl.skillLevel, ['id', 'name', 'description']))
    }
    return ret
  })
}

/**
 * Build prisma filter with member search query
 * @param {Object} query request query parameters
 * @returns member filter used in prisma
 */
function buildSearchMemberFilter (query) {
  const handles = _.isArray(query.handles) ? query.handles : []
  const handlesLower = _.isArray(query.handlesLower) ? query.handlesLower : []
  const userIds = _.isArray(query.userIds) ? query.userIds : []

  const filterList = []
  filterList.push({ status: 'ACTIVE' })
  if (query.userId) {
    filterList.push({ userId: query.userId })
  }
  if (query.handleLower) {
    filterList.push({ handleLower: query.handleLower })
  }
  if (query.handle) {
    filterList.push({ handle: query.handle })
  }
  if (query.email) {
    filterList.push({ email: query.email })
  }
  if (userIds.length > 0) {
    filterList.push({ userId: { in: userIds } })
  }
  if (handlesLower.length > 0) {
    filterList.push({ handleLower: { in: handlesLower } })
  }
  if (handles.length > 0) {
    filterList.push({ handle: { in: handles } })
  }

  const prismaFilter = {
    where: { AND: filterList }
  }
  return prismaFilter
}

/**
 * Convert db data to response structure for member stats
 * @param {Object} member member data
 * @param {Object} statsData stats data from db
 * @param {Array} fields fields return in response
 * @returns Member stats response
 */
function buildStatsResponse (member, statsData, fields) {
  const item = {
    userId: helper.bigIntToNumber(member.userId),
    groupId: helper.bigIntToNumber(statsData.groupId),
    handle: member.handle,
    handleLower: member.handleLower,
    challenges: statsData.challenges,
    wins: statsData.wins
  }
  if (member.maxRating) {
    item.maxRating = _.pick(member.maxRating, ['rating', 'track', 'subTrack', 'ratingColor'])
  }
  if (statsData.design) {
    item.DESIGN = {
      challenges: helper.bigIntToNumber(statsData.design.challenges),
      wins: helper.bigIntToNumber(statsData.design.wins),
      mostRecentSubmission: statsData.design.mostRecentSubmission
        ? statsData.design.mostRecentSubmission.getTime() : null,
      mostRecentEventDate: statsData.design.mostRecentEventDate
        ? statsData.design.mostRecentEventDate.getTime() : null,
      subTracks: []
    }
    const items = _.get(statsData, 'design.items', [])
    if (items.length > 0) {
      item.DESIGN.subTracks = _.map(items, t => ({
        ..._.pick(t, designBasicFields),
        challenges: helper.bigIntToNumber(t.challenges),
        wins: helper.bigIntToNumber(t.wins),
        id: t.subTrackId,
        mostRecentSubmission: t.mostRecentSubmission
          ? t.mostRecentSubmission.getTime() : null,
        mostRecentEventDate: t.mostRecentEventDate
          ? t.mostRecentEventDate.getTime() : null
      }))
    }
  }
  if (statsData.develop) {
    item.DEVELOP = {
      challenges: helper.bigIntToNumber(statsData.develop.challenges),
      wins: helper.bigIntToNumber(statsData.develop.wins),
      mostRecentSubmission: statsData.develop.mostRecentSubmission
        ? statsData.develop.mostRecentSubmission.getTime() : null,
      mostRecentEventDate: statsData.develop.mostRecentEventDate
        ? statsData.develop.mostRecentEventDate.getTime() : null,
      subTracks: []
    }
    const items = _.get(statsData, 'develop.items', [])
    if (items.length > 0) {
      item.DEVELOP.subTracks = _.map(items, t => ({
        challenges: helper.bigIntToNumber(t.challenges),
        wins: helper.bigIntToNumber(t.wins),
        id: t.subTrackId,
        name: t.name,
        mostRecentSubmission: t.mostRecentSubmission ? t.mostRecentSubmission.getTime() : null,
        mostRecentEventDate: t.mostRecentEventDate ? t.mostRecentEventDate.getTime() : null,
        submissions: {
          ..._.pick(t, developSubmissionFields),
          ..._.mapValues(_.pick(t, developSubmissionBigIntFields), v => helper.bigIntToNumber(v))
        },
        rank: _.pick(t, developRankFields)
      }))
    }
  }
  if (statsData.copilot) {
    item.COPILOT = _.pick(statsData.copilot, copilotFields)
  }
  if (statsData.dataScience) {
    item.DATA_SCIENCE = {
      challenges: helper.bigIntToNumber(statsData.dataScience.challenges),
      wins: helper.bigIntToNumber(statsData.dataScience.wins),
      mostRecentSubmission: statsData.dataScience.mostRecentSubmission
        ? statsData.dataScience.mostRecentSubmission.getTime() : null,
      mostRecentEventDate: statsData.dataScience.mostRecentEventDate
        ? statsData.dataScience.mostRecentEventDate.getTime() : null,
      mostRecentEventName: statsData.dataScience.mostRecentEventName
    }
    if (statsData.dataScience.srm) {
      const srmData = statsData.dataScience.srm
      item.DATA_SCIENCE.SRM = {
        challenges: helper.bigIntToNumber(srmData.challenges),
        wins: helper.bigIntToNumber(srmData.wins),
        mostRecentSubmission: srmData.mostRecentSubmission
          ? srmData.mostRecentSubmission.getTime() : null,
        mostRecentEventDate: srmData.mostRecentEventDate
          ? srmData.mostRecentEventDate.getTime() : null,
        mostRecentEventName: srmData.mostRecentEventName,
        rank: _.pick(srmData, srmRankFields)
      }
      if (srmData.challengeDetails && srmData.challengeDetails.length > 0) {
        item.DATA_SCIENCE.SRM.challengeDetails = _.map(srmData.challengeDetails,
          t => _.pick(t, ['challenges', 'levelName', 'failedChallenges']))
      }
      if (srmData.divisions && srmData.divisions.length > 0) {
        const div1Data = _.filter(srmData.divisions, t => t.divisionName === 'division1')
        const div2Data = _.filter(srmData.divisions, t => t.divisionName === 'division2')
        if (div1Data.length > 0) {
          item.DATA_SCIENCE.SRM.division1 = _.map(div1Data, t => _.pick(t, srmDivisionFields))
        }
        if (div2Data.length > 0) {
          item.DATA_SCIENCE.SRM.division2 = _.map(div2Data, t => _.pick(t, srmDivisionFields))
        }
      }
    }
    if (statsData.dataScience.marathon) {
      const marathonData = statsData.dataScience.marathon
      item.DATA_SCIENCE.MARATHON_MATCH = {
        challenges: helper.bigIntToNumber(marathonData.challenges),
        wins: helper.bigIntToNumber(marathonData.wins),
        mostRecentSubmission: marathonData.mostRecentSubmission
          ? marathonData.mostRecentSubmission.getTime() : null,
        mostRecentEventDate: marathonData.mostRecentEventDate
          ? marathonData.mostRecentEventDate.getTime() : null,
        mostRecentEventName: marathonData.mostRecentEventName,
        rank: _.pick(marathonData, marathonRankFields)
      }
    }
  }

  return fields ? _.pick(item, fields) : item
}

/**
 * Convert prisma data to response structure for member stats history
 * @param {Object} member member data
 * @param {Object} historyStats stats history
 * @param {Array} fields fields to return in response
 * @returns response
 */
function buildStatsHistoryResponse (member, historyStats, fields) {
  const item = {
    userId: helper.bigIntToNumber(member.userId),
    groupId: helper.bigIntToNumber(historyStats.groupId),
    handle: member.handle,
    handleLower: member.handleLower
  }
  // collect develop data
  if (historyStats.develop && historyStats.develop.length > 0) {
    item.DEVELOP = { subTracks: [] }
    // group by subTrackId
    const subTrackGroupData = _.groupBy(historyStats.develop, 'subTrackId')
    // for each sub track, build history data
    _.forEach(subTrackGroupData, (trackHistory, subTrackId) => {
      const subTrackItem = {
        id: subTrackId,
        name: trackHistory[0].subTrack
      }
      subTrackItem.history = _.map(trackHistory, h => ({
        ..._.pick(h, ['challengeName', 'newRating']),
        challengeId: helper.bigIntToNumber(h.challengeId),
        ratingDate: h.ratingDate ? h.ratingDate.getTime() : null
      }))
      item.DEVELOP.subTracks.push(subTrackItem)
    })
  }
  // collect data sciencedata
  if (historyStats.dataScience && historyStats.dataScience.length > 0) {
    item.DATA_SCIENCE = {}
    const srmHistory = _.filter(historyStats.dataScience, t => t.subTrack === 'SRM')
    const marathonHistory = _.filter(historyStats.dataScience, t => t.subTrack === 'MARATHON_MATCH')
    if (srmHistory.length > 0) {
      item.DATA_SCIENCE.SRM = {}
      item.DATA_SCIENCE.SRM.history = _.map(srmHistory, h => ({
        ..._.pick(h, ['challengeName', 'rating', 'placement', 'percentile']),
        challengeId: helper.bigIntToNumber(h.challengeId),
        date: h.date ? h.date.getTime() : null
      }))
    }
    if (marathonHistory.length > 0) {
      item.DATA_SCIENCE.MARATHON_MATCH = {}
      item.DATA_SCIENCE.MARATHON_MATCH.history = _.map(marathonHistory, h => ({
        ..._.pick(h, ['challengeName', 'rating', 'placement', 'percentile']),
        challengeId: helper.bigIntToNumber(h.challengeId),
        date: h.date ? h.date.getTime() : null
      }))
    }
  }
  return fields ? _.pick(item, fields) : item
}

// include parameters used to get all member stats
const statsIncludeParams = {
  design: { include: { items: true } },
  develop: { include: { items: true } },
  dataScience: { include: {
    srm: { include: { challengeDetails: true, divisions: true } },
    marathon: true
  } },
  copilot: true
}

// include parameters used to get all member skills
const skillsIncludeParams = {
  levels: { include: { skillLevel: true } },
  skill: { include: { category: true } },
  displayMode: true
}

module.exports = {
  convertMember,
  buildMemberSkills,
  buildStatsResponse,
  buildSearchMemberFilter,
  buildStatsHistoryResponse,
  statsIncludeParams,
  skillsIncludeParams
}
