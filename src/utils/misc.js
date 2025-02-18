async function convertTimestampToDate(timestamp) {
    let date = new Date(timestamp * 1000);
    return date;
}

export { convertTimestampToDate };
