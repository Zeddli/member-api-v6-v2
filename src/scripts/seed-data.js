const path = require('path');
const fs = require('fs');
const _ = require('lodash');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');
const prisma = require('../common/prisma').getClient();

const OUTPUT_DIR = config.fileLocation;
const handleList = config.handleList;

const memberBasicData = [
  'userId',
  'handle',
  'handleLower',
  'email',
  'verified',
  'skillScore',
  'firstName',
  'lastName',
  'description',
  'otherLangName',
  'newEmail',
  'emailVerifyToken',
  'emailVerifyTokenDate',
  'newEmailVerifyToken',
  'newEmailVerifyTokenDate',
  'homeCountryCode',
  'competitionCountryCode',
  'photoURL',
  'tracks',
  'loginCount',
  'lastLoginDate',
  'availableForGigs',
  'skillScoreDeduction',
  'namesAndHandleAppearance'
];

const createdBy = 'migration';

function readDate(milliseconds) {
  return milliseconds ? new Date(milliseconds) : null;
}

function buildMemberData(memberData, prismaData) {
  // pick basic data
  _.assign(prismaData, _.pick(memberData, memberBasicData));
  // set status
  prismaData.status = memberData.status;
  // set mock emails
  prismaData.email = `${memberData.handle}@topcoder.com`;
  // set createdAt, updatedAt
  prismaData.createdAt = readDate(memberData.createdAt);
  prismaData.updatedAt = readDate(memberData.updatedAt);
  prismaData.createdBy = memberData.createdBy ?? createdBy;
  // set max rating
  const maxRatingData = {
    ...memberData.maxRating,
    createdBy: createdBy
  };
  maxRatingData.track = maxRatingData.track ?? '';
  maxRatingData.subTrack = maxRatingData.subTrack ?? '';
  prismaData.maxRating = { create: maxRatingData };
  const addressList = _.map(_.get(memberData, 'addresses', []), t => ({
    ...t,
    type: t.type ?? '',
    createdAt: prismaData.createdAt,
    createdBy,
  }));
  if (addressList.length > 0) {  
    prismaData.addresses = {
      create: addressList
    };
  }
}


async function createSkillData(memberData) {
  // use upsert to create skill, skillLevel, displayMode, skillCategory
  if (!memberData.skills || memberData.skills.length === 0) {
    return;
  }
  for (let skillData of memberData.skills) {
    await prisma.skillCategory.upsert({
      create: { id: skillData.category.id, name: skillData.category.name, createdBy },
      update: { name: skillData.category.name },
      where: { id: skillData.category.id }
    });
    if (_.get(skillData, 'displayMode.id')) {
      await prisma.displayMode.upsert({
        create: { id: skillData.displayMode.id, name: skillData.displayMode.name, createdBy },
        update: { name: skillData.displayMode.name, },
        where: { id: skillData.displayMode.id }
      });
    }
    for (let level of skillData.levels) {
      await prisma.skillLevel.upsert({
        create: { id: level.id, name: level.name, description: level.description, createdBy },
        update: { name: level.name, description: level.description, },
        where: { id: level.id }
      });
    }
    await prisma.skill.upsert({
      create: { 
        id: skillData.id, name: skillData.name, createdBy,
        category: { connect: { id: skillData.category.id } }
      },
      update: { name: skillData.name },
      where: { id: skillData.id }
    });
  }
}

function buildDevelopStatsData(jsonData) {
  const ret = {
    challenges: jsonData.challenges,
    wins: jsonData.wins,
    mostRecentSubmission: readDate(jsonData.mostRecentSubmission),
    mostRecentEventDate: readDate(jsonData.mostRecentEventDate),
    createdBy,
  };
  const itemData = jsonData.subTracks;
  const items = _.map(itemData, t => ({
    name: t.name,
    subTrackId: t.id,
    challenges: t.challenges,
    wins: t.wins,
    mostRecentSubmission: readDate(t.mostRecentSubmission),
    mostRecentEventDate: readDate(t.mostRecentEventDate),
    ...t.submissions,
    ...t.rank,
    createdBy,
  }));
  if (items.length > 0) {
    ret.items = { create: items };
  }
  return ret;
}

const designStatsItemFields = [
  'name', 'challenges', 'wins', 'numInquiries', 'submissions', 'passedScreening',
  'avgPlacement', 'screeningSuccessRate', 'submissionRate', 'winPercent'
]

function buildDesignStatsData(jsonData) {
  const ret = {
    challenges: jsonData.challenges,
    wins: jsonData.wins,
    mostRecentSubmission: readDate(jsonData.mostRecentSubmission),
    mostRecentEventDate: readDate(jsonData.mostRecentEventDate),
    createdBy
  };
  const itemData = jsonData.subTracks;
  const items = _.map(itemData, t => ({
    subTrackId: t.id,
    mostRecentSubmission: readDate(t.mostRecentSubmission),
    mostRecentEventDate: readDate(t.mostRecentEventDate),
    ..._.pick(t, designStatsItemFields),
    createdBy,
  }));
  if (items.length > 0) {
    ret.items = { create: items };
  }
  return ret;
}

