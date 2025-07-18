const chai = require('chai')
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon')
const should = chai.should()
const StatisticsController = require('../../src/controllers/StatisticsController')
const StatisticsService = require('../../src/services/StatisticsService')

// Helper to mock req/res
function mockReqRes(body = {}, params = {}, authUser = {}) {
  const req = { body, params, authUser }
  // Add .json method to support res.status().json()
  const res = {
    status: sinon.stub().returnsThis(),
    send: sinon.stub().returnsThis(),
    json: sinon.stub().returnsThis()
  }
  return { req, res }
}

describe('StatisticsController', () => {
  afterEach(() => {
    sinon.restore()
  })

  describe('createHistoryStats', () => {
    it('should return 201 for valid request', async () => {
      const { req, res } = mockReqRes({ foo: 'bar' }, { handle: 'test' }, { sub: 'user' })
      const fakeResult = { id: 1 }
      sinon.stub(StatisticsService, 'createHistoryStats').resolves(fakeResult)
      await StatisticsController.createHistoryStats(req, res)
      res.status.calledWith(201).should.be.true
      res.send.calledWith(fakeResult).should.be.true
    })
    it('should handle service error', async () => {
      const { req, res } = mockReqRes({}, { handle: 'test' }, { sub: 'user' })
      sinon.stub(StatisticsService, 'createHistoryStats').rejects(new Error('fail'))
      try {
        await StatisticsController.createHistoryStats(req, res)
      } catch (e) {
        e.message.should.equal('fail')
      }
    })
  })

  describe('updateHistoryStats', () => {
    it('should return 200 for valid request', async () => {
      const { req, res } = mockReqRes({ foo: 'bar' }, { handle: 'test' }, { sub: 'user' })
      const fakeResult = { id: 2 }
      sinon.stub(StatisticsService, 'updateHistoryStats').resolves(fakeResult)
      await StatisticsController.updateHistoryStats(req, res)
      res.status.calledWith(200).should.be.true
      res.send.calledWith(fakeResult).should.be.true
    })
    it('should handle service error', async () => {
      const { req, res } = mockReqRes({}, { handle: 'test' }, { sub: 'user' })
      sinon.stub(StatisticsService, 'updateHistoryStats').rejects(new Error('fail'))
      try {
        await StatisticsController.updateHistoryStats(req, res)
      } catch (e) {
        e.message.should.equal('fail')
      }
    })
  })

  describe('createMemberStats', () => {
    it('should return 201 for valid request', async () => {
      const { req, res } = mockReqRes({ foo: 'bar' }, { handle: 'test' }, { sub: 'user' })
      const fakeResult = { id: 3 }
      sinon.stub(StatisticsService, 'createMemberStats').resolves(fakeResult)
      await StatisticsController.createMemberStats(req, res)
      res.status.calledWith(201).should.be.true
      res.send.calledWith(fakeResult).should.be.true
    })
    it('should handle service error', async () => {
      const { req, res } = mockReqRes({}, { handle: 'test' }, { sub: 'user' })
      sinon.stub(StatisticsService, 'createMemberStats').rejects(new Error('fail'))
      try {
        await StatisticsController.createMemberStats(req, res)
      } catch (e) {
        e.message.should.equal('fail')
      }
    })
  })

  describe('updateMemberStats', () => {
    it('should return 200 for valid request', async () => {
      const { req, res } = mockReqRes({ foo: 'bar' }, { handle: 'test' }, { sub: 'user' })
      const fakeResult = { id: 4 }
      sinon.stub(StatisticsService, 'updateMemberStats').resolves(fakeResult)
      await StatisticsController.updateMemberStats(req, res)
      res.status.calledWith(200).should.be.true
      res.send.calledWith(fakeResult).should.be.true
    })
    it('should handle service error', async () => {
      const { req, res } = mockReqRes({}, { handle: 'test' }, { sub: 'user' })
      sinon.stub(StatisticsService, 'updateMemberStats').rejects(new Error('fail'))
      try {
        await StatisticsController.updateMemberStats(req, res)
      } catch (e) {
        e.message.should.equal('fail')
      }
    })
  })
}) 