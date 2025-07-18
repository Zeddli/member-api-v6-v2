import chaiAsPromised from 'chai-as-promised';
import chai from 'chai';
chai.use(chaiAsPromised);
const sinon = require('sinon');
const StatisticsService = require('../../src/services/StatisticsService');
const prisma = require('../../src/common/prisma').getClient();
const helper = require('../../src/common/helper');
const errors = require('../../src/common/errors');

// Sample data
const mockMember = { userId: 1, handle: 'testuser' };
const validPayload = {
  develop: [
    {
      challengeId: 123,
      challengeName: 'Challenge 1',
      ratingDate: '2023-01-01',
      newRating: 1500,
      subTrack: 'SRM',
      subTrackId: 1
    }
  ],
  dataScience: [
    {
      challengeId: 456,
      challengeName: 'DS Challenge',
      date: '2023-01-02',
      rating: 1600,
      placement: 1,
      percentile: 99.5,
      subTrack: 'MARATHON',
      subTrackId: 2
    }
  ]
};

describe('StatisticsService.createHistoryStats', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should create stats history with valid data', async () => {
    sandbox.stub(helper, 'getMemberByHandle').resolves(mockMember);
    sandbox.stub(helper, 'canManageMember').returns(true);
    sandbox.stub(prisma.memberHistoryStats, 'create').resolves({ id: 1, ...validPayload });
    sandbox.stub(require('../../src/common/prismaHelper'), 'buildStatsResponse').returns({ id: 1, ...validPayload });

    const result = await StatisticsService.createHistoryStats({ handle: 'admin' }, 'testuser', validPayload);
    expect(result).to.have.property('id', 1);
    expect(result.develop).to.be.an('array');
    expect(result.dataScience).to.be.an('array');
  });

  it('should throw BadRequestError for invalid data', async () => {
    sandbox.stub(helper, 'getMemberByHandle').resolves(mockMember);
    sandbox.stub(helper, 'canManageMember').returns(true);
    const invalidPayload = { develop: [{ challengeId: 123 }] }; // missing required fields
    await expect(
      StatisticsService.createHistoryStats({ handle: 'admin' }, 'testuser', invalidPayload)
    ).to.be.rejectedWith(ErrorType, 'BadRequestError');
  });

  it('should throw ForbiddenError if user cannot manage member', async () => {
    sandbox.stub(helper, 'getMemberByHandle').resolves(mockMember);
    sandbox.stub(helper, 'canManageMember').returns(false);
    await expect(
      StatisticsService.createHistoryStats({ handle: 'notadmin' }, 'testuser', validPayload)
    ).to.be.rejectedWith(errors.ForbiddenError);
  });
});

