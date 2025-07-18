/**
 * This service provides operations of statistics.
 */

const _ = require('lodash')
const Joi = require('joi')
const config = require('config')
const helper = require('../common/helper')
const logger = require('../common/logger')
const errors = require('../common/errors')
const constants = require('../../app-constants')
const prisma = require('../common/prisma').getClient()
const prismaHelper = require('../common/prismaHelper')
const string = require('joi/lib/types/string')
const { v4: uuidv4 } = require('uuid')

const DISTRIBUTION_FIELDS = ['track', 'subTrack', 'distribution', 'createdAt', 'updatedAt',
  'createdBy', 'updatedBy']

const HISTORY_STATS_FIELDS = ['userId', 'groupId', 'handle', 'handleLower', 'DEVELOP', 'DATA_SCIENCE',
  'createdAt', 'updatedAt', 'createdBy', 'updatedBy']

const MEMBER_STATS_FIELDS = ['userId', 'groupId', 'handle', 'handleLower', 'maxRating',
  'challenges', 'wins', 'DEVELOP', 'DESIGN', 'DATA_SCIENCE', 'COPILOT', 'createdAt',
  'updatedAt', 'createdBy', 'updatedBy']

const MEMBER_SKILL_FIELDS = ['userId', 'handle', 'handleLower', 'skills',
  'createdAt', 'updatedAt', 'createdBy', 'updatedBy']

/**
 * Get distribution statistics.
 * @param {Object} query the query parameters
 * @returns {Object} the distribution statistics
 */
async function getDistribution (query) {
  // validate and parse query parameter
  const fields = helper.parseCommaSeparatedString(query.fields, DISTRIBUTION_FIELDS) || DISTRIBUTION_FIELDS

  // find matched distribution records
  const prismaFilter = { where: {} }
  if (query.track || query.subTrack) {
    prismaFilter.where = { AND: [] }
    if (query.track) {
      prismaFilter.where.AND.push({
        track: { contains: query.track.toUpperCase() }
      })
    }
    if (query.subTrack) {
      prismaFilter.where.AND.push({
        subTrack: { contains: query.subTrack.toUpperCase() }
      })
    }
  }
  const items = await prisma.distributionStats.findMany(prismaFilter)
  if (!items || items.length === 0) {
    throw new errors.NotFoundError(`No member distribution statistics is found.`)
  }
  // convert result to response structure
  const records = []
  _.forEach(items, t => {
    const r = _.pick(t, DISTRIBUTION_FIELDS)
    r.distribution = {}
    _.forEach(t, (value, key) => {
      if (key.startsWith('ratingRange')) {
        r.distribution[key] = value
      }
    })
    records.push(r)
  })

  // aggregate the statistics
  let result = { track: query.track, subTrack: query.subTrack, distribution: {} }
  _.forEach(records, (record) => {
    if (record.distribution) {
      // sum the statistics
      _.forIn(record.distribution, (value, key) => {
        if (!result.distribution[key]) {
          result.distribution[key] = 0
        }
        result.distribution[key] += Number(value)
      })
      // use earliest createdAt
      if (record.createdAt && (!result.createdAt || new Date(record.createdAt) < result.createdAt)) {
        result.createdAt = new Date(record.createdAt)
        result.createdBy = record.createdBy
      }
      // use latest updatedAt
      if (record.updatedAt && (!result.updatedAt || new Date(record.updatedAt) > result.updatedAt)) {
        result.updatedAt = new Date(record.updatedAt)
        result.updatedBy = record.updatedBy
      }
    }
  })
  // select fields if provided
  if (fields) {
    result = _.pick(result, fields)
  }
  return result
}

getDistribution.schema = {
  query: Joi.object().keys({
    track: Joi.string(),
    subTrack: Joi.string(),
    fields: Joi.string()
  })
}

/**
 * Get history statistics.
 * @param {String} handle the member handle
 * @param {Object} query the query parameters
 * @returns {Object} the history statistics
 */
