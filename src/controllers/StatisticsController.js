/**
 * Controller for statistics endpoints
 */
const service = require('../services/StatisticsService')

function sendError(res, err) {
  const status = err.status || err.httpStatus || 500;
  const body = { message: err.message };
  if (err.details) body.details = err.details;
  res.status(status).json(body);
}

/**
 * Get distribution statistics
 * @param {Object} req the request
 * @param {Object} res the response
 */
async function getDistribution (req, res) {
  try {
  const result = await service.getDistribution(req.query)
  res.send(result)
  } catch (err) {
    sendError(res, err)
  }
}

/**
 * Get member history statistics
 * @param {Object} req the request
 * @param {Object} res the response
 */
async function getHistoryStats (req, res) {
  try {
  const result = await service.getHistoryStats(req.authUser, req.params.handle, req.query)
  res.send(result)
  } catch (err) {
    sendError(res, err)
  }
}

/**
 * Get member statistics
 * @param {Object} req the request
 * @param {Object} res the response
 */
async function getMemberStats (req, res) {
  try {
  const result = await service.getMemberStats(req.authUser, req.params.handle, req.query, true)
  res.send(result)
  } catch (err) {
    sendError(res, err)
  }
}

/**
 * Get member skills
 * @param {Object} req the request
 * @param {Object} res the response
 */
async function getMemberSkills (req, res) {
  try {
  const result = await service.getMemberSkills(req.params.handle)
  res.send(result)
  } catch (err) {
    sendError(res, err)
  }
}

/**
 * Create member skills
 * @param {Object} req the request
 * @param {Object} res the response
 */
async function createMemberSkills (req, res) {
  try {
  const result = await service.createMemberSkills(req.authUser, req.params.handle, req.body)
  res.send(result)
  } catch (err) {
    sendError(res, err)
  }
}

/**
 * Partially update member skills
 * @param {Object} req the request
 * @param {Object} res the response
 */
async function partiallyUpdateMemberSkills (req, res) {
  try {
  const result = await service.partiallyUpdateMemberSkills(req.authUser, req.params.handle, req.body)
  res.send(result)
  } catch (err) {
    sendError(res, err)
  }
}

/**
 * Create member history statistics
 * @param {Object} req the request
 * @param {Object} res the response
 */
async function createHistoryStats (req, res) {
  try {
    const result = await service.createHistoryStats(req.authUser, req.params.handle, req.body)
    res.status(201).send(result)
  } catch (err) {
    sendError(res, err)
  }
}

/**
 * Update member history statistics
 * @param {Object} req the request
 * @param {Object} res the response
 */
async function updateHistoryStats (req, res) {
  try {
    const result = await service.updateHistoryStats(req.authUser, req.params.handle, req.body)
    res.status(200).send(result)
  } catch (err) {
    sendError(res, err)
  }
}

/**
 * Create member statistics
 * @param {Object} req the request
 * @param {Object} res the response
 */
async function createMemberStats (req, res) {
  try {
    const result = await service.createMemberStats(req.authUser, req.params.handle, req.body)
    res.status(201).send(result)
  } catch (err) {
    sendError(res, err)
  }
}

/**
 * Update member statistics
 * @param {Object} req the request
 * @param {Object} res the response
 */
async function updateMemberStats (req, res) {
  try {
    const result = await service.updateMemberStats(req.authUser, req.params.handle, req.body)
    res.status(200).send(result)
  } catch (err) {
    sendError(res, err)
  }
}

module.exports = {
  getDistribution,
  getHistoryStats,
  createHistoryStats,
  updateHistoryStats,
  getMemberStats,
  createMemberStats,
  updateMemberStats,
  getMemberSkills,
  createMemberSkills,
  partiallyUpdateMemberSkills
}