describe('StatisticsService.updateHistoryStats', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  const mockStats = {
    id: 1,
    userId: 1,
    groupId: null,
    develop: [{ id: 10 }],
    dataScience: [{ id: 20 }]
  };
  const updatePayload = {
    develop: [
      {
        id: 10,
        challengeId: 123,
        challengeName: 'Challenge 1',
        ratingDate: '2023-01-01',
        newRating: 1500,
        subTrack: 'SRM',
        subTrackId: 1
      },
      {
        challengeId: 124,
        challengeName: 'Challenge 2',
        ratingDate: '2023-01-02',
        newRating: 1550,
        subTrack: 'SRM',
        subTrackId: 1
      }
    ],
    dataScience: [
      {
        id: 20,
        challengeId: 456,
        challengeName: 'DS Challenge',
        date: '2023-01-02',
        rating: 1600,
        placement: 1,
        percentile: 99.5,
        subTrack: 'MARATHON',
        subTrackId: 2
      }
    ]
  };

  it('should update stats history with upsert/delete logic', async () => {
    sandbox.stub(helper, 'getMemberByHandle').resolves(mockMember);
    sandbox.stub(helper, 'canManageMember').returns(true);
    sandbox.stub(prisma.memberHistoryStats, 'findFirst').resolves(mockStats);
    const tx = {
      memberDevelopHistoryStats: {
        delete: sandbox.stub().resolves(),
        update: sandbox.stub().resolves(),
        create: sandbox.stub().resolves()
      },
      memberDataScienceHistoryStats: {
        delete: sandbox.stub().resolves(),
        update: sandbox.stub().resolves(),
        create: sandbox.stub().resolves()
      }
    };
    sandbox.stub(prisma, '$transaction').callsFake(async fn => fn(tx));
    sandbox.stub(require('../../src/common/prismaHelper'), 'buildStatsResponse').returns({ id: 1 });

    const result = await StatisticsService.updateHistoryStats({ handle: 'admin' }, 'testuser', updatePayload);
    expect(result).to.have.property('id', 1);
    // Check that upsert/delete stubs were called
    expect(tx.memberDevelopHistoryStats.update.calledOnce).to.be.true;
    expect(tx.memberDevelopHistoryStats.create.calledOnce).to.be.true;
    expect(tx.memberDevelopHistoryStats.delete.notCalled).to.be.true;
    expect(tx.memberDataScienceHistoryStats.update.calledOnce).to.be.true;
    expect(tx.memberDataScienceHistoryStats.create.notCalled).to.be.true;
    expect(tx.memberDataScienceHistoryStats.delete.notCalled).to.be.true;
  });

  it('should throw NotFoundError if stats record not found', async () => {
    sandbox.stub(helper, 'getMemberByHandle').resolves(mockMember);
    sandbox.stub(helper, 'canManageMember').returns(true);
    sandbox.stub(prisma.memberHistoryStats, 'findFirst').resolves(null);
    await expect(
      StatisticsService.updateHistoryStats({ handle: 'admin' }, 'testuser', updatePayload)
    ).to.be.rejectedWith(errors.NotFoundError);
  });

  it('should throw BadRequestError for invalid data', async () => {
    sandbox.stub(helper, 'getMemberByHandle').resolves(mockMember);
    sandbox.stub(helper, 'canManageMember').returns(true);
    const invalidPayload = { develop: [{ id: 10 }] }; // missing required fields
    await expect(
      StatisticsService.updateHistoryStats({ handle: 'admin' }, 'testuser', invalidPayload)
    ).to.be.rejectedWith(errors.BadRequestError);
  });

  it('should throw ForbiddenError if user cannot manage member', async () => {
    sandbox.stub(helper, 'getMemberByHandle').resolves(mockMember);
    sandbox.stub(helper, 'canManageMember').returns(false);
    await expect(
      StatisticsService.updateHistoryStats({ handle: 'notadmin' }, 'testuser', updatePayload)
    ).to.be.rejectedWith(errors.ForbiddenError);
  });
});

describe('StatisticsService.createMemberStats', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  const validPayload = {
    challenges: 5,
    wins: 2,
    develop: {
      challenges: 3,
      wins: 1,
      mostRecentSubmission: '2023-01-01',
      mostRecentEventDate: '2023-01-02',
      items: [
        {
          name: 'SRM',
          subTrackId: 1,
          challenges: 2,
          wins: 1
        }
      ]
    },
    design: {
      challenges: 2,
      wins: 1,
      items: []
    },
    dataScience: {
      challenges: 1,
      wins: 0,
      items: []
    },
    copilot: {
      challenges: 0,
      wins: 0,
      items: []
    }
  };

  it('should create member stats with nested data', async () => {
    sandbox.stub(helper, 'getMemberByHandle').resolves(mockMember);
    sandbox.stub(helper, 'canManageMember').returns(true);
    sandbox.stub(prisma.memberStats, 'create').resolves({ id: 1, ...validPayload });
    sandbox.stub(require('../../src/common/prismaHelper'), 'buildStatsResponse').returns({ id: 1, ...validPayload });

    const result = await StatisticsService.createMemberStats({ handle: 'admin' }, 'testuser', validPayload);
    expect(result).to.have.property('id', 1);
    expect(result.develop).to.be.an('object');
    expect(result.design).to.be.an('object');
    expect(result.dataScience).to.be.an('object');
    expect(result.copilot).to.be.an('object');
  });

  it('should throw BadRequestError for invalid data', async () => {
    sandbox.stub(helper, 'getMemberByHandle').resolves(mockMember);
    sandbox.stub(helper, 'canManageMember').returns(true);
    const invalidPayload = { develop: { items: [{}] } }; // missing required fields
    await expect(
      StatisticsService.createMemberStats({ handle: 'admin' }, 'testuser', invalidPayload)
    ).to.be.rejectedWith(errors.BadRequestError);
  });

  it('should throw ForbiddenError if user cannot manage member', async () => {
    sandbox.stub(helper, 'getMemberByHandle').resolves(mockMember);
    sandbox.stub(helper, 'canManageMember').returns(false);
    await expect(
      StatisticsService.createMemberStats({ handle: 'notadmin' }, 'testuser', validPayload)
    ).to.be.rejectedWith(errors.ForbiddenError);
  });
});