async function getHistoryStats (currentUser, handle, query) {
  let overallStat = []
  // validate and parse query parameter
  const fields = helper.parseCommaSeparatedString(query.fields, HISTORY_STATS_FIELDS) || HISTORY_STATS_FIELDS
  // get member by handle
  const member = await helper.getMemberByHandle(handle)
  const groupIds = await helper.getAllowedGroupIds(currentUser, member, query.groupIds)

  for (const groupId of groupIds) {
    let statsDb
    if (groupId === config.PUBLIC_GROUP_ID) {
      // get statistics by member user id from db
      statsDb = await prisma.memberHistoryStats.findFirst({
        where: { userId: member.userId, isPrivate: false },
        include: { develop: true, dataScience: true }
      })
      if (!_.isNil(statsDb)) {
        statsDb.groupId = _.toNumber(groupId)
      }
    } else {
      // get statistics private by member user id from db
      statsDb = await prisma.memberHistoryStats.findFirst({
        where: { userId: member.userId, groupId, isPrivate: true },
        include: { develop: true, dataScience: true }
      })
    }
    if (!_.isNil(statsDb)) {
      overallStat.push(statsDb)
    }
  }
  // build stats history response
  let result = _.map(overallStat, t => prismaHelper.buildStatsHistoryResponse(member, t, fields))
  // remove identifiable info fields if user is not admin, not M2M and not member himself
  if (!helper.canManageMember(currentUser, member)) {
    result = _.map(result, (item) => _.omit(item, config.STATISTICS_SECURE_FIELDS))
  }
  return result
}

getHistoryStats.schema = {
  currentUser: Joi.any(),
  handle: Joi.string().required(),
  query: Joi.object().keys({
    groupIds: Joi.string(),
    fields: Joi.string()
  })
}

/**
 * Get member statistics.
 * @param {String} handle the member handle
 * @param {Object} query the query parameters
 * @returns {Object} the member statistics
 */
async function getMemberStats (currentUser, handle, query, throwError) {
  let stats = []
  // validate and parse query parameter
  const fields = helper.parseCommaSeparatedString(query.fields, MEMBER_STATS_FIELDS) || MEMBER_STATS_FIELDS
  // get member by handle
  const member = await helper.getMemberByHandle(handle)
  const groupIds = await helper.getAllowedGroupIds(currentUser, member, query.groupIds)

  const includeParams = prismaHelper.statsIncludeParams

  for (const groupId of groupIds) {
    let stat
    if (groupId === config.PUBLIC_GROUP_ID) {
      // get statistics by member user id from db
      stat = await prisma.memberStats.findFirst({
        where: { userId: member.userId, isPrivate: false },
        include: includeParams
      })
      if (!_.isNil(stat)) {
        stat = _.assign(stat, { groupId: _.toNumber(groupId) })
      }
    } else {
      // get statistics private by member user id from db
      stat = await prisma.memberStats.findFirst({
        where: { userId: member.userId, isPrivate: true, groupId },
        include: includeParams
      })
    }
    if (!_.isNil(stat)) {
      stats.push(stat)
    }
  }
  let result = _.map(stats, t => prismaHelper.buildStatsResponse(member, t, fields))
  // remove identifiable info fields if user is not admin, not M2M and not member himself
  if (!helper.canManageMember(currentUser, member)) {
    result = _.map(result, (item) => _.omit(item, config.STATISTICS_SECURE_FIELDS))
  }
  return result
}

getMemberStats.schema = {
  currentUser: Joi.any(),
  handle: Joi.string().required(),
  query: Joi.object().keys({
    groupIds: Joi.string(),
    fields: Joi.string()
  }),
  throwError: Joi.boolean()
}

/**
 * Get member skills.
 * @param {String} handle the member handle
 * @param {Object} query the query parameters
 * @returns {Object} the member skills
 */
async function getMemberSkills (handle) {
  // validate member
  const member = await helper.getMemberByHandle(handle)
  const skillList = await prisma.memberSkill.findMany({
    where: {
      userId: member.userId
    },
    include: prismaHelper.skillsIncludeParams
  })
  // convert to response format
  return prismaHelper.buildMemberSkills(skillList)
}

getMemberSkills.schema = {
  currentUser: Joi.any(),
  handle: Joi.string().required()
}

/**
 * Check create/update member skill data
 * @param {Object} data request body
 */
