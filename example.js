'use strict';

const puppeteer = require('puppeteer-core'); // eslint-disable-line import/no-extraneous-dependencies
const { Instauto, FileDbAdapter } = require('./lib/index.js'); // eslint-disable-line import/no-unresolved
const chromePaths = require('chrome-paths');

const options = {
  cookiesPath: './cookies.json',

  username: 'your_ig_username',
  password: 'your_ig_pass',

  // Global limit that prevents follow or unfollows (total) to exceed this number over a sliding window of one hour:
  maxFollowsPerHour: 20,
  // Global limit that prevents follow or unfollows (total) to exceed this number over a sliding window of one day:
  maxFollowsPerDay: 150,
  // (NOTE setting the above parameters too high will cause temp ban/throttle)

  maxLikesPerDay: 50,

  // Don't follow users that have a followers / following ratio less than this:
  followUserRatioMin: 0.2,
  // Don't follow users that have a followers / following ratio higher than this:
  followUserRatioMax: 4.0,
  // Don't follow users who have more followers than this:
  followUserMaxFollowers: null,
  // Don't follow users who have more people following them than this:
  followUserMaxFollowing: null,
  // Don't follow users who have less followers than this:
  followUserMinFollowers: null,
  // Don't follow users who have more people following them than this:
  followUserMinFollowing: null,

  // NOTE: The dontUnfollowUntilTimeElapsed option is ONLY for the unfollowNonMutualFollowers function
  // This specifies the time during which the bot should not touch users that it has previously followed (in milliseconds)
  // After this time has passed, it will be able to unfollow them again.
  // TODO should remove this option from here
  dontUnfollowUntilTimeElapsed: 3 * 24 * 60 * 60 * 1000,

  // Usernames that we should not touch, e.g. your friends and actual followings
  excludeUsers: [],

  // If true, will not do any actions (defaults to true)
  dryRun: true,
};

(async () => {
  let browser;

  try {
    const chromePath = chromePaths.chrome;
    browser = await puppeteer.launch({ headless: false, executablePath: chromePath });

    // Create a database where state will be loaded/saved to
    const instautoDb = new FileDbAdapter({
      // Will store a list of all users that have been followed before, to prevent future re-following.
      followedDbPath: './followed.json',
      // Will store all unfollowed users here
      unfollowedDbPath: './unfollowed.json',
      // Will store all likes here
      likedPhotosDbPath: './liked-photos.json',
    });

    const instauto = await Instauto(instautoDb, browser, options, {
      settingInstagramLanguage: 'Réglage de la langue sur l\'anglais',
    });

    // This can be used to unfollow people:
    // Will unfollow auto-followed AND manually followed accounts who are not following us back, after some time has passed
    // The time is specified by config option dontUnfollowUntilTimeElapsed
    // await instauto.unfollowNonMutualFollowers();
    // await instauto.sleep(10 * 60 * 1000);

    // Unfollow previously auto-followed users (regardless of whether or not they are following us back)
    // after a certain amount of days (2 weeks)
    // Leave room to do following after this too (unfollow 2/3 of maxFollowsPerDay)
    const unfollowedCount = await instauto.unfollowOldFollowed({ ageInDays: 14, limit: options.maxFollowsPerDay * (2 / 3) });

    if (unfollowedCount > 0) await instauto.sleep(10 * 60 * 1000);

    // List of usernames that we should follow the followers of, can be celebrities etc.
    const usersToFollowFollowersOf = ['lostleblanc', 'sam_kolder'];

    // Now go through each of these and follow a certain amount of their followers
    await instauto.followUsersFollowers({
      usersToFollowFollowersOf,
      maxFollowsTotal: options.maxFollowsPerDay - unfollowedCount,
      skipPrivate: true,
      enableLikeImages: true,
      likeImagesMax: 3,
    });

    await instauto.sleep(10 * 60 * 1000);

    console.log('Done running');

    await instauto.sleep(30000);
  } catch (err) {
    console.error(err);
  } finally {
    console.log('Closing browser');
    if (browser) await browser.close();
  }
})();