function buildSrmData(jsonData) {
  // missing 'mostRecentEventName'
  const prismaData = {
    ..._.pick(jsonData, ['challenges', 'wins', 'mostRecentEventName']),
    mostRecentSubmission: readDate(jsonData.mostRecentSubmission),
    mostRecentEventDate: readDate(jsonData.mostRecentEventDate),
    ...jsonData.rank,
    createdBy,
  };
  if (jsonData.challengeDetails && jsonData.challengeDetails.length > 0) {
    const items = _.map(jsonData.challengeDetails, t => ({
      ...t,
      createdBy,
    }));
    prismaData.challengeDetails = { create: items };
  }
  // check division data
  if (jsonData.division2 && jsonData.division2.length > 0) {
    let items = _.map(jsonData.division2, t => ({
      ...t,
      divisionName: 'division2',
      createdBy,
    }));
    if (jsonData.division1 && jsonData.division1.length > 0) {
      const newItems = _.map(jsonData.division1, t => ({
        ...t,
        divisionName: 'division1',
        createdBy,
      }));
      items = _.concat(items, newItems);
    }
    prismaData.divisions = { create: items };
  }
  return prismaData;
}

function buildMarathonData(jsonData) {
  // missing 'mostRecentEventName'
  return {
    ..._.pick(jsonData, ['challenges', 'wins', 'mostRecentEventName']),
    mostRecentSubmission: readDate(jsonData.mostRecentSubmission),
    mostRecentEventDate: readDate(jsonData.mostRecentEventDate),
    ...jsonData.rank,
    createdBy,
  };
}

async function createSkills(memberData) {
  // set skills
  const memberSkillData = [];
  const memberSkillLevels = [];
  if (!memberData.skills || memberData.skills.length === 0) {
    return;
  }
  for (let skillData of memberData.skills) {
    const memberSkillId = uuidv4();
    const memberSkill = {
      id: memberSkillId,
      userId: memberData.userId,
      skillId: skillData.id,
      createdBy,
    };
    if (skillData.displayMode) {
      memberSkill.displayModeId = skillData.displayMode.id;
    }
    memberSkillData.push(memberSkill);
    for (let level of skillData.levels) {
      memberSkillLevels.push({
        memberSkillId,
        skillLevelId: level.id,
        createdBy,
      });
    }
  }

  await prisma.memberSkill.createMany({
    data: memberSkillData
  });

  await prisma.memberSkillLevel.createMany({
    data: memberSkillLevels
  })
}

async function createStats(memberData, maxRatingId) {
  let statsData = {};
  if (memberData.stats && memberData.stats.length > 0) {
    statsData = memberData.stats[0];
  }
  if (!statsData.userId) {
    return;
  }
  const prismaData = {
    member: { connect: { userId: memberData.userId } },
    maxRating: { connect: { id: maxRatingId } },
    challenges: statsData.challenges,
    wins: statsData.wins,
    createdBy,
  };
  if (_.get(statsData, 'COPILOT.contests')) {
    prismaData.copilot = {
      create: { ...statsData.COPILOT, createdBy }
    };
  }
  if (_.get(statsData, 'DEVELOP.challenges')) {
    const developData = buildDevelopStatsData(statsData.DEVELOP);
    prismaData.develop = { create: developData  };
  }
  if (_.get(statsData, 'DESIGN.challenges')) {
    const designData = buildDesignStatsData(statsData.DESIGN);
    prismaData.design = { create: designData };
  }
  if (_.get(statsData, 'DATA_SCIENCE.challenges')) {
    const dataScienceData = {
      challenges: statsData.DATA_SCIENCE.challenges,
      wins: statsData.DATA_SCIENCE.wins,
      // mostRecentEventName: statsData.DATA_SCIENCE.mostRecentEventName,
      mostRecentSubmission: readDate(statsData.DATA_SCIENCE.mostRecentSubmission),
      mostRecentEventDate: readDate(statsData.DATA_SCIENCE.mostRecentEventDate),
      createdBy,
    };
    if (_.get(statsData, 'DATA_SCIENCE.SRM.challenges')) {
      const jsonData = statsData.DATA_SCIENCE.SRM;
      dataScienceData.srm = { create: buildSrmData(jsonData) };
    }
    if (_.get(statsData, 'DATA_SCIENCE.MARATHON_MATCH.challenges')) {
      const jsonData = statsData.DATA_SCIENCE.MARATHON_MATCH;
      dataScienceData.marathon = { create: buildMarathonData(jsonData) };
    }
    prismaData.dataScience = { create: dataScienceData };
  }

  await prisma.memberStats.create({
    data: prismaData
  });
}

async function importMember(handle) {
  console.log(`Import member data for ${handle}`);
  const filename = path.join(OUTPUT_DIR, `${handle}.json`);
  const rawData = fs.readFileSync(filename, 'utf8');
  const dataList = JSON.parse(rawData);
  const memberData = _.find(dataList, t => t.handle === handle);
  if (!memberData) {
    console.log(`Can\'t find member data for user ${handle}`);
    return;
  }
  // get skill data and create them
  await createSkillData(memberData);
  // build prisma data structure for this member
  const prismaData = {};
  buildMemberData(memberData, prismaData);

  const member = await prisma.member.create({
    data: prismaData,
    include: {
      maxRating: true
    }
  });
  
  await createStats(memberData, member.maxRating.id);
  await createSkills(memberData);
  console.log(`Import member data complete for ${handle}`);
}

async function main() {
  for (let handle of handleList) {
    await importMember(handle);
  }
  console.log('All done');
}

main();