async function validateMemberSkillData(data) {
  // Check displayMode
  if (data.displayModeId) {
    const modeCount = await prisma.displayMode.count({
      where: { id: data.displayModeId }
    })
    if (modeCount <= 0) {
      throw new errors.BadRequestError(`Display mode ${data.displayModeId} does not exist`)
    }
  }
  if (data.levels && data.levels.length > 0) {
    const levelCount = await prisma.skillLevel.count({
      where: { id: { in: data.levels } }
    })
    if (levelCount < data.levels.length) {
      throw new errors.BadRequestError(`Please make sure skill level exists`)
    }
  }
}


async function createMemberSkills (currentUser, handle, data) {
  // get member by handle
  const member = await helper.getMemberByHandle(handle)
  // check authorization
  if (!helper.canManageMember(currentUser, member)) {
    throw new errors.ForbiddenError('You are not allowed to update the member skills.')
  }

  // validate request
  const existingCount = await prisma.memberSkill.count({
    where: { userId: member.userId, skillId: data.skillId }
  })
  if (existingCount > 0) {
    throw new errors.BadRequestError('This member skill exists')
  }
  await validateMemberSkillData(data)

  // save to db
  const createdBy = currentUser.handle || currentUser.sub
  const memberSkillData = {
    id: uuidv4(),
    userId: member.userId,
    skillId: data.skillId,
    createdBy,
  }
  if (data.displayModeId) {
    memberSkillData.displayModeId = data.displayModeId
  }
  if (data.levels && data.levels.length > 0) {
    memberSkillData.levels = {
      createMany: { data: 
        _.map(data.levels, levelId => ({
          skillLevelId: levelId,
          createdBy
        }))
      }
    }
  }
  await prisma.memberSkill.create({ data: memberSkillData })

  // get skills by member handle
  const memberSkill = await this.getMemberSkills(handle)
  return memberSkill
}

createMemberSkills.schema = {
  currentUser: Joi.any(),
  handle: Joi.string().required(),
  data: Joi.object().keys({
    skillId: Joi.string().uuid().required(),
    displayModeId: Joi.string().uuid(),
    levels: Joi.array().items(Joi.string().uuid())
  }).required()
}

/**
 * Partially update member skills.
 * @param {Object} currentUser the user who performs operation
 * @param {String} handle the member handle
 * @param {Object} data the skills data to update
 * @returns {Object} the updated member skills
 */
async function partiallyUpdateMemberSkills (currentUser, handle, data) {
  // get member by handle
  const member = await helper.getMemberByHandle(handle)
  // check authorization
  if (!helper.canManageMember(currentUser, member)) {
    throw new errors.ForbiddenError('You are not allowed to update the member skills.')
  }

  // validate request
  const existing = await prisma.memberSkill.findFirst({
    where: { userId: member.userId, skillId: data.skillId }
  })
  if (!existing || !existing.id) {
    throw new errors.NotFoundError('Member skill not found')
  }
  await validateMemberSkillData(data)

  const updatedBy = currentUser.handle || currentUser.sub
  const memberSkillData = {
    updatedBy,
  }
  if (data.displayModeId) {
    memberSkillData.displayModeId = data.displayModeId
  }
  if (data.levels && data.levels.length > 0) {
    await prisma.memberSkillLevel.deleteMany({
      where: { memberSkillId: existing.id }
    })
    memberSkillData.levels = {
      createMany: { data: 
        _.map(data.levels, levelId => ({
          skillLevelId: levelId,
          createdBy: updatedBy,
          updatedBy
        }))
      }
    }
  }
  await prisma.memberSkill.update({
    data: memberSkillData,
    where: { id: existing.id }
  })

  // get skills by member handle
  const memberSkill = await this.getMemberSkills(handle)
  return memberSkill
}

partiallyUpdateMemberSkills.schema = {
  currentUser: Joi.any(),
  handle: Joi.string().required(),
  data: Joi.object().keys({
    skillId: Joi.string().uuid().required(),
    displayModeId: Joi.string().uuid(),
    levels: Joi.array().items(Joi.string().uuid())
  }).required()
}

