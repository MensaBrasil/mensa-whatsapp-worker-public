/**
 * Generates a randomized delay time in milliseconds with an offset
 * @param {number} time - Base delay time in minutes
 * @param {number} offset - Maximum random offset in minutes (both positive and negative)
 * @returns {number} Final delay time in milliseconds, minimum 0
 */
function getRandomizedDelay(time, offset = 3) {
  const randomOffset = Math.floor((Math.random() * (offset * 2) - offset) * 60);
  return Math.max(0, (time * 60 * 1000) + (randomOffset * 1000));
}

/**
* Creates a delay with a countdown display in the console
* @param {number} time - The base delay time in minutes
* @param {number} offset - The random offset range in minutes to add/subtract from base time
* @returns {Promise<void>} A promise that resolves after the delay
* @example
* // Wait for 5 min ±3 min
* await delay(5, 3);
*/
async function delay(time, offset) {
  const delayTime = getRandomizedDelay(time, offset);
  let remainingTime = delayTime / 1000;

  console.log(`Waiting for ${remainingTime} seconds...`);
  return new Promise((resolve) => {
      const interval = setInterval(() => {
          remainingTime--;
          process.stdout.write(`\rTime left: ${remainingTime} seconds`);

          if (remainingTime <= 0) {
              process.stdout.write('\n');
              clearInterval(interval);
              resolve();
          }
      }, 1000);
  });
}

export { delay };
