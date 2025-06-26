/**
 * This file defines helper methods
 */
const _ = require('lodash')
const constants = require('../../app-constants')
const errors = require('./errors')
const AWS = require('aws-sdk')
const config = require('config')
const busApi = require('topcoder-bus-api-wrapper')
const querystring = require('querystring')
const prisma = require('./prisma').getClient();

// Color schema for Ratings
const RATING_COLORS = [{
  color: '#9D9FA0' /* Grey */,
  limit: 900
}, {
  color: '#69C329' /* Green */,
  limit: 1200
}, {
  color: '#616BD5' /* Blue */,
  limit: 1500
}, {
  color: '#FCD617' /* Yellow */,
  limit: 2200
}, {
  color: '#EF3A3A' /* Red */,
  limit: Infinity
}]

// Bus API Client
let busApiClient

const awsConfig = {
  s3: config.AMAZON.S3_API_VERSION,
  region: config.AMAZON.AWS_REGION
}
if (config.AMAZON.AWS_ACCESS_KEY_ID && config.AMAZON.AWS_SECRET_ACCESS_KEY) {
  awsConfig.accessKeyId = config.AMAZON.AWS_ACCESS_KEY_ID
  awsConfig.secretAccessKey = config.AMAZON.AWS_SECRET_ACCESS_KEY
}
AWS.config.update(awsConfig)

let s3;

// lazy loading to allow mock tests
function getS3() {
  if (!s3) {
    s3 = new AWS.S3()
  }
  return s3
}

const m2mAuth = require('tc-core-library-js').auth.m2m

const m2m = m2mAuth(
  _.pick(config, [
    'AUTH0_URL',
    'AUTH0_AUDIENCE',
    'AUTH0_CLIENT_ID',
    'AUTH0_CLIENT_SECRET',
    'AUTH0_PROXY_SERVER_URL'
  ])
)

/**
 * Wrap async function to standard express function
 * @param {Function} fn the async function
 * @returns {Function} the wrapped function
 */
function wrapExpress (fn) {
  return function (req, res, next) {
    fn(req, res, next).catch(next)
  }
}

/**
 * Wrap all functions from object
 * @param obj the object (controller exports)
 * @returns {Object|Array} the wrapped object
 */
function autoWrapExpress (obj) {
  if (_.isArray(obj)) {
    return obj.map(autoWrapExpress)
  }
  if (_.isFunction(obj)) {
    if (obj.constructor.name === 'AsyncFunction') {
      return wrapExpress(obj)
    }
    return obj
  }
  _.each(obj, (value, key) => {
    obj[key] = autoWrapExpress(value)
  })
  return obj
}

/**
 * Check if the user has admin role
 * @param {Object} authUser the user
 * @returns {Boolean} whether the user has admin role
 */
function hasAdminRole (authUser) {
  if (!authUser.roles) {
    return false
  }
  for (let i = 0; i < authUser.roles.length; i += 1) {
    for (let j = 0; j < constants.ADMIN_ROLES.length; j += 1) {
      if (authUser.roles[i].toLowerCase() === constants.ADMIN_ROLES[j].toLowerCase()) {
        return true
      }
    }
  }
  return false
}

function hasSearchByEmailRole (authUser) {
  if (!authUser.roles) {
    return false
  }
  for (let i = 0; i < authUser.roles.length; i += 1) {
    for (let j = 0; j < constants.SEARCH_BY_EMAIL_ROLES.length; j += 1) {
      if (authUser.roles[i].toLowerCase() === constants.SEARCH_BY_EMAIL_ROLES[j].toLowerCase()) {
        return true
      }
    }
  }
  return false
}

/**
 * Check if the user has autocomplete role
 * @param {Object} authUser the user
 * @returns {Boolean} whether the user has autocomplete role
 */
function hasAutocompleteRole (authUser) {
  if (!authUser || !authUser.roles) {
    return false
  }
  for (let i = 0; i < authUser.roles.length; i += 1) {
    for (let j = 0; j < constants.AUTOCOMPLETE_ROLES.length; j += 1) {
      if (authUser.roles[i].toLowerCase() === constants.AUTOCOMPLETE_ROLES[j].toLowerCase()) {
        return true
      }
    }
  }
  return false
}