// --- Joi Schema Constants ---
const developHistoryItemSchema = Joi.object({
  id: Joi.number().integer().optional(),
  challengeId: Joi.number().integer().messages({
    'any.required': 'challengeId is required',
    'number.base': 'challengeId must be a number'
  }).required(),
  challengeName: Joi.string().messages({
    'any.required': 'challengeName is required',
    'string.base': 'challengeName must be a string'
  }).required(),
  ratingDate: Joi.date().messages({
    'any.required': 'ratingDate is required',
    'date.base': 'ratingDate must be a valid date'
  }).required(),
  newRating: Joi.number().integer().messages({
    'any.required': 'newRating is required',
    'number.base': 'newRating must be a number'
  }).required(),
  subTrack: Joi.string().messages({
    'any.required': 'subTrack is required',
    'string.base': 'subTrack must be a string'
  }).required(),
  subTrackId: Joi.number().integer().messages({
    'any.required': 'subTrackId is required',
    'number.base': 'subTrackId must be a number'
  }).required()
}).unknown(false)

const dataScienceHistoryItemSchema = Joi.object({
  id: Joi.number().integer().optional(),
  challengeId: Joi.number().integer().messages({
    'any.required': 'challengeId is required',
    'number.base': 'challengeId must be a number'
  }).required(),
  challengeName: Joi.string().messages({
    'any.required': 'challengeName is required',
    'string.base': 'challengeName must be a string'
  }).required(),
  date: Joi.date().messages({
    'any.required': 'date is required',
    'date.base': 'date must be a valid date'
  }).required(),
  rating: Joi.number().integer().messages({
    'any.required': 'rating is required',
    'number.base': 'rating must be a number'
  }).required(),
  placement: Joi.number().integer().messages({
    'any.required': 'placement is required',
    'number.base': 'placement must be a number'
  }).required(),
  percentile: Joi.number().messages({
    'any.required': 'percentile is required',
    'number.base': 'percentile must be a number'
  }).required(),
  subTrack: Joi.string().messages({
    'any.required': 'subTrack is required',
    'string.base': 'subTrack must be a string'
  }).required(),
  subTrackId: Joi.number().integer().messages({
    'any.required': 'subTrackId is required',
    'number.base': 'subTrackId must be a number'
  }).required()
}).unknown(false)

const statsItemSchema = Joi.object({
  id: Joi.number().integer().optional(),
  name: Joi.string().messages({
    'any.required': 'name is required',
    'string.base': 'name must be a string'
  }).required(),
  subTrackId: Joi.number().integer().messages({
    'any.required': 'subTrackId is required',
    'number.base': 'subTrackId must be a number'
  }).required(),
  challenges: Joi.number().integer().messages({
    'number.base': 'challenges must be a number'
  }).optional(),
  wins: Joi.number().integer().messages({
    'number.base': 'wins must be a number'
  }).optional(),
  mostRecentSubmission: Joi.date().messages({
    'date.base': 'mostRecentSubmission must be a valid date'
  }).optional(),
  mostRecentEventDate: Joi.date().messages({
    'date.base': 'mostRecentEventDate must be a valid date'
  }).optional()
}).unknown(false)

// --- createHistoryStats & updateHistoryStats ---
const historyStatsSchema = Joi.object({
  groupId: Joi.number().integer().optional(),
  isPrivate: Joi.boolean().optional(),
  develop: Joi.array().items(developHistoryItemSchema).optional(),
  dataScience: Joi.array().items(dataScienceHistoryItemSchema).optional()
}).unknown(false).messages({
  'object.unknown': 'Unknown field in stats history payload'
})

// --- createMemberStats & updateMemberStats ---
const statsObjectSchema = Joi.object({
  id: Joi.number().integer().optional(),
  challenges: Joi.number().integer().messages({ 'number.base': 'challenges must be a number' }).optional(),
  wins: Joi.number().integer().messages({ 'number.base': 'wins must be a number' }).optional(),
  mostRecentSubmission: Joi.date().messages({ 'date.base': 'mostRecentSubmission must be a valid date' }).optional(),
  mostRecentEventDate: Joi.date().messages({ 'date.base': 'mostRecentEventDate must be a valid date' }).optional(),
  items: Joi.array().items(statsItemSchema).optional()
}).unknown(false)

