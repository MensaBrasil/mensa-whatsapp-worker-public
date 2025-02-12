const JBRemovalRules = [
    {
        groupCheck: (groupName) =>
            groupName.includes("M.JB") &&
            !groupName.includes("R. JB"),
        condition: (checkResult) =>
            checkResult.jb_over_10 && !checkResult.jb_under_10,
        actionMessage: 'User is JB over 10 in M.JB group'
    },
    {
        groupCheck: (groupName) =>
            groupName.includes("JB") &&
            !groupName.includes("M.JB") &&
            !groupName.includes("R. JB"),
        condition: (checkResult) =>
            checkResult.jb_under_10 && !checkResult.jb_over_10,
        actionMessage: 'User is JB under 10 in JB group'
    },
    {
        groupCheck: (groupName) =>
            !groupName.includes("JB") &&
            !jbGroupNames.includes(groupName),
        condition: (checkResult) =>
            checkResult.jb_under_10 || checkResult.jb_over_10,
        actionMessage: 'User is JB in non-JB group',
    },
];

const jbGroupNames = [
    "N-SIGs Mensa Brasil",
    "MB | Xadrez",
];

async function removeMembersFromGroups(client, chats, groups) {

}

module.exports = removeMembersFromGroups;