/**
 * Get member by handle
 * @param {String} handle the member handle
 * @returns {Promise<Object>} the member of given handle
 */
async function getMemberByHandle (handle) {
  const ret = await prisma.member.findUnique({
    where: {
      handleLower: handle.trim().toLowerCase()
    }
  });
  if (!ret || !ret.userId) {
    throw new errors.NotFoundError(`Member with handle: "${handle}" doesn't exist`);
  }
  return ret;
}


/**
 * Upload photo to S3
 * @param {Buffer} data the file data
 * @param {String} mimetype the MIME type
 * @param {String} fileName the original file name
 * @return {Promise<String>} the uploaded photo URL
 */
async function uploadPhotoToS3 (data, mimetype, fileName) {
  const params = {
    Bucket: config.AMAZON.PHOTO_S3_BUCKET,
    Key: fileName,
    Body: data,
    ContentType: mimetype,
    // ACL: 'public-read', // no public access after platform security updates
    Metadata: {
      fileName
    }
  }
  // Upload to S3
  await getS3().upload(params).promise()
  // construct photo URL
  return config.PHOTO_URL_TEMPLATE.replace('<key>', fileName)
}

/**
 * Get Bus API Client
 * @return {Object} Bus API Client Instance
 */
function getBusApiClient () {
  // if there is no bus API client instance, then create a new instance
  if (!busApiClient) {
    busApiClient = busApi(_.pick(config,
      ['AUTH0_URL', 'AUTH0_AUDIENCE', 'TOKEN_CACHE_TIME',
        'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET', 'BUSAPI_URL',
        'KAFKA_ERROR_TOPIC', 'AUTH0_PROXY_SERVER_URL']))
  }

  return busApiClient
}

/**
 * Post bus event.
 * @param {String} topic the event topic
 * @param {Object} payload the event payload
 */
async function postBusEvent (topic, payload) {
  const client = getBusApiClient()
  await client.postEvent({
    topic,
    originator: constants.EVENT_ORIGINATOR,
    timestamp: new Date().toISOString(),
    'mime-type': constants.EVENT_MIME_TYPE,
    payload
  })
}

/**
 * Parse comma separated string to return array of values.
 * @param {String} s the string to parse
 * @param {Array} allowedValues the allowed values
 * @returns {Array} the parsed values
 */
function parseCommaSeparatedString (s, allowedValues) {
  if (!s) {
    return null
  }
  const values = s.split(',')
  // used to check duplicate values
  const mapping = {}
  _.forEach(values, (value) => {
    if (value.trim().length === 0) {
      throw new errors.BadRequestError('Empty value.')
    }
    if (allowedValues && !_.includes(allowedValues, value)) {
      throw new errors.BadRequestError(`Invalid value: ${value}`)
    }
    if (mapping[value]) {
      throw new errors.BadRequestError(`Duplicate values: ${value}`)
    }
    mapping[value] = true
  })
  return values
}

/**
 * Get link for a given page.
 * @param {Object} req the HTTP request
 * @param {Number} page the page number
 * @returns {String} link for the page
 */
function getPageLink (req, page) {
  const q = _.assignIn({}, req.query, { page })
  return `${req.protocol}://${req.get('Host')}${req.baseUrl}${req.path}?${querystring.stringify(q)}`
}

/**
 * Set HTTP response headers from result.
 * @param {Object} req the HTTP request
 * @param {Object} res the HTTP response
 * @param {Object} result the operation result
 */
function setResHeaders (req, res, result) {
  const totalPages = Math.ceil(result.total / result.perPage)
  if (result.page > 1) {
    res.set('X-Prev-Page', result.page - 1)
  }
  if (result.page < totalPages) {
    res.set('X-Next-Page', result.page + 1)
  }
  res.set('X-Page', result.page)
  res.set('X-Per-Page', result.perPage)
  res.set('X-Total', result.total)
  res.set('X-Total-Pages', totalPages)
  // set Link header
  if (totalPages > 0) {
    let link = `<${getPageLink(req, 1)}>; rel="first", <${getPageLink(req, totalPages)}>; rel="last"`
    if (result.page > 1) {
      link += `, <${getPageLink(req, result.page - 1)}>; rel="prev"`
    }
    if (result.page < totalPages) {
      link += `, <${getPageLink(req, result.page + 1)}>; rel="next"`
    }
    res.set('Link', link)
  }
}