const memberStatsSchema = Joi.object({
  groupId: Joi.number().integer().optional(),
  isPrivate: Joi.boolean().optional(),
  challenges: Joi.number().integer().messages({ 'number.base': 'challenges must be a number' }).optional(),
  wins: Joi.number().integer().messages({ 'number.base': 'wins must be a number' }).optional(),
  maxRatingId: Joi.number().integer().messages({ 'number.base': 'maxRatingId must be a number' }).optional(),
  develop: statsObjectSchema.optional(),
  design: statsObjectSchema.optional(),
  dataScience: statsObjectSchema.optional(),
  copilot: statsObjectSchema.optional()
}).unknown(false).messages({
  'object.unknown': 'Unknown field in member stats payload'
})

async function createHistoryStats(currentUser, handle, data) {
  // Validate member
  const member = await helper.getMemberByHandle(handle)
  if (!helper.canManageMember(currentUser, member)) {
    throw new errors.ForbiddenError('You are not allowed to create the member history statistics.')
  }

  // Joi validation schema for payload
  const { error: validationError1 } = historyStatsSchema.validate(data)
  if (validationError1) {
    throw new errors.BadRequestError(validationError1.details.map(e => e.message).join(', '))
  }

  // Prepare data for Prisma
  const createdBy = currentUser.handle || currentUser.sub
  const historyStatsData = {
    userId: member.userId,
    createdBy,
    isPrivate: data.isPrivate || false
  }
  if (data.groupId) {
    historyStatsData.groupId = data.groupId
    historyStatsData.isPrivate = true
  }
  if (data.develop && data.develop.length > 0) {
    historyStatsData.develop = {
      create: data.develop.map(item => ({
        ...item,
        ratingDate: new Date(item.ratingDate),
        createdBy
      }))
    }
  }
  if (data.dataScience && data.dataScience.length > 0) {
    historyStatsData.dataScience = {
      create: data.dataScience.map(item => ({
        ...item,
        date: new Date(item.date),
        createdBy
      }))
    }
  }

  // Create record
  const created = await prisma.memberHistoryStats.create({
    data: historyStatsData,
    include: { develop: true, dataScience: true }
  })
  return prismaHelper.buildStatsHistoryResponse(member, created)
}

