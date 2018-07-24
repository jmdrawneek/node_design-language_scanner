const puppeteer = require('puppeteer');

module.exports = class Domain {
    // Domain
    // Create object
    // Set name from passing argument
    // Query script tags and find DL then regex for DL version
    // Set the date

    constructor(url, DLurl, styleGuide) {
        this.url = url;
        this.DLurl = DLurl;
        this.styleGuide = styleGuide;
        this.DLversion = null;
        this.puppeteer = puppeteer;
        this.urls = [url];
        this.DLselectors = [];

        this.result = {
            domain: url,
            date: Date.now(),
            version: this.DLversion,
            urls: this.urls,
            selectors: {
                match: [],
                not_match: []
            }
        };

    }

    gotoDomain() {
        return new Promise(async (resolve, reject) => {

            this.browser = await this.puppeteer.launch();
            this.page = await this.browser.newPage();
            // Get the selectors to compare to.
            await this.getDLselectors();

            console.log('this.url', this.url);
            // Start by getting the DL version.
            // Add the protocol here as lots of links don't include it but it's required for chrome.
            await this.page.goto('http://' + this.url);
            const localDLurl = this.DLurl;
            this.DLversion = await this.page.$$eval('script', (scriptLink, localDLurl) => {
                let version = 'NOT USING DESIGN LANGUAGE';

                scriptLink.forEach((scpt) => {
                    const src = scpt.src;
                    if (src !== null) {
                        if (src.indexOf(localDLurl) !== -1) {
                            version =  src.match(new RegExp('v=([0-9].*)'))[0];
                        }
                    }

                });

                return version;

            }, localDLurl);

            try {
                // Collect all the hrefs from the landing page as a starting point.
                await this.collectUrls(this.page);
            }
            catch(err) {
                console.log('Failed to visit: ', this.url, err)
            }

        });
    }

    async collectSelectors(page) {
        await page.$$eval('*', a => {
            const classes = a.getAttribute('class');

            classes.map((selector) => {
                this.setSelector = selector;
            })
        });
    }

    async collectUrls(page) {
        const urls = await page.$$eval('a', (els, thisUrl) => {
            let links = [];
            els.forEach((el) => {
                const href = el.href;

                // If this is in the same domain add it to the array of urls.
                if (href.includes(thisUrl)) {
                    links.push(href);
                }
            });

            return links;
        }, this.url);

        console.log(urls.length);
        console.log(urls);

        urls.map((url) => {
            console.log(url);
            this.setUrls(url);
        });

        return true;
    }

    set setSelector(selector) {
        if (this.DLselectors.includes(selector)) {
            this.result.selectors.match =
                !this.result.selectors.match.contains(selector) ?
                    this.result.selectors.match.push(selector) :
                    this.result.selectors.match;
        }
        else {
            this.result.selectors.not_match =
                !this.result.selectors.not_match.contains(selector) ?
                    this.result.selectors.not_match.push(selector) :
                    this.result.selectors.not_match;
        }
    }

    async setUrls(url) {
        console.log(this.urls);
        console.log(this);
        const newUrl = this.urls.indexOf(url) === -1;
        this.urls = newUrl ? this.urls.push(url) : this.urls;

        if (newUrl) {
            // Start a fresh instance of puppeteer.
            const browser = await puppeteer.launch();
            const page = await browser.newPage();
            const thePage = page.goto(url);

            // Collect classes
            await this.collectSelectors(thePage);

            // Collect urls
            await this.collectUrls(thePage);
        }
    }

    async getDLselectors() {
        let DLselectors = {};
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(this.styleGuide);

        DLselectors = await page.$$eval('*', els => {
            let DLselectors = {};

            els.forEach((el) => {
                let classes = el.getAttribute('class');
                if (classes !== null) {
                    classes = classes.split(' ');
                    classes.forEach((selector) => {
                        DLselectors[selector] = '';
                    });
                }
            });


            return DLselectors;
        });

        console.log(DLselectors);

        this.DLselectors = Object.keys(DLselectors);
    }

    getResult() {
        return this.result;
    }
};
