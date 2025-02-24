const { getWhatsappQueue, getMemberPhoneNumbers } = require('../database/pgsql.cjs');
const { getGroupParticipants } = require('../utils/chat.cjs');
const { checkPhoneNumber } = require('../utils/phone-check.cjs');
const { configDotenv } = require('dotenv');
const fs = require('fs');

configDotenv();

const dont_remove = process.env.DONT_REMOVE_NUMBERS.split(',');

const jbGroupNames = ['MB | N-SIGs Mensa Brasil', 'MB | Xadrez'];

const JBRemovalRules = [
  {
    groupCheck: (groupName) =>
      groupName.includes('M.JB') && !groupName.includes('R. JB'),
    condition: (checkResult) =>
      checkResult.jb_over_10 && !checkResult.jb_under_10,
    actionMessage: 'User is JB over 10 in M.JB group',
  },
  {
    groupCheck: (groupName) =>
      groupName.includes('JB') &&
      !groupName.includes('M.JB') &&
      !groupName.includes('R. JB'),
    condition: (checkResult) =>
      checkResult.jb_under_10 && !checkResult.jb_over_10,
    actionMessage: 'User is JB under 10 in JB group',
  },
  {
    groupCheck: (groupName) =>
      !groupName.includes('JB') && !jbGroupNames.includes(groupName),
    condition: (checkResult) =>
      checkResult.jb_under_10 || checkResult.jb_over_10,
    actionMessage: 'User is JB in non-JB group',
  },
];

