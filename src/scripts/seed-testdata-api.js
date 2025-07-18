/**
 * Script to seed the database with test data from test_data_api.json for member stats endpoints.
 * This script is idempotent: it clears existing data for each userId before inserting new data.
 */
const fs = require('fs')
const path = require('path')
const _ = require('lodash')
const prisma = require('../common/prisma').getClient()
const createdBy = 'testdata-seed'

function readDate(ms) {
  return ms ? new Date(ms) : null
}

async function clearMemberData(userId) {
  // Delete stats, stats history, skills, traits, addresses, etc. for the member
  await prisma.memberStats.deleteMany({ where: { userId } })
  await prisma.memberHistoryStats.deleteMany({ where: { userId } })
  await prisma.memberSkill.deleteMany({ where: { userId } })
  await prisma.memberTraits.deleteMany({ where: { userId } })
  await prisma.memberAddress.deleteMany({ where: { userId } })
  await prisma.memberMaxRating.deleteMany({ where: { userId } })
  await prisma.member.deleteMany({ where: { userId } })
}

async function seedMember(member) {
  await clearMemberData(member.userId)
  // Create member and related maxRating, addresses
  const memberData = {
    userId: member.userId,
    handle: member.handle,
    handleLower: member.handleLower,
    email: `${member.handle}@topcoder.com`,
    verified: member.verified || false,
    firstName: member.firstName,
    lastName: member.lastName,
    status: member.status,
    homeCountryCode: member.homeCountryCode,
    competitionCountryCode: member.competitionCountryCode,
    photoURL: member.photoURL,
    tracks: member.tracks,
    createdAt: readDate(member.createdAt) || new Date(),
    updatedAt: readDate(member.updatedAt) || new Date(),
    createdBy,
    addresses: { create: (member.addresses || []).map(addr => ({ ...addr, type: addr.type || '', createdBy })) },
    maxRating: member.maxRating ? { create: { 
      ...member.maxRating,
      track: member.maxRating.track || '',
      subTrack: member.maxRating.subTrack || '',
      createdBy 
    } } : undefined
  }
  const createdMember = await prisma.member.create({ data: memberData, include: { maxRating: true } })
  // Seed stats
  if (member.stats && member.stats.length > 0) {
    for (const stats of member.stats) {
      const statsData = {
        userId: member.userId,
        challenges: stats.challenges,
        wins: stats.wins,
        createdBy,
        memberRatingId: createdMember.maxRating ? createdMember.maxRating.id : undefined,
        develop: stats.DEVELOP ? {
          create: {
            challenges: stats.DEVELOP.challenges,
            wins: stats.DEVELOP.wins,
            createdBy,
            items: stats.DEVELOP.subTracks && stats.DEVELOP.subTracks.length > 0 ? {
              create: stats.DEVELOP.subTracks.map(st => ({
                name: st.name,
                subTrackId: st.id,
                challenges: st.challenges,
                wins: st.wins,
                createdBy
              }))
            } : undefined
          }
        } : undefined,
        design: stats.DESIGN ? {
          create: {
            challenges: stats.DESIGN.challenges,
            wins: stats.DESIGN.wins,
            createdBy,
            items: stats.DESIGN.subTracks && stats.DESIGN.subTracks.length > 0 ? {
              create: stats.DESIGN.subTracks.map(st => ({
                name: st.name,
                subTrackId: st.id,
                challenges: st.challenges,
                wins: st.wins,
                createdBy
              }))
            } : undefined
          }
        } : undefined,
        dataScience: stats.DATA_SCIENCE ? {
          create: {
            challenges: stats.DATA_SCIENCE.challenges,
            wins: stats.DATA_SCIENCE.wins,
            createdBy
          }
        } : undefined
      }
      await prisma.memberStats.create({ data: statsData })
    }
  }
  // TODO: Seed stats history if present in member object
}

async function main() {
  const filePath = path.join(__dirname, '../../test_data_api.json')
  const raw = fs.readFileSync(filePath, 'utf8')
  const members = JSON.parse(raw)
  let success = 0, failed = 0
  for (const member of members) {
    try {
      await seedMember(member)
      console.log(`Seeded member ${member.handle}`)
      success++
    } catch (err) {
      console.error(`Failed to seed member ${member.handle}:`, err)
      failed++
    }
  }
  console.log(`Seeding complete. Success: ${success}, Failed: ${failed}`)
}

main().catch(e => { console.error(e); process.exit(1) }) 