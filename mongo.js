// Function to check if the message has already been sent to the given number
async function isMessageAlreadySent(clientMongo, databaseName, collectionName, phoneNumber) {
    const collection = clientMongo.db(databaseName).collection(collectionName);
    const result = await collection.findOne({ phoneNumber });
    return result !== null;
}

// Function to save/update the sent message to the MongoDB collection
async function saveMessageToMongoDB(clientMongo, databaseName, collectionName, mb, phoneNumber, groupName) {
    //disable this function
    return;
    const collection = clientMongo.db(databaseName).collection(collectionName);

    const existingDocument = await collection.findOne({ phoneNumber });
    
    if (existingDocument) {
        // If the user exists, update the list of groups
        if (!existingDocument.groups.includes(groupName)) {
            await collection.updateOne(
                { _id: existingDocument._id },
                { $push: { groups: groupName } }
            );
        }
    } else {
        // If not, insert a new document
        await collection.insertOne({
            mb,
            phoneNumber,
            dateSent: new Date(),
            groups: [groupName]
        });
    }
}

module.exports = {
    isMessageAlreadySent,
    saveMessageToMongoDB
};
