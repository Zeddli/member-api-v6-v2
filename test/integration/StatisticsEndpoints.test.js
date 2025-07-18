const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const expect = chai.expect;
const request = require('supertest');
const app = require('../../src/app'); // Adjust if your express app is exported elsewhere
const seedTestData = require('../scripts/seed-testdata-api');
const prisma = require('../../src/common/prisma').getClient();

// Helper: seed and cleanup
async function resetDb() {
  await prisma.$executeRaw`TRUNCATE TABLE "memberHistoryStats" RESTART IDENTITY CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "memberStats" RESTART IDENTITY CASCADE`;
  // Add more tables as needed
  await seedTestData();
}

describe('Statistics Endpoints Integration', function () {
  this.timeout(10000);

  before(async () => {
    await resetDb();
  });

  after(async () => {
    // Optionally clean up
    await resetDb();
  });

  describe('POST /members/:handle/stats/history', () => {
    it('should create stats history for a valid member', async () => {
      const payload = {
        develop: [
          {
            challengeId: 999,
            challengeName: 'Integration Challenge',
            ratingDate: '2023-01-01',
            newRating: 1700,
            subTrack: 'SRM',
            subTrackId: 1
          }
        ]
      };
      const res = await request(app)
        .post('/members/testuser/stats/history')
        .send(payload)
        .set('Authorization', 'Bearer testtoken'); // Adjust auth as needed
      expect(res.status).to.equal(201);
      expect(res.body).to.have.property('develop');
      expect(res.body.develop[0]).to.include({ challengeName: 'Integration Challenge' });
    });
  });

  describe('PATCH /members/:handle/stats/history', () => {
    it('should update stats history for a valid member', async () => {
      // First, create a history record to update
      const createPayload = {
        develop: [
          {
            challengeId: 1000,
            challengeName: 'Patch Challenge',
            ratingDate: '2023-02-01',
            newRating: 1800,
            subTrack: 'SRM',
            subTrackId: 2
          }
        ]
      };
      await request(app)
        .post('/members/testuser/stats/history')
        .send(createPayload)
        .set('Authorization', 'Bearer testtoken');

      // Now, patch the record
      const patchPayload = {
        develop: [
          {
            challengeId: 1000,
            challengeName: 'Patched Challenge',
            ratingDate: '2023-02-01',
            newRating: 1850,
            subTrack: 'SRM',
            subTrackId: 2
          }
        ]
      };
      const res = await request(app)
        .patch('/members/testuser/stats/history')
        .send(patchPayload)
        .set('Authorization', 'Bearer testtoken');
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('develop');
      expect(res.body.develop[0]).to.include({ challengeName: 'Patched Challenge' });
    });
  });

  describe('POST /members/:handle/stats', () => {
    it('should create member stats for a valid member', async () => {
      const payload = {
        challenges: 10,
        wins: 3,
        develop: {
          challenges: 5,
          wins: 2,
          mostRecentSubmission: '2023-03-01',
          mostRecentEventDate: '2023-03-02',
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
      const res = await request(app)
        .post('/members/testuser/stats')
        .send(payload)
        .set('Authorization', 'Bearer testtoken');
      expect(res.status).to.equal(201);
      expect(res.body).to.have.property('develop');
      expect(res.body.develop).to.have.property('items');
      expect(res.body.develop.items[0]).to.include({ name: 'SRM' });
    });
  });

  describe('PATCH /members/:handle/stats', () => {
    it('should update member stats for a valid member', async () => {
      // First, create a stats record to update
      const createPayload = {
        challenges: 5,
        wins: 2,
        develop: {
          challenges: 3,
          wins: 1,
          mostRecentSubmission: '2023-04-01',
          mostRecentEventDate: '2023-04-02',
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
      await request(app)
        .post('/members/testuser/stats')
        .send(createPayload)
        .set('Authorization', 'Bearer testtoken');

      // Now, patch the record
      const patchPayload = {
        develop: {
          items: [
            {
              name: 'SRM Patched',
              subTrackId: 1,
              challenges: 3,
              wins: 2
            }
          ]
        }
      };
      const res = await request(app)
        .patch('/members/testuser/stats')
        .send(patchPayload)
        .set('Authorization', 'Bearer testtoken');
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('develop');
      expect(res.body.develop).to.have.property('items');
      expect(res.body.develop.items[0]).to.include({ name: 'SRM Patched' });
    });
  });

  describe('Error and Edge Cases', () => {
    it('should return 404 for non-existent member on POST /members/:handle/stats/history', async () => {
      const payload = {
        develop: [
          {
            challengeId: 999,
            challengeName: 'Integration Challenge',
            ratingDate: '2023-01-01',
            newRating: 1700,
            subTrack: 'SRM',
            subTrackId: 1
          }
        ]
      };
      const res = await request(app)
        .post('/members/nonexistentuser/stats/history')
        .send(payload)
        .set('Authorization', 'Bearer testtoken');
      expect(res.status).to.equal(404);
    });

    it('should return 400 for invalid payload on POST /members/:handle/stats/history', async () => {
      const payload = { develop: [{}] }; // missing required fields
      const res = await request(app)
        .post('/members/testuser/stats/history')
        .send(payload)
        .set('Authorization', 'Bearer testtoken');
      expect(res.status).to.equal(400);
    });

    it('should return 403 for missing token on POST /members/:handle/stats/history', async () => {
      const payload = {
        develop: [
          {
            challengeId: 999,
            challengeName: 'Integration Challenge',
            ratingDate: '2023-01-01',
            newRating: 1700,
            subTrack: 'SRM',
            subTrackId: 1
          }
        ]
      };
      const res = await request(app)
        .post('/members/testuser/stats/history')
        .send(payload);
      expect(res.status).to.equal(403);
    });

    it('should return 404 for non-existent member on PATCH /members/:handle/stats/history', async () => {
      const payload = { develop: [] };
      const res = await request(app)
        .patch('/members/nonexistentuser/stats/history')
        .send(payload)
        .set('Authorization', 'Bearer testtoken');
      expect(res.status).to.equal(404);
    });

    it('should return 400 for invalid payload on PATCH /members/:handle/stats/history', async () => {
      const payload = { develop: [{}] };
      const res = await request(app)
        .patch('/members/testuser/stats/history')
        .send(payload)
        .set('Authorization', 'Bearer testtoken');
      expect(res.status).to.equal(400);
    });

    it('should return 403 for missing token on PATCH /members/:handle/stats/history', async () => {
      const payload = { develop: [] };
      const res = await request(app)
        .patch('/members/testuser/stats/history')
        .send(payload);
      expect(res.status).to.equal(403);
    });

    it('should return 404 for non-existent member on POST /members/:handle/stats', async () => {
      const payload = { challenges: 1, wins: 0, develop: { items: [] }, design: { items: [] }, dataScience: { items: [] }, copilot: { items: [] } };
      const res = await request(app)
        .post('/members/nonexistentuser/stats')
        .send(payload)
        .set('Authorization', 'Bearer testtoken');
      expect(res.status).to.equal(404);
    });

    it('should return 400 for invalid payload on POST /members/:handle/stats', async () => {
      const payload = { develop: { items: [{}] } };
      const res = await request(app)
        .post('/members/testuser/stats')
        .send(payload)
        .set('Authorization', 'Bearer testtoken');
      expect(res.status).to.equal(400);
    });

    it('should return 403 for missing token on POST /members/:handle/stats', async () => {
      const payload = { challenges: 1, wins: 0, develop: { items: [] }, design: { items: [] }, dataScience: { items: [] }, copilot: { items: [] } };
      const res = await request(app)
        .post('/members/testuser/stats')
        .send(payload);
      expect(res.status).to.equal(403);
    });

    it('should return 404 for non-existent member on PATCH /members/:handle/stats', async () => {
      const payload = { develop: { items: [] } };
      const res = await request(app)
        .patch('/members/nonexistentuser/stats')
        .send(payload)
        .set('Authorization', 'Bearer testtoken');
      expect(res.status).to.equal(404);
    });

    it('should return 400 for invalid payload on PATCH /members/:handle/stats', async () => {
      const payload = { develop: { items: [{}] } };
      const res = await request(app)
        .patch('/members/testuser/stats')
        .send(payload)
        .set('Authorization', 'Bearer testtoken');
      expect(res.status).to.equal(400);
    });

    it('should return 403 for missing token on PATCH /members/:handle/stats', async () => {
      const payload = { develop: { items: [] } };
      const res = await request(app)
        .patch('/members/testuser/stats')
        .send(payload);
      expect(res.status).to.equal(403);
    });
  });
}); 