async function reportMembersInfo(client, chats, groups, phoneNumbersFromDB) {
  const details = {};
  for (const group of groups) {
    console.log(`Processing report for group ${group.name}`);
    try {
      const groupId = group.id._serialized;
      const conversations = chats.filter((chat) => !chat.isGroup);
      const queue = await getWhatsappQueue(groupId);
      const last8DigitsFromChats = conversations.map((chat) => chat.id.user).map((number) => number.slice(-8));
      const participants = await getGroupParticipants(client, groupId);
      const groupMembers = participants.map((participant) => participant.phone);

      for (const request of queue.rows) {
        try {
          const phones = await getMemberPhoneNumbers(request.registration_id);
          for (const phone of phones) {
            const new_phone = phone.replace(/\D/g, '');
            if (last8DigitsFromChats.includes(new_phone.slice(-8))) {
              if (!details[phone]) {
                details[phone] = {};
              }
              if (!details[phone]['Pending valid additions']) {
                details[phone]['Pending valid additions'] = { groups: [] };
              }
              details[phone]['Pending valid additions']['groups'].push(
                group.name,
              );
            }
          }
        } catch (error) {
          console.error(`Error processing request ${request.id}: ${error.message}`);
        }
      }

      for (const member of groupMembers) {
        const checkResult = checkPhoneNumber(phoneNumbersFromDB, member);

        if (checkResult.found) {
          if (!(checkResult.is_adult || (checkResult.jb_under_10 && checkResult.jb_over_10))) {
            for (const rule of JBRemovalRules) {
              if (rule.groupCheck(group.name) && rule.condition(checkResult)) {
                if (!details[member]) {
                  details[member] = {};
                }
                if (!details[member][rule.actionMessage]) {
                  details[member][rule.actionMessage] = { groups: [] };
                }
                details[member][rule.actionMessage]['groups'].push(group.name);
              }
            }
          } else if (checkResult.status === 'Inactive') {
            if (!details[member]) {
              details[member] = {};
            }
            if (!details[member]['inactive']) {
              details[member]['inactive'] = { groups: [] };
            }
            details[member]['inactive']['groups'].push(group.name);
          }
        } else {
          if (!dont_remove.includes(member)) {
            if (!details[member]) {
              details[member] = {};
            }
            if (!details[member]['not_found']) {
              details[member]['not_found'] = { groups: [] };
            }
            details[member]['not_found']['groups'].push(group.name);
          }
        }
      }
    } catch (error) {
      console.error(`Error processing request in group ${group.name}: ${error.message}`);
    }
  }
  console.log('Summary of report details:');
  let atleast1inactiveCount = 0;
  let atleast1notfoundCount = 0;
  let atleast1JBOver10MJBCount = 0;
  let atleast1JBUnder10JBCount = 0;
  let atleast1JBInNonJBCount = 0;
  let atleast1PendingAdditionsCount = 0;

  let totalInactiveCount = 0;
  let totalNotFoundCount = 0;
  let totalJBOver10MJBCount = 0;
  let totalJBUnder10JBCount = 0;
  let totalJBInNonJBCount = 0;
  let totalPendingAdditionsCount = 0;

  for (const member of Object.keys(details)) {
    if (details[member].inactive) {
      atleast1inactiveCount++;
      totalInactiveCount += details[member].inactive.groups.length;
    }
    if (details[member].not_found) {
      atleast1notfoundCount++;
      totalNotFoundCount += details[member].not_found.groups.length;
    }
    if (details[member]['User is JB over 10 in M.JB group']) {
      atleast1JBOver10MJBCount++;
      totalJBOver10MJBCount +=
        details[member]['User is JB over 10 in M.JB group'].groups.length;
    }
    if (details[member]['User is JB under 10 in JB group']) {
      atleast1JBUnder10JBCount++;
      totalJBUnder10JBCount +=
        details[member]['User is JB under 10 in JB group'].groups.length;
    }
    if (details[member]['User is JB in non-JB group']) {
      atleast1JBInNonJBCount++;
      totalJBInNonJBCount +=
        details[member]['User is JB in non-JB group'].groups.length;
    }
    if (details[member]['Pending valid additions']) {
      atleast1PendingAdditionsCount++;
      totalPendingAdditionsCount +=
        details[member]['Pending valid additions'].groups.length;
    }
  }

  console.log('\n\x1b[1m=== REMOVAL REPORT SUMMARY ===\x1b[0m');
  console.log(`\x1b[36mTotal unique members affected: ${Object.keys(details).length}\x1b[0m\n`);

  console.log('\x1b[1mMember Count by Issue:\x1b[0m');
  console.log(`\x1b[33m• Inactive status: ${atleast1inactiveCount} members (${totalInactiveCount} total occurrences)`);
  console.log(`• Not in database: ${atleast1notfoundCount} members (${totalNotFoundCount} total occurrences)`);
  console.log(`• JB over 10 in M.JB: ${atleast1JBOver10MJBCount} members (${totalJBOver10MJBCount} total occurrences)`);
  console.log(`• JB under 10 in JB: ${atleast1JBUnder10JBCount} members (${totalJBUnder10JBCount} total occurrences)`);
  console.log(`• JB in non-JB: ${atleast1JBInNonJBCount} members (${totalJBInNonJBCount} total occurrences)\x1b[0m\n`);

  console.log('\x1b[1mPending Additions:\x1b[0m');
  console.log(`\x1b[32m• Members awaiting addition: ${atleast1PendingAdditionsCount}`);
  console.log(`• Total pending additions: ${totalPendingAdditionsCount}\x1b[0m\n`);

  details.summary = {
    totalUniqueMembers: Object.keys(details).length,
    issues: {
      inactive: {
        uniqueMembers: atleast1inactiveCount,
        totalOccurrences: totalInactiveCount,
      },
      notFound: {
        uniqueMembers: atleast1notfoundCount,
        totalOccurrences: totalNotFoundCount,
      },
      jbOver10MJB: {
        uniqueMembers: atleast1JBOver10MJBCount,
        totalOccurrences: totalJBOver10MJBCount,
      },
      jbUnder10JB: {
        uniqueMembers: atleast1JBUnder10JBCount,
        totalOccurrences: totalJBUnder10JBCount,
      },
      jbInNonJB: {
        uniqueMembers: atleast1JBInNonJBCount,
        totalOccurrences: totalJBInNonJBCount,
      },
    },
    pendingAdditions: {
      uniqueMembers: atleast1PendingAdditionsCount,
      totalPending: totalPendingAdditionsCount,
    },
  };

  fs.writeFileSync('report_details.json', JSON.stringify(details, null, 2));
  console.log('\x1b[1mDetailed report saved to:\x1b[0m \x1b[36mreport_details.json\x1b[0m');
}

module.exports = { reportMembersInfo };