async function updateHistoryStats(currentUser, handle, data) {
  // Validate member
  const member = await helper.getMemberByHandle(handle)
  if (!helper.canManageMember(currentUser, member)) {
    throw new errors.ForbiddenError('You are not allowed to update the member history statistics.')
  }

  // Joi validation schema for payload
  const { error: validationError2 } = historyStatsSchema.validate(data)
  if (validationError2) {
    throw new errors.BadRequestError(validationError2.details.map(e => e.message).join(', '))
  }

  // Find existing stats record
  const stats = await prisma.memberHistoryStats.findFirst({
    where: {
      userId: member.userId,
      groupId: data.groupId || null
    },
    include: { develop: true, dataScience: true }
  })
  if (!stats) {
    throw new errors.NotFoundError('Member history statistics not found')
  }

  const updatedBy = currentUser.handle || currentUser.sub

  await prisma.$transaction(async (tx) => {
    // DEVELOP upsert/delete
    const dbDevelopIds = new Set((stats.develop || []).map(d => d.id))
    const payloadDevelopIds = new Set((data.develop || []).filter(d => d.id).map(d => d.id))
    // Delete develop items not in payload
    for (const dbId of dbDevelopIds) {
      if (!payloadDevelopIds.has(dbId)) {
        await tx.memberDevelopHistoryStats.delete({ where: { id: dbId } })
      }
    }
    // Upsert develop items
    for (const item of data.develop || []) {
      if (item.id) {
        await tx.memberDevelopHistoryStats.update({
          where: { id: item.id },
          data: {
            challengeId: item.challengeId,
            challengeName: item.challengeName,
            ratingDate: new Date(item.ratingDate),
            newRating: item.newRating,
            subTrack: item.subTrack,
            subTrackId: item.subTrackId,
            updatedBy
          }
        })
      } else {
        await tx.memberDevelopHistoryStats.create({
          data: {
            historyStatsId: stats.id,
            challengeId: item.challengeId,
            challengeName: item.challengeName,
            ratingDate: new Date(item.ratingDate),
            newRating: item.newRating,
            subTrack: item.subTrack,
            subTrackId: item.subTrackId,
            createdBy: updatedBy
          }
        })
      }
    }
    // DATA_SCIENCE upsert/delete
    const dbDataScienceIds = new Set((stats.dataScience || []).map(d => d.id))
    const payloadDataScienceIds = new Set((data.dataScience || []).filter(d => d.id).map(d => d.id))
    // Delete dataScience items not in payload
    for (const dbId of dbDataScienceIds) {
      if (!payloadDataScienceIds.has(dbId)) {
        await tx.memberDataScienceHistoryStats.delete({ where: { id: dbId } })
      }
    }
    // Upsert dataScience items
    for (const item of data.dataScience || []) {
      if (item.id) {
        await tx.memberDataScienceHistoryStats.update({
          where: { id: item.id },
          data: {
            challengeId: item.challengeId,
            challengeName: item.challengeName,
            date: new Date(item.date),
            rating: item.rating,
            placement: item.placement,
            percentile: item.percentile,
            subTrack: item.subTrack,
            subTrackId: item.subTrackId,
            updatedBy
          }
        })
      } else {
        await tx.memberDataScienceHistoryStats.create({
          data: {
            historyStatsId: stats.id,
            challengeId: item.challengeId,
            challengeName: item.challengeName,
            date: new Date(item.date),
            rating: item.rating,
            placement: item.placement,
            percentile: item.percentile,
            subTrack: item.subTrack,
            subTrackId: item.subTrackId,
            createdBy: updatedBy
          }
        })
      }
    }
    // Update main stats record
    await tx.memberHistoryStats.update({
      where: { id: stats.id },
      data: { updatedBy }
    })
  })

  // Return updated record
  const updated = await prisma.memberHistoryStats.findFirst({
    where: { userId: member.userId, groupId: data.groupId || null },
    include: { develop: true, dataScience: true }
  })
  return prismaHelper.buildStatsHistoryResponse(member, updated)
}

