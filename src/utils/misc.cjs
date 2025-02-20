async function convertTimestampToDate(timestamp) {
  const date = new Date(timestamp * 1000);
  return date;
}

module.exports = { convertTimestampToDate };
