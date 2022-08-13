async function(a) {
    const documentHtml = document.body.innerHTML.split('\n');
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
        const sText = documentHtml.find(a => a.includes('SuiteCommerce'));
        const strs = sText.split(/]\s+\[/g);
        const keywords = ['prodbundle_id', 'baselabel', 'version', 'datelabel', 'buildno'];
        const map = {};

        strs.forEach(s => {
            keywords.forEach(k => {
                if (s.includes(k)) {
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
                document.body.setAttribute(sObj.key, 'YES')
            } else {
                document.body.setAttribute(sObj.key, 'NO')
            }
        });
    } catch (e) {
        console.log('Error while parsing generic stuff', e);
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
                    if (typeof value === "object") {
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
            appendObjectToDom('perfTiming', flattenedObject[fo], fo, null, `${fo}:${flattenedObject[fo]}`);
        });

        document.body.setAttribute('searchrequest', res.searchrequest);
    } catch (e) {
        console.log('Error while getting search details', e);
    }
}
