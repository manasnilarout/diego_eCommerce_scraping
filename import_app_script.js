async function(a) {
    const documentHtml = document.body.innerHTML.split('\n');

    // Wait for 5 seconds before proceeding
    await new Promise(resolve => setTimeout(resolve, 5000));
    // Scroll to the bottom of the page before scraping
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })

    const appendObjectToDom = (className, value, key, cookie, content) => {
        const d = document.createElement('div');
        d.setAttribute('class', className);
        d.setAttribute('key', key);
        d.setAttribute('value', value);
        d.setAttribute('cookie', cookie && cookie.trim() || '');
        d.setAttribute('content', content);
        document.body.appendChild(d);
    };

    // Parse SuiteCommerce data
    try {
        const sText = documentHtml.find(a => a.includes('SuiteCommerce') && a.trim().startsWith('<!--'));
        const strs = sText.split(/]\s+\[/g);
        const keywords = ['prodbundle_id', 'baselabel', 'version', 'datelabel', 'buildno', 'ns_version'];
        const map = {};

        const envObj = SC.ENVIRONMENT.RELEASE_METADATA;

        strs.forEach(s => {
            keywords.forEach(k => {
                if (envObj && envObj.hasOwnProperty(k)) {
                    map[k] = envObj[k];
                } else if (s.includes(k)) {
                    map[k] = s.match(/[A-Z0-9a-z\._]+/g).pop();
                }
            });
        });

        Object.keys(map).forEach(k => {
            console.log(`Appending ${k} as ${map[k]}`);
            document.body.setAttribute(k, map[k]);
        });
        document.body.setAttribute('sText', sText);

        document.cookie.split(';').forEach(cookie => {
            const cSplit = cookie.split('=');
            appendObjectToDom('cookie', cSplit[0], cSplit[1], cookie);
        });
    } catch (e) {
        console.log('Something went wrong with SuiteCommerce Parsing', e);
    }

    // Parse SeoGenerator content
    try {
        const seoText = documentHtml.find(a => a.includes('SeoGenerator'));
        if (seoText) {
            document.body.setAttribute('seoText', seoText);
            const seoStr = seoText.match(/SeoGenerator:(\w+):(\w+)/g) ? seoText.match(/SeoGenerator:(\w+):(\w+)/g)[0] : '';
            if (seoStr.split(':').pop() === 'Error') {
                document.body.setAttribute('SeoGenerator', seoText);
            } else {
                document.body.setAttribute('SeoGenerator', 'OK');
            }
        } else {
            document.body.setAttribute('SeoGenerator', 'OK');
        }
    } catch (e) {
        console.log('There was an error while getting SeoGenerator data', e);
    }

    // Generic stuff
    try {
        const stringToCheck = [{
            key: 'gotResponseFromPrerender',
            text: 'Got a response from Prerender'
        }, {
            key: 'Governance',
            text: 'The governance null limit was reached'
        }, {
            key: 'SSPAppContext',
            text: 'SSPAppContext'
        }];
        stringToCheck.forEach(sObj => {
            if (documentHtml.find(a => a.toLowerCase().includes(sObj.text.toLowerCase()))) {
                document.body.setAttribute(sObj.key, 'YES');
            } else {
                document.body.setAttribute(sObj.key, 'NO');
            }
        });

        document.body.setAttribute('companyId', window.SC.ENVIRONMENT.companyId);
    } catch (e) {
        console.log('Error while parsing generic stuff', e);
    }

    // Pull console.log elements
    try {
        const debugOP = Array.from(document.body.childNodes).filter(el => el.nodeName === '#comment').find(el => el.textContent.includes('Debug output:'));
        const text = debugOP.textContent;
        const lines = text.split('\n');
        const has404Status = lines.find(l => l.includes('[status 404]') || l.includes('[status 400]'));
        if (has404Status) {
            document.body.setAttribute('SubRequests', 'Not Ok');
        } else {
            document.body.setAttribute('SubRequests', 'OK');
        }

        const allRequests = lines.map(l => l.trim()).filter(l => l.match(/\[status \d{3}\]/g));
        document.body.setAttribute('backgroundRequests', allRequests.join(';'));

        let starsDetected = false;
        let isFirstOccurance = false;
        let isSecondOccurance = false;
        let consoleString = '';
        lines.forEach(l => {
            if (!starsDetected && l.includes('***') && !isSecondOccurance) {
                starsDetected = true;
                isFirstOccurance = true;
            }

            if (starsDetected) {
                consoleString += l + '\n';
                if (l.includes('***') && !isFirstOccurance) {
                    starsDetected = false;
                    isSecondOccurance = true;
                }
            }
        });

        document.body.setAttribute('consoleContent', consoleString);
    } catch (e) {
        console.log('Error while pulling console.log elements', e);
    }

    // Get Item Search details
    try {
        const traverseAndFlatten = (currentNode, target, flattenedKey) => {
            for (var key in currentNode) {
                if (currentNode.hasOwnProperty(key)) {
                    var newKey;
                    if (flattenedKey === undefined) {
                        newKey = key;
                    } else {
                        newKey = flattenedKey + '.' + key;
                    }

                    var value = currentNode[key];
                    if (typeof value === 'object') {
                        traverseAndFlatten(value, target, newKey);
                    } else {
                        target[newKey] = value;
                    }
                }
            }
        };

        const combination = {
            country: SC.ENVIRONMENT.currentLanguage.locale.split('_')[1],
            language: SC.ENVIRONMENT.currentLanguage.locale.split('_')[0],
        }
        const country = SC.ENVIRONMENT.currentHost ? SC.ENVIRONMENT.currentHost.countryCode : SC.ENVIRONMENT.siteSettings.defaultshipcountry;
        const host = SC.ENVIRONMENT.currentHostString;
        const searchTerm = 'black';
        const searchUrl = `https://${host}/api/items?country=${country || combination.country || 'US'}&&fieldset=search&language=${combination.language || 'en'}&limit=10&offset=0&q=${searchTerm}&ssdebug=T`;
        const res = await fetch(searchUrl).then(r => r.json());

        const flattenedObject = {};
        traverseAndFlatten(res.perftiming || {}, flattenedObject);
        Object.keys(flattenedObject).forEach(fo => {
            if (fo === 'sqltime') document.body.setAttribute('sqltime', flattenedObject[fo]);
            appendObjectToDom('perfTiming', flattenedObject[fo], fo, null, `${fo}:${flattenedObject[fo]}`);
        });

        document.body.setAttribute('searchrequest', res.searchrequest);
    } catch (e) {
        console.log('Error while getting search details', e);
    }

    // E-Commerce identifier
    try {
        let shopifyTrue = window.Shopify;
        let suiteCommerce = window.SC;

        if (window.location.protocol.includes('s')) {
            document.body.setAttribute('isHttpS', 'Yes');
        } else {
            document.body.setAttribute('isHttpS', 'No');
        }

        const url = 'https://' + window.location.host.replace('www.', '');
        document.body.setAttribute('cNameTestWithUrl', url);

        await fetch(url)
            .then(res => {
                console.log('FETCH', res);
                document.body.setAttribute('isCNameProperlyMapped', 'Yes');
            })
            .catch(e => {
                console.log('Fetch with https to host without www failed', e);
                document.body.setAttribute('isCNameProperlyMapped', 'No');
            });

        const setECommerceType = (t) => document.body.setAttribute('eCommerceType', t);

        if (shopifyTrue) setECommerceType('Shopify');
        if (suiteCommerce) setECommerceType('NetSuite | SuiteCommerce');
    } catch (e) {
        console.log('Error while identifying e-commerce', e);
    }

    try {
        let isRobotsPagePresent = 'No';
        let isSiteMapLinkPresentInRobotsPage = 'No';
        let sitemapLink = '-';
        let isSitemapLinkFunctional = 'No';
        await fetch('/robots.txt').then(res => res.text()).then(async rt => {
            isRobotsPagePresent = 'Yes';
            if (rt.includes('Sitemap:')) {
                isSiteMapLinkPresentInRobotsPage = 'Yes';
                const regEx = /Sitemap:\s(\w.+)$/g;
                console.log(rt);
                if (regEx.test(rt)) {
                    sitemapLink = rt.match(regEx)[0].replace(regEx, '$1');
                    console.log(`Sitemap link => ${sitemapLink}`);
                    await fetch(sitemapLink).then(r => r.text()).then(r => {
                        isSitemapLinkFunctional = 'Yes';
                    });
                }
            }
        }).finally(() => {
            document.body.setAttribute('isRobotsPagePresent', isRobotsPagePresent);
            document.body.setAttribute('isSiteMapLinkPresentInRobotsPage', isSiteMapLinkPresentInRobotsPage);
            document.body.setAttribute('sitemapLink', sitemapLink);
            document.body.setAttribute('isSitemapLinkFunctional', isSitemapLinkFunctional);
        });
    } catch (err) {
        console.log(`Something went wrong while reading robot details/getting sitemap details.`, err);
    }
}