describe('StatisticsService.updateMemberStats', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  const mockStats = {
    id: 1,
    userId: 1,
    groupId: null,
    develop: { items: [{ id: 10 }] },
    design: { items: [{ id: 20 }] },
    dataScience: { items: [{ id: 30 }] },
    copilot: { items: [{ id: 40 }] }
  };
  const updatePayload = {
    develop: {
      items: [
        {
          id: 10,
          name: 'SRM',
          subTrackId: 1,
          challenges: 2,
          wins: 1
        },
        {
          name: 'SRM2',
          subTrackId: 2,
          challenges: 1,
          wins: 0
        }
      ]
    },
    design: {
      items: [
        {
          id: 20,
          name: 'Design',
          subTrackId: 3,
          challenges: 1,
          wins: 1
        }
      ]
    },
    dataScience: {
      items: [
        {
          id: 30,
          name: 'DS',
          subTrackId: 4,
          challenges: 1,
          wins: 0
        }
      ]
    },
    copilot: {
      items: [
        {
          id: 40,
          name: 'Copilot',
          subTrackId: 5,
          challenges: 0,
          wins: 0
        }
      ]
    }
  };

  it('should update member stats with partial updates and deletions', async () => {
    sandbox.stub(helper, 'getMemberByHandle').resolves(mockMember);
    sandbox.stub(helper, 'canManageMember').returns(true);
    sandbox.stub(prisma.memberStats, 'findFirst').resolves(mockStats);
    const tx = {
      memberDevelopStatsItem: {
        delete: sandbox.stub().resolves(),
        update: sandbox.stub().resolves(),
        create: sandbox.stub().resolves()
      },
      memberDesignStatsItem: {
        delete: sandbox.stub().resolves(),
        update: sandbox.stub().resolves(),
        create: sandbox.stub().resolves()
      },
      memberDataScienceStatsItem: {
        delete: sandbox.stub().resolves(),
        update: sandbox.stub().resolves(),
        create: sandbox.stub().resolves()
      },
      memberCopilotStatsItem: {
        delete: sandbox.stub().resolves(),
        update: sandbox.stub().resolves(),
        create: sandbox.stub().resolves()
      },
      memberStats: {
        update: sandbox.stub().resolves(mockStats)
      }
    };
    sandbox.stub(prisma, '$transaction').callsFake(async fn => fn(tx));
    sandbox.stub(require('../../src/common/prismaHelper'), 'buildStatsResponse').returns({ id: 1 });

    const result = await StatisticsService.updateMemberStats({ handle: 'admin' }, 'testuser', updatePayload);
    expect(result).to.have.property('id', 1);
    expect(tx.memberDevelopStatsItem.update.calledOnce).to.be.true;
    expect(tx.memberDevelopStatsItem.create.calledOnce).to.be.true;
    expect(tx.memberDevelopStatsItem.delete.notCalled).to.be.true;
    expect(tx.memberDesignStatsItem.update.calledOnce).to.be.true;
    expect(tx.memberDesignStatsItem.create.notCalled).to.be.true;
    expect(tx.memberDesignStatsItem.delete.notCalled).to.be.true;
    expect(tx.memberDataScienceStatsItem.update.calledOnce).to.be.true;
    expect(tx.memberDataScienceStatsItem.create.notCalled).to.be.true;
    expect(tx.memberDataScienceStatsItem.delete.notCalled).to.be.true;
    expect(tx.memberCopilotStatsItem.update.calledOnce).to.be.true;
    expect(tx.memberCopilotStatsItem.create.notCalled).to.be.true;
    expect(tx.memberCopilotStatsItem.delete.notCalled).to.be.true;
  });

  it('should throw NotFoundError if stats record not found', async () => {
    sandbox.stub(helper, 'getMemberByHandle').resolves(mockMember);
    sandbox.stub(helper, 'canManageMember').returns(true);
    sandbox.stub(prisma.memberStats, 'findFirst').resolves(null);
    await expect(
      StatisticsService.updateMemberStats({ handle: 'admin' }, 'testuser', updatePayload)
    ).to.be.rejectedWith(errors.NotFoundError);
  });

  it('should throw BadRequestError for invalid data', async () => {
    sandbox.stub(helper, 'getMemberByHandle').resolves(mockMember);
    sandbox.stub(helper, 'canManageMember').returns(true);
    const invalidPayload = { develop: { items: [{}] } }; // missing required fields
    await expect(
      StatisticsService.updateMemberStats({ handle: 'admin' }, 'testuser', invalidPayload)
    ).to.be.rejectedWith(errors.BadRequestError);
  });

  it('should throw ForbiddenError if user cannot manage member', async () => {
    sandbox.stub(helper, 'getMemberByHandle').resolves(mockMember);
    sandbox.stub(helper, 'canManageMember').returns(false);
    await expect(
      StatisticsService.updateMemberStats({ handle: 'notadmin' }, 'testuser', updatePayload)
    ).to.be.rejectedWith(errors.ForbiddenError);
  });
}); 