/**
 * Check whether the current user can manage the member data
 * @param {Object} currentUser the user who performs operation
 * @param {Object} member the member profile data
 * @returns {Boolean} whether the current user can manage the member data
 */
function canManageMember (currentUser, member) {
  // only admin, M2M or member himself can manage the member data
  return currentUser && (currentUser.isMachine || hasAdminRole(currentUser) ||
    (currentUser.handle && currentUser.handle.toLowerCase() === member.handleLower.toLowerCase()))
}

function cleanUpStatistics (stats, fields) {
  // cleanup - convert string to object
  for (let count = 0; count < stats.length; count++) {
    if (stats[count].hasOwnProperty('maxRating')) {
      if (typeof stats[count].maxRating === 'string') {
        stats[count].maxRating = JSON.parse(stats[count].maxRating)
      }
      // set the rating color
      stats[count].maxRating.ratingColor = this.getRatingColor(stats[count].maxRating.rating)
    }
    if (stats[count].hasOwnProperty('DATA_SCIENCE')) {
      if (typeof stats[count].DATA_SCIENCE === 'string') {
        stats[count].DATA_SCIENCE = JSON.parse(stats[count].DATA_SCIENCE)
      }
    }
    if (stats[count].hasOwnProperty('DESIGN')) {
      if (typeof stats[count].DESIGN === 'string') {
        stats[count].DESIGN = JSON.parse(stats[count].DESIGN)
      }
    }
    if (stats[count].hasOwnProperty('DEVELOP')) {
      if (typeof stats[count].DEVELOP === 'string') {
        stats[count].DEVELOP = JSON.parse(stats[count].DEVELOP)
      }
    }
    // select fields if provided
    if (fields) {
      stats[count] = _.pick(stats[count], fields)
    }
  }
  return stats
}

function getRatingColor (rating) {
  let i = 0; const r = Number(rating)
  while (RATING_COLORS[i].limit <= r) i += 1
  return RATING_COLORS[i].color || 'black'
}

function paginate (array, page_size, page_number) {
  return array.slice(page_number * page_size, page_number * page_size + page_size)
}

/*
 * Function to get M2M token
 * @returns {Promise}
 */
const getM2MToken = () => {
  return m2m.getMachineToken(
    config.AUTH0_CLIENT_ID,
    config.AUTH0_CLIENT_SECRET
  )
}

/**
 * Gets the list of parameters from the query as an array
 *
 * @param query
 * @param parameterName
 * @returns {*[]}
 */
const getParamsFromQueryAsArray = async (query, parameterName) => {
  const paramsArray = []
  if (!_.isEmpty(query[parameterName])) {
    if (!_.isArray(query[parameterName])) {
      paramsArray.push(query[parameterName])
    } else {
      paramsArray.push(...query[parameterName])
    }
  }
  return paramsArray
}

function secureMemberAddressData(member) {
  if (member.addresses) {
    member.addresses = _.map(member.addresses, (address) => _.omit(address, config.ADDRESS_SECURE_FIELDS))
  }

  return member
}

function truncateLastName(member) {
  if (member.lastName) {
    member.lastName = member.lastName.substring(0,1)
  }
  return member
}

function bigIntToNumber(value) {
  if (value) {
    return Number(value)
  }
  return null
}

module.exports = {
  wrapExpress,
  autoWrapExpress,
  hasAdminRole,
  hasAutocompleteRole,
  hasSearchByEmailRole,
  getMemberByHandle,
  uploadPhotoToS3,
  postBusEvent,
  parseCommaSeparatedString,
  setResHeaders,
  canManageMember,
  cleanUpStatistics,
  getRatingColor,
  paginate,
  getM2MToken,
  getParamsFromQueryAsArray,
  secureMemberAddressData,
  truncateLastName,
  bigIntToNumber
}