async function createMemberStats(currentUser, handle, data) {
  // Validate member
  const member = await helper.getMemberByHandle(handle)
  if (!helper.canManageMember(currentUser, member)) {
    throw new errors.ForbiddenError('You are not allowed to create the member statistics.')
  }

  // Joi validation schema for payload
  const { error: validationError3 } = memberStatsSchema.validate(data)
  if (validationError3) {
    throw new errors.BadRequestError(validationError3.details.map(e => e.message).join(', '))
  }

  // Prepare data for Prisma
  const createdBy = currentUser.handle || currentUser.sub
  const memberStatsData = {
    userId: member.userId,
    createdBy,
    isPrivate: data.isPrivate || false
  }
  if (data.groupId) {
    memberStatsData.groupId = data.groupId
    memberStatsData.isPrivate = true
  }
  if (data.challenges !== undefined) memberStatsData.challenges = data.challenges
  if (data.wins !== undefined) memberStatsData.wins = data.wins
  if (data.maxRatingId) memberStatsData.memberRatingId = data.maxRatingId

  // Nested develop
  if (data.develop) {
    memberStatsData.develop = {
      create: {
        challenges: data.develop.challenges,
        wins: data.develop.wins,
        mostRecentSubmission: data.develop.mostRecentSubmission ? new Date(data.develop.mostRecentSubmission) : undefined,
        mostRecentEventDate: data.develop.mostRecentEventDate ? new Date(data.develop.mostRecentEventDate) : undefined,
        createdBy,
        items: data.develop.items && data.develop.items.length > 0 ? {
          create: data.develop.items.map(item => ({
            ...item,
            mostRecentSubmission: item.mostRecentSubmission ? new Date(item.mostRecentSubmission) : undefined,
            mostRecentEventDate: item.mostRecentEventDate ? new Date(item.mostRecentEventDate) : undefined,
            createdBy
          }))
        } : undefined
      }
    }
  }
  // Nested design
  if (data.design) {
    memberStatsData.design = {
      create: {
        challenges: data.design.challenges,
        wins: data.design.wins,
        mostRecentSubmission: data.design.mostRecentSubmission ? new Date(data.design.mostRecentSubmission) : undefined,
        mostRecentEventDate: data.design.mostRecentEventDate ? new Date(data.design.mostRecentEventDate) : undefined,
        createdBy,
        items: data.design.items && data.design.items.length > 0 ? {
          create: data.design.items.map(item => ({
            ...item,
            mostRecentSubmission: item.mostRecentSubmission ? new Date(item.mostRecentSubmission) : undefined,
            mostRecentEventDate: item.mostRecentEventDate ? new Date(item.mostRecentEventDate) : undefined,
            createdBy
          }))
        } : undefined
      }
    }
  }
  // Nested dataScience
  if (data.dataScience) {
    memberStatsData.dataScience = {
      create: {
        challenges: data.dataScience.challenges,
        wins: data.dataScience.wins,
        mostRecentSubmission: data.dataScience.mostRecentSubmission ? new Date(data.dataScience.mostRecentSubmission) : undefined,
        mostRecentEventDate: data.dataScience.mostRecentEventDate ? new Date(data.dataScience.mostRecentEventDate) : undefined,
        mostRecentEventName: data.dataScience.mostRecentEventName,
        createdBy
        // srm and marathon handled below
      }
    }
    // TODO: handle srm and marathon nested creation if needed
  }
  // Nested copilot
  if (data.copilot) {
    memberStatsData.copilot = { create: { ...data.copilot, createdBy } }
  }

  // Create record
  const created = await prisma.memberStats.create({
    data: memberStatsData,
    include: prismaHelper.statsIncludeParams
  })
  return prismaHelper.buildStatsResponse(member, created)
}

