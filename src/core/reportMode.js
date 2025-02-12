async function reportMembersInfo(client, groupNames, phoneNumbersFromDB) {
    let details = {};
    for (const groupName of groupNames) {
        try {
            const groupId = await getGroupIdByName(client, groupName);
            const previousMembers = await getPreviousGroupMembers(groupId);
            const participants = await getGroupParticipants(client, groupId);
            const groupMembers = participants.map(participant => participant.phone);
            const currentMembers = groupMembers.filter(member => checkPhoneNumber(phoneNumbersFromDB, member).found);

            
            for (const member of groupMembers) {
                const checkResult = checkPhoneNumber(phoneNumbersFromDB, member);
                let reason = null;

                if (checkResult.found) {
                    if (!reportMode) {
                        if (!previousMembers.includes(member)) {
                            console.log(`Number ${member}, MB ${checkResult.mb} is new to the group.`);
                            await recordUserEntryToGroup(checkResult.mb, member, groupId, checkResult.status);
                            logAction(groupName, member, 'Entry', 'New to group');
                        }
                    }

                    if (checkResult.is_adult || (checkResult.jb_under_10 && checkResult.jb_over_10)) {
                        if (!reportMode) {
                            console.log(`Skipping JB removal for ${member} (adult or ambiguous JB status).`);
                        }
                    } else {
                        for (const rule of JBRemovalRules) {
                            if (
                                rule.groupCheck(groupName) &&
                                rule.condition(checkResult) &&
                                (removeOnlyMode || addAndRemoveMode || reportMode)
                            ) {
                                if (reportMode) {
                                    console.log(`REPORT: Number ${member}, MB ${checkResult.mb} matches JB removal rule: ${rule.actionMessage} from group ${groupName}`);
                                    if (!details[member]) {
                                        details[member] = {}
                                    }
                                    if (!details[member][rule.actionMessage]) {
                                        details[member][rule.actionMessage] = { 'groups': [] }
                                    }
                                    details[member][rule.actionMessage]['groups'].push(groupName);
                                } else {
                                    console.log(`Removing ${member} (${rule.actionMessage}) from ${groupName}.`);
                                    if (!scanMode && !reportMode) {
                                        const removed = await removeParticipantByPhoneNumber(client, groupId, member);
                                        if (removed) {
                                            logAction(groupName, member, 'Removal', rule.actionMessage);
                                            await recordUserExitFromGroup(member, groupId, rule.actionMessage);
                                            await delay(300000);
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if (checkResult.status === 'Inactive' && (removeOnlyMode || addAndRemoveMode || reportMode)) {
                        if (reportMode) {
                            console.log(`REPORT: Number ${member}, MB ${checkResult.mb} is inactive in group ${groupName}`);
                            if (!details[member]) {
                                details[member] = {}
                            }
                            if (!details[member]['inactive']) {
                                details[member]['inactive'] = { 'groups': [] }
                            }
                            details[member]['inactive']['groups'].push(groupName);
                        }
                        if (!scanMode && !reportMode) {
                            console.log(`Number ${member}, MB ${checkResult.mb} is inactive.`);
                            const shouldRemove = await triggerTwilioOrRemove(member, "mensa_inactive");
                            if (shouldRemove) {
                                const removed = await removeParticipantByPhoneNumber(client, groupId, member);
                                if (removed) {
                                    reason = 'Inactive';
                                    logAction(groupName, member, 'Removal', reason);
                                    await delay(300000);
                                }
                            }
                        }
                    }
                } else {
                    if (member !== '+33681604260' && member !== '18653480874' && member !== '36705346911' && member !== '351926855059' && member !== '447863603673' && member !== '4915122324805' && member !== '62999552046' && member !== '15142676652' && member !== "556299552046" && member !== '447782796843' && member !== '555496875059' && member !== '34657489744' && member !== '5511914206718' && (removeOnlyMode || addAndRemoveMode)) {
                        if (reportMode) {
                            console.log(`REPORT: Number ${member}, MB ${checkResult.mb} is not found in the database in group ${groupName}`);
                            if (!details[member]) {
                                details[member] = {}
                            }
                            if (!details[member]['not_found']) {
                                details[member]['not_found'] = { 'groups': [] }
                            }
                            details[member]['not_found']['groups'].push(groupName);
                        }
                        if (!scanMode && !reportMode) {
                            console.log(`Number ${member} not found in the database.`);
                            const shouldRemove = await triggerTwilioOrRemove(member, "mensa_not_found");
                            if (shouldRemove) {
                                const removed = await removeParticipantByPhoneNumber(client, groupId, member);
                                if (removed) {
                                    reason = 'Not found in database';
                                    logAction(groupName, member, 'Removal', reason);
                                    await delay(300000);
                                }
                            }
                        }
                    }
                }

                if (reason && !reportMode) {
                    if (!scanMode) {
                        await recordUserExitFromGroup(member, groupId, reason);
                    }
                }
            }

        } catch (error) {
            console.log(`Error while creating report in group ${groupName}: ${error}`);
        }
    }
}

module.exports = reportMembersInfo;