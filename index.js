const Domain = require('./Domain');
const Collection = require('./Collecton--puppeteer');
const fs = require('fs');

// Get list of target site roots

// Per target open thread

// TASKS

// Domain
// Create object
// Set name from passing argument
// Query script tags and find DL then regex for DL version
// Set the date

// Path collector
// Create the pages and paths objects
// Crawl the page for links add to an array
// de-dupe
// Remove anything not in the same domain

// Selector collector
// Create the selector object
// Per page collect all the classes
// Create an object with the keys as classes
// For every class increment a numeric value on that matching key


const result = {
    domain: 'name',
    DL_version: '8.4.0',
    date: '04/08/18',
    pages: 388,
    paths: [],
    selectors: {
        match: {
            'rc-alpha': 4
        },
        not_matching: {
            'boot-strap': 1
        }
    }
};

// const domains = ['https://www.royalcanin.com'];
const domains = ['http://developer.royalcanin.com'];
const DLassetUrl = 'd3moonnr9fkxfg.cloudfront.net';
const styleGuide = 'http://developer.royalcanin.com/test.html';
process.setMaxListeners(Infinity); // Set max listeners to Infinity as we're going to firing up a lot of browsers.


//exports.handler =
(async (event, context, callback) => {
    // Wrap the main method in a try/catch block.
    // Prevents UncaughtPromiseRejection.
    try {
        Promise.all(domains.map((url) => {
          const collector = new Collection(url);
          const domain = new Domain(url, DLassetUrl, styleGuide, collector);
          const results = domain.gotoDomain();
          results.catch(console.log);
          return results;
        }))
            .then(function(values) {
                console.log('Returned domain result: ', values);
                const json = JSON.stringify(values);
              fs.writeFile('results.json', json, (err) => {
                if (err) throw err;
                console.log('The file has been saved!');
              });
            })
            .catch(function(err) {
                console.log(err.message); // some coding error in handling happened
            });

        // Return result to the caller.
        //callback(null, result);
    } catch (err) {
        // Throws an error to the caller.
        //callback(err);
        console.log(err);
    }
})();