async function updateMemberStats(currentUser, handle, data) {
  // Validate member
  const member = await helper.getMemberByHandle(handle)
  if (!helper.canManageMember(currentUser, member)) {
    throw new errors.ForbiddenError('You are not allowed to update the member statistics.')
  }

  // Joi validation schema for payload
  const { error: validationError4 } = memberStatsSchema.validate(data)
  if (validationError4) {
    throw new errors.BadRequestError(validationError4.details.map(e => e.message).join(', '))
  }

  // Find existing stats record
  const stats = await prisma.memberStats.findFirst({
    where: {
      userId: member.userId,
      groupId: data.groupId || null
    },
    include: prismaHelper.statsIncludeParams
  })
  if (!stats) {
    throw new errors.NotFoundError('Member statistics not found')
  }

  const updatedBy = currentUser.handle || currentUser.sub

  await prisma.$transaction(async (tx) => {
    // Update main stats fields
    await tx.memberStats.update({
      where: { id: stats.id },
      data: {
        challenges: data.challenges !== undefined ? data.challenges : stats.challenges,
        wins: data.wins !== undefined ? data.wins : stats.wins,
        memberRatingId: data.maxRatingId !== undefined ? data.maxRatingId : stats.memberRatingId,
        updatedBy
      }
    })
    // DEVELOP upsert/delete
    if (data.develop) {
      let develop = stats.develop
      if (develop) {
        // Update develop fields
        await tx.memberDevelopStats.update({
          where: { id: develop.id },
          data: {
            challenges: data.develop.challenges !== undefined ? data.develop.challenges : develop.challenges,
            wins: data.develop.wins !== undefined ? data.develop.wins : develop.wins,
            mostRecentSubmission: data.develop.mostRecentSubmission ? new Date(data.develop.mostRecentSubmission) : develop.mostRecentSubmission,
            mostRecentEventDate: data.develop.mostRecentEventDate ? new Date(data.develop.mostRecentEventDate) : develop.mostRecentEventDate,
            updatedBy
          }
        })
        // Items upsert/delete
        const dbItemIds = new Set((develop.items || []).map(d => d.id))
        const payloadItemIds = new Set((data.develop.items || []).filter(d => d.id).map(d => d.id))
        // Delete items not in payload
        for (const dbId of dbItemIds) {
          if (!payloadItemIds.has(dbId)) {
            await tx.memberDevelopStatsItem.delete({ where: { id: dbId } })
          }
        }
        // Upsert items
        for (const item of data.develop.items || []) {
          if (item.id) {
            await tx.memberDevelopStatsItem.update({
              where: { id: item.id },
              data: {
                name: item.name,
                subTrackId: item.subTrackId,
                challenges: item.challenges,
                wins: item.wins,
                mostRecentSubmission: item.mostRecentSubmission ? new Date(item.mostRecentSubmission) : undefined,
                mostRecentEventDate: item.mostRecentEventDate ? new Date(item.mostRecentEventDate) : undefined,
                updatedBy
              }
            })
          } else {
            await tx.memberDevelopStatsItem.create({
              data: {
                developStatsId: develop.id,
                name: item.name,
                subTrackId: item.subTrackId,
                challenges: item.challenges,
                wins: item.wins,
                mostRecentSubmission: item.mostRecentSubmission ? new Date(item.mostRecentSubmission) : undefined,
                mostRecentEventDate: item.mostRecentEventDate ? new Date(item.mostRecentEventDate) : undefined,
                createdBy: updatedBy
              }
            })
          }
        }
      }
    }
    // DESIGN upsert/delete
    if (data.design) {
      let design = stats.design
      if (design) {
        // Update design fields
        await tx.memberDesignStats.update({
          where: { id: design.id },
          data: {
            challenges: data.design.challenges !== undefined ? data.design.challenges : design.challenges,
            wins: data.design.wins !== undefined ? data.design.wins : design.wins,
            mostRecentSubmission: data.design.mostRecentSubmission ? new Date(data.design.mostRecentSubmission) : design.mostRecentSubmission,
            mostRecentEventDate: data.design.mostRecentEventDate ? new Date(data.design.mostRecentEventDate) : design.mostRecentEventDate,
            updatedBy
          }
        })
        // Items upsert/delete
        const dbItemIds = new Set((design.items || []).map(d => d.id))
        const payloadItemIds = new Set((data.design.items || []).filter(d => d.id).map(d => d.id))
        // Delete items not in payload
        for (const dbId of dbItemIds) {
          if (!payloadItemIds.has(dbId)) {
            await tx.memberDesignStatsItem.delete({ where: { id: dbId } })
          }
        }
        // Upsert items
        for (const item of data.design.items || []) {
          if (item.id) {
            await tx.memberDesignStatsItem.update({
              where: { id: item.id },
              data: {
                name: item.name,
                subTrackId: item.subTrackId,
                challenges: item.challenges,
                wins: item.wins,
                mostRecentSubmission: item.mostRecentSubmission ? new Date(item.mostRecentSubmission) : undefined,
                mostRecentEventDate: item.mostRecentEventDate ? new Date(item.mostRecentEventDate) : undefined,
                updatedBy
              }
            })
          } else {
            await tx.memberDesignStatsItem.create({
              data: {
                designStatsId: design.id,
                name: item.name,
                subTrackId: item.subTrackId,
                challenges: item.challenges,
                wins: item.wins,
                mostRecentSubmission: item.mostRecentSubmission ? new Date(item.mostRecentSubmission) : undefined,
                mostRecentEventDate: item.mostRecentEventDate ? new Date(item.mostRecentEventDate) : undefined,
                createdBy: updatedBy
              }
            })
          }
        }
      }
    }
    // TODO: dataScience and copilot upsert/delete logic (similar pattern)
  })

  // Return updated record
  const updated = await prisma.memberStats.findFirst({
    where: { userId: member.userId, groupId: data.groupId || null },
    include: prismaHelper.statsIncludeParams
  })
  return prismaHelper.buildStatsResponse(member, updated)
}

module.exports = {
  getDistribution,
  getHistoryStats,
  getMemberStats,
  getMemberSkills,
  createMemberSkills,
  partiallyUpdateMemberSkills,
  createHistoryStats,
  updateHistoryStats,
  createMemberStats,
  updateMemberStats
}

logger.buildService(module.exports)
