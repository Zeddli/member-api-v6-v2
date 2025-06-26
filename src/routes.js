/**
 * Contains all routes
 */

const constants = require('../app-constants')
const { SCOPES: {
  MEMBERS
} } = require('config')

module.exports = {
  '/members/health': {
    get: {
      controller: 'HealthController',
      method: 'checkHealth'
    }
  },
  '/members/uid-signature': {
    get: {
      controller: 'MemberController',
      method: 'getMemberUserIdSignature',
      auth: 'jwt',
      scopes: [MEMBERS.READ, MEMBERS.ALL]
    }
  },
  '/members/:handle': {
    get: {
      controller: 'MemberController',
      method: 'getMember',
      auth: 'jwt',
      allowNoToken: true,
      scopes: [MEMBERS.READ, MEMBERS.ALL]
    },
    put: {
      controller: 'MemberController',
      method: 'updateMember',
      auth: 'jwt',
      scopes: [MEMBERS.UPDATE, MEMBERS.ALL]
    }
  },
  '/members/:handle/profileCompleteness': {
    get: {
      controller: 'MemberController',
      method: 'getProfileCompleteness',
      auth: 'jwt',
      scopes: [MEMBERS.UPDATE, MEMBERS.ALL]
    }
  },
  '/members/:handle/verify': {
    get: {
      controller: 'MemberController',
      method: 'verifyEmail',
      auth: 'jwt',
      scopes: [MEMBERS.UPDATE, MEMBERS.ALL]
    }
  },
  '/members/:handle/photo': {
    post: {
      controller: 'MemberController',
      method: 'uploadPhoto',
      auth: 'jwt',
      scopes: [MEMBERS.UPDATE, MEMBERS.ALL]
    }
  },
  '/members/:handle/traits': {
    get: {
      controller: 'MemberTraitController',
      method: 'getTraits',
      auth: 'jwt',
      allowNoToken: true,
      scopes: [MEMBERS.READ, MEMBERS.ALL]
    },
    post: {
      controller: 'MemberTraitController',
      method: 'createTraits',
      auth: 'jwt',
      scopes: [MEMBERS.CREATE, MEMBERS.ALL]
    },
    put: {
      controller: 'MemberTraitController',
      method: 'updateTraits',
      auth: 'jwt',
      scopes: [MEMBERS.UPDATE, MEMBERS.ALL]
    },
    delete: {
      controller: 'MemberTraitController',
      method: 'removeTraits',
      auth: 'jwt',
      scopes: [MEMBERS.DELETE, MEMBERS.ALL]
    }
  },
}
